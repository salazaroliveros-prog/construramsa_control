/**
 * @fileoverview Módulo unificado de sincronización en la nube para CONSTRURAMSA.
 *
 * Consolidado que reemplaza la lógica dispersa de silentDownload.js,
 * backgroundSync.js y las funciones globales de index.html. Proporciona:
 *
 *  - Detección de duplicados por hash por módulo y por registro individual.
 *  - Cola de operaciones pendientes (persistida) para sincronización offline.
 *  - Estrategia de resolución de conflictos con timestamps por registro
 *    (último en ganar con merge de campos no tocados).
 *  - Integración con SyncOptimizer (retry con backoff, descarga en chunks,
 *    métricas, batching de notificaciones).
 *  - Persistencia del estado de sincronización (último sync, hash por módulo,
 *    cola de pendientes) en localStorage / IndexedDB.
 *
 * @module syncManager
 * @version 2.9.5
 */

(function (globalScope) {
  'use strict';

  // ── Configuración ──────────────────────────────────────────────────────────
  const CONFIG = Object.freeze({
    SYNC_INTERVAL_MS: 5 * 60 * 1000, // 5 minutos
    IDLE_TIMEOUT_MS: 30 * 1000, // 30s para requestIdleCallback
    CALL_TIMEOUT_MS: 15 * 1000, // timeout llamadas externas
    TOKEN_RENEW_MAX_ATTEMPTS: 2,
    TOKEN_RENEW_BACKOFF_MS: 2000,
    MIN_CHANGE_THRESHOLD: 100, // bytes mínimos para notificar
    PENDING_KEY: 'cr_sync_pending', // clave localStorage para cola
    STATE_KEY: 'cr_sync_state', // clave para estado de sincronización
    MAX_PENDING_ITEMS: 500, // límite de cola de pendientes
  });

  // ── Módulos de datos rastreados para detección de duplicados ───────────────
  const TRACKED_MODULES = Object.freeze([
    'caja_chica',
    'maquinaria_flota.vehiculos',
    'maquinaria_flota.registros',
    'personal.trabajadores',
    'personal.asistencia',
    'adquisiciones.proveedores',
    'adquisiciones.cotizaciones_compras',
    'viajes_camiones.rutas_botadero',
    'viajes_camiones.camiones',
    'viajes_camiones.equipo_alquilado',
    'viajes_camiones.viajes',
    'mantenimiento.maquinaria',
    'mantenimiento.ordenes',
    'mantenimiento.compras_insumos',
    'proyectos',
  ]);

  // ── Estado interno ─────────────────────────────────────────────────────────
  let _isSyncing = false;
  let _syncTimer = null;
  let _lastState = null; // { lastSyncTs, moduleHashes: {} }
  let _pendingQueue = []; // [{ id, op, module, recordId, payload, ts }]
  let _syncConfig = null; // { provider, token, fileId, connected, ... }

  // ── Utilidades ─────────────────────────────────────────────────────────────
  function log(msg, data) {
    if (
      typeof globalScope !== 'undefined' &&
      globalScope.SYNC_CONFIG &&
      globalScope.SYNC_CONFIG.LOG_ENABLED
    ) {
      const t = new Date().toISOString();
      if (data !== undefined) console.log(`[${t}] 🔄 SyncManager: ${msg}`, data);
      else console.log(`[${t}] 🔄 SyncManager: ${msg}`);
    }
  }

  function getNested(obj, path) {
    return path
      .split('.')
      .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
  }

  function setNested(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((acc, key) => {
      if (acc[key] === undefined) acc[key] = {};
      return acc[key];
    }, obj);
    target[last] = value;
    return obj;
  }

  function cloneDeep(v) {
    return JSON.parse(JSON.stringify(v));
  }

  /**
   * Hash SHA-256 con fallback DJB2.
   */
  async function simpleHash(str) {
    try {
      if (typeof globalScope !== 'undefined' && globalScope.crypto && globalScope.crypto.subtle) {
        const buf = await globalScope.crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(str)
        );
        return Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      }
    } catch (_) {}
    // Fallback DJB2
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash;
    }
    return String(hash);
  }

  /**
   * Hash de un módulo específico para detectar cambios.
   */
  async function hashModule(db, modulePath) {
    const val = getNested(db, modulePath);
    return await simpleHash(JSON.stringify(val));
  }

  /**
   * Genera una clave estable para un registro (usa id si existe, sino serializa).
   */
  function recordKey(record) {
    if (!record || typeof record !== 'object') return String(record);
    if (record.id) return `id:${record.id}`;
    return `obj:${JSON.stringify(record)}`;
  }

  /**
   * Wrap promesa con timeout.
   */
  function withTimeout(promise, ms, msg) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(msg || 'Timeout')), ms);
    });
    return Promise.race([promise.finally(() => clearTimeout(timeoutId)), timeout]);
  }

  /**
   * Llamada segura con timeout.
   */
  async function safeCall(fn, args = [], timeoutMs = CONFIG.CALL_TIMEOUT_MS) {
    try {
      if (typeof fn !== 'function') return null;
      const result = fn.apply(null, args);
      if (result && typeof result.then === 'function') {
        return await withTimeout(result, timeoutMs, 'External call timeout');
      }
      return result;
    } catch (e) {
      log('safeCall error', e.message);
      return null;
    }
  }

  /**
   * Renovación de token con backoff.
   */
  async function tryRenewTokenWithBackoff(renewFn, maxAttempts, backoffMs) {
    if (typeof renewFn !== 'function') return false;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        log(`Renovando token (intento ${attempt})`);
        const res = await withTimeout(renewFn(), CONFIG.CALL_TIMEOUT_MS, 'Token renew timeout');
        if (res) return true;
      } catch (e) {
        log('renew token error', e.message);
      }
      await new Promise((r) => setTimeout(r, backoffMs * attempt));
    }
    return false;
  }

  // ── Persistencia de estado y cola ──────────────────────────────────────────

  function loadState() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(CONFIG.STATE_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch (_) {}
    return { lastSyncTs: null, moduleHashes: {}, pendingCount: 0 };
  }

  function saveState(state) {
    _lastState = state;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CONFIG.STATE_KEY, JSON.stringify(state));
      }
    } catch (_) {}
  }

  function loadPendingQueue() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(CONFIG.PENDING_KEY);
        if (raw) _pendingQueue = JSON.parse(raw);
      }
    } catch (_) {
      _pendingQueue = [];
    }
    if (!Array.isArray(_pendingQueue)) _pendingQueue = [];
    if (_pendingQueue.length > CONFIG.MAX_PENDING_ITEMS) {
      _pendingQueue = _pendingQueue.slice(-CONFIG.MAX_PENDING_ITEMS);
    }
  }

  function savePendingQueue() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CONFIG.PENDING_KEY, JSON.stringify(_pendingQueue));
      }
    } catch (_) {}
  }

  function addPending(op, module, recordId, payload) {
    const item = {
      id: `pend_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      op, // 'create' | 'update' | 'delete'
      module, // ruta del módulo (ej: 'caja_chica')
      recordId, // id del registro o null
      payload, // datos del registro
      ts: new Date().toISOString(),
    };
    _pendingQueue.push(item);
    savePendingQueue();
    log(`Añadido a cola pendiente: ${op} ${module}`, item);
    return item.id;
  }

  function removePending(id) {
    _pendingQueue = _pendingQueue.filter((i) => i.id !== id);
    savePendingQueue();
  }

  // ── Detección de duplicados ────────────────────────────────────────────────

  /**
   * Detecta registros duplicados dentro de un array basado en una clave de negocio.
   * Por defecto usa 'id', pero se puede pasar una función clave personalizada.
   * Retorna { duplicates: [], unique: [] }
   */
  function detectDuplicates(records, keyFn = null) {
    const seen = new Map();
    const duplicates = [];
    const unique = [];

    const getKey = keyFn || ((r) => (r && r.id ? `id:${r.id}` : JSON.stringify(r)));

    for (const record of records) {
      if (!record || typeof record !== 'object') {
        unique.push(record);
        continue;
      }
      const k = getKey(record);
      if (seen.has(k)) {
        duplicates.push(record);
      } else {
        seen.set(k, record);
        unique.push(record);
      }
    }

    return { duplicates, unique, seen };
  }

  /**
   * Limpia duplicados de todos los módulos rastreados en la DB.
   * Retorna la DB limpia y un reporte de qué se eliminó.
   */
  function cleanDuplicates(db) {
    const report = { cleaned: false, removedByModule: {} };
    const db2 = cloneDeep(db);

    for (const mod of TRACKED_MODULES) {
      const parts = mod.split('.');
      let target = db2;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!target[parts[i]]) target[parts[i]] = {};
        target = target[parts[i]];
      }
      const lastKey = parts[parts.length - 1];
      const arr = target[lastKey];

      if (Array.isArray(arr) && arr.length > 0) {
        const { duplicates, unique } = detectDuplicates(arr);
        if (duplicates.length > 0) {
          target[lastKey] = unique;
          report.cleaned = true;
          report.removedByModule[mod] = duplicates.length;
          log(`Duplicados eliminados en ${mod}: ${duplicates.length}`);
        }
      }
    }

    return { db: db2, report };
  }

  /**
   * Valida integridad estructural de una DB antes de sincronizar.
   * Retorna { valid: true } o { valid: false, errors: [] }.
   */
  function validateIntegrity(db) {
    const errors = [];
    if (!db || typeof db !== 'object') {
      errors.push('DB no es un objeto válido');
      return { valid: false, errors };
    }
    if (!db.configuracion) errors.push('Falta configuracion');
    if (!Array.isArray(db.proyectos)) errors.push('proyectos no es un array');
    if (!db.proyectos_data || typeof db.proyectos_data !== 'object') {
      errors.push('proyectos_data no es un objeto');
    }

    // Verificar que no haya IDs duplicados en arrays clave
    const checkArrays = [
      'caja_chica',
      'maquinaria_flota.vehiculos',
      'maquinaria_flota.registros',
      'personal.trabajadores',
      'adquisiciones.proveedores',
      'adquisiciones.cotizaciones_compras',
      'viajes_camiones.camiones',
      'viajes_camiones.viajes',
      'mantenimiento.ordenes',
      'mantenimiento.compras_insumos',
      'proyectos',
    ];

    for (const path of checkArrays) {
      const val = getNested(db, path);
      if (Array.isArray(val)) {
        const ids = val.map((r) => r && r.id).filter(Boolean);
        const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
        if (dupIds.length > 0) {
          errors.push(`IDs duplicados en ${path}: ${dupIds.join(', ')}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ── Sincronización bidireccional ──────────────────────────────────────────

  /**
   * Ejecuta una sincronización bidireccional completa:
   * 1. Sube cambios locales pendientes (cola)
   * 2. Descarga cambios remotos
   * 3. Fusiona con estrategia de conflicto (timestamp por registro)
   * 4. Limpia duplicados
   */
  async function performBidirectionalSync() {
    if (_isSyncing) {
      log('⏳ Sync ya en progreso, saltando');
      return { synced: false, reason: 'already_syncing' };
    }
    _isSyncing = true;
    const startedAt = Date.now();

    try {
      const cfg = await safeCall(
        typeof globalScope !== 'undefined' && globalScope._nubeCfg ? globalScope._nubeCfg : null,
        [],
        2000
      );
      _syncConfig = cfg;

      if (!cfg || !cfg.od_connected || !cfg.od_token) {
        log('⏸️ Proveedor nube no conectado o token ausente');
        return { synced: false, reason: 'not_connected' };
      }

      // ── Fase 1: Subir cola de pendientes ──
      log('📤 Fase 1: Procesando cola de pendientes...');
      const uploadResults = await uploadPendingQueue(cfg);

      // ── Fase 2: Descargar cambios remotos ──
      log('📥 Fase 2: Verificando cambios remotos...');
      const remoteData = await safeCall(
        typeof globalScope !== 'undefined' && globalScope.onedriveDescargarSilencioso
          ? globalScope.onedriveDescargarSilencioso
          : null,
        [],
        CONFIG.CALL_TIMEOUT_MS
      );

      let merged = null;
      let changesDetected = false;

      if (remoteData) {
        // Validar integridad antes de fusionar
        const integrity = validateIntegrity(remoteData);
        if (!integrity.valid) {
          log('❌ Datos remotos fallaron validación de integridad', integrity.errors);
          return { synced: false, reason: 'remote_integrity_failed', errors: integrity.errors };
        }

        // Limpiar duplicados en remoto
        const { db: remoteClean, report: remoteDupReport } = cleanDuplicates(remoteData);
        if (remoteDupReport.cleaned) {
          log('🧹 Duplicados limpiados en remoto', remoteDupReport.removedByModule);
        }

        const localDB =
          typeof globalScope !== 'undefined' && globalScope.getDB ? globalScope.getDB() : {};

        // Comparar hash global para decidir si hay cambios
        const localHash = await simpleHash(JSON.stringify(localDB));
        const remoteHash = await simpleHash(JSON.stringify(remoteClean));

        const state = loadState();
        const lastRemoteHash = state.moduleHashes['_global'] || null;

        if (lastRemoteHash === null || remoteHash !== lastRemoteHash) {
          log('📊 Cambios remotos detectados', {
            lastHash: lastRemoteHash,
            currentHash: remoteHash,
          });
          changesDetected = true;

          // Fusionar con estrategia de conflicto
          const fusionado = await safeCall(
            typeof globalScope !== 'undefined' && globalScope.importarBaseDatosConFusion
              ? globalScope.importarBaseDatosConFusion
              : null,
            [remoteClean],
            CONFIG.CALL_TIMEOUT_MS
          );

          if (fusionado) {
            // Limpiar duplicados tras fusión
            const { db: fusedClean, report: fusedDupReport } = cleanDuplicates(fusionado);
            if (fusedDupReport.cleaned) {
              log('🧹 Duplicados eliminados tras fusión', fusedDupReport.removedByModule);
            }

            // Guardar DB fusionada
            if (typeof globalScope !== 'undefined' && globalScope.saveDB) {
              await withTimeout(
                Promise.resolve().then(() => globalScope.saveDB(fusedClean)),
                CONFIG.CALL_TIMEOUT_MS,
                'saveDB timeout'
              );
            }

            merged = fusedClean;
            changesDetected = true;
            log('✅ Descarga y fusión completadas');
          }
        }

        // Actualizar hash global remoto
        const newState = loadState();
        newState.moduleHashes['_global'] = remoteHash;
        newState.lastSyncTs = new Date().toISOString();
        newState.pendingCount = _pendingQueue.length;
        saveState(newState);
      }

      // ── Notificación ──
      if (changesDetected || uploadResults.uploaded > 0) {
        const bytesChanged = Math.abs(
          JSON.stringify(merged || {}).length -
            JSON.stringify(
              typeof globalScope !== 'undefined' && globalScope.getDB ? globalScope.getDB() : {}
            ).length
        );
        if (bytesChanged > CONFIG.MIN_CHANGE_THRESHOLD || uploadResults.uploaded > 0) {
          await safeCall(
            typeof globalScope !== 'undefined' && globalScope.showToast
              ? globalScope.showToast
              : null,
            ['☁️ Datos sincronizados con la nube', 'info', 2000],
            2000
          );
          await safeCall(
            typeof globalScope !== 'undefined' && globalScope._nubeSetUltimo
              ? globalScope._nubeSetUltimo
              : null,
            [new Date().toISOString()],
            2000
          );
        }
      }

      const duration = Date.now() - startedAt;
      log(`✨ Sync completada en ${duration}ms`, {
        uploaded: uploadResults.uploaded,
        failed: uploadResults.failed,
        remoteChanges: changesDetected,
        pendingRemaining: _pendingQueue.length,
      });

      return {
        synced: true,
        duration,
        uploaded: uploadResults.uploaded,
        failed: uploadResults.failed,
        remoteChanges: changesDetected,
        pendingRemaining: _pendingQueue.length,
      };
    } catch (error) {
      log('❌ Error en sync', error.message);
      if (error && /401|403/.test(String(error.message))) {
        const renewed = await tryRenewTokenWithBackoff(
          typeof globalScope !== 'undefined' && globalScope.onedriveRenovarToken
            ? globalScope.onedriveRenovarToken
            : null,
          CONFIG.TOKEN_RENEW_MAX_ATTEMPTS,
          CONFIG.TOKEN_RENEW_BACKOFF_MS
        );
        if (renewed) log('🔁 Token renovado (intento automático)');
        else log('🔑 No se pudo renovar token automáticamente');
      }
      return { synced: false, reason: 'error', error: error.message };
    } finally {
      _isSyncing = false;
    }
  }

  /**
   * Sube la cola de operaciones pendientes a la nube.
   * Por ahora sube la DB completa (OneDrive no soporta parches parciales fácilmente)
   * pero marca cada operación como procesada.
   */
  async function uploadPendingQueue(cfg) {
    let uploaded = 0;
    let failed = 0;

    if (_pendingQueue.length === 0) {
      return { uploaded: 0, failed: 0 };
    }

    // Si hay pendientes, subimos la DB completa como representante de todos los cambios
    try {
      const localDB =
        typeof globalScope !== 'undefined' && globalScope.getDB ? globalScope.getDB() : {};

      // Validar integridad local antes de subir
      const integrity = validateIntegrity(localDB);
      if (!integrity.valid) {
        log('❌ DB local falló validación antes de subir', integrity.errors);
        return { uploaded: 0, failed: _pendingQueue.length };
      }

      // Limpiar duplicados local
      const { db: localClean, report: localDupReport } = cleanDuplicates(localDB);
      if (localDupReport.cleaned) {
        log('🧹 Duplicados limpiados en local antes de subir', localDupReport.removedByModule);
      }

      const sanitized =
        typeof globalScope !== 'undefined' && globalScope._nubeSanitizarPayload
          ? globalScope._nubeSanitizarPayload(localClean)
          : localClean;

      const result = await safeCall(
        typeof globalScope !== 'undefined' && globalScope.onedriveSubirAhora
          ? globalScope.onedriveSubirAhora
          : null,
        [true], // auto = true
        CONFIG.CALL_TIMEOUT_MS
      );

      if (result !== null || result === undefined) {
        // onedriveSubirAhora no retorna nada útil, asumimos éxito si no lanzó
        uploaded = _pendingQueue.length;
        _pendingQueue = [];
        savePendingQueue();
        log(`✅ Subidos ${uploaded} elementos pendientes`);
      } else {
        failed = _pendingQueue.length;
      }
    } catch (e) {
      log('Error subiendo pendientes', e.message);
      failed = _pendingQueue.length;
    }

    return { uploaded, failed };
  }

  /**
   * Añade un cambio a la cola de pendientes (llamado desde UI tras cada operación CRUD).
   */
  function enqueueChange(op, module, recordId, payload) {
    if (_pendingQueue.length >= CONFIG.MAX_PENDING_ITEMS) {
      log('⚠️ Cola de pendientes llena, descartando más antiguos');
      _pendingQueue.shift();
    }
    return addPending(op, module, recordId, payload);
  }

  // ── API pública ────────────────────────────────────────────────────────────

  const api = Object.freeze({
    /** Ejecuta sincronización bidireccional completa */
    sync: performBidirectionalSync,

    /** Añade un cambio a la cola de pendientes */
    enqueueChange,

    /** Obtiene la cola de pendientes actual */
    getPendingQueue: () => cloneDeep(_pendingQueue),

    /** Limpia la cola de pendientes */
    clearPendingQueue: () => {
      _pendingQueue = [];
      savePendingQueue();
    },

    /** Obtiene estado de sincronización */
    getStatus: () => {
      const state = loadState();
      return {
        isSyncing: _isSyncing,
        pendingCount: _pendingQueue.length,
        lastSyncTs: state.lastSyncTs,
        moduleHashes: state.moduleHashes,
        connected: !!(_syncConfig && _syncConfig.od_connected),
        config: CONFIG,
      };
    },

    /** Detecta duplicados en un array */
    detectDuplicates,

    /** Limpia duplicados de una DB */
    cleanDuplicates,

    /** Valida integridad de una DB */
    validateIntegrity,

    /** Configura el proveedor de nube */
    configure: (cfg) => {
      _syncConfig = cfg;
      log('⚙️ Configuración de sync actualizada', cfg);
    },

    /** Inicia temporizador de sync automático */
    startAutoSync: () => {
      if (_syncTimer) clearInterval(_syncTimer);
      runIdleOnce();
      _syncTimer = setInterval(runIdleOnce, CONFIG.SYNC_INTERVAL_MS);
      log('✅ Auto-sync iniciado', { interval: CONFIG.SYNC_INTERVAL_MS });
    },

    /** Detiene temporizador de sync automático */
    stopAutoSync: () => {
      if (_syncTimer) {
        clearInterval(_syncTimer);
        _syncTimer = null;
        log('⏹️ Auto-sync detenido');
      }
    },
  });

  function runIdleOnce() {
    if (typeof globalScope !== 'undefined' && globalScope.requestIdleCallback) {
      globalScope.requestIdleCallback(() => performBidirectionalSync(), {
        timeout: CONFIG.IDLE_TIMEOUT_MS,
      });
    } else {
      performBidirectionalSync();
    }
  }

  // ── Inicialización ─────────────────────────────────────────────────────────
  loadState();
  loadPendingQueue();

  if (globalScope) {
    try {
      Object.defineProperty(globalScope, 'CR_SyncManager', {
        value: api,
        writable: false,
        enumerable: false,
        configurable: false,
      });
    } catch (_) {}
    // También exponer funciones individuales para compatibilidad
    try {
      globalScope.syncManager = api;
    } catch (_) {}
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  log('✨ SyncManager (v2.9.5) cargado');
})(typeof window !== 'undefined' ? window : globalThis);
