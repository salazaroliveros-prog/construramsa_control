/*
 * backgroundSync.js — Wrapper refactorizado sobre CR_SyncManager.
 *
 * Mantiene la API pública global (startBackgroundSync, stopBackgroundSync,
 * getBackgroundSyncStatus, configureBackgroundSync) para compatibilidad con
 * index.html, pero toda la lógica de sincronización bidireccional, detección
 * de duplicados, cola de pendientes y estrategia de conflicto reside ahora en
 * src/syncManager.js.
 *
 * @module backgroundSync
 */

(function (globalScope) {
  'use strict';

  const SYNC_CONFIG = Object.freeze({
    SYNC_INTERVAL: 5 * 60 * 1000, // 5 minutos
    IDLE_TIMEOUT: 30 * 1000, // 30s
    MIN_CHANGE_THRESHOLD: 100,
    CALL_TIMEOUT: 15 * 1000,
    TOKEN_RENEW_MAX_ATTEMPTS: 2,
    TOKEN_RENEW_BACKOFF_MS: 2000,
  });

  let _syncTimerId = null;
  let _isSyncingNow = false;
  let _lastSyncHash = null;

  function log(msg, data = null) {
    // Logging controlado por SYNC_CONFIG.LOG_ENABLED (definido en index.html)
    const cfg = (typeof globalScope !== 'undefined' && globalScope.SYNC_CONFIG) || {};
    if (!cfg.LOG_ENABLED) return;
    const time = new Date().toISOString();
    if (data !== null) console.log(`[${time}] 🔄 BgSync: ${msg}`, data);
    else console.log(`[${time}] 🔄 BgSync: ${msg}`);
  }

  function withTimeout(promise, ms, onTimeoutMessage) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(onTimeoutMessage || 'Timeout')), ms);
    });
    return Promise.race([promise.finally(() => clearTimeout(timeoutId)), timeout]);
  }

  async function safeCall(fn, args = [], timeoutMs = SYNC_CONFIG.CALL_TIMEOUT) {
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

  async function tryRenewTokenWithBackoff(renewFn, maxAttempts, backoffMs) {
    if (typeof renewFn !== 'function') return false;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        log(`Intentando renovar token (intento ${attempt})`);
        const res = await withTimeout(renewFn(), SYNC_CONFIG.CALL_TIMEOUT, 'Token renew timeout');
        if (res) return true;
      } catch (e) {
        log('renew token error', e.message);
      }
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
      try {
        setTimeout(() => callback(), 100);
      } catch (_) {
        // The scheduler fallback is best-effort only.
      }
    }
  }

  /**
   * Ejecuta una sincronización bidireccional delegando en CR_SyncManager.
   * Mantiene compatibilidad con el flujo existente de index.html.
   */
  async function performBidirectionalSync() {
    if (_isSyncingNow) {
      log('⏳ Sync ya en progreso, saltando');
      return;
    }
    _isSyncingNow = true;

    try {
      const sm =
        typeof globalScope !== 'undefined' && globalScope.CR_SyncManager
          ? globalScope.CR_SyncManager
          : null;

      if (!sm) {
        log('❌ CR_SyncManager no disponible');
        return;
      }

      // Ejecutar sync bidireccional completa (sube pendientes, baja remotos,
      // fusiona con estrategia de conflicto, limpia duplicados).
      const result = await sm.sync();

      // Mantener _lastSyncHash para compatibilidad con código legacy
      const status = sm.getStatus();
      _lastSyncHash = status.lastSyncTs;

      if (result && result.synced) {
        log('✨ Sync completada vía SyncManager', {
          duration: result.duration,
          uploaded: result.uploaded,
          failed: result.failed,
          remoteChanges: result.remoteChanges,
          pendingRemaining: result.pendingRemaining,
        });

        // Notificar si hubo cambios significativos
        const bytesChanged = Math.abs(JSON.stringify(result.remoteChanges ? {} : {}).length - 0);
        if (
          (result.uploaded > 0 || result.remoteChanges) &&
          typeof globalScope.showToast === 'function'
        ) {
          globalScope.showToast('☁️ Datos sincronizados', 'info', 2000);
        }
        if (typeof globalScope._nubeSetUltimo === 'function') {
          globalScope._nubeSetUltimo(new Date().toISOString());
        }
      } else if (result && !result.synced) {
        log('⏸️ Sync no realizada', { reason: result.reason });
        if (result.error && /401|403/.test(String(result.error))) {
          const renewed = await tryRenewTokenWithBackoff(
            typeof globalScope.onedriveRenovarToken === 'function'
              ? globalScope.onedriveRenovarToken
              : null,
            SYNC_CONFIG.TOKEN_RENEW_MAX_ATTEMPTS,
            SYNC_CONFIG.TOKEN_RENEW_BACKOFF_MS
          );
          if (renewed) log('🔁 Token renovado (intento automático)');
          else log('🔑 No se pudo renovar token automáticamente');
        }
      }
    } catch (error) {
      log('❌ Error en sync', error.message);
      if (error && /401|403/.test(String(error.message))) {
        const renewed = await tryRenewTokenWithBackoff(
          typeof globalScope.onedriveRenovarToken === 'function'
            ? globalScope.onedriveRenovarToken
            : null,
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
    // Delegar también al auto-sync de SyncManager si existe
    const sm =
      typeof globalScope !== 'undefined' && globalScope.CR_SyncManager
        ? globalScope.CR_SyncManager
        : null;
    if (sm && typeof sm.startAutoSync === 'function') {
      sm.startAutoSync();
    }
    log('✅ Background sync iniciado', { interval: SYNC_CONFIG.SYNC_INTERVAL });
  }

  function stopBackgroundSync() {
    if (_syncTimerId) {
      clearInterval(_syncTimerId);
      _syncTimerId = null;
      log('⏹️ Background sync detenido');
    }
    const sm =
      typeof globalScope !== 'undefined' && globalScope.CR_SyncManager
        ? globalScope.CR_SyncManager
        : null;
    if (sm && typeof sm.stopAutoSync === 'function') {
      sm.stopAutoSync();
    }
  }

  function getBackgroundSyncStatus() {
    const sm =
      typeof globalScope !== 'undefined' && globalScope.CR_SyncManager
        ? globalScope.CR_SyncManager
        : null;
    if (sm) {
      const smStatus = sm.getStatus();
      return {
        enabled: _syncTimerId !== null,
        isSyncing: _isSyncingNow || smStatus.isSyncing,
        lastSyncHash: _lastSyncHash,
        pendingCount: smStatus.pendingCount,
        connected: smStatus.connected,
        config: SYNC_CONFIG,
      };
    }
    return {
      enabled: _syncTimerId !== null,
      isSyncing: _isSyncingNow,
      lastSyncHash: _lastSyncHash,
      pendingCount: 0,
      connected: false,
      config: SYNC_CONFIG,
    };
  }

  function configureBackgroundSync(options) {
    log('⚙️ Configuración actualizada', options);
    const sm =
      typeof globalScope !== 'undefined' && globalScope.CR_SyncManager
        ? globalScope.CR_SyncManager
        : null;
    if (sm && typeof sm.configure === 'function') {
      sm.configure(options || {});
    }
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

  log('✨ backgroundSync.js (refactorizado sobre SyncManager) cargado');
})(typeof window !== 'undefined' ? window : globalThis);
