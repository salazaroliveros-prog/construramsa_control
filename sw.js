// ============================================================
// SERVICE WORKER — Control de Obra v2.8.2
// Estrategia: Network First con fallback a Cache
// ============================================================

const CACHE_NAME = 'control-obra-v2.8.2';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './onedrive-callback.html',
    './icon.png',
    './icon-512.png',
    './icon-192.png',
    './icon.svg',
    './vendor/html2pdf.bundle.min.js',
    './vendor/xlsx.full.min.js',
    './vendor/purify.min.js'
];

// ── Instalación ───────────────────────────────────────────────
self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function (cache) {
                console.log('[SW] Instalando cache:', CACHE_NAME);
                const locales = STATIC_ASSETS.filter(u => !u.startsWith('http'));
                const remotos = STATIC_ASSETS.filter(u => u.startsWith('http'));
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
