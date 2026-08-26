// ============================================================
// SERVICE WORKER — CONSTRURAMSA Control de Obra v2.7.4
// Estrategia: Network First con fallback a Cache
// ============================================================

const CACHE_NAME = 'construramsa-v2.7.4';

const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    './construramsa_db.json',
    './icon.png',
    './icon-512.png',
    './icon-192.png',
    './icon.svg',
    './wilson.png',
    './juan.png',
    'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
    'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js'
];

// ── Instalación ───────────────────────────────────────────────
self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function (cache) {
                console.log('[SW] Instalando cache:', CACHE_NAME);
                const locales = urlsToCache.filter(u => !u.startsWith('http'));
                const remotos = urlsToCache.filter(u => u.startsWith('http'));
                return cache.addAll(locales)
                    .then(() => Promise.allSettled(remotos.map(u => cache.add(u))));
            })
            .then(() => self.skipWaiting())
    );
});

// ── Activación ───────────────────────────────────────────────
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys()
            .then(function (names) {
                return Promise.all(
                    names.filter(n => n !== CACHE_NAME)
                         .map(n => { console.log('[SW] Eliminando cache obsoleto:', n); return caches.delete(n); })
                );
            })
            .then(() => self.clients.claim())
    );
});

// ── Fetch: Network First, fallback a Cache ────────────────────
self.addEventListener('fetch', function (event) {
    if (event.request.method !== 'GET') return;
    if (event.request.url.startsWith('chrome-extension://')) return;

    // Normalizar URLs con query params de shortcuts PWA al index.html cacheado
    const url = new URL(event.request.url);
    const esNavegacion = event.request.mode === 'navigate' ||
                         event.request.destination === 'document';

    // Si es navegación al index con ?module= o ?source=, servir index.html del cache
    // (los parámetros los lee el JS en el cliente, no el servidor)
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
                if (!response || response.status !== 200) return response;
                if (response.type !== 'basic' && response.type !== 'opaque') return response;

                const clone = response.clone();
                caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                return response;
            })
            .catch(function () {
                return caches.match(event.request)
                    .then(function (cached) {
                        if (cached) return cached;
                        // Fallback: cualquier navegación sin red → index.html
                        if (esNavegacion) return caches.match('./index.html');
                    });
            })
    );
});

// ── Mensajes ─────────────────────────────────────────────────
self.addEventListener('message', function (event) {
    if (event.data && event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});
