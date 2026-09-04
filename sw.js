// ============================================================
// SERVICE WORKER — Control de Obra v2.9.1
// Estrategia: Network First con fallback a Cache
// Mejora: Skip waiting in install para actualizaciones inmediatas
// ============================================================

const CACHE_VERSION = '2.9.2';
const CACHE_NAME = `control-obra-v${CACHE_VERSION}`;
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './onedrive-callback.html',
    './logocr.png',
    './icon-512.png',
    './icon-192.png',
    './icon.svg',
    './vendor/html2pdf.bundle.min.js',
    './vendor/purify.min.js',
    './vendor/xlsx.full.min.js',
    './vendor/exceljs.min.js',
    './src/types.js',
    './src/config.js',
    './src/kpiEngine.js',
    './src/exportador.js',
    './src/reporteEjecutivo.js',
    './src/signatureCapture.js',
    './src/nominaEngine.js',
    './src/plantillaPremium.js',
    './src/backgroundSync.js',
    './src/syncOptimizer.js',
    './src/silentDownload.js',
    './splash-640x1136.png',
    './splash-750x1334.png',
    './splash-1125x2436.png',
    './splash-828x1792.png',
    './splash-1242x2208.png',
    './splash-1170x2532.png',
    './splash-1284x2778.png',
    './splash-1179x2556.png',
    './splash-1290x2796.png',
    './splash-1024x1366.png',
    './splash-1536x2048.png',
    './splash-1668x2388.png'
];

// ── Instalación ───────────────────────────────────────────────
self.addEventListener('install', function (event) {
    console.log('[SW] Instalando nueva versión:', CACHE_NAME);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function (cache) {
                console.log('[SW] Cache abierto:', CACHE_NAME);
                const locales = STATIC_ASSETS.filter(u => !u.startsWith('http'));
                const remotos = STATIC_ASSETS.filter(u => u.startsWith('http'));
                return cache.addAll(locales)
                    .then(() => Promise.allSettled(remotos.map(u => cache.add(u))));
            })
            .then(() => {
                console.log('[SW] Cache instalado, activando inmediatamente');
                return self.skipWaiting(); // Forzar activación inmediata
            })
    );
});

// ── Activación ───────────────────────────────────────────────
self.addEventListener('activate', function (event) {
    console.log('[SW] Activando:', CACHE_NAME);
    event.waitUntil(
        caches.keys()
            .then(function (names) {
                console.log('[SW] Caches existentes:', names);
                return Promise.all(
                    names.filter(n => n !== CACHE_NAME)
                         .map(n => { 
                             console.log('[SW] Eliminando cache obsoleto:', n); 
                             return caches.delete(n); 
                         })
                );
            })
            .then(() => {
                console.log('[SW] Claiming clients');
                return self.clients.claim();
            })
    );
});

// ── Fetch: Network First para locales, incluidos recursos de exportación offline ──
self.addEventListener('fetch', function (event) {
    if (event.request.method !== 'GET') return;
    if (event.request.url.startsWith('chrome-extension://')) return;

    const url = new URL(event.request.url);
    const esNavegacion = event.request.mode === 'navigate' ||
                         event.request.destination === 'document';

    if (esNavegacion && url.pathname.endsWith('index.html')) {
        event.respondWith(
            fetch(event.request)
                .then(function (response) {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(c => c.put('./index.html', clone));
                    }
                    return response;
                })
                .catch(function () {
                    return caches.match('./index.html');
                })
        );
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(function (response) {
                // Solo cachear respuestas same-origin 'basic' con estado 200.
                // Las 'opaque' (cross-origin) pueden ser errores opacos no
                // inspeccionables y llenarían la cuota de almacenamiento.
                if (!response || response.status !== 200) return response;
                if (response.type !== 'basic') return response;

                const clone = response.clone();
                caches.open(CACHE_NAME).then(c => {
                    c.put(event.request, clone);
                    limitarCache(c);
                });
                return response;
            })
            .catch(function () {
                return caches.match(event.request)
                    .then(function (cached) {
                        if (cached) return cached;
                        if (esNavegacion) return caches.match('./index.html');
                    });
            })
    );
});

// ── Límite de entradas en caché (LRU aproximado, FIFO) ───────
const MAX_CACHE_ENTRIES = 200;
async function limitarCache(cache) {
    try {
        const keys = await cache.keys();
        if (keys.length <= MAX_CACHE_ENTRIES) return;
        // Elimina las más antiguas primero (orden de inserción).
        const exceso = keys.length - MAX_CACHE_ENTRIES;
        for (let i = 0; i < exceso; i++) {
            await cache.delete(keys[i]);
        }
    } catch (e) { /* no bloquear la respuesta por un fallo de limpieza */ }
}

// ── Mensajes ─────────────────────────────────────────────────
self.addEventListener('message', function (event) {
    if (event.data && event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});
