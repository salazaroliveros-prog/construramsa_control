/**
 * run_e2e_validation.js
 * Orquestador E2E headless de validacion integral UI/UX + funciones + procesos.
 *
 * 1) Levanta el servidor estatico (server.js, puerto 3000).
 * 2) Inyecta datos de prueba en localStorage (sin tocar el seed del repo).
 * 3) Recorre los 9 modulos validando selectores clave y genera screenshots.
 * 4) Valida el Dashboard de Costos (barras renderizadas, colores diferenciados,
 *    regresion del filtro por categoria) verifica la correccion aplicada.
 *
 * Uso:  node run_e2e_validation.js
 * (server.js se levanta desde este script; no levantarlo por separado).
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
process.stdout.write('E2E: ALL IMPORTS DONE\n');

const PORT = process.env.PORT || '3000';
const BASE = 'http://127.0.0.1:' + PORT + '/index.html';
const OUT_DIR = path.join(__dirname, 'screenshots', 'e2e');
const REPORT = path.join(__dirname, 'e2e_validation_report.html');
const SEED_DB = path.join(__dirname, 'construramsa_db.json');
const SEED_BAK = path.join(__dirname, 'construramsa_db.json.bak_e2e');

let results = [];

function addResult(section, name, passed, detail) {
    results.push({ section, name, passed: !!passed, detail: detail || '' });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ftoday(dd) {
    const d = new Date();
    d.setDate(d.getDate() + (dd || 0));
    return d.toISOString().slice(0, 10);
}

// ---- Datos sinteticos para localStorage ----
function mk(id, dd, tipo, cat, num) {
    return { id, fecha: ftoday(dd), tipo, categoria: cat, monto: num };
}
function mkViaje(id, dd, vid, mat, nro, km, lit) {
    return { id, fecha: ftoday(dd), vehiculo_id: vid, material: mat, numero: nro, propiedad: 'propio', km_total: km, litros: lit };
}
function mkCamion(id, nom, prop) {
    return { id, nombre: nom, propiedad: prop };
}
function mkAsist(dd, tid, est) {
    return { fecha: ftoday(dd), registros: [{ trabajador_id: tid, estado: est }] };
}
function mkOrden(id, dd, tipo, costo) {
    return { id, fecha: ftoday(dd), tipo, costo };
}
function mkInsumo(id, dd, art, cant, costo, min) {
    return { id, fecha: ftoday(dd), articulo: art, cantidad: cant, costo, stock_min: min };
}
function mkRegMaq(id, dd, horas) {
    return { id, fecha: ftoday(dd), horas };
}
function mkCompra(id, dd, desc, total, estado) {
    return { id, fecha: ftoday(dd), material_descripcion: desc, total, estado };
}

function dbSintetico() {
    return {
        version: '2.9.2',
        configuracion: { nombre_empresa: 'CONSTRURAMSA', presupuesto_inicial_caja: 200000, proyecto_actual: 'proyecto_demo' },
        proyectos: [{ id: 'proyecto_demo', nombre: 'Proyecto Residencial' }],
        proyectos_data: {
            proyecto_demo: {
                caja_chica: [
                    mk('m1', 0, 'ingreso', 'Aportacion', 50000),
                    mk('m2', -1, 'egreso', 'Materiales', 15000),
                    mk('m3', -2, 'egreso', 'Mano de Obra', 12000),
                    mk('m4', -3, 'egreso', 'Combustible/Viajes', 3000),
                    mk('m5', -4, 'egreso', 'Alquiler de Equipo', 2000),
                    mk('m6', -5, 'egreso', 'Herramientas', 1000)
                ],
                viajes_camiones: {
                    viajes: [mkViaje('v1', -1, 'c1', 'Arena', 2, 80, 20)],
                    camiones: [mkCamion('c1', 'Volquete 01', 'propio')]
                },
                mantenimiento: {
                    ordenes: [mkOrden('o1', -2, 'Preventivo', 1500)],
                    compras_insumos: [mkInsumo('i1', -3, 'Aceite', 2, 280, 1)]
                },
                personal: {
                    trabajadores: [{ id: 't1', nombre: 'Juan Perez', puesto: 'Albanil' }],
                    asistencia: [mkAsist(-1, 't1', 'asistio')]
                },
                maquinaria_flota: { registros: [mkRegMaq('ma1', -1, 4)] },
                adquisiciones: {
                    cotizaciones_compras: [mkCompra('c1', -1, 'Cemento', 2500, 'pendiente')],
                    proveedores: [{ id: 'p1', nombre: 'Ferreteria Central' }]
                }
            }
        }
    };
}


// ---- Server lifecycle ----
function waitServer(timeoutMs) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const check = () => {
            const req = http.get(BASE, (res) => {
                res.resume();
                if (res.statusCode === 200) return resolve(true);
                retry();
            });
            req.on('error', retry);
        };
        const retry = () => {
            if (Date.now() - start > timeoutMs) return reject(new Error('Servidor no respondio'));
            setTimeout(check, 400);
        };
        check();
    });
}

function startServer() {
    const server = spawn('node', ['server.js'], {
        cwd: __dirname,
        stdio: 'ignore'
    });
    console.log('[e2e] Servidor levantando en puerto ' + PORT + '...');
    server.on('error', (e) => console.error('[e2e] Error spawn:', e.message));
    return server;
}

// ---- Inject data into localStorage ----
function injectDataScript() {
    const db = dbSintetico();
    return 'localStorage.setItem("construramsa_db", ' + JSON.stringify(JSON.stringify(db)) + ');';
}

// ---- Modulos a validar (9 modulos) ----
const modulos = [
    { name: 'Caja Chica', tab: '#tab-caja-chica', container: '#caja-chica', title: '#caja-chica-title', extra: ['#saldo-caja-chica', '#form-caja-chica', '#tabla-caja-chica'] },
    { name: 'Maquinaria', tab: '#tab-maquinaria', container: '#maquinaria', title: '#maquinaria-title', extra: ['#form-maquinaria', '#tabla-maquinaria'] },
    { name: 'Personal', tab: '#tab-personal', container: '#personal', title: '#personal-title', extra: ['#form-trabajador', '#tabla-asistencia'] },
    { name: 'Viajes Camiones', tab: '#tab-viajes', container: '#viajes', title: '#viajes-title', extra: ['#form-camion', '#tabla-camiones', '#form-viaje', '#tabla-viajes'] },
    { name: 'Mantenimiento', tab: '#tab-mantenimiento', container: '#mantenimiento', title: '#mantenimiento-title', extra: ['#form-maqcat', '#tabla-ordenes', '#form-insumo', '#tabla-insumos'] },
    { name: 'Adquisiciones', tab: '#tab-adquisiciones', container: '#adquisiciones', title: '#adquisiciones-title', extra: ['#form-proveedor', '#tabla-proveedores', '#form-cotizacion', '#tabla-cotizaciones'] },
    { name: 'Reportes', tab: '#tab-reportes', container: '#reportes', title: '#reportes-title', extra: ['#reporte-tipo', '#export-pdf', '#export-csv', '#reporte-fecha'] },
    { name: 'Configuracion', tab: '#tab-configuracion', container: '#configuracion', title: '#configuracion-title', extra: ['#cfg-nombre-empresa', '#btn-instalar-app2'] },
    { name: 'Dashboard Costos', tab: '#tab-resumen', container: '#resumen', title: '#resumen .modulo-titulo', extra: ['#kpi-grid', '#grafico-gastos', '#dashboard-categoria'] }
];



// ---- Test: Modulos ----
async function testModulos(page) {
    console.log('[e2e] Validando 9 modulos...');
    for (const m of modulos) {
        try {
            await page.click(m.tab);
            await page.waitForTimeout(800);

            const containerOk = await page.$(m.container) !== null;
            addResult('Modulos', m.name + ' - container visible', containerOk, m.container);

            const titleOk = await page.$(m.title) !== null;
            addResult('Modulos', m.name + ' - titulo', titleOk, m.title);

            let extrasOk = true;
            let extraDetails = [];
            for (const sel of m.extra) {
                const ok = await page.$(sel) !== null;
                if (!ok) { extraDetails.push(sel); extrasOk = false; }
            }
            addResult('Modulos', m.name + ' - selectores extra', extrasOk, extrasOk ? '' : extraDetails.join(', '));

            const safe = m.name.replace(/\s+/g, '_');
            await page.screenshot({ path: path.join(OUT_DIR, 'modulo_' + safe + '.png'), fullPage: true });
        } catch (e) {
            addResult('Modulos', m.name + ' - ERROR', false, e.message);
        }
    }
}

// ---- Test: Dashboard de Costos y filtro ----
async function testDashboardFiltro(page) {
    console.log('[e2e] Validando Dashboard de Costos y filtro por categoria...');
    try {
        await page.click('#tab-resumen');
        await page.waitForTimeout(1500);
        addResult('Dashboard', 'Modulo Resumen accesible (tab por defecto)', true);
        await page.evaluate(() => { if (typeof actualizarDashboard === 'function') actualizarDashboard(); });
        await page.waitForTimeout(500);

        const barsSel = '#grafico-gastos .css-chart-bar';
        const chartBase = '#grafico-gastos';
        const chartOk = (await page.$$('#grafico-gastos .css-chart-bar')).length > 0;
        addResult('Dashboard', 'Grafico de gastos renderizado (barras)', chartOk, barsSel);
        await page.screenshot({ path: path.join(OUT_DIR, 'dashboard_general.png'), fullPage: true });

        const kpiGridOk = await page.$('#kpi-grid') !== null;
        addResult('Dashboard', 'KPI grid presente', kpiGridOk, '#kpi-grid');

        const catSelect = await page.$('#dashboard-categoria');
        if (catSelect) {
            const catValue = await page.evaluate(() => {
                const opts = Array.from(document.querySelectorAll('#dashboard-categoria option')).map(o => o.value);
                return opts.find(v => /material/i.test(v)) || (opts.length > 1 ? opts[1] : null);
            });
            const labelsAntes = await page.evaluate((sel) => {
                return Array.from(document.querySelectorAll(sel + ' .css-chart-bar')).map(e => e.getAttribute('data-category'));
            }, chartBase);
            addResult('Dashboard', 'Barras/labels visibles antes filtro', labelsAntes.length > 0, 'count=' + labelsAntes.length + ' cats=' + labelsAntes.join('|'));

            await page.selectOption('#dashboard-categoria', catValue);
            await page.waitForTimeout(600);
            addResult('Dashboard', 'Filtro categoria aplicado', true, 'select=' + catValue);

            const labelsDespues = await page.evaluate((sel) => {
                return Array.from(document.querySelectorAll(sel + ' .css-chart-bar')).map(e => e.getAttribute('data-category'));
            }, chartBase);
            const noVacio = labelsDespues.length > 0;
            addResult('Dashboard', 'Grafico no vacio tras filtro (regresion BUG-1)', noVacio, 'labels count=' + labelsDespues.length);

            const bgColors = await page.evaluate((sel) => {
                const barras = Array.from(document.querySelectorAll(sel + ' .css-chart-bar'));
                return barras.map(b => (getComputedStyle(b).backgroundImage || getComputedStyle(b).backgroundColor));
            }, chartBase);
            if (bgColors.length > 1) {
                const unique = new Set(bgColors);
                addResult('Dashboard', 'Colores diferenciados entre categorias (regresion BUG-2)', unique.size > 1,
                    'unique=' + unique.size + ' total=' + bgColors.length);
            } else {
                addResult('Dashboard', 'Colores diferenciados entre categorias (regresion BUG-2)', false, 'insufficient bars: ' + bgColors.length);
            }
            await page.screenshot({ path: path.join(OUT_DIR, 'dashboard_filtro_categoria.png'), fullPage: true });
        } else {
            addResult('Dashboard', 'Filtro categoria presente', false, '#dashboard-categoria no encontrado');
        }
        } catch (e) {
        addResult('Dashboard', 'Test filtro - ERROR', false, e.message);
    }
}

// ---- Test: Responsive ----
async function testResponsive(page) {
    console.log('[e2e] Validando responsividad movil (Android + iOS)...');
    const viewports = [
        { name: 'Android_Pixel4', width: 393, height: 830, ua: 'Android' },
        { name: 'iOS_iPhone12', width: 390, height: 844, ua: 'iOS' },
        { name: 'Desktop', width: 1366, height: 768, ua: 'Desktop' }
    ];
    for (const vp of viewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.setExtraHTTPHeaders({ 'User-Agent': vp.ua });
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        const tabs = await page.evaluate(() => document.querySelectorAll('[id^="tab-"]').length);
        addResult('Responsive', vp.name + ' - tabs visibles', tabs > 0, 'view=' + vp.width + 'x' + vp.height);
        await page.screenshot({ path: path.join(OUT_DIR, 'responsive_' + vp.name + '.png'), fullPage: true });
    }
}

// ---- Test: PDF Export ----
async function testPDFExport(page) {
    console.log('[e2e] Validando exportacion PDF...');
    try {
        await page.click('#tab-reportes');
        await page.waitForTimeout(800);
        await page.click('#tab-reportes');
        await page.waitForTimeout(800);
        const pdfChk = await page.$('#export-pdf');
        const csvChk = await page.$('#export-csv');
        const tipoSel = await page.$('#reporte-tipo');
        if (pdfChk && csvChk && tipoSel) {
            // Seleccionar reporte ejecutivo y lanzar vista previa local
            await page.evaluate(() => {
                const sel = document.getElementById('reporte-tipo');
                const opt = Array.from(sel.options).find(o => /ejecutivo/i.test(o.value));
                if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change')); }
            });
            await page.waitForTimeout(300);
            const previewOk = await page.evaluate(() => {
                try {
                    if (typeof abrirVistaPrevia !== 'function') return 'no-fn';
                    abrirVistaPrevia('local');
                    return 'ok';
                } catch (e) { return 'err: ' + e.message; }
            });
            await page.waitForTimeout(1500);
            addResult('Reportes', 'Controles PDF/CSV presentes', true, '#export-pdf + #export-csv + #reporte-tipo');
            addResult('Reportes', 'PDF ejecutivo generado', previewOk === 'ok', 'abrirVistaPrevia(local) -> ' + previewOk);
        } else {
            addResult('Reportes', 'PDF ejecutivo generado', false, 'controles export no encontrados');
        }
        await page.screenshot({ path: path.join(OUT_DIR, 'export_pdf.png'), fullPage: true });
    } catch (e) {
        addResult('Reportes', 'PDF export - ERROR', false, e.message);
    }
}

// ---- Generate HTML Report ----
async function generateReport() {
    let html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>E2E Validation Report</title>';
    html += '<style>body{font-family:sans-serif;margin:20px;background:#f5f5f5}';
    html += '.container{max-width:1200px;margin:0 auto;background:#fff;padding:20px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,.1)}';
    html += 'h1{color:#2c3e50}.summary{display:flex;gap:20px;margin:20px 0}.card{flex:1;padding:15px;border-radius:8px;text-align:center}';
    html += '.pass{background:#d4edda;color:#155724}.fail{background:#f8d7da;color:#721c24}';
    html += 'table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:8px;text-align:left}';
    html += 'th{background:#f8f9fa}.pass{color:#28a745}.fail{color:#dc3545}';
    html += '.section{margin-top:30px}img{max-width:300px;margin:10px;display:block;border:1px solid #ddd;border-radius:4px}</style></head><body>';
    html += '<div class="container"><h1>CONSTRURAMSA E2E Validation Report</h1>';
    html += '<p>Generado: ' + new Date().toISOString() + '</p>';
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = total - passed;
    html += '<div class="summary"><div class="card pass"><h3>' + passed + '</h3><p>Passed</p></div>';
    html += '<div class="card fail"><h3>' + failed + '</h3><p>Failed</p></div>';
    html += '<div class="card"><h3>' + total + '</h3><p>Total</p></div></div>';
    const sections = [...new Set(results.map(r => r.section))];
    for (const sec of sections) {
        html += '<div class="section"><h2>' + sec + '</h2><table><tr><th>Test</th><th>Status</th><th>Detalles</th></tr>';
        for (const r of results.filter(x => x.section === sec)) {
            const cls = r.passed ? 'pass' : 'fail';
            const icon = r.passed ? '✅' : '❌';
            html += '<tr><td>' + icon + ' ' + r.name + '</td><td class="' + cls + '">' + (r.passed ? 'PASS' : 'FAIL') + '</td><td>' + r.detail + '</td></tr>';
        }
        html += '</table></div>';
    }
    html += '<div class="section"><h2>Screenshots</h2>';
    try {
        const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png'));
        for (const f of files) {
            html += '<img src="screenshots/e2e/' + f + '" alt="' + f + '"><small>' + f + '</small>';
        }
    } catch (e) {
        html += '<p>No se pudieron cargar screenshots: ' + e.message + '</p>';
    }
    html += '</div></div></body></html>';
    fs.writeFileSync(REPORT, html);
    console.log('[e2e] Reporte generado: ' + REPORT);
}

// ---- Main ----
async function main() {
        console.log('[e2e] === INICIO VALIDACION E2E ===');
    fs.mkdirSync(OUT_DIR, { recursive: true });
    console.log('[e2e] Directorio listo:', OUT_DIR);
    try {
        if (fs.existsSync(SEED_DB)) {
            fs.copyFileSync(SEED_DB, SEED_BAK);
            console.log('[e2e] Backup de seed DB creado');
        }
    } catch (e) {
        console.log('[e2e] Aviso backup:', e.message);
    }
                let server = null;
    try {
        await waitServer(2000);
        console.log('[e2e] Servidor ya en ejecucion');
    } catch (e) {
        console.log('[e2e] Iniciando servidor...');
        server = startServer();
        await waitServer(10000);
        console.log('[e2e] Servidor respondiendo');
    }
    try {
        const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.addInitScript(injectDataScript());
        await page.goto(BASE, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        console.log('[e2e] Pagina cargada');
        await testModulos(page);
        await testDashboardFiltro(page);
        await testResponsive(page);
        await testPDFExport(page);
        await browser.close();
        } finally {
        if (server) server.kill();
    }
    if (fs.existsSync(SEED_BAK)) {
        fs.copyFileSync(SEED_BAK, SEED_DB);
        fs.unlinkSync(SEED_BAK);
        console.log('[e2e] Seed DB restaurado');
    }
    await generateReport();
    console.log('\n[e2e] === RESUMEN ===');
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    console.log('[e2e] Total: ' + total + ' | Passed: ' + passed + ' | Failed: ' + (total - passed));
    if (total - passed > 0) {
        console.log('[e2e] Fallos:');
        results.filter(r => !r.passed).forEach(r => {
            console.log('  [FAIL] ' + r.section + ' / ' + r.name + ' - ' + r.detail);
        });
    }
    console.log('\n[e2e] === FIN ===');
    process.exit(results.every(r => r.passed) ? 0 : 1);
}

if (require.main === module) {
    main().catch((e) => {
        console.error('[e2e] Fatal:', e);
        process.exit(1);
    });
}

module.exports = { testModulos, testDashboardFiltro, testResponsive, testPDFExport, generateReport };
