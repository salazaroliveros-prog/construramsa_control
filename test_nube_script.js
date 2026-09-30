// Prueba funcional del NUBE_SCRIPT con mocks de Apps Script
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('const NUBE_SCRIPT = [');
const joinPos = html.indexOf('.join(', start);
const arr = Function(
  '"use strict"; return (' + html.slice(start + 'const NUBE_SCRIPT = '.length, joinPos).trim() + ')'
)();
const code = arr.join('\n');

// ── Mocks de Google Apps Script ──
const store = new Map(); // name -> content
function mockFiles(names) {
  let i = 0;
  return {
    hasNext: () => i < names.length,
    next: () => {
      const name = names[i++];
      return {
        setContent: (c) => {
          store.set(name, c);
        },
        getBlob: () => ({ getDataAsString: () => store.get(name) }),
        getName: () => name,
      };
    },
  };
}
const folder = {
  getFilesByName: (nom) => mockFiles([...store.keys()].filter((k) => k === nom)),
  getFiles: () => mockFiles([...store.keys()]),
  createFile: (blob) => {
    store.set(blob.nombre, blob.contenido);
    return {};
  },
  removeFile: (f) => {
    store.delete(f.getName());
  },
};
global.DriveApp = {
  getFoldersByName: () => {
    let used = false;
    return {
      hasNext: () => !used,
      next: () => {
        used = true;
        return folder;
      },
    };
  },
  createFolder: () => folder,
};
global.Utilities = { newBlob: (contenido, mime, nombre) => ({ contenido, mime, nombre }) };
global.ContentService = {
  MimeType: { JSON: 'application/json', JAVASCRIPT: 'application/javascript' },
  createTextOutput: (t) => {
    const o = {
      _t: t,
      _m: null,
      setMimeType(m) {
        o._m = m;
        return o;
      },
    };
    return o;
  },
};

// Mock de PropertiesService para verificarToken (gestiona global.__GAS_TOKENS)
global.PropertiesService = {
  getScriptProperties: () => ({
    getProperty: (k) => global.__GAS_TOKENS[k],
    setProperty: (k, v) => {
      global.__GAS_TOKENS[k] = v;
    },
  }),
};
global.__GAS_TOKENS = {}; // {} => TOKEN no definido => modo ABIERTO

// Cargar el script y capturar sus puntos de entrada
const api = new Function(
  code + '\nreturn { doGet: doGet, doPost: doPost, crearCarpetaPrueba: crearCarpetaPrueba };'
)();
const { doGet, doPost, crearCarpetaPrueba } = api;

let pass = 0,
  fail = 0;
function check(name, cond, extra) {
  if (cond) {
    pass++;
    console.log('  PASS ' + name);
  } else {
    fail++;
    console.log('  FAIL ' + name + (extra ? ' -> ' + extra : ''));
  }
}
const parse = (out) => JSON.parse(out._t);

// 1. doPost con data válida
let r = doPost({
  postData: { contents: JSON.stringify({ data: { version: '2.9.4', prueba: 1 } }) },
});
check('doPost guardar ok:true', parse(r).ok === true, r._t);
check(
  'archivo latest escrito',
  store.get('control_obra_latest.json') === JSON.stringify({ version: '2.9.4', prueba: 1 })
);
check(
  'archivo diario escrito',
  [...store.keys()].some((k) => /^control_obra_\d{4}-\d{2}-\d{2}\.json$/.test(k))
);
check('doPost mime JSON', r._m === 'application/json');

// 2. doGet sin prefix (JSON)
r = doGet({ parameter: {} });
check('doGet JSON ok:true', parse(r).ok === true && parse(r).data.version === '2.9.4', r._t);
check('doGet mime JSON', r._m === 'application/json');

// 3. doGet con prefix (JSONP)
r = doGet({ parameter: { prefix: '__nubeGasCallback_1_abc' } });
check('doGet JSONP envuelve callback', /^__nubeGasCallback_1_abc\(\{.*\}\);$/.test(r._t), r._t);
check('doGet JSONP mime JS', r._m === 'application/javascript');

// 4. JSONP con inyección en prefix -> cae a JSON plano
r = doGet({ parameter: { prefix: 'a(1);alert(2);//' } });
check('doGet rechaza prefix malicioso', !r._t.startsWith('a(1)'), r._t.slice(0, 40));

// 5. doPost sin cuerpo
r = doPost({});
check('doPost sin cuerpo -> ok:false', parse(r).ok === false, r._t);

// 6. doPost sin data
r = doPost({ postData: { contents: JSON.stringify({ otra: 1 }) } });
check('doPost sin data -> ok:false', parse(r).ok === false && /data/.test(parse(r).error), r._t);

// 7. doPost con JSON inválido
r = doPost({ postData: { contents: '{no-json' } });
check('doPost JSON inválido -> ok:false', parse(r).ok === false, r._t);

