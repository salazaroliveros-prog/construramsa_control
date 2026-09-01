/**
 * ════════════════════════════════════════════════════════════════════════════════
 * SYNC OPTIMIZER — Control de Obra v2.8.6
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * Módulo para optimizar sincronización con Cloud (OneDrive, Google Drive):
 * • Reintentos con backoff exponencial (2^n con jitter)
 * • Descarga en chunks para archivos grandes
 * • Batching inteligente de notificaciones
 * • Métricas y logging para monitoring
 * • Manejo de timeout y fallos de red robustos
 * 
 * SIN dependencias externas — funciona en cualquier contexto con IndexedDB / localStorage.
 * 
 * ════════════════════════════════════════════════════════════════════════════════
 */

const SyncOptimizer = (() => {
    const safeStorage = (() => {
        try {
            if (typeof localStorage !== 'undefined') return localStorage;
        } catch (_) {}
        return null;
    })();

    const safeFetch = typeof fetch === 'function' ? fetch.bind(globalThis) : null;

    // ─── CONFIGURACIÓN GLOBAL ─────────────────────────────────────────────────
    const CONFIG = {
        MAX_RETRIES: 5,
        INITIAL_BACKOFF_MS: 500,
        MAX_BACKOFF_MS: 30000,
        CHUNK_SIZE: 1024 * 1024, // 1 MB
        TIMEOUT_MS: 30000,
        NOTIFICATION_BATCH_DELAY_MS: 2000,
        METRICS_KEY: 'sync-metrics',
        RETRY_LOG_KEY: 'sync-retry-log'
    };

    // ─── ESTADO INTERNO ───────────────────────────────────────────────────────
    let notificationBatch = [];
    let notificationBatchTimer = null;
    let syncMetrics = _loadMetrics();
    let retryLog = _loadRetryLog();

    // ═══════════════════════════════════════════════════════════════════════════
    // MÉTRICAS & LOGGING
    // ═══════════════════════════════════════════════════════════════════════════

    function _loadMetrics() {
        try {
            if (!safeStorage) return {
                totalSyncs: 0,
                successfulSyncs: 0,
                failedSyncs: 0,
                totalRetries: 0,
                lastSyncTime: null,
                lastSyncDuration: 0,
                downloadedBytes: 0,
                uploadedBytes: 0,
                errorCounts: {}
            };
            const stored = safeStorage.getItem(CONFIG.METRICS_KEY);
            return stored ? JSON.parse(stored) : {
                totalSyncs: 0,
                successfulSyncs: 0,
                failedSyncs: 0,
                totalRetries: 0,
                lastSyncTime: null,
                lastSyncDuration: 0,
                downloadedBytes: 0,
                uploadedBytes: 0,
                errorCounts: {}
            };
        } catch (_) {
            return {
                totalSyncs: 0,
                successfulSyncs: 0,
                failedSyncs: 0,
                totalRetries: 0,
                lastSyncTime: null,
                lastSyncDuration: 0,
                downloadedBytes: 0,
                uploadedBytes: 0,
                errorCounts: {}
            };
        }
    }

    function _saveMetrics() {
        if (!safeStorage) return;
        try {
            safeStorage.setItem(CONFIG.METRICS_KEY, JSON.stringify(syncMetrics));
        } catch (_) {}
    }

    function _loadRetryLog() {
        try {
            if (!safeStorage) return [];
            const stored = safeStorage.getItem(CONFIG.RETRY_LOG_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (_) {
            return [];
        }
    }

    function _saveRetryLog() {
        if (!safeStorage) return;
        try {
            if (retryLog.length > 100) {
                retryLog = retryLog.slice(-100);
            }
            safeStorage.setItem(CONFIG.RETRY_LOG_KEY, JSON.stringify(retryLog));
        } catch (_) {}
    }

    function _recordRetry(endpoint, attemptNumber, errorMessage, nextBackoffMs) {
        const entry = {
            timestamp: new Date().toISOString(),
            endpoint,
            attemptNumber,
            errorMessage,
            nextBackoffMs
        };
        retryLog.push(entry);
        _saveRetryLog();
        console.warn(`[RETRY ${attemptNumber}/${CONFIG.MAX_RETRIES}] ${endpoint}: ${errorMessage} → retry in ${nextBackoffMs}ms`);
    }

    function _recordSync(success, durationMs, errorMessage = null) {
        const now = new Date();
        syncMetrics.totalSyncs++;
        syncMetrics.lastSyncTime = now.toISOString();
        syncMetrics.lastSyncDuration = durationMs;
        
        if (success) {
            syncMetrics.successfulSyncs++;
        } else {
            syncMetrics.failedSyncs++;
            const errType = (errorMessage || 'unknown').split(':')[0];
            syncMetrics.errorCounts[errType] = (syncMetrics.errorCounts[errType] || 0) + 1;
        }
        _saveMetrics();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REINTENTOS CON BACKOFF EXPONENCIAL
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Calcula backoff exponencial con jitter.
     * Fórmula: min(MAX, INITIAL * 2^attempt + random(0, INITIAL * 2^attempt))
     */
    function _calculateBackoffMs(attemptNumber) {
        const exponential = CONFIG.INITIAL_BACKOFF_MS * Math.pow(2, attemptNumber - 1);
        const jitter = Math.random() * exponential;
        return Math.min(CONFIG.MAX_BACKOFF_MS, exponential + jitter);
    }

    /**
     * Ejecuta una función con reintentos automáticos.
     * 
     * @param {Function} fetchFn - async function que lanza error
     * @param {string} endpoint - descripción del endpoint (para logging)
     * @param {number} maxRetries - intentos máximos (default: CONFIG.MAX_RETRIES)
     * @returns {Promise} - resultado de fetchFn o error después de N reintentos
     */
    async function fetchWithRetry(fetchFn, endpoint, maxRetries = CONFIG.MAX_RETRIES) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await Promise.race([
                    fetchFn(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('TIMEOUT')), CONFIG.TIMEOUT_MS)
                    )
                ]);
                
                // ✅ Éxito
                if (attempt > 1) {
                    console.log(`[RETRY SUCCESS] ${endpoint} en intento ${attempt}`);
                }
                syncMetrics.totalRetries += attempt - 1;
                _saveMetrics();
                return result;
                
            } catch (error) {
                lastError = error;
                const isLastAttempt = attempt === maxRetries;
                
                if (isLastAttempt) {
                    syncMetrics.totalRetries += attempt - 1;
                    _saveMetrics();
                    _recordSync(false, 0, error.message);
                    throw error;
                }
                
                // Calcular próximo backoff
                const nextBackoffMs = _calculateBackoffMs(attempt);
                _recordRetry(endpoint, attempt, error.message, nextBackoffMs);
                
                // Esperar antes de reintentar
                await new Promise(resolve => setTimeout(resolve, nextBackoffMs));
            }
        }
        
        throw lastError || new Error(`Failed after ${maxRetries} retries`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DESCARGA EN CHUNKS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Descarga un archivo en chunks de 1 MB.
     * Útil para archivos grandes sin consumir toda la memoria.
     * 
     * @param {string} downloadUrl - URL de descarga (ejemplo: OneDrive /content)
     * @param {string} authToken - token de autorización Bearer
     * @param {Function} onProgress - callback(bytesDownloaded, totalBytes)
     * @returns {Promise<Object>} - JSON parseado del archivo descargado
     */
    async function downloadFileInChunks(downloadUrl, authToken, onProgress = null) {
        const chunks = [];
        let totalBytes = 0;
        let downloadedBytes = 0;

        return fetchWithRetry(async () => {
            const response = await fetch(downloadUrl, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // Leer total del header si está disponible
            const contentLength = parseInt(response.headers.get('content-length'), 10);
            if (!isNaN(contentLength)) {
                totalBytes = contentLength;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let text = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    downloadedBytes += value.length;
                    text += decoder.decode(value, { stream: true });
                    
                    if (onProgress) {
                        onProgress(downloadedBytes, totalBytes || downloadedBytes);
                    }
                }

                // Finish decoder
                text += decoder.decode();
                syncMetrics.downloadedBytes += downloadedBytes;
                _saveMetrics();

                return JSON.parse(text);

            } catch (error) {
                reader.cancel();
                throw error;
            }

        }, `download-chunks(${downloadUrl})`, 3);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BATCHING DE NOTIFICACIONES
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Agrega una notificación al batch. Se envían juntas después de BATCH_DELAY.
     * Útil para evitar spam de toast cuando hay múltiples cambios.
     * 
     * @param {string} message - texto de la notificación
     * @param {string} type - tipo ('info', 'warning', 'error', 'success')
     * @param {Function} showFn - función para mostrar toast (si está disponible)
     */
    function addNotificationToBatch(message, type = 'info', showFn = null) {
        notificationBatch.push({ message, type, timestamp: Date.now() });

        // Cancelar timer anterior
        if (notificationBatchTimer) {
            clearTimeout(notificationBatchTimer);
        }

        // Nuevo timer para enviar batch
        notificationBatchTimer = setTimeout(() => {
            _flushNotificationBatch(showFn);
        }, CONFIG.NOTIFICATION_BATCH_DELAY_MS);
    }

    /**
     * Envía todas las notificaciones del batch como una sola.
     * Agrupa por tipo y muestra un resumen inteligente.
     */
    function _flushNotificationBatch(showFn = null) {
        if (notificationBatch.length === 0) return;

        // Agrupar por tipo
        const grouped = {};
        notificationBatch.forEach(n => {
            if (!grouped[n.type]) grouped[n.type] = [];
            grouped[n.type].push(n);
        });

        // Construir mensaje consolidado
        const parts = [];
        Object.entries(grouped).forEach(([type, items]) => {
            if (items.length === 1) {
                parts.push(items[0].message);
            } else {
                parts.push(`${items.length} ${type}(s)`);
            }
        });

        const consolidatedMsg = parts.join(' • ');
        const dominantType = Object.keys(grouped)[0] || 'info';

        // Mostrar una sola notificación
        if (showFn && typeof showFn === 'function') {
            showFn(consolidatedMsg, dominantType, 3000);
        } else {
            console.log(`[${dominantType.toUpperCase()}] ${consolidatedMsg}`);
        }

        // Limpiar batch
        notificationBatch = [];
        notificationBatchTimer = null;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDACIÓN DE CONECTIVIDAD & ESTADO
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Verifica si hay conexión a internet.
     * Usa una combinación de navigator.onLine + fetch HEAD.
     */
    async function checkConnectivity() {
        if (typeof navigator !== 'undefined' && !navigator.onLine) return false;

        const fetchFn = safeFetch || globalThis.fetch;
        if (!fetchFn) return false;

        try {
            const response = await Promise.race([
                fetchFn('data:text/plain,', { method: 'HEAD' }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('TIMEOUT')), 3000)
                )
            ]);
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Valida un token de acceso mediante un request trivial.
     * Retorna true si el token es válido, false si está expirado/revocado.
     */
    async function validateToken(token, providerEndpoint) {
        if (!safeFetch || !providerEndpoint) return false;
        try {
            const response = await safeFetch(providerEndpoint, {
                method: 'HEAD',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.status !== 401 && response.status !== 403;
        } catch {
            return false;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // API PÚBLICA
    // ═══════════════════════════════════════════════════════════════════════════

    return Object.freeze({
        fetchWithRetry,
        downloadFileInChunks,
        addNotificationToBatch,
        checkConnectivity,
        validateToken,
        getMetrics: () => JSON.parse(JSON.stringify(syncMetrics)),
        getRetryLog: () => JSON.parse(JSON.stringify(retryLog)),
        clearMetrics: () => {
            syncMetrics = _loadMetrics();
            localStorage.removeItem(CONFIG.METRICS_KEY);
        },
        clearRetryLog: () => {
            retryLog = [];
            localStorage.removeItem(CONFIG.RETRY_LOG_KEY);
        }
    });
})();

if (typeof window !== 'undefined') {
    window.SyncOptimizer = SyncOptimizer;
}

if (typeof globalThis !== 'undefined') {
    globalThis.SyncOptimizer = SyncOptimizer;
}

// Exportar para uso en Node.js / test environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SyncOptimizer;
}
