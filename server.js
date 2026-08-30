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
  '.ico': 'image/x-icon',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pdf': 'application/pdf'
};

const DIST = path.join(process.env.VERCEL ? '/var/task/dist' : __dirname, 'static');

module.exports = async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const filePath = path.join(DIST, p);
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  let stat;
  try { stat = await fs.promises.stat(filePath); } catch { stat = null; }
  if (!stat || !stat.isFile()) {
    const idx = path.join(DIST, 'index.html');
    const data = await fs.promises.readFile(idx);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data); return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', ext === '.html' ? 'no-store' : 'public, max-age=31536000, immutable');
  res.writeHead(200);
  fs.createReadStream(filePath).pipe(res);
};
