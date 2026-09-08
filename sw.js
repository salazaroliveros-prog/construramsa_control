// ============================================================
// SERVICE WORKER — Control de Obra v2.9.2
// Estrategia: Cache First para recursos estáticos, Network First para navegación
// Mejora: Offline completo con fallback UI
// ============================================================

const CACHE_VERSION = '2.9.2';
const CACHE_NAME = `control-obra-v${CACHE_VERSION}`;
const OFFLINE_CACHE_NAME = `${CACHE_NAME}-offline`;

// Recursos estáticos críticos para offline completo
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './onedrive-callback.html',
  './logocr.png',
  './icon-512.png',
  './icon-192.png',
  './icon.svg',
  './icon.png',
  './vendor/html2pdf.bundle.min.js',
  './vendor/purify.min.js',
  './vendor/xlsx.full.min.js',
  './vendor/exceljs.min.js',
  './src/types.js',
  './src/config.js',
  './src/reportDataAdapter.js',
  './src/kpiEngine.js',
  './src/exportador.js',
  './src/reporteEjecutivo.js',
  './src/signatureCapture.js',
  './src/nominaEngine.js',
  './src/plantillaPremium.js',
  './src/backgroundSync.js',
  './src/syncOptimizer.js',
  './src/silentDownload.js',
  './src/formValidator.js',
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
  './splash-1668x2388.png',
];

// Recursos adicionales para caché dinámico
const DYNAMIC_CACHE_PATTERNS = [
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.svg',
  '*.css',
  '*.woff',
  '*.woff2',
  '*.ttf',
];

// NOTA: Scripts de desarrollo (build.js, optimize-images.js, test_*.js) no están en caché
// porque no se usan en producción. Solo se cachean archivos necesarios para
// funcionamiento offline de la aplicación.

// ── Instalación ───────────────────────────────────────────────
self.addEventListener('install', function (event) {
  console.log('[SW] Instalando nueva versión:', CACHE_NAME);
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function (cache) {
        console.log('[SW] Cache abierto:', CACHE_NAME);
        const locales = STATIC_ASSETS.filter((u) => !u.startsWith('http'));
        const remotos = STATIC_ASSETS.filter((u) => u.startsWith('http'));
        return cache
          .addAll(locales)
          .then(() => Promise.allSettled(remotos.map((u) => cache.add(u))));
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
    caches
      .keys()
      .then(function (names) {
        console.log('[SW] Caches existentes:', names);
        return Promise.all(
          names
            .filter((n) => n !== CACHE_NAME && n !== OFFLINE_CACHE_NAME)
            .map((n) => {
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

// ── Fetch: Cache First para todos los recursos (estrategia offline-first) ──
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;

  const url = new URL(event.request.url);
  const esNavegacion =
    event.request.mode === 'navigate' || event.request.destination === 'document';

  // Para navegación: Cache First para soportar recarga offline
  if (esNavegacion) {
    event.respondWith(
      caches.match(event.request).then(function (cached) {
        if (cached) {
          // Actualizar en background si hay red
          fetch(event.request)
            .then(function (response) {
              if (response && response.status === 200) {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
              }
            })
            .catch(() => {
              // No hay red, pero tenemos caché - OK
            });
          return cached;
        }

        // Si no está en caché, buscar en red
        return fetch(event.request)
          .then(function (response) {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
            }
            return response;
          })
          .catch(function () {
            // Fallback a index.html para SPA
            return caches.match('./index.html');
          });
      })
    );
    return;
  }

  // Para recursos estáticos: Cache First con fallback a Network
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) {
        // Actualizar caché en background
        fetch(event.request).then(function (response) {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => {
              c.put(event.request, clone);
              limitarCache(c);
            });
          }
        });
        return cached;
      }

      // Si no está en caché, buscar en red
      return fetch(event.request)
        .then(function (response) {
          if (!response || response.status !== 200) return response;
          if (response.type !== 'basic') return response;

          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => {
            c.put(event.request, clone);
            limitarCache(c);
          });
          return response;
        })
        .catch(function () {
          // Si no hay red y no está en caché, retornar respuesta offline
          return new Response('Offline: recurso no disponible', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' }),
          });
        });
    })
  );
});

// ── Límite de entradas en caché (LRU aproximado, FIFO) ───────
const MAX_CACHE_ENTRIES = 300; // Aumentado para mejor offline
async function limitarCache(cache) {
  try {
    const keys = await cache.keys();
    if (keys.length <= MAX_CACHE_ENTRIES) return;
    // Elimina las más antiguas primero (orden de inserción).
    const exceso = keys.length - MAX_CACHE_ENTRIES;
    for (let i = 0; i < exceso; i++) {
      await cache.delete(keys[i]);
    }
  } catch (e) {
    /* no bloquear la respuesta por un fallo de limpieza */
  }
}

// ── Mensajes ─────────────────────────────────────────────────
self.addEventListener('message', function (event) {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
