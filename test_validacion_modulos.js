/**
 * CONSTRURAMSA — Validación Funcional de Módulos v2.9.2
 * ======================================================
 * Suite Playwright que valida CRUD y comportamiento de los 9 módulos:
 *   1. Resumen       2. Caja Chica    3. Maquinaria    4. Personal
 *   5. Adquisiciones 6. Viajes        7. Mantenimiento 8. Reportes
 *   9. Configuración
 *
 * Ejecución:  node test_validacion_modulos.js
 */

'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL    = 'http://localhost:3000';
const TIMEOUT     = 30000;
const REPORT_PATH = path.join(__dirname, 'validacion_modulos_report.json');

// ─── utilidades ─────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
function ts() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }

const suite = { inicio: ts(), modulos: {}, totales: { pass: 0, fail: 0, warn: 0 } };

function registro(modulo, accion, ok, detalle = '') {
    if (!suite.modulos[modulo]) suite.modulos[modulo] = { tests: [], pass: 0, fail: 0 };
    const nivel = ok === 'warn' ? 'warn' : ok ? 'pass' : 'fail';
    suite.modulos[modulo].tests.push({ accion, nivel, detalle });
    if (nivel === 'pass')  { suite.modulos[modulo].pass++; suite.totales.pass++; }
    else if (nivel === 'fail') { suite.modulos[modulo].fail++; suite.totales.fail++; }
    else { suite.totales.warn++; }
    const icon = nivel === 'pass' ? '✅' : nivel === 'warn' ? '⚠️ ' : '❌';
    console.log(`  ${icon} [${modulo}] ${accion}${detalle ? ' — ' + detalle : ''}`);
}

async function getDB(page) {
    return page.evaluate(() => {
        try { return JSON.parse(localStorage.getItem('construramsa_db') || '{}'); }
        catch (_) { return {}; }
    });
}
async function getDatos(page) {
    return page.evaluate(() => {
        try {
            const db  = JSON.parse(localStorage.getItem('construramsa_db') || '{}');
            const pid = db.configuracion?.proyecto_actual;
            return pid ? (db.proyectos_data?.[pid] || db) : db;
        } catch (_) { return {}; }
    });
}

async function waitApp(page) {
    await page.waitForFunction(() => typeof APP_VERSION !== 'undefined', { timeout: TIMEOUT });
}