// 8. re-ejecución (actualiza sin duplicar)
r = doPost({ postData: { contents: JSON.stringify({ data: { v: 2 } }) } });
check('doPost re-ejecución ok', parse(r).ok === true);
check(
  'sin duplicados de latest',
  [...store.keys()].filter((k) => k === 'control_obra_latest.json').length === 1
);

// 9. clear -> borra latest + diarios
r = doPost({ postData: { contents: JSON.stringify({ clear: true }) } });
check('doPost clear ok', parse(r).ok === true && parse(r).cleared === true, r._t);
check(
  'clear elimina todos los respaldos',
  [...store.keys()].filter((k) => k.startsWith('control_obra_')).length === 0,
  [...store.keys()].join(',')
);

// 10. doGet sin respaldo
r = doGet({ parameter: {} });
check('doGet sin respaldo -> ok:false', parse(r).ok === false, r._t);

// 11. crearCarpetaPrueba (punto de entrada de la guía)
check(
  'crearCarpetaPrueba ejecutable',
  typeof crearCarpetaPrueba === 'function' && /Carpeta/.test(crearCarpetaPrueba())
);

// ── 12. Token obligatorio: modo ABIERTO (TOKEN no definido) ──
global.__GAS_TOKENS = {};
r = doPost({ postData: { contents: JSON.stringify({ data: { modopen: 1 } }) } });
check('modo abierto: doPost sin token funciona (retrocompatible)', parse(r).ok === true, r._t);
check(
  'modo abierto: doGet sin token funciona (retrocompatible)',
  parse(doGet({ parameter: {} })).ok === true && parse(doGet({ parameter: {} })).data.modopen === 1
);

// ── 13. Token obligatorio: TOKEN definido en propiedades del script ──
global.__GAS_TOKENS = { TOKEN: 'secreto-app' };

// 13a. doPost sin token -> rechazado
r = doPost({ postData: { contents: JSON.stringify({ data: { t: 1 } }) } });
check(
  'modo token: doPost sin token -> ok:false',
  parse(r).ok === false && /Token|invalido/i.test(parse(r).error),
  parse(r).error
);

// 13b. doPost con token correcto -> ok
r = doPost({
  postData: { contents: JSON.stringify({ data: { tokenizado: 1 } }) },
  parameter: { token: 'secreto-app' },
});
check('modo token: doPost con token correcto -> ok:true', parse(r).ok === true, r._t);
check(
  'modo token: doPost guarda data tokenizada',
  store.get('control_obra_latest.json') === JSON.stringify({ tokenizado: 1 })
);

// 13c. doGet sin token -> rechazado
r = doGet({ parameter: {} });
check(
  'modo token: doGet sin token -> ok:false',
  parse(r).ok === false && /Token|invalido/i.test(parse(r).error),
  parse(r).error
);

// 13d. doGet con token correcto -> ok
r = doGet({ parameter: { token: 'secreto-app' } });
check(
  'modo token: doGet con token correcto -> ok:true',
  parse(r).ok === true && parse(r).data.tokenizado === 1,
  r._t
);

// 13e. doGet con token incorrecto -> rechazado
r = doGet({ parameter: { token: 'otro' } });
check(
  'modo token: doGet token incorrecto -> ok:false',
  parse(r).ok === false && /Token|invalido/i.test(parse(r).error),
  parse(r).error
);

// 13f. doPost clear con token correcto
store.clear();
store.set('control_obra_latest.json', JSON.stringify({ v: 1 }));
r = doPost({
  postData: { contents: JSON.stringify({ data: { v: 2 } }) },
  parameter: { token: 'secreto-app' },
});
r = doPost({
  postData: { contents: JSON.stringify({ clear: true }) },
  parameter: { token: 'secreto-app' },
});
check(
  'modo token: clear con token correcto -> ok:true',
  parse(r).ok === true && parse(r).cleared === true,
  r._t
);
check(
  'modo token: clear borra backups',
  [...store.keys()].filter((k) => k.startsWith('control_obra_')).length === 0,
  [...store.keys()].join(',')
);

// 13g. JSONP con token
r = doGet({ parameter: { token: 'secreto-app', prefix: '__nubeGasCallback_1_xyz' } });
check(
  'modo token: doGet JSONP con token -> callback',
  /^__nubeGasCallback_1_xyz\(\{.*\}\);$/.test(r._t),
  r._t.slice(0, 80)
);

// 13h. clear con token incorrecto NO borra
store.clear();
store.set('control_obra_latest.json', JSON.stringify({ v: 9 }));
r = doPost({
  postData: { contents: JSON.stringify({ data: { v: 1 } }) },
  parameter: { token: 'secreto-app' },
});
r = doPost({
  postData: { contents: JSON.stringify({ clear: true }) },
  parameter: { token: 'WRONG' },
});
check(
  'modo token: clear con token incorrecto no borra latest',
  parse(r).ok === false && store.get('control_obra_latest.json') === JSON.stringify({ v: 1 }),
  r._t
);

console.log(`\nRESULTADO: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
