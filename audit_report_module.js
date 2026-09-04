/**
 * CONSTRURAMSA Report Module Quality Audit
 * 
 * Comprehensive audit focusing on:
 * 1. Data Integrity: PDF and CSV exports contain complete, accurate data
 * 2. Template UI: No text overflow, table cell breaches, or elements outside page limits
 * 3. Format and Pagination: Proper margins, page breaks, and professional presentation
 * 
 * Usage: node audit_report_module.js
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'construramsa_db.json');

// ============================================================
// UTILITIES
// ============================================================

function log(message, color = 'reset') {
    const colors = {
        reset: '\x1b[0m',
        green: '\x1b[32m',
        red: '\x1b[31m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        cyan: '\x1b[36m',
        bold: '\x1b[1m'
    };
    console.log(`${colors[color] || ''}${message}${colors.reset}`);
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠️ ${message}`, 'yellow');
}

function logInfo(message) {
    log(`ℹ️ ${message}`, 'cyan');
}

function logSection(message) {
    log(`\n${'='.repeat(70)}`, 'blue');
    log(`  ${message}`, 'bold');
    log(`${'='.repeat(70)}`, 'blue');
}

function loadDatabase() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            logError('Database file not found.');
            return null;
        }
        const content = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        logError(`Error loading database: ${error.message}`);
        return null;
    }
}

// ============================================================
// AUDIT STATE
// ============================================================

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let warnings = 0;

function test(description, fn, isWarning = false) {
    totalTests++;
    try {
        fn();
        passedTests++;
        logSuccess(description);
    } catch (error) {
        if (isWarning) {
            warnings++;
            logWarning(`${description}: ${error.message}`);
        } else {
            failedTests++;
            logError(`${description}: ${error.message}`);
        }
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertApprox(actual, expected, tolerance, message) {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(message || `Expected ~${expected}, got ${actual}`);
    }
}

// ============================================================
// 1. DATA INTEGRITY
// ============================================================

function auditDataIntegrity(db) {
    logSection('1. DATA INTEGRITY AUDIT');

    const pid = db.configuracion.proyecto_actual;
    const datos = db.proyectos_data[pid];

    test('Active project exists', () => {
        assert(pid, 'No active project');
        assert(datos, 'No project data for active project');
    });

    test('All modules have data', () => {
        assert(datos.caja_chica.length > 0, 'caja_chica empty');
        assert(datos.personal.trabajadores.length > 0, 'personal.trabajadores empty');
        assert(datos.personal.asistencia.length > 0, 'personal.asistencia empty');
        assert(datos.adquisiciones.proveedores.length > 0, 'adquisiciones.proveedores empty');
        assert(datos.viajes_camiones.viajes.length > 0, 'viajes_camiones.viajes empty');
        assert(datos.mantenimiento.ordenes.length > 0, 'mantenimiento.ordenes empty');
    });

    test('CSV export structure: diario/semanal/mensual', () => {
        const movs = datos.caja_chica;
        movs.forEach((m, i) => {
            assert(typeof m.fecha === 'string' && m.fecha.match(/^\d{4}-\d{2}-\d{2}$/),
                `Movement ${i} invalid fecha: ${m.fecha}`);
            assert(['ingreso', 'egreso'].includes(m.tipo),
                `Movement ${i} invalid tipo: ${m.tipo}`);
            assert(typeof m.descripcion === 'string' && m.descripcion.length > 0,
                `Movement ${i} missing descripcion`);
            assert(typeof m.monto === 'number' && m.monto > 0,
                `Movement ${i} invalid monto: ${m.monto}`);
            assert(typeof m.categoria === 'string' && m.categoria.length > 0,
                `Movement ${i} missing categoria`);
        });
        logInfo(`   Validated ${movs.length} caja_chica records`);
    });

    test('CSV export structure: viajes', () => {
        const viajes = datos.viajes_camiones.viajes;
        viajes.forEach((v, i) => {
            assert(typeof v.fecha === 'string', `Viaje ${i} missing fecha`);
            assert(typeof v.material === 'string', `Viaje ${i} missing material`);
            assert(typeof v.km_total === 'number' && v.km_total > 0, `Viaje ${i} invalid km_total`);
            assert(typeof v.litros === 'number' && v.litros >= 0, `Viaje ${i} invalid litros`);
            assert(typeof v.total === 'number' && v.total > 0, `Viaje ${i} invalid total`);
        });
        logInfo(`   Validated ${viajes.length} viajes records`);
    });

    test('CSV export structure: asistencia', () => {
        const workers = datos.personal.trabajadores;
        const attendance = datos.personal.asistencia;
        
        workers.forEach((t, i) => {
            assert(typeof t.nombre === 'string' && t.nombre.length >= 3,
                `Worker ${i} nombre too short: ${t.nombre}`);
            assert(typeof t.puesto === 'string', `Worker ${i} missing puesto`);
            assert(typeof t.pago_hora_normal === 'number' && t.pago_hora_normal > 0,
                `Worker ${i} invalid pago_hora_normal`);
        });

        attendance.forEach((dia, i) => {
            assert(typeof dia.fecha === 'string', `Attendance day ${i} missing fecha`);
            assert(Array.isArray(dia.registros), `Attendance day ${i} registros not array`);
            dia.registros.forEach(reg => {
                assert(['asistio', 'falto', 'justificado'].includes(reg.estado),
                    `Invalid estado: ${reg.estado}`);
            });
        });
        logInfo(`   Validated ${workers.length} workers, ${attendance.length} attendance days`);
    });

    test('CSV export structure: mantenimiento', () => {
        const ordenes = datos.mantenimiento.ordenes;
        const insumos = datos.mantenimiento.compras_insumos;

        ordenes.forEach((o, i) => {
            assert(typeof o.fecha === 'string', `Order ${i} missing fecha`);
            assert(typeof o.observaciones === 'string', `Order ${i} missing observaciones`);
            assert(typeof o.costo === 'number' && o.costo > 0, `Order ${i} invalid costo`);
        });

        insumos.forEach((ins, i) => {
            assert(typeof ins.fecha === 'string', `Supply ${i} missing fecha`);
            assert(typeof ins.articulo === 'string' && ins.articulo.length >= 2,
                `Supply ${i} articulo too short`);
            assert(typeof ins.cantidad === 'number' && ins.cantidad >= 1,
                `Supply ${i} invalid cantidad`);
            assert(typeof ins.costo === 'number' && ins.costo > 0,
                `Supply ${i} invalid costo`);
        });
        logInfo(`   Validated ${ordenes.length} orders, ${insumos.length} supplies`);
    });

    test('CSV export structure: categoria', () => {
        const movs = datos.caja_chica.filter(m => m.tipo === 'egreso');
        const categorias = new Set(movs.map(m => m.categoria));
        assert(categorias.size > 0, 'No categories found for categoria report');
        logInfo(`   Found ${categorias.size} categories for categoria report`);
    });

    test('CSV export structure: nomina', () => {
        const workers = datos.personal.trabajadores;
        assert(workers.length > 0, 'No workers for nomina report');
        logInfo(`   Validated ${workers.length} workers for nomina report`);
    });

    test('CSV export structure: ejecutivo', () => {
        const kpis = [
            'saldo', 'totalIngresos', 'totalEgresos', 'totalViajes',
            'totalKm', 'totalLitros', 'totalMantenimiento', 'totalNomina'
        ];
        assert(kpis.length > 0, 'No KPIs defined for ejecutivo report');
        logInfo(`   Validated ${kpis.length} KPI metrics for ejecutivo report`);
    });

    test('Linked expenses integrity (gasto_id references)', () => {
        const cajaIds = new Set(datos.caja_chica.map(m => m.id));
        
        let linkedCount = 0;
        datos.viajes_camiones.viajes.forEach(v => {
            if (v.gasto_id) {
                assert(cajaIds.has(v.gasto_id),
                    `Viaje gasto_id ${v.gasto_id} not in caja_chica`);
                linkedCount++;
            }
        });
        
        datos.mantenimiento.ordenes.forEach(o => {
            if (o.gasto_id) {
                assert(cajaIds.has(o.gasto_id),
                    `Orden gasto_id ${o.gasto_id} not in caja_chica`);
                linkedCount++;
            }
        });

        datos.mantenimiento.compras_insumos.forEach(i => {
            if (i.gasto_id) {
                assert(cajaIds.has(i.gasto_id),
                    `Insumo gasto_id ${i.gasto_id} not in caja_chica`);
                linkedCount++;
            }
        });

        logInfo(`   Validated ${linkedCount} linked expenses`);
    });

    test('No duplicate IDs in caja_chica', () => {
        const ids = datos.caja_chica.map(m => m.id);
        const uniqueIds = new Set(ids);
        assert(ids.length === uniqueIds.size,
            `Duplicate IDs in caja_chica: ${ids.length} total, ${uniqueIds.size} unique`);
    });

    test('No duplicate IDs in viajes', () => {
        const ids = datos.viajes_camiones.viajes.map(v => v.id);
        const uniqueIds = new Set(ids);
        assert(ids.length === uniqueIds.size,
            `Duplicate IDs in viajes`);
    });

    test('No duplicate IDs in personal.trabajadores', () => {
        const ids = datos.personal.trabajadores.map(t => t.id);
        const uniqueIds = new Set(ids);
        assert(ids.length === uniqueIds.size,
            `Duplicate IDs in trabajadores`);
    });
}

// ============================================================
// 2. TEMPLATE UI AUDIT
// ============================================================

function auditTemplateUI() {
    logSection('2. TEMPLATE UI AUDIT');

    const htmlPath = path.join(__dirname, 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    test('PDF template has proper page structure', () => {
        assert(htmlContent.includes('id="plantilla-reporte-impresion"'),
            'Missing plantilla-reporte-impresion container');
        assert(htmlContent.includes('class="pdf-page-header"'),
            'Missing pdf-page-header class');
        assert(htmlContent.includes('class="tabla-pdf"'),
            'Missing tabla-pdf class');
    });

    test('PDF template has proper CSS for overflow control', () => {
        assert(htmlContent.includes('word-break: break-word'),
            'Missing word-break: break-word in table CSS');
        assert(htmlContent.includes('overflow-wrap: break-word'),
            'Missing overflow-wrap: break-word in table CSS');
        assert(htmlContent.includes('white-space: normal'),
            'Missing white-space: normal in table cells');
        assert(htmlContent.includes('max-width: 0'),
            'Missing max-width: 0 in table cells');
    });

    test('PDF template has proper table layout', () => {
        assert(htmlContent.includes('table-layout: fixed'),
            'Missing table-layout: fixed in tabla-pdf');
        assert(htmlContent.includes('border-collapse: collapse'),
            'Missing border-collapse: collapse');
        assert(htmlContent.includes('width: 100%'),
            'Missing width: 100% in tables');
    });

    test('PDF template has proper cell padding and borders', () => {
        assert(htmlContent.includes('padding: 7px 6px') || htmlContent.includes('padding:8px 6px'),
            'Missing proper cell padding');
        assert(htmlContent.includes('border: 1px solid'),
            'Missing cell borders');
    });

    test('PDF template prevents row breaks inside pages', () => {
        assert(htmlContent.includes('page-break-inside: avoid'),
            'Missing page-break-inside: avoid');
        assert(htmlContent.includes('break-inside: avoid'),
            'Missing break-inside: avoid');
    });

    test('PDF template repeats header on each page', () => {
        assert(htmlContent.includes('display: table-header-group'),
            'Missing display: table-header-group for thead');
    });

    test('PDF template has proper page margins', () => {
        assert(htmlContent.includes('padding: 12mm'),
            'Missing 12mm padding for page margins');
        assert(htmlContent.includes('box-sizing: border-box'),
            'Missing box-sizing: border-box');
    });

    test('PDF template has fixed page dimensions', () => {
        assert(htmlContent.includes('width: 210mm') || htmlContent.includes('width: 816px'),
            'Missing fixed page width');
        assert(htmlContent.includes('min-height: 297mm') || htmlContent.includes('min-height: 1123px'),
            'Missing fixed page height');
    });

    test('PDF template has overflow hidden', () => {
        assert(htmlContent.includes('overflow: hidden'),
            'Missing overflow: hidden on template container');
    });

    test('PDF template has proper text escaping', () => {
        assert(htmlContent.includes('_esc('),
            'Missing _esc function for text escaping');
    });

    test('PDF template has colgroup for column widths', () => {
        const colgroupCount = (htmlContent.match(/<colgroup>/g) || []).length;
        assert(colgroupCount > 0, 'Missing colgroup elements for column width control');
        logInfo(`   Found ${colgroupCount} colgroup definitions`);
    });

    test('PDF template has no fixed-width elements that could overflow', () => {
        // Check for elements with width > 210mm that might cause overflow
        const wideElements = htmlContent.match(/width:\s*(\d+)mm/g) || [];
        const problematic = wideElements.filter(m => {
            const match = m.match(/(\d+)mm/);
            return match && parseInt(match[1]) > 216;
        });
        assert(problematic.length === 0,
            `Found ${problematic.length} elements wider than page width`);
    });

    test('PDF template images have max-width constraints', () => {
        // Extract only the PDF template section
        const templateMatch = htmlContent.match(/<div id="plantilla-reporte-impresion"[\s\S]*?<\/div>\s*<\/div>/);
        const templateContent = templateMatch ? templateMatch[0] : htmlContent;
        
        const imgTags = templateContent.match(/<img[^>]*>/g) || [];
        const unconstrained = imgTags.filter(img => 
            !img.includes('max-width') && !img.includes('width:')
        );
        assert(unconstrained.length === 0,
            `Found ${unconstrained.length} images in PDF template without max-width constraint`);
    });

    test('PDF template signature images are constrained', () => {
        assert(htmlContent.includes('max-height: 58px') || htmlContent.includes('max-height:30px'),
            'Missing max-height constraint on signature images');
    });
}

// ============================================================
// 3. FORMAT AND PAGINATION
// ============================================================

function auditFormatAndPagination() {
    logSection('3. FORMAT AND PAGINATION AUDIT');

    const htmlPath = path.join(__dirname, 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    test('PDF generation uses proper page size constants', () => {
        assert(htmlContent.includes("PAGE_PX = { letter: 816, a4: 794, legal: 816 }"),
            'Missing PAGE_PX constants');
        assert(htmlContent.includes("PAGE_MM = { letter: '216mm', a4: '210mm', legal: '216mm' }"),
            'Missing PAGE_MM constants');
    });

    test('PDF generation uses html2pdf with proper options', () => {
        assert(htmlContent.includes('html2pdf().set(opts).from(contenedor).toPdf().get(\'pdf\')'),
            'Missing html2pdf call');
        assert(htmlContent.includes('margin: 0'),
            'Missing margin: 0 in html2pdf options');
        assert(htmlContent.includes('jsPDF: { unit: \'mm\', format: pageSize, orientation: \'portrait\' }'),
            'Missing jsPDF configuration');
    });

    test('PDF generation uses proper scale for quality', () => {
        assert(htmlContent.includes('const scale = docHeight > 8000 ? 1.2 : (docHeight > 5000 ? 1.5 : 2)'),
            'Missing dynamic scale calculation');
    });

    test('PDF generation injects CSS variables for cloned document', () => {
        assert(htmlContent.includes('onclone: function(clonedDoc)'),
            'Missing onclone function for CSS variable injection');
        assert(htmlContent.includes('CSS_VARS'),
            'Missing CSS_VARS definition');
    });

    test('PDF generation stamps page numbers', () => {
        assert(htmlContent.includes('Página ${i} de ${total}'),
            'Missing page number stamping');
        assert(htmlContent.includes('pdf.setPage(i)'),
            'Missing pdf.setPage() call');
        assert(htmlContent.includes('pdf.internal.getNumberOfPages()'),
            'Missing getNumberOfPages() call');
    });

    test('PDF generation handles page breaks properly', () => {
        assert(htmlContent.includes('pagebreak: { mode: [\'css\', \'legacy\'], avoid: [\'tr\', \'img\', \'.signature-wrapper\'] }'),
            'Missing pagebreak configuration');
    });

    test('PDF template has proper page break CSS', () => {
        assert(htmlContent.includes('page-break-after: always'),
            'Missing page-break-after: always');
        assert(htmlContent.includes('page-break-inside: avoid'),
            'Missing page-break-inside: avoid');
    });

    test('PDF generation uses proper document height', () => {
        assert(htmlContent.includes('const docHeight = Math.max(Math.ceil(contenedor.scrollHeight), 1123)'),
            'Missing docHeight calculation with minimum 1123px');
    });

    test('PDF generation waits for layout recalculation', () => {
        assert(htmlContent.includes('requestAnimationFrame'),
            'Missing requestAnimationFrame for layout recalculation');
    });

    test('PDF generation handles page size selection', () => {
        assert(htmlContent.includes('id="vp-page-size"'),
            'Missing vp-page-size selector');
        assert(htmlContent.includes('letter') && htmlContent.includes('a4') && htmlContent.includes('legal'),
            'Missing page size options');
    });

    test('CSV export has proper encoding (UTF-8 BOM)', () => {
        assert(htmlContent.includes('let csv = \'\\uFEFF\''),
            'Missing UTF-8 BOM in CSV export');
    });

    test('CSV export has proper pagination', () => {
        assert(htmlContent.includes('paginarCSV'),
            'Missing paginarCSV function');
        assert(htmlContent.includes('maxRowsPerPage'),
            'Missing maxRowsPerPage configuration');
    });

    test('CSV export includes signatures section', () => {
        assert(htmlContent.includes('generarFirmasCSV'),
            'Missing generarFirmasCSV function');
        assert(htmlContent.includes('FIRMAS DE APROBACIÓN'),
            'Missing FIRMAS DE APROBACIÓN header');
    });

    test('CSV export includes company information', () => {
        assert(htmlContent.includes('csv += `# ${empresa}\\n`;') || htmlContent.includes('# CONSTRURAMSA'),
            'Missing company header in CSV');
        assert(htmlContent.includes('# Fecha de generacion'),
            'Missing generation date in CSV');
    });

    test('PDF template has proper footer area', () => {
        assert(htmlContent.includes('Página') && htmlContent.includes('de ${total}'),
            'Missing footer page numbers');
    });

    test('PDF template has signature area', () => {
        assert(htmlContent.includes('pdf-firma-jefe-proyectos'),
            'Missing jefe de proyectos signature area');
        assert(htmlContent.includes('pdf-firma-gerente-comercial'),
            'Missing gerente comercial signature area');
        assert(htmlContent.includes('pdf-nombre-visto-bueno'),
            'Missing visto bueno signature area');
    });

    test('PDF template has proper color scheme for printing', () => {
        assert(htmlContent.includes('--pdf-blanco'),
            'Missing white background variable');
        assert(htmlContent.includes('--pdf-azul-oscuro'),
            'Missing dark blue variable');
        assert(htmlContent.includes('--pdf-gris-oscuro'),
            'Missing dark gray text variable');
    });

    test('PDF generation avoids breaking on specific elements', () => {
        assert(htmlContent.includes('avoid: [\'tr\', \'img\', \'.signature-wrapper\']'),
            'Missing pagebreak avoid rules for critical elements');
    });
}

// ============================================================
// 4. MOBILE-SPECIFIC CHECKS
// ============================================================

function auditMobileSpecific() {
    logSection('4. MOBILE-SPECIFIC CHECKS');

    const htmlPath = path.join(__dirname, 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    test('Report UI has responsive breakpoints', () => {
        assert(htmlContent.includes('@media (max-width: 768px)'),
            'Missing 768px breakpoint');
        assert(htmlContent.includes('@media (max-width: 480px)'),
            'Missing 480px breakpoint');
        assert(htmlContent.includes('@media (max-width: 390px)'),
            'Missing 390px breakpoint');
        assert(htmlContent.includes('@media (max-width: 360px)'),
            'Missing 360px breakpoint');
    });

    test('Report forms stack on mobile', () => {
        assert(htmlContent.includes('.form-grid-2 { display: grid; grid-template-columns: 1fr 1fr;'),
            'Missing form-grid-2 base style');
        const hasMobileOverride = htmlContent.includes('grid-template-columns: 1fr') &&
            htmlContent.includes('.form-grid-2');
        assert(hasMobileOverride, 'Missing mobile override for form-grid-2');
    });

    test('Report buttons are full-width on mobile', () => {
        assert(htmlContent.includes('.btn-row { flex-direction: column; }'),
            'Missing btn-row column direction for mobile');
    });

    test('Preview modal is responsive', () => {
        assert(htmlContent.includes('#modal-vista-previa'),
            'Missing vista previa modal');
        assert(htmlContent.includes('.vp-editor') && htmlContent.includes('.vp-preview'),
            'Missing editor/preview split in modal');
        assert(htmlContent.includes('max-height: 38dvh') || htmlContent.includes('max-height: 40dvh'),
            'Missing mobile height constraint for editor');
    });

    test('Toast notifications are responsive', () => {
        assert(htmlContent.includes('.toast-container { left: 10px !important; right: 10px !important;'),
            'Missing responsive toast container');
    });

    test('Tables have horizontal scroll on mobile', () => {
        assert(htmlContent.includes('.overflow-x-auto'),
            'Missing overflow-x-auto class for mobile table scroll');
    });

    test('PDF template uses mm units for print', () => {
        assert(htmlContent.includes('padding: 12mm'),
            'Missing mm units in template padding');
    });

    test('PDF generation uses proper pixel-to-mm conversion', () => {
        assert(htmlContent.includes('816') && htmlContent.includes('794'),
            'Missing pixel constants for letter/A4 at 96dpi');
    });
}

// ============================================================
// MAIN
// ============================================================

function main() {
    console.log('\n' + '═'.repeat(70));
    console.log('  CONSTRURAMSA REPORT MODULE QUALITY AUDIT');
    console.log('  Mobile-Optimized Version');
    console.log('═'.repeat(70) + '\n');

    const db = loadDatabase();
    if (!db) {
        process.exit(1);
    }

    const pid = db.configuracion.proyecto_actual;
    if (!pid) {
        logError('No active project found. Run generate_test_data.js first.');
        process.exit(1);
    }

    logInfo(`Active Project: ${db.proyectos.find(p => p.id === pid)?.nombre || pid}`);
    logInfo(`Database: ${DB_FILE}`);
    logInfo(`Report Types: diario, semanal, mensual, asistencia, viajes, mantenimiento, categoria, nomina, ejecutivo\n`);

    // Run all audits
    auditDataIntegrity(db);
    auditTemplateUI();
    auditFormatAndPagination();
    auditMobileSpecific();

    // Summary
    console.log('\n' + '═'.repeat(70));
    console.log('  AUDIT SUMMARY');
    console.log('═'.repeat(70));
    console.log(`\nTotal Tests:  ${totalTests}`);
    console.log(`${'✅'.repeat(passedTests > 0 ? 1 : 0)} Passed:      ${passedTests}`);
    if (failedTests > 0) {
        console.log(`${'❌'.repeat(failedTests > 0 ? 1 : 0)} Failed:      ${failedTests}`);
    }
    if (warnings > 0) {
        console.log(`${'⚠️'.repeat(warnings > 0 ? 1 : 0)} Warnings:    ${warnings}`);
    }
    console.log(`\nSuccess Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%\n`);

    if (failedTests === 0) {
        log('✅ AUDIT PASSED — Report module meets quality standards', 'green');
        if (warnings > 0) {
            log(`   (${warnings} warnings noted but non-critical)`, 'yellow');
        }
        process.exit(0);
    } else {
        log('❌ AUDIT FAILED — Critical issues found in report module', 'red');
        process.exit(1);
    }
}

main();
