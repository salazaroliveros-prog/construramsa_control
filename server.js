const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

const ROOT = path.resolve(__dirname);

/**
 * Sirve un archivo estático. Para rutas sin extensión (rutas SPA) devuelve
 * index.html con 200. Para rutas CON extensión que no existen devuelve 404
 * real (coherente con los rewrites de vercel.json). Errores internos → 500.
 */
module.exports = async (req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';

    // Path traversal robusto: resolver y exigir que quede dentro del proyecto.
    const resolved = path.resolve(ROOT, '.' + urlPath);
    if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    const ext = path.extname(resolved).toLowerCase();
    let data;
    try {
      data = await fs.promises.readFile(resolved);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      if (ext !== '') {
        // Asset solicitado que no existe → 404 real (no enmascarar como SPA).
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }
      // Ruta SPA sin extensión → index.html
      data = await fs.promises.readFile(path.join(ROOT, 'index.html'));
      return sendHtml(res, data);
    }

    const contentType = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html'
        ? 'no-store, no-cache, must-revalidate, max-age=0'
        : 'public, max-age=31536000, immutable'
    });
    res.end(data);
  } catch (err) {
    console.error('[server] Error:', err.message);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
};

function sendHtml(res, data) {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
  });
  res.end(data);
}

// Modo local: `node server.js` arranca un servidor HTTP (usado por npm test y npm start).
// Modo Vercel: exporta el handler (aunque el despliegue en Vercel es estático).
if (require.main === module) {
  const http = require('http');
  const PORT = process.env.PORT || 3000;
  http.createServer((req, res) => module.exports(req, res)).listen(PORT, () => {
    console.log(`CONSTRURAMSA Control de Obra — http://127.0.0.1:${PORT}/`);
  });
}
