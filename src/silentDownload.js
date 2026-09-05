/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║   Silent OneDrive Download Module                            ║
 * ║   Descarga datos sin UI, completamente en background         ║
 * ║   No abre dialogs, no pide confirmación                       ║
 * ╚═══════════════════════════════════════════════════════════════╝
 *
 * Expuesto como `window.CR_SilentDownload` (IIFE, sin fuga de globales).
 * Las funciones individuales también se asignan a window.* para mantener
 * compatibilidad con el código existente en index.html.
 */

(function (globalScope) {
    'use strict';

    const LOG_ENABLED = false;

    function log(msg, data) {
        if (!LOG_ENABLED) return;
        if (data) {
            console.log(`[OneDrive Silent] ${msg}`, data);
        } else {
            console.log(`[OneDrive Silent] ${msg}`);
        }
    }

    /**
     * Descarga datos de OneDrive sin mostrar UI
     * - No pide confirmación
     * - No muestra dialogs
     * - No recarga la página
     * - Retorna datos o null si error
     *
     * Uso: const data = await CR_SilentDownload.descargar();
     */
    async function onedriveDescargarSilencioso() {
        const cfg = typeof _nubeCfg === 'function' ? _nubeCfg() : null;

        if (!cfg || !cfg.od_connected || !cfg.od_token) {
            log('❌ OneDrive no conectado');
            return null;
        }

        try {
            log('📥 Iniciando descarga silenciosa...');

            const fileId = cfg.od_itemid;
            const endpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`;

            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${cfg.od_token}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    log('🔑 Token expirado (401)');
                } else {
                    log(`❌ Error ${response.status}: ${response.statusText}`);
                }
                return null;
            }

            const text = await response.text();
            log(`📊 Descargados ${text.length} bytes`);

            try {
                const data = JSON.parse(text);
                log('✅ Descarga completada', { items: Object.keys(data).length });
                return data;
            } catch (parseErr) {
                log('⚠️ JSON inválido:', parseErr.message);
                return null;
            }

        } catch (error) {
            log('❌ Error en descarga:', error.message);
            return null;
        }
    }

    /**
     * Descarga específicamente el archivo JSON principal
     * Alternativa si el archivo está en /me/drive/root:/archivo.json
     */
    async function onedriveDescargarPorNombre(fileName) {
        var nombre = fileName || 'db.json';
        const cfg = typeof _nubeCfg === 'function' ? _nubeCfg() : null;

        if (!cfg || !cfg.od_connected || !cfg.od_token) {
            log('❌ OneDrive no conectado');
            return null;
        }

        try {
            log(`📥 Descargando archivo: ${nombre}`);

            const encodedPath = encodeURIComponent(`/${nombre}`);
            const endpoint = `https://graph.microsoft.com/v1.0/me/drive/root:${encodedPath}:/content`;

            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${cfg.od_token}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                log(`❌ Error ${response.status}: ${response.statusText}`);
                return null;
            }

            const text = await response.text();
            const data = JSON.parse(text);

            log(`✅ Archivo descargado: ${nombre}`, { items: Object.keys(data).length });
            return data;

        } catch (error) {
            log(`❌ Error en descarga de ${nombre}:`, error.message);
            return null;
        }
    }

    /**
     * Verifica si hay cambios en el archivo remoto comparando última modificación
     * Retorna: { hasChanges: boolean, lastModified: timestamp }
     */
    async function onedriveCheckRemoteChanges(fileId) {
        const cfg = typeof _nubeCfg === 'function' ? _nubeCfg() : null;

        if (!cfg || !cfg.od_connected || !cfg.od_token) {
            return { hasChanges: false, lastModified: null };
        }

        try {
            const endpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`;

            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${cfg.od_token}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                return { hasChanges: false, lastModified: null };
            }

            const item = await response.json();
            const lastModified = new Date(item.lastModifiedDateTime);

            const lastCheck = localStorage.getItem('_od_lastRemoteModified');
            const hasChanges = !lastCheck || new Date(lastCheck) < lastModified;

            if (hasChanges) {
                log('📝 Cambios remotos detectados');
                localStorage.setItem('_od_lastRemoteModified', lastModified.toISOString());
            }

            return { hasChanges, lastModified };

        } catch (error) {
            log('⚠️ Error verificando cambios remotos:', error.message);
            return { hasChanges: false, lastModified: null };
        }
    }

    /**
     * Descarga con smart retry en caso de timeout
     * Reintentos exponenciales
     */
    async function onedriveDescargarConRetry(maxRetries) {
        var intentos = maxRetries || 3;
        for (let attempt = 1; attempt <= intentos; attempt++) {
            log(`📥 Intento ${attempt}/${intentos}`);

            try {
                const data = await onedriveDescargarSilencioso();
                if (data) return data;
            } catch (error) {
                log(`⚠️ Intento ${attempt} falló: ${error.message}`);

                if (attempt < intentos) {
                    const waitTime = Math.pow(2, attempt - 1) * 1000;
                    log(`⏳ Esperando ${waitTime}ms antes de reintentar...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }

        log('❌ Todos los intentos fallaron');
        return null;
    }

    // API pública congelada
    const api = Object.freeze({
        descargar: onedriveDescargarSilencioso,
        descargarPorNombre: onedriveDescargarPorNombre,
        checkCambiosRemotos: onedriveCheckRemoteChanges,
        descargarConRetry: onedriveDescargarConRetry
    });

    // Exponer funciones individuales en window para compatibilidad con index.html
    // y objeto API congelado bajo CR_SilentDownload
    if (globalScope) {
        globalScope.onedriveDescargarSilencioso = onedriveDescargarSilencioso;
        globalScope.onedriveDescargarPorNombre = onedriveDescargarPorNombre;
        globalScope.onedriveCheckRemoteChanges = onedriveCheckRemoteChanges;
        globalScope.onedriveDescargarConRetry = onedriveDescargarConRetry;
        try {
            Object.defineProperty(globalScope, 'CR_SilentDownload', {
                value: api,
                writable: false,
                enumerable: false,
                configurable: false
            });
        } catch (e) { /* entornos restringidos */ }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    log('✨ silentDownload.js cargado');

})(typeof window !== 'undefined' ? window : globalThis);
