/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║   Background Synchronization Module                          ║
 * ║   Sincronización silenciosa de datos con OneDrive             ║
 * ║   No bloquea la UI, usa requestIdleCallback, completamente    ║
 * ║   no-intrusivo                                                ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

(function() {
    'use strict';

    /**
     * Configuración de sincronización en background
     * - SYNC_INTERVAL: Cada cuánto sincronizar (ms)
     * - IDLE_TIMEOUT: Máximo tiempo de espera para requestIdleCallback (ms)
     * - MIN_CHANGE_THRESHOLD: Cambios mínimos para notificar al usuario
     * - LOG_ENABLED: Debug mode
     */
    const SYNC_CONFIG = {
        SYNC_INTERVAL: 5 * 60 * 1000,      // 5 minutos
        IDLE_TIMEOUT: 30 * 1000,            // 30 segundos max de espera
        MIN_CHANGE_THRESHOLD: 100,          // Bytes de diferencia para considerar cambio
        LOG_ENABLED: false                  // true para debug
    };

    let _syncTimerId = null;
    let _isSyncingNow = false;
    let _lastSyncHash = null;

    /**
     * Logging condicional para debug
     */
    function log(msg, data = null) {
        if (!SYNC_CONFIG.LOG_ENABLED) return;
        const time = new Date().toLocaleTimeString();
        if (data) {
            console.log(`[${time}] 🔄 BgSync: ${msg}`, data);
        } else {
            console.log(`[${time}] 🔄 BgSync: ${msg}`);
        }
    }

    /**
     * Calcula hash SHA-256 del JSON para detectar cambios de forma fiable.
     * (Sustituye al hash de 32 bits anterior, que tenía alta tasa de
     * colisiones y podía saltar sincronizaciones legítimas.)
     */
    async function simpleHash(obj) {
        try {
            const str = JSON.stringify(obj);
            if (self.crypto && self.crypto.subtle) {
                const buf = await self.crypto.subtle.digest(
                    'SHA-256',
                    new TextEncoder().encode(str)
                );
                return Array.from(new Uint8Array(buf))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
            }
        } catch (e) { /* fallback abajo */ }
        // Fallback (entornos sin SubtleCrypto): hash 32-bit.
        const str = JSON.stringify(obj);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return String(hash);
    }

    /**
     * Ejecuta sincronización cuando el navegador esté inactivo
     * Fallback a setTimeout si requestIdleCallback no está dispon
     */
    function runInIdle(callback) {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(
                () => {
                    log('Ejecutando en idle');
                    callback();
                },
                { timeout: SYNC_CONFIG.IDLE_TIMEOUT }
            );
        } else {
            // Fallback: muy corto delay para evitar bloqueo
            setTimeout(() => {
                log('Ejecutando con setTimeout fallback');
                callback();
            }, 100);
        }
    }

    /**
     * Sincronización bidireccional:
     * 1. Subir cambios locales a OneDrive (si hay)
     * 2. Descargar cambios remotos de OneDrive (si hay)
     * 3. Fusionar sin interrupciones
     * 
     * Completamente silenciosa — no abre dialogs, no recarga.
     */
    async function performBidirectionalSync() {
        if (_isSyncingNow) {
            log('⏳ Sync ya en progreso, saltando');
            return;
        }

        _isSyncingNow = true;

        try {
            // Verificar que OneDrive esté conectado
            // (Nota: Esta función debe existir en el scope global del index.html)
            if (typeof _nubeCfg !== 'function') {
                log('❌ _nubeCfg no disponible');
                return;
            }

            const cfg = _nubeCfg();
            if (!cfg.od_connected || !cfg.od_token) {
                log('⏸️ OneDrive no conectado');
                return;
            }

            // Fase 1: Intentar subir cambios locales
            log('📤 Fase 1: Verificando cambios locales...');
            const localHash = await simpleHash(typeof getDB === 'function' ? getDB() : {});

            if (_lastSyncHash === null || _lastSyncHash !== localHash) {
                log('📊 Cambios locales detectados', {
                    lastHash: _lastSyncHash,
                    currentHash: localHash
                });
                
                // Subir silenciosamente sin UI bloqueante
                if (typeof onedriveSubirAhora === 'function') {
                    try {
                        await onedriveSubirAhora(true); // true = automático, sin UI
                        log('✅ Subida completada');
                    } catch (err) {
                        log('⚠️ Error en subida:', err.message);
                    }
                }
            }

            // Fase 2: Intentar descargar cambios remotos
            log('📥 Fase 2: Verificando cambios remotos...');
            
            if (typeof onedriveDescargarSilencioso === 'function') {
                const remoteData = await onedriveDescargarSilencioso();
                
                if (remoteData) {
                    const remoteHash = await simpleHash(remoteData);
                    
                    if (_lastSyncHash === null || remoteHash !== localHash) {
                        log('📊 Cambios remotos detectados', {
                            remoteHash,
                            localHash
                        });

                        // Fusionar sin UI
                        if (typeof importarBaseDatosConFusion === 'function') {
                            try {
                                const fusionado = importarBaseDatosConFusion(remoteData);
                                
                                if (typeof saveDB === 'function') {
                                    saveDB(fusionado);
                                    log('✅ Descarga y fusión completadas');
                                    
                                    // Notificación MUY discreta
                                    const bytesChanged = Math.abs(
                                        JSON.stringify(fusionado).length - 
                                        JSON.stringify(typeof getDB === 'function' ? getDB() : {}).length
                                    );
                                    
                                    if (bytesChanged > SYNC_CONFIG.MIN_CHANGE_THRESHOLD) {
                                        if (typeof showToast === 'function') {
                                            showToast(
                                                '☁️ Datos sincronizados',
                                                'info',
                                                2000 // Solo 2 segundos — MUY discreta
                                            );
                                        }
                                        
                                        // Actualizar last sync timestamp
                                        if (typeof _nubeSetUltimo === 'function') {
                                            _nubeSetUltimo(new Date().toISOString());
                                        }
                                    }
                                }
                            } catch (err) {
                                log('⚠️ Error en fusión:', err.message);
                            }
                        }
                    }
                } else {
                    log('ℹ️ Sin cambios remotos');
                }
            }

            // Actualizar hash local
            _lastSyncHash = localHash;

        } catch (error) {
            log('❌ Error en sync:', error.message);
            
            // NO mostrar error al usuario — solo log silencioso
            if (error.message.includes('401') || error.message.includes('403')) {
                log('🔑 Token expirado, intentando renovar en próxima sync');
            }
        } finally {
            _isSyncingNow = false;
            log('✨ Sync completada');
        }
    }

    /**
     * Inicia sincronización periódica en background
     * - Usa requestIdleCallback para máxima performance
     * - Se ejecuta sin interrupciones
     * - Completamente silenciosa salvo cambios significativos
     */
    window.startBackgroundSync = function() {
        log('🚀 Iniciando background sync');
        
        if (_syncTimerId) {
            clearInterval(_syncTimerId);
        }

        // Sincronizar inmediatamente (en idle)
        runInIdle(performBidirectionalSync);

        // Sincronizar periódicamente
        _syncTimerId = setInterval(() => {
            runInIdle(performBidirectionalSync);
        }, SYNC_CONFIG.SYNC_INTERVAL);

        log('✅ Background sync iniciado', {
            interval: `${SYNC_CONFIG.SYNC_INTERVAL / 1000 / 60} min`,
            idleTimeout: `${SYNC_CONFIG.IDLE_TIMEOUT / 1000}s`
        });
    };

    /**
     * Detiene sincronización en background
     */
    window.stopBackgroundSync = function() {
        if (_syncTimerId) {
            clearInterval(_syncTimerId);
            _syncTimerId = null;
            log('⏹️  Background sync detenido');
        }
    };

    /**
     * Expone configuración para debug
     */
    window.getBackgroundSyncStatus = function() {
        return {
            enabled: _syncTimerId !== null,
            isSyncing: _isSyncingNow,
            lastSyncHash: _lastSyncHash,
            config: SYNC_CONFIG
        };
    };

    /**
     * Permite cambiar configuración en runtime
     */
    window.configureBackgroundSync = function(options = {}) {
        Object.assign(SYNC_CONFIG, options);
        log('⚙️ Configuración actualizada', SYNC_CONFIG);
    };

    log('✨ backgroundSync.js cargado');

})();
