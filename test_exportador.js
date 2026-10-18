'use strict';

const assert = require('assert');

const clicks = [];
const revokedUrls = [];
let objectUrlCounter = 0;

global.document = {
  body: {
    appendChild() {},
    removeChild() {},
  },
  createElement(tagName) {
    assert.strictEqual(tagName, 'a');
    return {
      click() {
        clicks.push({ href: this.href, download: this.download });
      },
    };
  },
};
global.URL = {
  createObjectURL() {
    objectUrlCounter += 1;
    return `blob:test-${objectUrlCounter}`;
  },
  revokeObjectURL(url) {
    revokedUrls.push(url);
  },
};

const exportador = require('./src/exportador.js');

assert.strictEqual(
  exportador.descargarArchivos(
    [
      { blob: new Blob(['csv']), nombre: 'reporte diario.csv' },
      { blob: new Blob(['pdf']), nombre: 'reporte diario.pdf' },
    ],
    0
  ),
  true,
  'all files should be scheduled for download'
);
assert.deepStrictEqual(
  clicks.map((click) => click.download),
  ['reporte_diario.csv', 'reporte_diario.pdf'],
  'downloaded files should use safe, stable names'
);
setTimeout(() => {
  assert.deepStrictEqual(revokedUrls, ['blob:test-1', 'blob:test-2']);
  assert.strictEqual(exportador.descargarArchivos([], 0), false);
  console.log('Export download helper tests OK');
}, 0);
