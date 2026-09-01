/**
 * check_versions.js
 * Auditoría de consistencia de versión en toda la PWA.
 * Fuente de verdad: package.json -> version
 *
 * Verifica que la versión esté presente y coherente en:
 *  - package.json
 *  - index.html (const APP_VERSION, db.version, UI "Versión:")
 *  - sw.js        (CACHE_NAME, cabecera del archivo)
 *  - manifest.json (no declara versión; solo informativo)
 *
 * Uso: node check_versions.js
 * Sale con código 0 en éxito y 1 si hay inconsistencias.
 */
const fs = require('fs');
const path = require('path');

const errors = [];
const notes = [];

function read(p) {
  try { return fs.readFileSync(path.join(__dirname, p), 'utf8'); }
  catch (e) { errors.push(`No se pudo leer ${p}: ${e.message}`); return ''; }
}

// 1. Fuente de verdad: package.json
let pkg;
try {
  pkg = JSON.parse(read('package.json'));
} catch (e) {
  errors.push('package.json no es JSON válido');
  finish();
  process.exit(1);
  return;
}
const VERSION = pkg.version;
if (!VERSION) {
  errors.push('package.json no define "version"');
}
console.log(`✔ Fuente de verdad (package.json): ${VERSION}`);

// 2. index.html
const html = read('index.html');
const appVersionDecls = (html.match(/const APP_VERSION\s*=\s*'[^']+'/g) || []);
if (appVersionDecls.length === 0) {
  errors.push('index.html no declara const APP_VERSION');
} else if (appVersionDecls.length > 1) {
  errors.push(`index.html declara const APP_VERSION ${appVersionDecls.length} veces (se espera 1): ${appVersionDecls.join(', ')}`);
} else if (!appVersionDecls[0].includes(`'${VERSION}'`)) {
  errors.push(`APP_VERSION en index.html es ${appVersionDecls[0]} pero debería ser '${VERSION}'`);
} else {
  notes.push(`APP_VERSION = '${VERSION}' (1 declaración)`);
}

// db.version en inicializarDB y migrarDB
const dbInitVersion = (html.match(/version:\s*'[^']+',/) || [])[0];
const dbMigrateVersion = (html.match(/db\.version\s*=\s*'[^']+'/) || [])[0];
let dbOk = 0;
if (dbInitVersion && dbInitVersion.includes(VERSION)) dbOk++;
if (dbMigrateVersion && dbMigrateVersion.includes(VERSION)) dbOk++;
if (dbOk >= 2) {
  notes.push(`db.version = '${VERSION}' en inicializarDB y migrarDB`);
} else {
  errors.push(
    `Se esperaban coincidencias de db.version '${VERSION}' en inicializarDB y migrarDB; se encontraron ${dbOk} ` +
    `(inicializarDB: ${dbInitVersion || 'n/a'}, migrarDB: ${dbMigrateVersion || 'n/a'})`
  );
}

// UI "Versión:" visible
const uiVersion = (html.match(/Versión:\s*[0-9.]+/g) || []);
if (uiVersion.length && !uiVersion[0].includes(VERSION)) {
  errors.push(`La UI muestra "${uiVersion[0]}" pero debería mostrar Versión ${VERSION}`);
} else if (uiVersion.length) {
  notes.push(`UI "Versión:" coincide (${VERSION})`);
}

// 3. sw.js
const sw = read('sw.js');
const cacheMatch = (sw.match(/CACHE_NAME\s*=\s*'[^']+'/) || [null])[0];
if (cacheMatch && cacheMatch.includes(`v${VERSION}`)) {
  notes.push(`CACHE_NAME incluye v${VERSION}`);
} else {
  errors.push(`CACHE_NAME en sw.js (${cacheMatch || 'no encontrado'}) no coincide con v${VERSION}`);
}
const swHeaderMatches = (sw.match(/Control de Obra\s*v[0-9.]+/g) || []);
if (swHeaderMatches.length && swHeaderMatches.some(s => s.includes(`v${VERSION}`))) {
  notes.push(`sw.js header menciona v${VERSION}`);
} else {
  errors.push('sw.js header no menciona "Control de Obra v' + VERSION + '"');
}

// 4. src/config.js
const configJs = read('src/config.js');
const configVersionMatch = (configJs.match(/const APP_VERSION\s*=\s*'[^']+'/) || [null])[0];
if (configVersionMatch && configVersionMatch.includes(`'${VERSION}'`)) {
  notes.push(`src/config.js APP_VERSION = '${VERSION}'`);
} else {
  errors.push(`src/config.js APP_VERSION (${configVersionMatch || 'no encontrado'}) no coincide con '${VERSION}'`);
}

// 5. construramsa_db.json
try {
  const dbJson = JSON.parse(read('construramsa_db.json'));
  if (dbJson.version === VERSION) {
    notes.push(`construramsa_db.json version = '${VERSION}'`);
  } else {
    errors.push(`construramsa_db.json version es '${dbJson.version}' pero debería ser '${VERSION}'`);
  }
} catch (e) {
  errors.push('construramsa_db.json no es JSON válido o no tiene campo version');
}

// 6. manifest.json (informativo)
try {
  JSON.parse(read('manifest.json'));
  notes.push('manifest.json es JSON válido (no declara versión explícita)');
} catch (e) {
  errors.push('manifest.json no es JSON válido');
}

// Reporte
function finish() {
  if (errors.length) {
    console.error('\n❌ Inconsistencias de versión detectadas:');
    errors.forEach(e => console.error('   - ' + e));
    notes.forEach(n => console.log('   · ' + n));
    console.error('\nResultado: ERROR (versiones no alineadas)');
    process.exit(1);
  } else {
    console.log('\n✔ Todas las versiones están alineadas a ' + VERSION + ':');
    notes.forEach(n => console.log('   · ' + n));
    console.log('\nResultado: OK');
    process.exit(0);
  }
}

finish();