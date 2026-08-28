/**
 * check_assets.js
 * Auditoría de integridad de assets de la PWA.
 *
 * Verifica que todo archivo local referenciado realmente exista en disco:
 *  - sw.js       -> STATIC_ASSETS (precache)
 *  - manifest.json -> icons[].src
 *  - index.html  -> href/src de rutas estáticas relativas (./...)
 *
 * Uso: node check_assets.js
 * Sale con código 0 en éxito y 1 si falta algún asset.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const missing = [];
let checked = 0;

function exists(rel) {
  checked++;
  const clean = rel.replace(/^\//, '').replace(/\?.*$/, '');
  const p = path.join(ROOT, clean);
  if (!fs.existsSync(p)) {
    missing.push(`${rel}  (archivo referenciado no existe)`);
  }
}

function read(p) {
  try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
  catch (ignore) { return ''; }
}

// --- 1. Service Worker STATIC_ASSETS ---
const sw = read('sw.js');
const asMatch = sw.match(/STATIC_ASSETS\s*=\s*(\[[\s\S]*?\]);/);
if (asMatch) {
  let body = asMatch[1]
    .replace(/\/\/[^\n]*/g, '')    // quitar comentarios de línea
    .replace(/,\s*]/g, ']');
  let arr;
  try { arr = JSON.parse(body.replace(/'/g, '"')); }
  catch { arr = (body.match(/'[^']+'/g) || []).map(s => s.slice(1, -1)); }
  console.log(`Verificando ${arr.length} assets de sw.js (precache)...`);
  arr.forEach(u => {
    if (!u.startsWith('http') && u !== './') exists(u);
  });
} else {
  missing.push('sw.js no contiene STATIC_ASSETS');
}

// --- 2. manifest.json ---
try {
  const manifest = JSON.parse(read('manifest.json'));
  const icons = manifest.icons || [];
  console.log(`Verificando ${icons.length} iconos de manifest.json...`);
  icons.forEach(ic => { if (ic && ic.src) exists(ic.src); });
} catch {
  missing.push('manifest.json no es JSON válido');
}

// --- 3. index.html recursos relativos ---
const html = read('index.html');
// src="..." y href="..." que empiecen con ./
const refs = [...html.matchAll(/(?:src|href)="(\.\/[^"#]+\.(?:png|svg|js|json|html|ico|css|woff2?|jpg|webp|mp4))"/g)]
  .map(m => m[1])
  .filter((v, i, a) => a.indexOf(v) === i); // únicos
console.log(`Verificando ${refs.length} recursos únicos de index.html...`);
refs.forEach(r => exists(r));

// --- Reporte ---
if (missing.length) {
  console.error(`\n❌ ${missing.length} asset(s) faltante(s):`);
  missing.forEach(m => console.error('   - ' + m));
  console.error(`\nSe verificaron ${checked} rutas. Resultado: ERROR`);
  process.exit(1);
} else {
  console.log(`\n✔ Integridad de assets OK (${checked} rutas verificadas, ninguna falta).`);
  process.exit(0);
}