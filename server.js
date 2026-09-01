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
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

module.exports = async (req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    
    // Prevent directory traversal
    if (urlPath.includes('..')) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    
    const filePath = path.join(process.cwd(), urlPath);
    
    // Check if file exists
    await fs.promises.access(filePath, fs.constants.F_OK);
    
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' 
        ? 'no-store, no-cache, must-revalidate, max-age=0' 
        : 'public, max-age=31536000, immutable'
    });
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    // File not found or other error - serve index.html for SPA routing
    try {
      const indexPath = path.join(process.cwd(), 'index.html');
      const data = await fs.promises.readFile(indexPath);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    } catch (e) {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  }
};

// Modo local: `node server.js` arranca un servidor HTTP (usado por npm test y npm start).
// Modo Vercel: exporta el handler (aunque el despliegue en Vercel es estático).
if (require.main === module) {
  const http = require('http');
  const PORT = process.env.PORT || 3000;
  http.createServer((req, res) => module.exports(req, res)).listen(PORT, () => {
    console.log(`CONSTRURAMSA Control de Obra — http://127.0.0.1:${PORT}/`);
  });
}
