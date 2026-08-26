// ============================================================
// SERVICE WORKER — Control de Obra v2.8.0
// Estrategia: Network First con fallback a Cache
// ============================================================

const CACHE_NAME = 'control-obra-v2.8.0';

const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    './onedrive-callback.html',
    './construramsa_db.json',
    './icon.png',
    './icon-512.png',
    './icon-192.png',
    './icon.svg',
    './logocr.png',
    './wilson.png',
    './juan.png',
    'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
    'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.0/purify.min.js'
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

// ── Fetch: Stale-While-Revalidate para CDN, Network First para locales ──
self.addEventListener('fetch', function (event) {
    if (event.request.method !== 'GET') return;
    if (event.request.url.startsWith('chrome-extension://')) return;

    const url = new URL(event.request.url);
    const esNavegacion = event.request.mode === 'navigate' ||
                         event.request.destination === 'document';
    const esCDN = url.hostname.includes('cdnjs.cloudflare.com') ||
                  url.hostname.includes('cdn.sheetjs.com');

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

    if (esCDN) {
        event.respondWith(
            caches.open(CACHE_NAME).then(function (cache) {
                return cache.match(event.request).then(function (cached) {
                    const fetchPromise = fetch(event.request).then(function (response) {
                        if (response && response.status === 200) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    }).catch(function () {
                        return cached || new Response('', { status: 503, statusText: 'Offline' });
                    });
                    return cached || fetchPromise;
                });
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
