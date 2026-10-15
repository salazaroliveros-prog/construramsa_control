/*
 * Background Synchronization Module — hardened
 * - Más defensas contra funciones globales faltantes
 * - Timeouts para llamadas externas (evitar hangs)
 * - Backoff limitado para renovación de token
 * - Uso de globalScope en lugar de `self` cuando corresponde
 * - Logging controlado por SYNC_CONFIG.LOG_ENABLED (no consola por defecto)
 */
(function (globalScope) {
  'use strict';

  const SYNC_CONFIG = {
    SYNC_INTERVAL: 5 * 60 * 1000, // 5 minutos
    IDLE_TIMEOUT: 30 * 1000, // 30s
    MIN_CHANGE_THRESHOLD: 100, // bytes
    LOG_ENABLED: false,
    CALL_TIMEOUT: 15 * 1000, // timeout para llamadas a APIs externas (ms)
    TOKEN_RENEW_MAX_ATTEMPTS: 2,
    TOKEN_RENEW_BACKOFF_MS: 2000,
  };

  let _syncTimerId = null;
  let _isSyncingNow = false;
  let _lastSyncHash = null;

  function log(msg, data = null) {
    if (!SYNC_CONFIG.LOG_ENABLED) return;
    const time = new Date().toISOString();
    if (data !== null) console.log(`[${time}] 🔄 BgSync: ${msg}`, data);
    else console.log(`[${time}] 🔄 BgSync: ${msg}`);
  }

  // Env-safe access to crypto.subtle
  const subtleCrypto = (globalScope && globalScope.crypto && globalScope.crypto.subtle) || null;

  async function simpleHash(obj) {
    try {
      const str = JSON.stringify(obj);
      if (subtleCrypto) {
        const buf = await subtleCrypto.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      }
      // fallback 32-bit
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash = hash & hash;
      }
      return String(hash);
    } catch (e) {
      log('simpleHash error', e.message);
      return String(Date.now());
    }
  }

  // Wrap a promise with timeout
  function withTimeout(promise, ms, onTimeoutMessage) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(onTimeoutMessage || 'Timeout')), ms);
    });
    return Promise.race([promise.finally(() => clearTimeout(timeoutId)), timeout]);
  }

  // Safe call helper: if fn missing, return null; call with timeout
  async function safeCall(fn, args = [], timeoutMs = SYNC_CONFIG.CALL_TIMEOUT) {
    try {
      if (typeof fn !== 'function') return null;
      const result = fn.apply(null, args);
      // If returns a promise, race with timeout
      if (result && typeof result.then === 'function') {
        return await withTimeout(result, timeoutMs, 'External call timeout');
      }
      return result;
    } catch (e) {
      log('safeCall error', e.message);
      return null;
    }
  }

  async function tryRenewTokenWithBackoff(renewFn, maxAttempts, backoffMs) {
    if (typeof renewFn !== 'function') return false;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        log(`Intentando renovar token (intent ${attempt})`);
        const res = await withTimeout(renewFn(), SYNC_CONFIG.CALL_TIMEOUT, 'Token renew timeout');
        // Consider success if function returns truthy
        if (res) return true;
      } catch (e) {
        log('renew token error', e.message);
      }
      // backoff before retry
      await new Promise((r) => setTimeout(r, backoffMs * attempt));
    }
    return false;
  }

  function runInIdle(callback) {
    try {
      if (globalScope && 'requestIdleCallback' in globalScope) {
        globalScope.requestIdleCallback(
          () => {
            log('Ejecutando en idle');
            callback();
          },
          { timeout: SYNC_CONFIG.IDLE_TIMEOUT }
        );
      } else {
        setTimeout(() => {
          log('Ejecutando con setTimeout fallback');
          callback();
        }, 100);
      }
    } catch (e) {
      // If something goes wrong, still attempt without idle
      try {
        setTimeout(() => callback(), 100);
      } catch (_) {}
    }
  }

  async function performBidirectionalSync() {
    if (_isSyncingNow) {
      log('⏳ Sync ya en progreso, saltando');
      return;
    }
    _isSyncingNow = true;

    try {
      // Safely obtain nube config
      const cfg =
        typeof globalScope._nubeCfg === 'function'
          ? safeCall(globalScope._nubeCfg, [], 2000)
          : null;
      const resolvedCfg = cfg instanceof Promise ? await cfg : cfg; // safeCall may return promise

      if (!resolvedCfg) {
        log('❌ _nubeCfg no disponible o no resolvió');
        return;
      }

      if (!resolvedCfg.od_connected || !resolvedCfg.od_token) {
        log('⏸️ Proveedor nube no conectado o token ausente');
        return;
      }

      // Phase 1: check local changes
      log('📤 Fase 1: Verificando cambios locales...');
      let localDB = {};
      try {
        localDB = typeof globalScope.getDB === 'function' ? globalScope.getDB() : {};
      } catch (e) {
        log('getDB error', e.message);
      }
      const localHash = await simpleHash(localDB || {});

      if (_lastSyncHash === null || _lastSyncHash !== localHash) {
        log('📊 Cambios locales detectados', { lastHash: _lastSyncHash, currentHash: localHash });
        // Try to upload (automatically) with timeout
        await safeCall(globalScope.onedriveSubirAhora, [true], SYNC_CONFIG.CALL_TIMEOUT).catch(
          (_) => log('onedriveSubirAhora failed or timed out')
        );
      }

      // Phase 2: download remote if exists
      log('📥 Fase 2: Verificando cambios remotos...');
      const remoteData = await safeCall(
        globalScope.onedriveDescargarSilencioso,
        [],
        SYNC_CONFIG.CALL_TIMEOUT
      );

      if (remoteData) {
        const remoteHash = await simpleHash(remoteData);
        if (_lastSyncHash === null || remoteHash !== localHash) {
          log('📊 Cambios remotos detectados', { remoteHash, localHash });

          const fusionado = await safeCall(
            globalScope.importarBaseDatosConFusion,
            [remoteData],
            SYNC_CONFIG.CALL_TIMEOUT
          );

          if (fusionado && typeof globalScope.saveDB === 'function') {
            try {
              // Ensure saveDB does not hang
              await withTimeout(
                Promise.resolve().then(() => globalScope.saveDB(fusionado)),
                SYNC_CONFIG.CALL_TIMEOUT,
                'saveDB timeout'
              );
              log('✅ Descarga y fusión completadas');

              // Small notification if changes significant
              const bytesChanged = Math.abs(
                JSON.stringify(fusionado).length - JSON.stringify(localDB || {}).length
              );
              if (bytesChanged > SYNC_CONFIG.MIN_CHANGE_THRESHOLD) {
                await safeCall(
                  globalScope.showToast,
                  ['☁️ Datos sincronizados', 'info', 2000],
                  2000
                );
                // update last sync timestamp
                await safeCall(globalScope._nubeSetUltimo, [new Date().toISOString()], 2000);
              }
            } catch (e) {
              log('Error saving fused DB', e.message);
            }
          }
        }
      } else {
        log('ℹ️ Sin cambios remotos o descarga silenciosa devolvió null');
      }

      _lastSyncHash = localHash;
    } catch (error) {
      log('❌ Error en sync', error.message);
      // If auth error, attempt to renew token but limit attempts
      if (error && /401|403/.test(String(error.message))) {
        const renewed = await tryRenewTokenWithBackoff(
          globalScope.onedriveRenovarToken,
          SYNC_CONFIG.TOKEN_RENEW_MAX_ATTEMPTS,
          SYNC_CONFIG.TOKEN_RENEW_BACKOFF_MS
        );
        if (renewed) log('🔁 Token renovado (intento automático)');
        else log('🔑 No se pudo renovar token automáticamente');
      }
    } finally {
      _isSyncingNow = false;
      log('✨ Sync completada');
    }
  }

  function startBackgroundSync() {
    log('🚀 Iniciando background sync');
    if (_syncTimerId) clearInterval(_syncTimerId);
    runInIdle(performBidirectionalSync);
    _syncTimerId = setInterval(
      () => runInIdle(performBidirectionalSync),
      SYNC_CONFIG.SYNC_INTERVAL
    );
    log('✅ Background sync iniciado', { interval: SYNC_CONFIG.SYNC_INTERVAL });
  }

  function stopBackgroundSync() {
    if (_syncTimerId) {
      clearInterval(_syncTimerId);
      _syncTimerId = null;
      log('⏹️ Background sync detenido');
    }
  }

  function getBackgroundSyncStatus() {
    return {
      enabled: _syncTimerId !== null,
      isSyncing: _isSyncingNow,
      lastSyncHash: _lastSyncHash,
      config: SYNC_CONFIG,
    };
  }

  function configureBackgroundSync(options) {
    Object.assign(SYNC_CONFIG, options || {});
    log('⚙️ Configuración actualizada', SYNC_CONFIG);
  }

  const api = Object.freeze({
    start: startBackgroundSync,
    stop: stopBackgroundSync,
    status: getBackgroundSyncStatus,
    configure: configureBackgroundSync,
  });

  if (globalScope) {
    globalScope.startBackgroundSync = startBackgroundSync;
    globalScope.stopBackgroundSync = stopBackgroundSync;
    globalScope.getBackgroundSyncStatus = getBackgroundSyncStatus;
    globalScope.configureBackgroundSync = configureBackgroundSync;
    try {
      Object.defineProperty(globalScope, 'CR_BackgroundSync', {
        value: api,
        writable: false,
        enumerable: false,
        configurable: false,
      });
    } catch (e) {
      /* entornos restringidos */
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  log('✨ backgroundSync.js (hardened) cargado');
})(typeof window !== 'undefined' ? window : globalThis);
