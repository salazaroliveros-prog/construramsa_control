// check_inline.js — Valida la sintaxis de los <script> inline de index.html (sin ejecutarlos).
// También compila el contenido del script de Google Apps Script (NUBE_SCRIPT) que el usuario
// copia y pega en script.google.com, verificando además sus puntos de entrada obligatorios.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
// Coincide con <script ...>contenido</script> que NO tengan atributo src=
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m,
  i = 0,
  errores = 0,
  total = 0;
while ((m = re.exec(html)) !== null) {
  const attrs = m[1] || '';
  const body = m[2] || '';
  if (/src\s*=/.test(attrs)) continue; // scripts externos, no inline
  total++;
  try {
    new Function(body);
  } catch (e) {
    errores++;
    i++;
    console.error(`[${i}] SCRIPT INLINE #${total} (offset ${m.index}) -> ERROR: ${e.message}`);
  }
}
// — Validación del script de Google Apps Script (NUBE_SCRIPT) —
// El usuario lo copia/pega en script.google.com, así que debe compilar limpio
// y exponer los puntos de entrada que usa la app y la guía.
const NUBE_ENTRY_POINTS = [
  'doGet',
  'doPost',
  'crearCarpetaPrueba',
  'buscarCarpeta',
  'guardarArchivo',
  'borrarRespaldos',
];
const nubeStart = html.indexOf('const NUBE_SCRIPT = [');
if (nubeStart < 0) {
  errores++;
  console.error('[NUBE_SCRIPT] No se encontró "const NUBE_SCRIPT" en index.html');
} else {
  const joinPos = html.indexOf('.join(', nubeStart);
  const literal = html.slice(nubeStart + 'const NUBE_SCRIPT = '.length, joinPos).trim(); // incluye el "]" de cierre
  try {
    const arr = Function('"use strict"; return (' + literal + ')')();
    if (!Array.isArray(arr) || arr.length === 0)
      throw new Error('NUBE_SCRIPT no es un array de líneas');
    const nubeCode = arr.join('\n');
    new Function(nubeCode); // compila el código literal de Apps Script
    NUBE_ENTRY_POINTS.forEach((fn) => {
      if (!new RegExp('function\\s+' + fn + '\\s*\\(').test(nubeCode)) {
        errores++;
        console.error(`[NUBE_SCRIPT] Falta la función obligatoria: ${fn}()`);
      }
    });
    console.log(
      `NUBE_SCRIPT compilado OK: ${arr.length} líneas, ${NUBE_ENTRY_POINTS.length} puntos de entrada verificados`
    );
  } catch (e) {
    errores++;
    console.error(`[NUBE_SCRIPT] ERROR de compilación: ${e.message}`);
  }
}

console.log(`Scripts inline validados: ${total}; errores: ${errores}`);
process.exit(errores ? 1 : 0);
