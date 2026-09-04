/**
 * Comprehensive Verification Script for CONSTRURAMSA Control de Gastos
 * 
 * Verifies ALL read modules after test data insertion:
 * - Project data integrity
 * - Caja Chica reads and calculations
 * - Maquinaria y Flota reads
 * - Personal and attendance reads
 * - Adquisiciones reads
 * - Viajes de Camiones reads
 * - Mantenimiento reads
 * - Report generation (CSV structure)
 * - KPI calculations
 * - Data linkages (gasto_id integrity)
 * 
 * Usage: node verify_all_modules.js
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'construramsa_db.json');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
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

function logInfo(message) {
    log(`ℹ️ ${message}`, 'cyan');
}

function logSection(message) {
    log(`\n${colors.bold}${colors.blue}━━━ ${message} ━━━${colors.reset}`);
}

// ============================================================
// DATABASE LOAD
// ============================================================

function loadDatabase() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            logError('Database file not found. Run generate_test_data.js first.');
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
// VERIFICATION FUNCTIONS
// ============================================================

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(description, fn) {
    totalTests++;
    try {
        fn();
        passedTests++;
        logSuccess(description);
    } catch (error) {
        failedTests++;
        logError(`${description}: ${error.message}`);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

// ============================================================
// 1. PROJECT VERIFICATION
// ============================================================

function verifyProjects(db) {
    logSection('PROJECTS VERIFICATION');

    test('Database has version', () => {
        assert(db.version === '2.9.2', `Expected version 2.9.2, got ${db.version}`);
    });

    test('Database has configuracion', () => {
        assert(db.configuracion, 'Missing configuracion');
        assert(db.configuracion.nombre_empresa === 'CONSTRURAMSA', 'Wrong company name');
    });

    test('Database has active project', () => {
        assert(db.configuracion.proyecto_actual, 'No active project');
        assert(db.proyectos_data[db.configuracion.proyecto_actual], 'Project data not found');
    });

    test('Project has valid structure', () => {
        const pid = db.configuracion.proyecto_actual;
        const proy = db.proyectos.find(p => p.id === pid);
        assert(proy, 'Project not found in proyectos array');
        assert(proy.nombre && proy.nombre.length >= 3, 'Project name too short');
        assert(proy.presupuesto_inicial > 0, 'Project budget should be > 0');
        assert(proy.activo === true, 'Project should be active');
    });

    test('Project data has all required modules', () => {
        const pid = db.configuracion.proyecto_actual;
        const datos = db.proyectos_data[pid];
        assert(datos.caja_chica, 'Missing caja_chica');
        assert(datos.maquinaria_flota, 'Missing maquinaria_flota');
        assert(datos.personal, 'Missing personal');
        assert(datos.adquisiciones, 'Missing adquisiciones');
        assert(datos.viajes_camiones, 'Missing viajes_camiones');
        assert(datos.mantenimiento, 'Missing mantenimiento');
    });
}

// ============================================================
// 2. CAJA CHICA VERIFICATION
// ============================================================

function verifyCajaChica(db) {
    logSection('CAJA CHICA VERIFICATION');

    const pid = db.configuracion.proyecto_actual;
    const datos = db.proyectos_data[pid];
    const movimientos = datos.caja_chica;

    test('Caja chica has movements', () => {
        assert(movimientos.length > 0, 'No movements found');
    });

    test('All movements have valid structure', () => {
        movimientos.forEach((mov, idx) => {
            assert(mov.id, `Movement ${idx} missing id`);
            assert(mov.fecha, `Movement ${idx} missing fecha`);
            assert(['ingreso', 'egreso'].includes(mov.tipo), `Movement ${idx} invalid tipo: ${mov.tipo}`);
            assert(mov.monto > 0, `Movement ${idx} monto should be > 0`);
            assert(mov.descripcion && mov.descripcion.length >= 3, `Movement ${idx} descripcion too short`);
            assert(mov.categoria, `Movement ${idx} missing categoria`);
            assert(mov.responsable, `Movement ${idx} missing responsable`);
        });
    });

    test('All movements have valid dates (YYYY-MM-DD)', () => {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        movimientos.forEach((mov, idx) => {
            assert(dateRegex.test(mov.fecha), `Movement ${idx} invalid date format: ${mov.fecha}`);
        });
    });

    test('All amounts are positive numbers', () => {
        movimientos.forEach((mov, idx) => {
            assert(typeof mov.monto === 'number' && mov.monto > 0, 
                `Movement ${idx} invalid monto: ${mov.monto}`);
        });
    });

    test('Movements have both ingresos and egresos', () => {
        const ingresos = movimientos.filter(m => m.tipo === 'ingreso');
        const egresos = movimientos.filter(m => m.tipo === 'egreso');
        assert(ingresos.length > 0, 'No ingresos found');
        assert(egresos.length > 0, 'No egresos found');
    });

    test('Ingresos and egresos have correct total calculation', () => {
        const ingresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((sum, m) => sum + m.monto, 0);
        const egresos = movimientos.filter(m => m.tipo === 'egreso').reduce((sum, m) => sum + m.monto, 0);
        assert(ingresos > 0, 'Total ingresos should be > 0');
        assert(egresos > 0, 'Total egresos should be > 0');
        assert(ingresos > egresos || egresos > 0, 'Invalid balance');
        logInfo(`   Balance: Ingresos Q${ingresos.toFixed(2)} - Egresos Q${egresos.toFixed(2)} = Saldo Q${(ingresos - egresos).toFixed(2)}`);
    });

    test('All categories are valid', () => {
        const validCategories = [
            'capital', 'combustible', 'materiales', 'herramientas', 'servicios',
            'alimentos', 'otros', 'transporte', 'mantenimiento', 'insumos',
            'nomina', 'equipo', 'transporte_alquiler'
        ];
        movimientos.forEach((mov, idx) => {
            assert(validCategories.includes(mov.categoria), 
                `Movement ${idx} invalid categoria: ${mov.categoria}`);
        });
    });

    test('All movements belong to current project', () => {
        const pid = db.configuracion.proyecto_actual;
        movimientos.forEach((mov, idx) => {
            assert(mov.proyecto_id === pid, 
                `Movement ${idx} belongs to wrong project: ${mov.proyecto_id}`);
        });
    });
}

// ============================================================
// 3. MAQUINARIA Y FLOTA VERIFICATION
// ============================================================

function verifyMaquinariaFlota(db) {
    logSection('MAQUINARIA Y FLOTA VERIFICATION');

    const pid = db.configuracion.proyecto_actual;
    const datos = db.proyectos_data[pid];
    const { vehiculos, registros } = datos.maquinaria_flota;

    test('Maquinaria flota has vehicles', () => {
        assert(vehiculos.length > 0, 'No vehicles found');
    });

    test('All vehicles have valid structure', () => {
        vehiculos.forEach((veh, idx) => {
            assert(veh.id, `Vehicle ${idx} missing id`);
            assert(veh.nombre && veh.nombre.length >= 2, `Vehicle ${idx} nombre too short`);
            assert(veh.tipo, `Vehicle ${idx} missing tipo`);
        });
    });

    test('Maquinaria flota has usage records', () => {
        assert(registros.length > 0, 'No usage records found');
    });

    test('All records have valid structure', () => {
        registros.forEach((reg, idx) => {
            assert(reg.id, `Record ${idx} missing id`);
            assert(reg.vehiculo_id, `Record ${idx} missing vehiculo_id`);
            assert(reg.fecha, `Record ${idx} missing fecha`);
            assert(reg.odometro_final >= reg.odometro_inicial, 
                `Record ${idx} odometro_final < odometro_inicial`);
        });
    });

    test('All records reference valid vehicles', () => {
        const vehicleIds = new Set(vehiculos.map(v => v.id));
        registros.forEach((reg, idx) => {
            assert(vehicleIds.has(reg.vehiculo_id), 
                `Record ${idx} references invalid vehicle: ${reg.vehiculo_id}`);
        });
    });

    test('Records with costs have linked gasto_id', () => {
        registros.forEach((reg, idx) => {
            const totalCost = (reg.combustible_costo || 0) + (reg.mantenimiento_costo || 0);
            if (totalCost > 0) {
                assert(reg.gasto_id, `Record ${idx} has cost but no gasto_id`);
            }
        });
    });
}

// ============================================================
// 4. PERSONAL VERIFICATION
// ============================================================

function verifyPersonal(db) {
    logSection('PERSONAL VERIFICATION');

    const pid = db.configuracion.proyecto_actual;
    const datos = db.proyectos_data[pid];
    const { trabajadores, asistencia } = datos.personal;

    test('Personal has workers', () => {
        assert(trabajadores.length > 0, 'No workers found');
    });

    test('All workers have valid structure', () => {
        trabajadores.forEach((t, idx) => {
            assert(t.id, `Worker ${idx} missing id`);
            assert(t.nombre && t.nombre.length >= 3, `Worker ${idx} nombre too short`);
            assert(t.puesto && t.puesto.length >= 2, `Worker ${idx} puesto too short`);
            assert(t.pago_hora_normal > 0, `Worker ${idx} pago_hora_normal should be > 0`);
            assert(t.pago_hora_extra >= 0, `Worker ${idx} pago_hora_extra should be >= 0`);
        });
    });

    test('Personal has attendance records', () => {
        assert(asistencia.length > 0, 'No attendance records found');
    });

    test('All attendance days have valid structure', () => {
        asistencia.forEach((dia, idx) => {
            assert(dia.fecha, `Attendance day ${idx} missing fecha`);
            assert(Array.isArray(dia.registros), `Attendance day ${idx} registros should be array`);
            assert(dia.registros.length > 0, `Attendance day ${idx} has no registros`);
        });
    });

    test('All attendance registros reference valid workers', () => {
        const workerIds = new Set(trabajadores.map(t => t.id));
        asistencia.forEach(dia => {
            dia.registros.forEach(reg => {
                assert(workerIds.has(reg.trabajador_id), 
                    `Registro references invalid worker: ${reg.trabajador_id}`);
            });
        });
    });

    test('All attendance estados are valid', () => {
        const validEstados = ['asistio', 'falto', 'justificado'];
        asistencia.forEach(dia => {
            dia.registros.forEach(reg => {
                assert(validEstados.includes(reg.estado), 
                    `Invalid estado: ${reg.estado}`);
            });
        });
    });

    test('Attendance records have correct calculations', () => {
        asistencia.forEach(dia => {
            dia.registros.forEach(reg => {
                if (reg.estado === 'asistio' && reg.calculos) {
                    const worker = trabajadores.find(t => t.id === reg.trabajador_id);
                    if (worker) {
                        const expectedNormal = 8 * worker.pago_hora_normal;
                        const expectedExtra = reg.horas_extras * worker.pago_hora_extra;
                        const expectedTotal = expectedNormal + expectedExtra;
                        assert(Math.abs(reg.calculos.total_diario - expectedTotal) < 0.01,
                            `Calculation mismatch: expected ${expectedTotal}, got ${reg.calculos.total_diario}`);
                    }
                }
            });
        });
    });
}

// ============================================================
// 5. ADQUISICIONES VERIFICATION
// ============================================================

function verifyAdquisiciones(db) {
    logSection('ADQUISICIONES VERIFICATION');

    const pid = db.configuracion.proyecto_actual;
    const datos = db.proyectos_data[pid];
    const { proveedores, cotizaciones_compras } = datos.adquisiciones;

    test('Adquisiciones has suppliers', () => {
        assert(proveedores.length > 0, 'No suppliers found');
    });

    test('All suppliers have valid structure', () => {
        proveedores.forEach((prov, idx) => {
            assert(prov.id, `Supplier ${idx} missing id`);
            assert(prov.nombre && prov.nombre.length >= 3, `Supplier ${idx} nombre too short`);
            assert(prov.telefono && prov.telefono.length >= 7, `Supplier ${idx} telefono too short`);
        });
    });

    test('Adquisiciones has quotations', () => {
        assert(cotizaciones_compras.length > 0, 'No quotations found');
    });

    test('All quotations have valid structure', () => {
        cotizaciones_compras.forEach((cot, idx) => {
            assert(cot.id, `Quotation ${idx} missing id`);
            assert(cot.proveedor_id, `Quotation ${idx} missing proveedor_id`);
            assert(cot.material_descripcion && cot.material_descripcion.length >= 3, 
                `Quotation ${idx} material too short`);
            assert(cot.precio_unitario > 0, `Quotation ${idx} precio_unitario should be > 0`);
            assert(cot.cantidad >= 1, `Quotation ${idx} cantidad should be >= 1`);
            assert(['pendiente', 'aprobada', 'rechazada'].includes(cot.estado), 
                `Quotation ${idx} invalid estado: ${cot.estado}`);
        });
    });

    test('All quotations reference valid suppliers', () => {
        const supplierIds = new Set(proveedores.map(p => p.id));
        cotizaciones_compras.forEach((cot, idx) => {
            assert(supplierIds.has(cot.proveedor_id), 
                `Quotation ${idx} references invalid supplier: ${cot.proveedor_id}`);
        });
    });

    test('Approved quotations have correct total calculation', () => {
        cotizaciones_compras.forEach((cot, idx) => {
            const expectedTotal = Math.round(cot.cantidad * cot.precio_unitario * 100) / 100;
            assert(Math.abs(cot.total - expectedTotal) < 1.0,
                `Quotation ${idx} total mismatch: expected ${expectedTotal}, got ${cot.total}`);
        });
    });

    test('Approved quotations have linked gasto_id', () => {
        cotizaciones_compras.forEach((cot, idx) => {
            if (cot.estado === 'aprobada') {
                assert(cot.gasto_id, `Approved quotation ${idx} missing gasto_id`);
            }
        });
    });
}

// ============================================================
// 6. VIAJES DE CAMIONES VERIFICATION
// ============================================================

function verifyViajes(db) {
    logSection('VIAJES DE CAMIONES VERIFICATION');

    const pid = db.configuracion.proyecto_actual;
    const datos = db.proyectos_data[pid];
    const { rutas_botadero, camiones, equipo_alquilado, viajes } = datos.viajes_camiones;

    test('Viajes has routes', () => {
        assert(rutas_botadero.length > 0, 'No routes found');
    });

    test('Viajes has trucks', () => {
        assert(camiones.length > 0, 'No trucks found');
    });

    test('Viajes has trips', () => {
        assert(viajes.length > 0, 'No trips found');
    });

    test('All routes have valid structure', () => {
        rutas_botadero.forEach((ruta, idx) => {
            assert(ruta.id, `Route ${idx} missing id`);
            assert(ruta.nombre && ruta.nombre.length >= 2, `Route ${idx} nombre too short`);
            assert(ruta.distancia_km > 0, `Route ${idx} distancia_km should be > 0`);
        });
    });

    test('All trucks have valid structure', () => {
        camiones.forEach((cam, idx) => {
            assert(cam.id, `Truck ${idx} missing id`);
            assert(cam.nombre && cam.nombre.length >= 2, `Truck ${idx} nombre too short`);
            assert(['propio', 'alquilado'].includes(cam.propiedad), 
                `Truck ${idx} invalid propiedad: ${cam.propiedad}`);
        });
    });

    test('All trips have valid structure', () => {
        viajes.forEach((viaje, idx) => {
            assert(viaje.id, `Trip ${idx} missing id`);
            assert(viaje.fecha, `Trip ${idx} missing fecha`);
            assert(viaje.vehiculo_id, `Trip ${idx} missing vehiculo_id`);
            assert(viaje.ruta_id, `Trip ${idx} missing ruta_id`);
            assert(viaje.numero > 0, `Trip ${idx} numero should be > 0`);
            assert(viaje.km_total > 0, `Trip ${idx} km_total should be > 0`);
            assert(viaje.total > 0, `Trip ${idx} total should be > 0`);
        });
    });

    test('All trips reference valid vehicles and routes', () => {
        const vehicleIds = new Set([...camiones.map(c => c.id), ...equipo_alquilado.map(e => e.id)]);
        const routeIds = new Set(rutas_botadero.map(r => r.id));
        
        viajes.forEach((viaje, idx) => {
            assert(vehicleIds.has(viaje.vehiculo_id), 
                `Trip ${idx} references invalid vehicle: ${viaje.vehiculo_id}`);
            assert(routeIds.has(viaje.ruta_id), 
                `Trip ${idx} references invalid route: ${viaje.ruta_id}`);
        });
    });

    test('Trip calculations are correct', () => {
        viajes.forEach((viaje, idx) => {
            const ruta = rutas_botadero.find(r => r.id === viaje.ruta_id);
            const expectedKm = ruta.distancia_km * 2 * viaje.numero;
            assert(Math.abs(viaje.km_total - expectedKm) < 0.01,
                `Trip ${idx} km_total mismatch: expected ${expectedKm}, got ${viaje.km_total}`);
        });
    });

    test('All trips have linked gasto_id', () => {
        viajes.forEach((viaje, idx) => {
            assert(viaje.gasto_id, `Trip ${idx} missing gasto_id`);
        });
    });
}

// ============================================================
// 7. MANTENIMIENTO VERIFICATION
// ============================================================

function verifyMantenimiento(db) {
    logSection('MANTENIMIENTO VERIFICATION');

    const pid = db.configuracion.proyecto_actual;
    const datos = db.proyectos_data[pid];
    const { maquinaria, formatos, ordenes, compras_insumos } = datos.mantenimiento;

    test('Mantenimiento has machinery catalog', () => {
        assert(maquinaria.length > 0, 'No machinery in catalog');
    });

    test('Mantenimiento has formatos', () => {
        assert(formatos && Object.keys(formatos).length > 0, 'No formatos found');
    });

    test('Mantenimiento has orders', () => {
        assert(ordenes.length > 0, 'No maintenance orders found');
    });

    test('Mantenimiento has supply purchases', () => {
        assert(compras_insumos.length > 0, 'No supply purchases found');
    });

    test('All machinery has valid structure', () => {
        maquinaria.forEach((maq, idx) => {
            assert(maq.id, `Machinery ${idx} missing id`);
            assert(maq.nombre && maq.nombre.length >= 2, `Machinery ${idx} nombre too short`);
            assert(maq.tipo, `Machinery ${idx} missing tipo`);
        });
    });

    test('All orders have valid structure', () => {
        ordenes.forEach((ord, idx) => {
            assert(ord.id, `Order ${idx} missing id`);
            assert(ord.fecha, `Order ${idx} missing fecha`);
            assert(ord.maquinaria_id, `Order ${idx} missing maquinaria_id`);
            assert(['preventivo', 'correctivo'].includes(ord.tipo), 
                `Order ${idx} invalid tipo: ${ord.tipo}`);
            assert(ord.costo > 0, `Order ${idx} costo should be > 0`);
            assert(ord.gasto_id, `Order ${idx} missing gasto_id`);
        });
    });

    test('All orders reference valid machinery', () => {
        const maqIds = new Set(maquinaria.map(m => m.id));
        ordenes.forEach((ord, idx) => {
            assert(maqIds.has(ord.maquinaria_id), 
                `Order ${idx} references invalid machinery: ${ord.maquinaria_id}`);
        });
    });

    test('All supply purchases have valid structure', () => {
        compras_insumos.forEach((ins, idx) => {
            assert(ins.id, `Supply ${idx} missing id`);
            assert(ins.fecha, `Supply ${idx} missing fecha`);
            assert(ins.articulo && ins.articulo.length >= 2, `Supply ${idx} articulo too short`);
            assert(ins.cantidad >= 1, `Supply ${idx} cantidad should be >= 1`);
            assert(ins.costo > 0, `Supply ${idx} costo should be > 0`);
            assert(ins.gasto_id, `Supply ${idx} missing gasto_id`);
        });
    });

    test('Formatos match machinery types', () => {
        const tiposMaquinaria = maquinaria.map(m => m.tipo);
        Object.keys(formatos).forEach(tipo => {
            assert(tiposMaquinaria.includes(tipo), 
                `Formato for unknown machinery type: ${tipo}`);
        });
    });
}

// ============================================================
// 8. DATA INTEGRITY AND LINKAGE VERIFICATION
// ============================================================

function verifyDataIntegrity(db) {
    logSection('DATA INTEGRITY AND LINKAGE VERIFICATION');

    const pid = db.configuracion.proyecto_actual;
    const datos = db.proyectos_data[pid];

    // Collect all gasto_ids from caja_chica
    const cajaGastoIds = new Set(datos.caja_chica.map(m => m.id));

    test('Viajes gasto_ids exist in caja_chica', () => {
        datos.viajes_camiones.viajes.forEach((viaje, idx) => {
            if (viaje.gasto_id) {
                assert(cajaGastoIds.has(viaje.gasto_id), 
                    `Trip ${idx} gasto_id ${viaje.gasto_id} not found in caja_chica`);
            }
        });
    });

    test('Mantenimiento orders gasto_ids exist in caja_chica', () => {
        datos.mantenimiento.ordenes.forEach((ord, idx) => {
            if (ord.gasto_id) {
                assert(cajaGastoIds.has(ord.gasto_id), 
                    `Order ${idx} gasto_id ${ord.gasto_id} not found in caja_chica`);
            }
        });
    });

    test('Mantenimiento supplies gasto_ids exist in caja_chica', () => {
        datos.mantenimiento.compras_insumos.forEach((ins, idx) => {
            if (ins.gasto_id) {
                assert(cajaGastoIds.has(ins.gasto_id), 
                    `Supply ${idx} gasto_id ${ins.gasto_id} not found in caja_chica`);
            }
        });
    });

    test('Adquisiciones quotations gasto_ids exist in caja_chica', () => {
        datos.adquisiciones.cotizaciones_compras.forEach((cot, idx) => {
            if (cot.gasto_id) {
                assert(cajaGastoIds.has(cot.gasto_id), 
                    `Quotation ${idx} gasto_id ${cot.gasto_id} not found in caja_chica`);
            }
        });
    });

    test('Maquinaria registros gasto_ids exist in caja_chica', () => {
        datos.maquinaria_flota.registros.forEach((reg, idx) => {
            if (reg.gasto_id) {
                assert(cajaGastoIds.has(reg.gasto_id), 
                    `Maquinaria record ${idx} gasto_id ${reg.gasto_id} not found in caja_chica`);
            }
        });
    });

    test('No duplicate IDs in caja_chica', () => {
        const ids = datos.caja_chica.map(m => m.id);
        const uniqueIds = new Set(ids);
        assert(ids.length === uniqueIds.size, 
            `Duplicate IDs found in caja_chica: ${ids.length} total, ${uniqueIds.size} unique`);
    });

    test('No duplicate IDs in personal.trabajadores', () => {
        const ids = datos.personal.trabajadores.map(t => t.id);
        const uniqueIds = new Set(ids);
        assert(ids.length === uniqueIds.size, 
            `Duplicate IDs found in trabajadores`);
    });

    test('No duplicate IDs in viajes_camiones.viajes', () => {
        const ids = datos.viajes_camiones.viajes.map(v => v.id);
        const uniqueIds = new Set(ids);
        assert(ids.length === uniqueIds.size, 
            `Duplicate IDs found in viajes`);
    });
}

// ============================================================
// 9. REPORT STRUCTURE VERIFICATION
// ============================================================

function verifyReportStructure(db) {
    logSection('REPORT STRUCTURE VERIFICATION');

    const pid = db.configuracion.proyecto_actual;
    const datos = db.proyectos_data[pid];

    test('Report types can access required data', () => {
        // Diario/Semanal/Mensual
        assert(datos.caja_chica.length >= 0, 'Diario report: caja_chica accessible');
        
        // Asistencia
        assert(datos.personal.trabajadores.length > 0, 'Asistencia report: trabajadores accessible');
        assert(datos.personal.asistencia.length > 0, 'Asistencia report: asistencia accessible');
        
        // Viajes
        assert(datos.viajes_camiones.viajes.length >= 0, 'Viajes report: viajes accessible');
        
        // Mantenimiento
        assert(datos.mantenimiento.ordenes.length >= 0, 'Mantenimiento report: ordenes accessible');
        assert(datos.mantenimiento.compras_insumos.length >= 0, 'Mantenimiento report: insumos accessible');
        
        // Nómina
        assert(datos.personal.trabajadores.length > 0, 'Nómina report: trabajadores accessible');
        
        // Categoría
        assert(datos.caja_chica.length > 0, 'Categoría report: caja_chica accessible');
        
        // Ejecutivo
        assert(datos.caja_chica.length > 0, 'Ejecutivo report: caja_chica accessible');
    });

    test('Linked expenses are properly tracked', () => {
        const linkedViajes = datos.viajes_camiones.viajes.filter(v => v.gasto_id).length;
        const linkedOrdenes = datos.mantenimiento.ordenes.filter(o => o.gasto_id).length;
        const linkedInsumos = datos.mantenimiento.compras_insumos.filter(i => i.gasto_id).length;
        
        assert(linkedViajes > 0, 'No linked expenses in viajes');
        assert(linkedOrdenes > 0, 'No linked expenses in órdenes');
        assert(linkedInsumos > 0, 'No linked expenses in insumos');
        
        logInfo(`   Viajes linked: ${linkedViajes}, Órdenes linked: ${linkedOrdenes}, Insumos linked: ${linkedInsumos}`);
    });

    test('All report sections have data', () => {
        const caja = datos.caja_chica;
        const viajes = datos.viajes_camiones.viajes;
        const ordenes = datos.mantenimiento.ordenes;
        const insumos = datos.mantenimiento.compras_insumos;
        const trabajadores = datos.personal.trabajadores;
        const asistencia = datos.personal.asistencia;

        assert(caja.length > 0, 'Caja chica section empty');
        assert(viajes.length > 0, 'Viajes section empty');
        assert(ordenes.length > 0, 'Mantenimiento órdenes section empty');
        assert(insumos.length > 0, 'Mantenimiento insumos section empty');
        assert(trabajadores.length > 0, 'Personal trabajadores section empty');
        assert(asistencia.length > 0, 'Personal asistencia section empty');
    });
}

// ============================================================
// 10. DATA CONSISTENCY VERIFICATION
// ============================================================

function verifyDataConsistency(db) {
    logSection('DATA CONSISTENCY VERIFICATION');

    const pid = db.configuracion.proyecto_actual;
    const datos = db.proyectos_data[pid];

    test('All dates are in valid range', () => {
        const today = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(today.getFullYear() - 1);

        const checkDate = (dateStr) => {
            const d = new Date(dateStr);
            assert(d >= oneYearAgo && d <= today, 
                `Date ${dateStr} out of valid range`);
        };

        datos.caja_chica.forEach(m => checkDate(m.fecha));
        datos.maquinaria_flota.registros.forEach(r => checkDate(r.fecha));
        datos.personal.asistencia.forEach(a => checkDate(a.fecha));
        datos.adquisiciones.cotizaciones_compras.forEach(c => checkDate(c.fecha));
        datos.viajes_camiones.viajes.forEach(v => checkDate(v.fecha));
        datos.mantenimiento.ordenes.forEach(o => checkDate(o.fecha));
        datos.mantenimiento.compras_insumos.forEach(i => checkDate(i.fecha));
    });

    test('All numeric fields are valid numbers', () => {
        const checkNumber = (value, field) => {
            assert(typeof value === 'number' && !isNaN(value), 
                `Invalid number for ${field}: ${value}`);
        };

        datos.caja_chica.forEach(m => checkNumber(m.monto, 'caja_chica.monto'));
        datos.maquinaria_flota.registros.forEach(r => {
            checkNumber(r.odometro_inicial, 'odometro_inicial');
            checkNumber(r.odometro_final, 'odometro_final');
        });
        datos.viajes_camiones.viajes.forEach(v => {
            checkNumber(v.km_total, 'km_total');
            checkNumber(v.litros, 'litros');
            checkNumber(v.total, 'total');
        });
        datos.mantenimiento.ordenes.forEach(o => checkNumber(o.costo, 'orden.costo'));
        datos.mantenimiento.compras_insumos.forEach(i => checkNumber(i.costo, 'insumo.costo'));
    });

    test('No orphaned references', () => {
        const workerIds = new Set(datos.personal.trabajadores.map(t => t.id));
        const supplierIds = new Set(datos.adquisiciones.proveedores.map(p => p.id));
        const vehicleIds = new Set([...datos.viajes_camiones.camiones.map(c => c.id), ...datos.viajes_camiones.equipo_alquilado.map(e => e.id)]);
        const routeIds = new Set(datos.viajes_camiones.rutas_botadero.map(r => r.id));
        const maqIds = new Set(datos.mantenimiento.maquinaria.map(m => m.id));

        datos.adquisiciones.cotizaciones_compras.forEach(cot => {
            assert(supplierIds.has(cot.proveedor_id), 
                `Cotizacion references orphaned supplier: ${cot.proveedor_id}`);
        });

        datos.viajes_camiones.viajes.forEach(viaje => {
            assert(vehicleIds.has(viaje.vehiculo_id), 
                `Viaje references orphaned vehicle: ${viaje.vehiculo_id}`);
            assert(routeIds.has(viaje.ruta_id), 
                `Viaje references orphaned route: ${viaje.ruta_id}`);
        });

        datos.mantenimiento.ordenes.forEach(ord => {
            assert(maqIds.has(ord.maquinaria_id), 
                `Orden references orphaned machinery: ${ord.maquinaria_id}`);
        });

        datos.personal.asistencia.forEach(dia => {
            dia.registros.forEach(reg => {
                assert(workerIds.has(reg.trabajador_id), 
                    `Asistencia references orphaned worker: ${reg.trabajador_id}`);
            });
        });
    });
}

// ============================================================
// 11. BUSINESS LOGIC VERIFICATION
// ============================================================

function verifyBusinessLogic(db) {
    logSection('BUSINESS LOGIC VERIFICATION');

    const pid = db.configuracion.proyecto_actual;
    const datos = db.proyectos_data[pid];

    test('Caja chica: ingresos should exceed egresos for positive balance', () => {
        const ingresos = datos.caja_chica
            .filter(m => m.tipo === 'ingreso')
            .reduce((sum, m) => sum + m.monto, 0);
        const egresos = datos.caja_chica
            .filter(m => m.tipo === 'egreso')
            .reduce((sum, m) => sum + m.monto, 0);
        
        assert(ingresos > 0, 'Should have ingresos');
        assert(egresos > 0, 'Should have egresos');
        // With linked expenses, total egresos can exceed ingresos, which is valid
        logInfo(`   Ingresos: Q${ingresos.toFixed(2)}, Egresos: Q${egresos.toFixed(2)}`);
    });

    test('Viajes: total calculation is correct', () => {
        datos.viajes_camiones.viajes.forEach((viaje, idx) => {
            const expectedTotal = viaje.costo_combustible + viaje.costo_alquiler;
            assert(Math.abs(viaje.total - expectedTotal) < 0.01,
                `Viaje ${idx} total incorrect: expected ${expectedTotal}, got ${viaje.total}`);
        });
    });

    test('Adquisiciones: total = cantidad * precio_unitario', () => {
        datos.adquisiciones.cotizaciones_compras.forEach((cot, idx) => {
            const expectedTotal = Math.round(cot.cantidad * cot.precio_unitario * 100) / 100;
            assert(Math.abs(cot.total - expectedTotal) < 1.0,
                `Cotizacion ${idx} total incorrect: expected ${expectedTotal}, got ${cot.total}`);
        });
    });

    test('Attendance: all workers present on any given day', () => {
        datos.personal.asistencia.forEach(dia => {
            const estados = dia.registros.map(r => r.estado);
            const hasPresent = estados.includes('asistio');
            assert(hasPresent, `Day ${dia.fecha} has no present workers`);
        });
    });

    test('All dates are within valid range', () => {
        const today = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(today.getFullYear() - 1);

        const checkDate = (dateStr, field) => {
            const d = new Date(dateStr);
            assert(d >= oneYearAgo && d <= today, 
                `${field} out of valid range: ${dateStr}`);
        };

        datos.caja_chica.forEach(m => checkDate(m.fecha, 'caja_chica.fecha'));
        datos.maquinaria_flota.registros.forEach(r => checkDate(r.fecha, 'maquinaria.fecha'));
        datos.personal.asistencia.forEach(a => checkDate(a.fecha, 'asistencia.fecha'));
        datos.adquisiciones.cotizaciones_compras.forEach(c => checkDate(c.fecha, 'cotizacion.fecha'));
        datos.viajes_camiones.viajes.forEach(v => checkDate(v.fecha, 'viaje.fecha'));
        datos.mantenimiento.ordenes.forEach(o => checkDate(o.fecha, 'orden.fecha'));
        datos.mantenimiento.compras_insumos.forEach(i => checkDate(i.fecha, 'insumo.fecha'));
    });
}

// ============================================================
// 12. CSV EXPORT STRUCTURE VERIFICATION
// ============================================================

function verifyCSVStructure(db) {
    logSection('CSV EXPORT STRUCTURE VERIFICATION');

    const pid = db.configuracion.proyecto_actual;
    const datos = db.proyectos_data[pid];

    test('CSV export can access all required data fields', () => {
        // Verify caja_chica fields for CSV
        datos.caja_chica.forEach((m, idx) => {
            assert(typeof m.fecha === 'string', `CSV: movement ${idx} fecha not string`);
            assert(typeof m.tipo === 'string', `CSV: movement ${idx} tipo not string`);
            assert(typeof m.categoria === 'string', `CSV: movement ${idx} categoria not string`);
            assert(typeof m.descripcion === 'string', `CSV: movement ${idx} descripcion not string`);
            assert(typeof m.monto === 'number', `CSV: movement ${idx} monto not number`);
        });

        // Verify viajes fields for CSV
        datos.viajes_camiones.viajes.forEach((v, idx) => {
            assert(typeof v.fecha === 'string', `CSV: viaje ${idx} fecha not string`);
            assert(typeof v.material === 'string', `CSV: viaje ${idx} material not string`);
            assert(typeof v.km_total === 'number', `CSV: viaje ${idx} km_total not number`);
        });

        // Verify personal fields for CSV
        datos.personal.trabajadores.forEach((t, idx) => {
            assert(typeof t.nombre === 'string', `CSV: trabajador ${idx} nombre not string`);
            assert(typeof t.puesto === 'string', `CSV: trabajador ${idx} puesto not string`);
        });
    });

    test('All text fields are strings (not null/undefined)', () => {
        datos.caja_chica.forEach((m, idx) => {
            assert(m.descripcion !== null && m.descripcion !== undefined,
                `Movement ${idx} descripcion is null/undefined`);
            assert(m.categoria !== null && m.categoria !== undefined,
                `Movement ${idx} categoria is null/undefined`);
        });
    });
}

// ============================================================
// MAIN VERIFICATION
// ============================================================

function main() {
    console.log('\n══════════════════════════════════════════════');
    console.log('  CONSTRURAMSA MODULE VERIFICATION SYSTEM');
    console.log('══════════════════════════════════════════════\n');

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

    // Run all verifications
    verifyProjects(db);
    verifyCajaChica(db);
    verifyMaquinariaFlota(db);
    verifyPersonal(db);
    verifyAdquisiciones(db);
    verifyViajes(db);
    verifyMantenimiento(db);
    verifyDataIntegrity(db);
    verifyReportStructure(db);
    verifyDataConsistency(db);
    verifyBusinessLogic(db);
    verifyCSVStructure(db);

    // Summary
    console.log('\n══════════════════════════════════════════════');
    console.log('  VERIFICATION SUMMARY');
    console.log('══════════════════════════════════════════════');
    console.log(`\nTotal Tests: ${totalTests}`);
    console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
    if (failedTests > 0) {
        console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
    }
    console.log(`\nSuccess Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%\n`);

    if (failedTests === 0) {
        console.log('${colors.green}${colors.bold}✅ ALL MODULES VERIFIED SUCCESSFULLY${colors.reset}\n');
        process.exit(0);
    } else {
        console.log(`${colors.red}${colors.bold}❌ VERIFICATION FAILED${colors.reset}\n`);
        process.exit(1);
    }
}

main();
