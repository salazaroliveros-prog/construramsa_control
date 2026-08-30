const fs = require('fs');
const path = require('path');

const DIST = path.join(process.cwd(), 'static');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

module.exports = async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const filePath = path.join(DIST, p);
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  let isFile = false;
  try { isFile = (await fs.promises.stat(filePath)).isFile(); } catch { isFile = false; }
  if (!isFile) {
    const idx = path.join(DIST, 'index.html');
    const data = await fs.promises.readFile(idx);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data); return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', ext === '.html' ? 'no-store' : 'public, max-age=31536000, immutable');
  res.writeHead(200);
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
};
