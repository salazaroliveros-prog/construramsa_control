// check_inline.js — Valida la sintaxis de los <script> inline de index.html (sin ejecutarlos).
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
// Coincide con <script ...>contenido</script> que NO tengan atributo src=
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m, i = 0, errores = 0, total = 0;
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
console.log(`Scripts inline validados: ${total}; errores: ${errores}`);
process.exit(errores ? 1 : 0);