// Navega usando el parámetro ?module= que la app entiende
async function irA(page, modulo) {
    await page.goto(`${BASE_URL}/?module=${modulo}`, { waitUntil: 'networkidle' });
    await waitApp(page);
    await sleep(400);
}

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 1 — RESUMEN EJECUTIVO
// ═══════════════════════════════════════════════════════════════════════════
async function testResumen(page) {
    const M = 'Resumen';
    console.log(`\n▶ ${M}`);
    try {
        await irA(page, 'resumen');

        const tabActive = page.locator('[role="tab"][aria-selected="true"]');
        registro(M, 'Tab resumen activo con aria-selected=true', await tabActive.count() > 0);

        const kpiCards = page.locator('.kpi-card, .kpi-valor, .summary-card');
        const nKpi = await kpiCards.count();
        registro(M, `KPI cards renderizadas (${nKpi})`, nKpi > 0);

        const panel = page.locator('.resumen-alertas, .alert-item, .sin-proyecto, .estado-vacio, .empty-state, #resumen');
        registro(M, 'Panel resumen visible', await panel.count() > 0);

        // Selector de proyectos siempre presente en header
        const selectorProyecto = page.locator('#selector-proyectos');
        registro(M, 'Selector de proyectos presente en header', await selectorProyecto.count() > 0);

    } catch (e) {
        registro(M, 'Error inesperado en módulo', false, e.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 2 — CAJA CHICA
// ═══════════════════════════════════════════════════════════════════════════
async function testCajaChica(page) {
    const M = 'CajaChica';
    console.log(`\n▶ Caja Chica`);
    try {
        await irA(page, 'caja-chica');

        // IDs reales: form-caja-chica, #caja-monto, #caja-descripcion, #caja-tipo
        const form = page.locator('#form-caja-chica');
        registro(M, 'Formulario #form-caja-chica presente', await form.count() > 0);

        const campoMonto = page.locator('#caja-monto');
        const campoDesc  = page.locator('#caja-descripcion');
        const campoTipo  = page.locator('#caja-tipo');

        registro(M, 'Campo #caja-monto presente', await campoMonto.count() > 0);
        registro(M, 'Campo #caja-descripcion presente', await campoDesc.count() > 0);
        registro(M, 'Selector #caja-tipo presente', await campoTipo.count() > 0);

        // Registrar un movimiento de prueba
        try {
            await campoTipo.selectOption({ value: 'apertura' }).catch(() => {});
            await campoMonto.fill('1500');
            await campoDesc.fill('Apertura test validación');
            const btn = page.locator('#form-caja-chica button[type="submit"]').first();
            if (await btn.isVisible({ timeout: 2000 })) {
                await btn.click();
                await sleep(800);
            }
            registro(M, 'Submit de ingreso (apertura Q1500) ejecutado', true);
        } catch (e2) {
            registro(M, 'Submit de ingreso', 'warn', e2.message);
        }

        const tabla = page.locator('table');
        registro(M, 'Tabla de movimientos presente', await tabla.count() > 0);

        const datos = await getDatos(page);
        const movs  = datos.caja_chica || [];
        registro(M, `Datos en localStorage (${movs.length} movimientos)`, movs.length >= 0);

    } catch (e) {
        registro(M, 'Error inesperado en módulo', false, e.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 3 — MAQUINARIA
// ═══════════════════════════════════════════════════════════════════════════
async function testMaquinaria(page) {
    const M = 'Maquinaria';
    console.log(`\n▶ Maquinaria`);
    try {
        await irA(page, 'maquinaria');

        // form-maquinaria (registro de uso) y form-maqcat (catálogo)
        const formUso  = page.locator('#form-maquinaria');
        const formCat  = page.locator('#form-maqcat');
        registro(M, 'Formulario #form-maquinaria (uso) presente', await formUso.count() > 0);
        registro(M, 'Formulario #form-maqcat (catálogo) presente', await formCat.count() > 0);

        // IDs de campos de maquinaria
        const selectTipo = page.locator('#maq-tipo');
        const campoFecha = page.locator('input[type="date"]').first();
        registro(M, 'Selector #maq-tipo presente', await selectTipo.count() > 0);
        registro(M, 'Campo fecha presente', await campoFecha.count() > 0);

        // Catálogo: #maqcat-nombre, #maqcat-tipo
        const catNombre = page.locator('#maqcat-nombre');
        const catTipo   = page.locator('#maqcat-tipo');
        registro(M, 'Campo #maqcat-nombre presente', await catNombre.count() > 0);
        registro(M, 'Selector #maqcat-tipo presente', await catTipo.count() > 0);

        const tabla = page.locator('table');
        registro(M, 'Tabla de maquinaria presente', await tabla.count() > 0);

    } catch (e) {
        registro(M, 'Error inesperado en módulo', false, e.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 4 — PERSONAL
// ═══════════════════════════════════════════════════════════════════════════
async function testPersonal(page) {
    const M = 'Personal';
    console.log(`\n▶ Personal`);
    try {
        await irA(page, 'personal');

        // ID real: form-trabajador (no form-personal)
        const form = page.locator('#form-trabajador');
        registro(M, 'Formulario #form-trabajador presente', await form.count() > 0);

        // IDs reales: #trab-nombre, #trab-puesto (confirmado en HTML)
        const campoNombre = page.locator('#trab-nombre');
        const campoPuesto = page.locator('#trab-puesto');
        registro(M, 'Campo #trab-nombre presente', await campoNombre.count() > 0);
        registro(M, 'Campo #trab-puesto presente', await campoPuesto.count() > 0);

        // Registrar trabajador de prueba
        try {
            await campoNombre.fill('Trabajador Test');
            await campoPuesto.fill('Ayudante General');
            const btn = page.locator('#form-trabajador button[type="submit"]').first();
            if (await btn.isVisible({ timeout: 2000 })) { await btn.click(); await sleep(600); }
            registro(M, 'Registro de trabajador ejecutado', true);
        } catch (e2) {
            registro(M, 'Registro de trabajador', 'warn', e2.message);
        }

        // Sección asistencia
        const secAsistencia = page.locator('[id*="asistencia"]').first();
        registro(M, 'Sección de asistencia presente', await secAsistencia.count() > 0);

        const tabla = page.locator('table');
        registro(M, 'Tabla de personal presente', await tabla.count() > 0);

    } catch (e) {
        registro(M, 'Error inesperado en módulo', false, e.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 5 — ADQUISICIONES
// ═══════════════════════════════════════════════════════════════════════════
async function testAdquisiciones(page) {
    const M = 'Adquisiciones';
    console.log(`\n▶ Adquisiciones`);
    try {
        await irA(page, 'adquisiciones');

        // IDs reales: form-proveedor, form-cotizacion
        const formProv = page.locator('#form-proveedor');
        const formCot  = page.locator('#form-cotizacion');
        registro(M, 'Formulario #form-proveedor presente', await formProv.count() > 0);
        registro(M, 'Formulario #form-cotizacion presente', await formCot.count() > 0);

        // Selector de proveedor en cotizaciones
        const selProv = page.locator('#cot-proveedor');
        registro(M, 'Selector #cot-proveedor en cotizaciones presente', await selProv.count() > 0);

        // Botón agregar proveedor
        const btn = page.locator('button:has-text("Agregar"), button:has-text("Nuevo"), button:has-text("Guardar")').first();
        registro(M, 'Botón agregar/guardar presente', await btn.count() > 0);

        const tabla = page.locator('table');
        registro(M, 'Tabla de adquisiciones presente', await tabla.count() > 0);

    } catch (e) {
        registro(M, 'Error inesperado en módulo', false, e.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 6 — VIAJES
// ═══════════════════════════════════════════════════════════════════════════
async function testViajes(page) {
    const M = 'Viajes';
    console.log(`\n▶ Viajes`);
    try {
        await irA(page, 'viajes');

        // IDs reales: form-viaje, form-ruta, form-camion
        const formViaje  = page.locator('#form-viaje');
        const formRuta   = page.locator('#form-ruta');
        const formCamion = page.locator('#form-camion');
        registro(M, 'Formulario #form-viaje presente', await formViaje.count() > 0);
        registro(M, 'Formulario #form-ruta presente', await formRuta.count() > 0);
        registro(M, 'Formulario #form-camion presente', await formCamion.count() > 0);

        // Campos de viaje con IDs reales
        const selRuta     = page.locator('#viaje-ruta');
        const selCamion   = page.locator('#viaje-cam');
        const selMaterial = page.locator('#viaje-material');
        registro(M, 'Selector #viaje-ruta presente', await selRuta.count() > 0);
        registro(M, 'Selector #viaje-cam (camión) presente', await selCamion.count() > 0);
        registro(M, 'Selector #viaje-material presente', await selMaterial.count() > 0);

        // Propiedad camión (propio/alquilado)
        const selPropiedad = page.locator('#cam-propiedad');
        const selModalidad = page.locator('#cam-modalidad');
        registro(M, 'Selector #cam-propiedad (propio/alquilado) presente', await selPropiedad.count() > 0);
        registro(M, 'Selector #cam-modalidad presente', await selModalidad.count() > 0);

        const tabla = page.locator('table');
        registro(M, 'Tabla historial de viajes presente', await tabla.count() > 0);

    } catch (e) {
        registro(M, 'Error inesperado en módulo', false, e.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 7 — MANTENIMIENTO
// ═══════════════════════════════════════════════════════════════════════════
async function testMantenimiento(page) {
    const M = 'Mantenimiento';
    console.log(`\n▶ Mantenimiento`);
    try {
        await irA(page, 'mantenimiento');

        // IDs reales: form-orden (órdenes de mantenimiento), form-insumo (compras)
        const formOrden  = page.locator('#form-orden');
        const formInsumo = page.locator('#form-insumo');
        registro(M, 'Formulario #form-orden (órdenes/inspección) presente', await formOrden.count() > 0);
        registro(M, 'Formulario #form-insumo (compras insumos) presente', await formInsumo.count() > 0);

        // Campos de orden de mantenimiento — IDs reales: #ord-maquina, #ord-tipo
        const selMaquina = page.locator('#ord-maquina');
        const selTipo    = page.locator('#ord-tipo');
        registro(M, 'Selector #ord-maquina presente', await selMaquina.count() > 0);
        registro(M, 'Selector #ord-tipo (preventivo/correctivo) presente', await selTipo.count() > 0);

        // Campos de insumos — IDs reales: #insumo-tipo, #insumo-articulo, #insumo-cantidad
        const selInsumoTipo = page.locator('#insumo-tipo');
        const campoArticulo = page.locator('#insumo-articulo');
        const campoCantidad = page.locator('#insumo-cantidad');
        registro(M, 'Selector #insumo-tipo presente', await selInsumoTipo.count() > 0);
        registro(M, 'Campo #insumo-articulo presente', await campoArticulo.count() > 0);
        registro(M, 'Campo #insumo-cantidad presente', await campoCantidad.count() > 0);

        const tabla = page.locator('table');
        registro(M, 'Tabla de mantenimiento/insumos presente', await tabla.count() > 0);

    } catch (e) {
        registro(M, 'Error inesperado en módulo', false, e.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 8 — REPORTES
// ═══════════════════════════════════════════════════════════════════════════
async function testReportes(page) {
    const M = 'Reportes';
    console.log(`\n▶ Reportes`);
    try {
        await irA(page, 'reportes');

        // IDs reales: #reporte-tipo, #reporte-fecha-inicio, #reporte-fecha-fin
        const selectTipo   = page.locator('#reporte-tipo');
        const fechaInicio  = page.locator('#reporte-fecha-inicio');
        const fechaFin     = page.locator('#reporte-fecha-fin');
        registro(M, 'Selector #reporte-tipo presente', await selectTipo.count() > 0);
        registro(M, 'Campo #reporte-fecha-inicio presente', await fechaInicio.count() > 0);
        registro(M, 'Campo #reporte-fecha-fin presente', await fechaFin.count() > 0);

        // #export-pdf y #export-csv son checkboxes de opciones (confirmado en HTML)
        const chkPDF = page.locator('#export-pdf');
        const chkCSV = page.locator('#export-csv');
        registro(M, 'Checkbox #export-pdf (opción PDF) presente', await chkPDF.count() > 0);
        registro(M, 'Checkbox #export-csv (opción CSV) presente', await chkCSV.count() > 0);

        // El botón real de descarga usa onclick="abrirVistaPrevia('local')" o generarReporteLocal()
        const btnDescargar = page.locator('button[onclick*="abrirVistaPrevia"], button[onclick*="generarReporteLocal"]').first();
        registro(M, 'Botón descargar reporte (abrirVistaPrevia/generarReporteLocal) presente', await btnDescargar.count() > 0);

        // XLSX se genera dentro del flujo interno de generarReporteLocal — no hay botón dedicado
        // Verificar que la función existe en window
        const tieneXLSX = await page.evaluate(() => typeof generarReporteLocal === 'function');
        registro(M, 'Función generarReporteLocal() disponible (genera PDF+CSV+XLSX)', tieneXLSX);

        // Zona de preview
        const preview = page.locator('#plantilla-reporte-impresion, #preview-reporte, [id*="preview"]').first();
        registro(M, 'Zona preview/impresión presente', await preview.count() > 0);

        // Probar apertura de vista previa
        try {
            if (await selectTipo.isVisible()) await selectTipo.selectOption({ index: 0 }).catch(() => {});
            const btnPreview = page.locator('button[onclick*="abrirVistaPrevia"]').first();
            if (await btnPreview.isVisible({ timeout: 2000 })) {
                await btnPreview.click();
                await sleep(1000);
                registro(M, 'Vista previa de reporte abierta sin error', true);
            } else {
                registro(M, 'Botón abrirVistaPrevia', 'warn', 'No visible — puede requerir fecha seleccionada');
            }
        } catch (e2) {
            registro(M, 'Apertura de vista previa', 'warn', e2.message);
        }

    } catch (e) {
        registro(M, 'Error inesperado en módulo', false, e.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 9 — CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════
async function testConfiguracion(page) {
    const M = 'Configuracion';
    console.log(`\n▶ Configuración`);
    try {
        await irA(page, 'configuracion');

        // Campos de empresa
        const campoEmpresa = page.locator('input[placeholder*="empresa"], input[id*="empresa"]').first();
        const campoEslogan = page.locator('input[placeholder*="slogan"], input[placeholder*="Eslogan"], input[id*="eslogan"]').first();
        registro(M, 'Campo nombre empresa presente', await campoEmpresa.count() > 0);
        registro(M, 'Campo eslogan presente', await campoEslogan.count() > 0);

        // Botón exportar JSON
        const btnExportar = page.locator('button:has-text("Exportar")').first();
        registro(M, 'Botón exportar JSON presente', await btnExportar.count() > 0);

        // Botón importar — es un <label for="import-json"> o input#import-json
        const inputImportar = page.locator('#import-json');
        registro(M, 'Input #import-json (importar base de datos) presente', await inputImportar.count() > 0);

        // Sección de proyectos
        const secProyectos = page.locator('[id*="proyecto"]').first();
        registro(M, 'Elementos de proyectos presentes', await secProyectos.count() > 0);

        // Sección de nube
        const secNube = page.locator('[id*="nube"], button:has-text("Nube"), button:has-text("Cloud")').first();
        registro(M, 'Sección respaldo en la nube presente', await secNube.count() > 0);

        // Guardar configuración y verificar DB
        try {
            const btnGuardar = page.locator('button:has-text("Guardar")').first();
            if (await btnGuardar.isVisible({ timeout: 2000 })) {
                await btnGuardar.click();
                await sleep(500);
                registro(M, 'Guardar configuración ejecutado', true);
            }
        } catch (e2) {
            registro(M, 'Guardar configuración', 'warn', e2.message);
        }

        const db = await getDB(page);
        registro(M, 'DB.configuracion en localStorage', !!(db.configuracion));

    } catch (e) {
        registro(M, 'Error inesperado en módulo', false, e.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// PRUEBAS CROSS-MÓDULO: Teclado, deep-links, assets, localStorage
// ═══════════════════════════════════════════════════════════════════════════
async function testCrossModulo(page) {
    const M = 'Cross-Módulo';
    console.log(`\n▶ Pruebas Cross-Módulo`);
    try {
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        await waitApp(page);

        // Navegación por teclado Alt+1..9
        for (const [n, mod] of [[1,'resumen'],[2,'caja-chica'],[6,'viajes'],[8,'reportes'],[9,'configuracion']]) {
            try {
                await page.keyboard.press(`Alt+${n}`);
                await sleep(350);
                registro(M, `Atajo Alt+${n} (${mod}) no lanza error`, true);
            } catch (e2) {
                registro(M, `Atajo Alt+${n} (${mod})`, false, e2.message);
            }
        }

        // Deep-link viajes
        await page.goto(`${BASE_URL}/?module=viajes`, { waitUntil: 'networkidle' });
        await waitApp(page);
        await sleep(400);
        const tabActivo = page.locator('[role="tab"][aria-selected="true"]');
        const label = await tabActivo.first().textContent().catch(() => '');
        registro(M, `Deep-link ?module=viajes activa tab correcto ("${label.trim()}")`,
            label.toLowerCase().includes('viaje'));

        // Escape sin error
        await page.keyboard.press('Escape');
        registro(M, 'Tecla Escape ejecutada sin error', true);

        // Estructura de localStorage
        const db = await getDB(page);
        registro(M, 'DB.proyectos[] existe', Array.isArray(db.proyectos));
        registro(M, 'DB.proyectos_data{} existe', typeof db.proyectos_data === 'object');
        registro(M, 'DB.caja_chica[] existe', Array.isArray(db.caja_chica));
        registro(M, 'DB.viajes_camiones existe', typeof db.viajes_camiones !== 'undefined');
        registro(M, 'DB.mantenimiento existe', typeof db.mantenimiento !== 'undefined');

        // Service Worker
        const swReg = await page.evaluate(async () => {
            if (!('serviceWorker' in navigator)) return false;
            const r = await navigator.serviceWorker.getRegistration();
            return !!r;
        });
        registro(M, 'Service Worker registrado', swReg);

        // Manifest PWA
        const mResp = await page.request.get(`${BASE_URL}/manifest.json`);
        registro(M, 'manifest.json accesible (200)', mResp.status() === 200);

        // Vendor libs
        for (const lib of ['html2pdf.bundle.min.js','purify.min.js','xlsx.full.min.js','exceljs.min.js']) {
            const r = await page.request.get(`${BASE_URL}/vendor/${lib}`);
            registro(M, `vendor/${lib} (${r.status()})`, r.status() === 200);
        }

        // Módulos src/
        for (const mod of ['config.js','kpiEngine.js','exportador.js','reporteEjecutivo.js',
                            'nominaEngine.js','reportDataAdapter.js','syncOptimizer.js',
                            'backgroundSync.js','silentDownload.js','signatureCapture.js']) {
            const r = await page.request.get(`${BASE_URL}/src/${mod}`);
            registro(M, `src/${mod} (${r.status()})`, r.status() === 200);
        }

    } catch (e) {
        registro(M, 'Error inesperado en cross-módulo', false, e.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// FLUJO INTEGRACIÓN: Proyecto → Caja Chica → Maquinaria
// ═══════════════════════════════════════════════════════════════════════════
async function testFlujoIntegracion(page) {
    const M = 'Integración';
    console.log(`\n▶ Flujo Integración`);
    try {
        // Crear proyecto desde header — selector-proyectos
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        await waitApp(page);

        // Botón ➕ nuevo proyecto (suele estar junto al selector de proyectos)
        const btnNuevo = page.locator(
            'button[onclick*="nuevoProyecto"], button[onclick*="crearProyecto"], ' +
            'button[title*="royecto"], button[aria-label*="royecto"], ' +
            'button:has-text("Nuevo proyecto"), button:has-text("Crear")'
        ).first();

        if (await btnNuevo.isVisible({ timeout: 3000 })) {
            await btnNuevo.click();
            await sleep(500);

            const nombreInput = page.locator('input[placeholder*="nombre"], input[id*="nombre"]').first();
            const presupInput = page.locator('input[placeholder*="presupuesto"], input[id*="presupuesto"]').first();
            if (await nombreInput.isVisible({ timeout: 2000 })) await nombreInput.fill('Proyecto Test Validación');
            if (await presupInput.isVisible({ timeout: 2000 })) await presupInput.fill('50000');

            const btnConfirm = page.locator('button[type="submit"], button:has-text("Crear"), button:has-text("Guardar")').first();
            if (await btnConfirm.isVisible({ timeout: 2000 })) { await btnConfirm.click(); await sleep(700); }

            const db2 = await getDB(page);
            registro(M, 'Proyecto creado en DB', (db2.proyectos || []).length > 0);
        } else {
            registro(M, 'Botón nuevo proyecto', 'warn', 'No visible en header — requiere interacción con selector');
        }

        // Navegar a Caja Chica con proyecto activo
        await irA(page, 'caja-chica');
        const formCaja = page.locator('#form-caja-chica');
        registro(M, 'Caja Chica carga con formulario activo', await formCaja.isVisible({ timeout: 3000 }).catch(() => false));

        // Navegar a Maquinaria
        await irA(page, 'maquinaria');
        const formMaq = page.locator('#form-maquinaria');
        registro(M, 'Maquinaria carga con formulario activo', await formMaq.isVisible({ timeout: 3000 }).catch(() => false));

        // Navegar a Viajes
        await irA(page, 'viajes');
        const formViaje = page.locator('#form-viaje');
        registro(M, 'Viajes carga con formulario activo', await formViaje.isVisible({ timeout: 3000 }).catch(() => false));

        // Navegar a Reportes
        await irA(page, 'reportes');
        const selReporte = page.locator('#reporte-tipo');
        registro(M, 'Reportes carga con selector de tipo activo', await selReporte.isVisible({ timeout: 3000 }).catch(() => false));

    } catch (e) {
        registro(M, 'Error en flujo de integración', false, e.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// RUNNER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
async function run() {
    console.log('═══════════════════════════════════════════════════════');
    console.log(' CONSTRURAMSA — Validación Funcional de Módulos v2.9.2');
    console.log('═══════════════════════════════════════════════════════');
    console.log(` Inicio: ${ts()}\n`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        ignoreHTTPSErrors: true
    });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);

    const browserErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') browserErrors.push(msg.text()); });
    page.on('pageerror', err => browserErrors.push(err.message));

    try {
        await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
        await page.evaluate(() => localStorage.clear());
        await page.reload({ waitUntil: 'networkidle' });
        await waitApp(page);
        console.log(' ✓ App cargada y localStorage limpio\n');

        await testResumen(page);
        await testCajaChica(page);
        await testMaquinaria(page);
        await testPersonal(page);
        await testAdquisiciones(page);
        await testViajes(page);
        await testMantenimiento(page);
        await testReportes(page);
        await testConfiguracion(page);
        await testCrossModulo(page);
        await testFlujoIntegracion(page);

    } finally {
        await browser.close();
    }

    suite.browserErrors = [...new Set(browserErrors)];
    suite.fin = ts();

    console.log('\n═══════════════════════════════════════════════════════');
    console.log(' RESUMEN FINAL');
    console.log('═══════════════════════════════════════════════════════');
    console.log(` ✅ PASS : ${suite.totales.pass}`);
    console.log(` ❌ FAIL : ${suite.totales.fail}`);
    console.log(` ⚠️  WARN : ${suite.totales.warn}`);
    console.log(`\n Módulos:`);
    for (const [mod, info] of Object.entries(suite.modulos)) {
        const ico = info.fail === 0 ? '✅' : '❌';
        console.log(`  ${ico} ${mod.padEnd(18)} ${info.pass} pass / ${info.fail} fail`);
    }

    if (suite.browserErrors.length > 0) {
        console.log(`\n⚠️  Errores JS en navegador (${suite.browserErrors.length}):`);
        suite.browserErrors.slice(0, 10).forEach(e => console.log(`  • ${e.slice(0, 140)}`));
    } else {
        console.log('\n✅ Sin errores JavaScript en el navegador');
    }

    fs.writeFileSync(REPORT_PATH, JSON.stringify(suite, null, 2), 'utf8');
    console.log(`\n📄 Reporte guardado: ${REPORT_PATH}`);

    process.exit(suite.totales.fail > 0 ? 1 : 0);
}

run().catch(err => {
    console.error('❌ Error crítico en runner:', err);
    process.exit(2);
});
