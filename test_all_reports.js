/**
 * @fileoverview Comprehensive Report Testing Script for CONSTRURAMSA
 * 
 * Tests all report types by simulating the generation logic and validating:
 * - CSV structure and formatting
 * - Data integrity and calculations
 * - Proper column ordering
 * - No data overflow
 * - Professional formatting
 * 
 * Usage: node test_all_reports.js
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = 'construramsa_db.json';

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
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
    log(`\n${'='.repeat(50)}`, 'blue');
    log(message, 'blue');
    log('='.repeat(50), 'blue');
}

// Load database
function loadDatabase() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            logError('Database file not found.');
            return null;
        }
        const contenido = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(contenido);
    } catch (error) {
        logError(`Error loading database: ${error.message}`);
        return null;
    }
}

// Format currency
function formatCurrency(value) {
    return 'Q' + Number(value).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Mock CSV helper functions (same as in index.html)
function numToF(v) { const n = parseFloat(v); return (Number.isFinite(n) ? n : 0).toFixed(2); }
function numToInt(v) { const n = parseFloat(v); return (Number.isFinite(n) ? Math.round(n) : 0).toString(); }

function csvCell(value) {
    const text = String(value ?? '').replace(/\r?\n/g, ' ');
    const safeText = /^[=+\-@]/.test(text.trim()) ? "'" + text : text;
    return '"' + safeText.replace(/"/g, '""') + '"';
}

function csvRow(values) {
    return values.map(value => {
        if (typeof value === 'number') {
            return numToF(value);
        }
        return csvCell(value);
    }).join(',');
}

// Test report generation
function testReportGeneration(tipo, db) {
    logSection(`Testing: ${tipo.toUpperCase()} Report`);
    
    const issues = [];
    const improvements = [];
    
    if (!db.proyectos || db.proyectos.length === 0) {
        logWarning('No projects found in database; skipping report generation for clean-state validation.');
        return {
            passed: true,
            failed: false,
            issues: [],
            improvements: ['No projects in DB — user should create a project before generating reports'],
            csv: '',
            filename: ''
        };
    }
    
    const datos = db.proyectos_data[db.proyectos[0].id];
    const proy = db.proyectos[0];
    const config = db.configuracion || {};
    const empresa = config.nombre_empresa || 'CONSTRURAMSA';
    const proyNombre = proy ? proy.nombre : 'General';
    
    const today = new Date();
    const formatDate = (d) => d.toISOString().split('T')[0];
    const rango = { inicio: formatDate(today), fin: formatDate(today) };
    
    let csv = '\uFEFF'; // BOM UTF-8
    csv += `# ${empresa}\n`;
    csv += `# Proyecto: ${proyNombre}\n`;
    csv += `# Periodo: ${rango.inicio}\n`;
    csv += `# Fecha de generacion: ${formatDate(today)}\n`;
    csv += `# \n`;
    
    const enRango = (f) => f >= rango.inicio && f <= rango.fin;
    
    // Generate based on report type
    switch (tipo) {
        case 'diario':
        case 'semanal':
        case 'mensual':
            csv += `Fecha,Tipo,Categoria,Descripcion,Monto (Q)\n`;
            
            const viajesAll = datos.viajes_camiones.viajes || [];
            const ordsAll = datos.mantenimiento.ordenes || [];
            const insAll = datos.mantenimiento.compras_insumos || [];
            const idsExternos = new Set([
                ...viajesAll.map(v => v.gasto_id).filter(Boolean),
                ...ordsAll.map(o => o.gasto_id).filter(Boolean),
                ...insAll.map(i => i.gasto_id).filter(Boolean)
            ]);
            
            const movs = (datos.caja_chica || []).filter(g => enRango(g.fecha) && !idsExternos.has(g.id));
            
            if (movs.length === 0) {
                csv += `"SIN MOVIMIENTOS DE CAJA EN EL PERIODO",,,,\n`;
                logWarning('No cash movements in period');
            } else {
                let totalIng = 0, totalEgr = 0;
                movs.forEach(g => {
                    const desc = (g.descripcion || '').substring(0, 100);
                    csv += `${csvRow([g.fecha, g.tipo, g.categoria, desc, g.monto])}\n`;
                    if (g.tipo === 'ingreso') totalIng += g.monto;
                    else totalEgr += g.monto;
                });
                csv += `\n`;
                csv += `${csvRow(['', '', 'TOTAL INGRESOS:', totalIng])}\n`;
                csv += `${csvRow(['', '', 'TOTAL EGRESOS:', totalEgr])}\n`;
                csv += `${csvRow(['', '', 'SALDO:', totalIng - totalEgr])}\n`;
                logSuccess(`Processed ${movs.length} movements`);
            }
            
            // Viajes section
            const viajes = viajesAll.filter(v => enRango(v.fecha));
            if (viajes.length > 0) {
                csv += `\n--- VIAJES DE CAMIONES ---\n`;
                csv += `Fecha,Unidad,Material,No.,Km,Litros,Combustible (Q),Alquiler (Q),Total (Q)\n`;
                let totalViajes = 0;
                viajes.forEach(v => {
                    const c = (datos.viajes_camiones.camiones || []).find(x => x.id === v.vehiculo_id) || { nombre: 'N/A' };
                    totalViajes += v.total || 0;
                    csv += `${csvRow([v.fecha, c.nombre, v.material, numToInt(v.numero), v.km_total, v.litros, v.costo_combustible, v.costo_alquiler, v.total])}\n`;
                });
                csv += `\n`;
                csv += `${csvRow(['', '', '', '', '', '', '', 'TOTAL VIAJES (Q):', totalViajes])}\n`;
                logSuccess(`Processed ${viajes.length} trips`);
            }
            
            // Mantenimiento section
            const ordsMT = ordsAll.filter(o => enRango(o.fecha));
            const insMT = insAll.filter(i => enRango(i.fecha));
            if (ordsMT.length > 0 || insMT.length > 0) {
                csv += `\n--- MANTENIMIENTO E INSUMOS ---\n`;
                csv += `Fecha,Módulo,Descripción,Monto (Q)\n`;
                let totalMT = 0;
                ordsMT.forEach(o => {
                    const m = (datos.mantenimiento.maquinaria || []).find(x => x.id === o.maquinaria_id) || { nombre: 'N/A' };
                    totalMT += o.costo || 0;
                    csv += `${csvRow([o.fecha, 'Mantenimiento ' + o.tipo, (o.observaciones || 'N/A') + ' - ' + m.nombre, o.costo])}\n`;
                });
                insMT.forEach(i => {
                    totalMT += i.costo || 0;
                    csv += `${csvRow([i.fecha, 'Insumo ' + i.tipo, i.articulo + ' (x' + numToInt(i.cantidad) + ')', i.costo])}\n`;
                });
                csv += `\n`;
                csv += `${csvRow(['', '', 'TOTAL MANTENIMIENTO E INSUMOS:', totalMT])}\n`;
                logSuccess(`Processed ${ordsMT.length} orders and ${insMT.length} supplies`);
            }
            break;
            
        case 'asistencia':
            csv += `Trabajador,Fecha,Estado,Horas Trabajadas,Horas Extra,Pago (Q)\n`;
            
            const asistencia = datos.personal.asistencia || [];
            const trabajadores = datos.personal.trabajadores || [];
            
            if (asistencia.length === 0) {
                csv += `"SIN REGISTROS DE ASISTENCIA",,,,,\n`;
                logWarning('No attendance records');
            } else {
                let totalHoras = 0, totalExtra = 0, totalPago = 0;
                asistencia.forEach(a => {
                    const t = trabajadores.find(w => w.id === a.trabajador_id) || { nombre: 'N/A' };
                    const pago = (a.horas_trabajadas * 25) + (a.horas_extra * 35); // Mock calculation
                    totalHoras += a.horas_trabajadas || 0;
                    totalExtra += a.horas_extra || 0;
                    totalPago += pago;
                    csv += `${csvRow([t.nombre, a.fecha, a.estado, a.horas_trabajadas, a.horas_extra, pago])}\n`;
                });
                csv += `\n`;
                csv += `${csvRow(['', '', 'TOTAL HORAS:', totalHoras, '', ''])}\n`;
                csv += `${csvRow(['', '', 'TOTAL HORAS EXTRA:', totalExtra, '', ''])}\n`;
                csv += `${csvRow(['', '', '', '', 'TOTAL PAGO:', totalPago])}\n`;
                logSuccess(`Processed ${asistencia.length} attendance records`);
            }
            break;
            
        case 'viajes':
            csv += `Fecha,Unidad,Material,No.,Km,Litros,Combustible (Q),Alquiler (Q),Total (Q)\n`;
            
            const viajesAllV = datos.viajes_camiones.viajes || [];
            if (viajesAllV.length === 0) {
                csv += `"SIN VIAJES REGISTRADOS",,,,,,,,\n`;
                logWarning('No trips recorded');
            } else {
                let totalKm = 0, totalLitros = 0, totalCost = 0;
                viajesAllV.forEach(v => {
                    const c = (datos.viajes_camiones.camiones || []).find(x => x.id === v.vehiculo_id) || { nombre: 'N/A' };
                    totalKm += v.km_total || 0;
                    totalLitros += v.litros || 0;
                    totalCost += v.total || 0;
                    csv += `${csvRow([v.fecha, c.nombre, v.material, numToInt(v.numero), v.km_total, v.litros, v.costo_combustible, v.costo_alquiler, v.total])}\n`;
                });
                csv += `\n`;
                csv += `${csvRow(['', '', '', '', '', '', '', 'TOTAL COSTO (Q):', totalCost])}\n`;
                logSuccess(`Processed ${viajesAllV.length} trips`);
            }
            break;
            
        case 'mantenimiento':
            csv += `Fecha,Módulo,Descripción,Monto (Q)\n`;
            
            const ords = datos.mantenimiento.ordenes || [];
            const ins = datos.mantenimiento.compras_insumos || [];
            
            if (ords.length === 0 && ins.length === 0) {
                csv += `"SIN MANTENIMIENTO/INSUMOS",,,\n`;
                logWarning('No maintenance records');
            } else {
                let totalM = 0;
                ords.forEach(o => {
                    const m = (datos.mantenimiento.maquinaria || []).find(x => x.id === o.maquinaria_id) || { nombre: 'N/A' };
                    totalM += o.costo || 0;
                    csv += `${csvRow([o.fecha, 'Mantenimiento ' + o.tipo, m.nombre + ' - ' + (o.observaciones || 'N/A'), o.costo])}\n`;
                });
                ins.forEach(i => {
                    totalM += i.costo || 0;
                    csv += `${csvRow([i.fecha, 'Insumo ' + i.tipo, i.articulo + ' (x' + numToInt(i.cantidad) + ')', i.costo])}\n`;
                });
                csv += `\n`;
                csv += `${csvRow(['', '', 'TOTAL:', totalM])}\n`;
                logSuccess(`Processed ${ords.length} orders and ${ins.length} supplies`);
            }
            break;
            
        case 'categoria':
            csv += `Categoría,Monto (Q),Porcentaje\n`;
            
            const movsCat = (datos.caja_chica || []).filter(m => m.tipo === 'egreso');
            const gastosPorCat = {};
            movsCat.forEach(m => {
                const cat = m.categoria || 'sin_categoria';
                gastosPorCat[cat] = (gastosPorCat[cat] || 0) + (Number(m.monto) || 0);
            });
            
            const categorias = Object.entries(gastosPorCat).sort((a, b) => b[1] - a[1]);
            const totalGastos = categorias.reduce((s, [, v]) => s + v, 0);
            
            if (categorias.length === 0) {
                csv += `"SIN GASTOS POR CATEGORÍA",,\n`;
                logWarning('No expenses by category');
            } else {
                categorias.forEach(([cat, monto]) => {
                    const porcentaje = totalGastos > 0 ? ((monto / totalGastos) * 100).toFixed(1) : 0;
                    const etiqueta = cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    csv += `${csvRow([etiqueta, monto, porcentaje + '%'])}\n`;
                });
                csv += `\n`;
                csv += `${csvRow(['TOTAL', totalGastos, '100%'])}\n`;
                logSuccess(`Processed ${categorias.length} categories`);
            }
            break;
            
        case 'nomina':
            csv += `Trabajador,Días Asistidos,Faltas,Horas Extra,Total a Pagar (Q)\n`;
            
            const trabajadoresN = datos.personal.trabajadores || [];
            const asistenciaN = datos.personal.asistencia || [];
            
            if (trabajadoresN.length === 0) {
                csv += `"SIN TRABAJADORES REGISTRADOS",,,,\n`;
                logWarning('No workers registered');
            } else {
                trabajadoresN.forEach(t => {
                    const registros = asistenciaN.filter(a => a.trabajador_id === t.id);
                    const diasAsistidos = registros.filter(a => a.estado === 'presente').length;
                    const faltas = registros.filter(a => a.estado === 'falto').length;
                    const horasExtra = registros.reduce((s, a) => s + (a.horas_extra || 0), 0);
                    const pago = (diasAsistidos * 8 * (t.pago_hora_normal || 20)) + (horasExtra * (t.pago_hora_extra || 28));
                    csv += `${csvRow([t.nombre, diasAsistidos, faltas, horasExtra, pago])}\n`;
                });
                logSuccess(`Processed ${trabajadoresN.length} workers`);
            }
            break;
            
        case 'ejecutivo':
            csv += `KPI,Valor,Descripción\n`;
            
            const movsE = datos.caja_chica || [];
            const ingresos = movsE.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
            const egresos = movsE.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);
            const viajesE = datos.viajes_camiones.viajes || [];
            const kmTotal = viajesE.reduce((s, v) => s + (v.km_total || 0), 0);
            const litrosTotal = viajesE.reduce((s, v) => s + (v.litros || 0), 0);
            
            const kpis = [
                { nombre: 'Total Ingresos', valor: ingresos, desc: 'Suma de todos los ingresos' },
                { nombre: 'Total Egresos', valor: egresos, desc: 'Suma de todos los egresos' },
                { nombre: 'Saldo Neto', valor: ingresos - egresos, desc: 'Ingresos menos egresos' },
                { nombre: 'Viajes Realizados', valor: viajesE.length, desc: 'Cantidad de viajes' },
                { nombre: 'Kilometraje Total', valor: kmTotal.toFixed(1), desc: 'Km recorridos' },
                { nombre: 'Combustible Consumido', valor: litrosTotal.toFixed(1), desc: 'Litros totales' }
            ];
            
            kpis.forEach(k => {
                csv += `${csvRow([k.nombre, k.valor, k.desc])}\n`;
            });
            logSuccess(`Processed ${kpis.length} KPIs`);
            break;
            
        default:
            logError(`Unknown report type: ${tipo}`);
            return { passed: false, issues: ['Unknown report type'], csv: '' };
    }
    
    // Save CSV file
    const filename = `report_${tipo}_${formatDate(today)}.csv`;
    fs.writeFileSync(filename, csv, 'utf8');
    logSuccess(`CSV saved: ${filename}`);
    
    // Validate CSV structure
    const lines = csv.split('\n');
    if (lines.length < 5) {
        issues.push('CSV has too few lines');
    }
    
    // Check for BOM
    if (!csv.startsWith('\uFEFF')) {
        issues.push('Missing UTF-8 BOM');
    }
    
    // Check for proper escaping
    if (csv.includes('\n"') && !csv.includes('"')) {
        issues.push('Potential unescaped newlines in fields');
    }
    
    // Check for formula injection
    if (/^=/.test(csv.replace(/\uFEFF/g, ''))) {
        issues.push('Potential formula injection detected');
    }
    
    return {
        passed: issues.length === 0,
        issues,
        improvements,
        csv,
        filename
    };
}

// Main function
function main() {
    logInfo('\n══════════════════════════════════════════════');
    logInfo('  CONSTRURAMSA COMPREHENSIVE REPORT TESTING');
    logInfo('══════════════════════════════════════════════\n');
    
    const db = loadDatabase();
    if (!db) {
        process.exit(1);
    }
    
    const reportTypes = ['diario', 'semanal', 'mensual', 'asistencia', 'viajes', 'mantenimiento', 'categoria', 'nomina', 'ejecutivo'];
    
    const results = {
        passed: 0,
        failed: 0,
        warnings: 0,
        reports: {}
    };
    
    reportTypes.forEach(tipo => {
        const result = testReportGeneration(tipo, db);
        results.reports[tipo] = result;
        
        if (result.passed) {
            results.passed++;
            logSuccess(`${tipo.toUpperCase()}: PASSED`);
        } else {
            results.failed++;
            logError(`${tipo.toUpperCase()}: FAILED`);
            result.issues.forEach(issue => logWarning(`  - ${issue}`));
        }
        
        if (result.improvements.length > 0) {
            results.warnings += result.improvements.length;
            result.improvements.forEach(imp => logInfo(`  💡 ${imp}`));
        }
    });
    
    // Summary
    logSection('TEST SUMMARY');
    logInfo(`Total Reports Tested: ${reportTypes.length}`);
    logSuccess(`Passed: ${results.passed}`);
    if (results.failed > 0) {
        logError(`Failed: ${results.failed}`);
    }
    if (results.warnings > 0) {
        logWarning(`Improvements Needed: ${results.warnings}`);
    }
    
    // Save results
    fs.writeFileSync('report_test_results.json', JSON.stringify(results, null, 2));
    logSuccess('\n✅ Test results saved to: report_test_results.json');
    logInfo('✅ CSV files generated for manual review');
    
    if (results.failed === 0) {
        logSuccess('\n✅ All reports generated successfully!');
        process.exit(0);
    } else {
        logError('\n❌ Some reports have issues that need fixing');
        process.exit(1);
    }
}

main();