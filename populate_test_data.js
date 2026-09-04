/**
 * @fileoverview Test Data Population Script for CONSTRURAMSA
 * 
 * Populates the database with sample data to test all report types.
 * This enables comprehensive testing of PDF/CSV exports.
 * 
 * Usage: node populate_test_data.js
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
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logInfo(message) {
    log(`ℹ️ ${message}`, 'cyan');
}

// Load existing database
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

// Save database
function saveDatabase(db) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
        logSuccess('Database saved successfully');
    } catch (error) {
        logError(`Error saving database: ${error.message}`);
    }
}

// Generate test data
function generateTestData(db) {
    logInfo('Generating test data...');
    
    const projectId = db.proyectos[0].id;
    const datos = db.proyectos_data[projectId];
    
    const today = new Date();
    const formatDate = (d) => d.toISOString().split('T')[0];
    
    // Generate dates for the last 30 days
    const dates = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        dates.push(formatDate(d));
    }
    
    // 1. Caja Chica - Mix of income and expenses
    logInfo('Adding caja chica movements...');
    datos.caja_chica = [];
    const categories = ['combustible', 'materiales', 'herramientas', 'servicios', 'alimentos', 'otros'];
    
    dates.forEach((fecha, idx) => {
        // Add 2-3 movements per day
        const numMovs = 2 + Math.floor(Math.random() * 2);
        for (let m = 0; m < numMovs; m++) {
            const isIngreso = m === 0 && idx % 7 === 0; // Weekly income
            datos.caja_chica.push({
                id: 'cc_' + fecha + '_' + m,
                fecha: fecha,
                tipo: isIngreso ? 'ingreso' : 'egreso',
                categoria: categories[Math.floor(Math.random() * categories.length)],
                descripcion: isIngreso ? 'Aporte de capital' : `Gasto operativo ${m + 1}`,
                monto: isIngreso ? 5000 + Math.random() * 2000 : 100 + Math.random() * 500,
                proyecto_id: projectId
            });
        }
    });
    
    // 2. Maquinaria - Machinery usage records
    logInfo('Adding maquinaria records...');
    datos.maquinaria_flota = {
        vehiculos: [
            { id: 'v1', nombre: 'Camión Volteo 1', tipo: 'camion', capacidad: 10 },
            { id: 'v2', nombre: 'Excavadora CAT 320', tipo: 'excavadora', capacidad: 5 },
            { id: 'v3', nombre: 'Compactor Vibratorio', tipo: 'compactor', capacidad: 3 }
        ],
        registros: dates.slice(0, 15).map((fecha, idx) => ({
            id: 'maq_' + fecha,
            fecha: fecha,
            vehiculo_id: ['v1', 'v2', 'v3'][idx % 3],
            horas: 8,
            combustible: 20 + Math.random() * 10,
            operador: 'Operador ' + (idx + 1)
        }))
    };
    
    // 3. Personal - Workers and attendance
    logInfo('Adding personal data...');
    datos.personal = {
        trabajadores: [
            { id: 't1', nombre: 'Juan Pérez', puesto: 'Albañil', pago_hora_normal: 25, pago_hora_extra: 35 },
            { id: 't2', nombre: 'María García', puesto: 'Ayudante', pago_hora_normal: 20, pago_hora_extra: 28 },
            { id: 't3', nombre: 'Carlos López', puesto: 'Maestro', pago_hora_normal: 30, pago_hora_extra: 42 },
            { id: 't4', nombre: 'Ana Martínez', puesto: 'Soldador', pago_hora_normal: 28, pago_hora_extra: 38 },
            { id: 't5', nombre: 'Pedro Sánchez', puesto: 'Ayudante', pago_hora_normal: 20, pago_hora_extra: 28 }
        ],
        asistencia: dates.slice(0, 15).map((fecha, idx) => {
            const records = [];
            for (let t = 1; t <= 5; t++) {
                const estado = Math.random() > 0.1 ? 'presente' : 'falto';
                records.push({
                    id: 'as_' + fecha + '_t' + t,
                    fecha: fecha,
                    trabajador_id: 't' + t,
                    estado: estado,
                    horas_trabajadas: estado === 'presente' ? 8 : 0,
                    horas_extra: estado === 'presente' && Math.random() > 0.7 ? 2 : 0
                });
            }
            return records;
        }).flat()
    };
    
    // 4. Adquisiciones - Suppliers and quotations
    logInfo('Adding adquisiciones data...');
    datos.adquisiciones = {
        proveedores: [
            { id: 'p1', nombre: 'Constructora Los Ángeles', telefono: '5555-1234', especialidad: 'Materiales' },
            { id: 'p2', nombre: 'Distribuidora de Cemento', telefono: '5555-5678', especialidad: 'Cemento' },
            { id: 'p3', nombre: 'Hierros y Aceros', telefono: '5555-9012', especialidad: 'Acero' }
        ],
        cotizaciones_compras: dates.slice(0, 10).map((fecha, idx) => ({
            id: 'cot_' + fecha,
            fecha: fecha,
            proveedor_id: ['p1', 'p2', 'p3'][idx % 3],
            articulo: ['Cemento', 'Varilla', 'Bloque'][idx % 3],
            cantidad: 10 + Math.random() * 50,
            precio_unitario: 50 + Math.random() * 100,
            estado: Math.random() > 0.3 ? 'aprobado' : 'pendiente'
        }))
    };
    
    // 5. Viajes - Truck trips
    logInfo('Adding viajes data...');
    datos.viajes_camiones = {
        rutas_botadero: [
            { id: 'r1', nombre: 'Ruta Principal - Botadero A', distancia_km: 15 },
            { id: 'r2', nombre: 'Ruta Secundaria - Botadero B', distancia_km: 12 }
        ],
        camiones: [
            { id: 'c1', nombre: 'Volvo FH16', capacidad: 25 },
            { id: 'c2', nombre: 'Scania R450', capacidad: 25 }
        ],
        equipo_alquilado: [
            { id: 'ea1', nombre: 'Camión Alquilado 1', tarifa_diaria: 800 }
        ],
        viajes: dates.slice(0, 10).map((fecha, idx) => {
            const isRental = idx % 3 === 0;
            const km = 12 + Math.random() * 20;
            const litros = km * 0.3;
            const costoCombustible = litros * 25;
            const costoAlquiler = isRental ? 800 : 0;
            const viaje = {
                id: 'viaje_' + fecha,
                fecha: fecha,
                vehiculo_id: isRental ? 'ea1' : ['c1', 'c2'][idx % 2],
                material: ['Tierra', 'Grava', 'Arena'][idx % 3],
                numero: idx + 1,
                km_total: km,
                litros: litros,
                costo_combustible: costoCombustible,
                costo_alquiler: costoAlquiler,
                total: costoCombustible + costoAlquiler
            };
            // Link to caja chica
            const gastoId = 'gasto_viaje_' + fecha;
            datos.caja_chica.push({
                id: gastoId,
                fecha: fecha,
                tipo: 'egreso',
                categoria: 'transporte',
                descripcion: 'Viaje de camión ' + idx,
                monto: viaje.total,
                proyecto_id: projectId
            });
            viaje.gasto_id = gastoId;
            return viaje;
        })
    };
    
    // 6. Mantenimiento - Maintenance orders and supplies
    logInfo('Adding mantenimiento data...');
    datos.mantenimiento = {
        maquinaria: [
            { id: 'mm1', nombre: 'Excavadora CAT 320', tipo: 'excavadora' },
            { id: 'mm2', nombre: 'Camión Volvo FH16', tipo: 'camion' }
        ],
        formatos: ['preventivo', 'correctivo'],
        ordenes: dates.slice(0, 8).map((fecha, idx) => {
            const orden = {
                id: 'ord_' + fecha,
                fecha: fecha,
                maquinaria_id: ['mm1', 'mm2'][idx % 2],
                tipo: ['preventivo', 'correctivo'][idx % 2],
                observaciones: 'Mantenimiento rutino de equipo',
                costo: 500 + Math.random() * 1000
            };
            // Link to caja chica
            const gastoId = 'gasto_mant_' + fecha;
            datos.caja_chica.push({
                id: gastoId,
                fecha: fecha,
                tipo: 'egreso',
                categoria: 'mantenimiento',
                descripcion: 'Orden de mantenimiento ' + idx,
                monto: orden.costo,
                proyecto_id: projectId
            });
            orden.gasto_id = gastoId;
            return orden;
        }),
        compras_insumos: dates.slice(0, 5).map((fecha, idx) => {
            const insumo = {
                id: 'ins_' + fecha,
                fecha: fecha,
                tipo: 'aceite',
                articulo: ['Aceite Motor', 'Filtros', 'Grasa'][idx % 3],
                cantidad: 2 + Math.random() * 3,
                costo: 100 + Math.random() * 200
            };
            // Link to caja chica
            const gastoId = 'gasto_ins_' + fecha;
            datos.caja_chica.push({
                id: gastoId,
                fecha: fecha,
                tipo: 'egreso',
                categoria: 'insumos',
                descripcion: 'Compra de insumos ' + idx,
                monto: insumo.costo,
                proyecto_id: projectId
            });
            insumo.gasto_id = gastoId;
            return insumo;
        })
    };
    
    logSuccess('Test data generated successfully');
    return db;
}

// Main function
function main() {
    logInfo('\n══════════════════════════════════════════════');
    logInfo('  CONSTRURAMSA TEST DATA POPULATION');
    logInfo('══════════════════════════════════════════════\n');
    
    const db = loadDatabase();
    if (!db) {
        process.exit(1);
    }
    
    // Backup original database
    const backupFile = DB_FILE + '.backup';
    fs.copyFileSync(DB_FILE, backupFile);
    logSuccess(`Backup created: ${backupFile}`);
    
    // Generate test data
    const dbWithTestData = generateTestData(db);
    
    // Save
    saveDatabase(dbWithTestData);
    
    logInfo('\n══════════════════════════════════════════════');
    logInfo('  SUMMARY');
    logInfo('══════════════════════════════════════════════\n');
    logInfo('Test data added for:');
    logInfo('  • Caja Chica: ~90 movements (30 days)');
    logInfo('  • Maquinaria: 3 vehicles, 15 usage records');
    logInfo('  • Personal: 5 workers, 75 attendance records');
    logInfo('  • Adquisiciones: 3 suppliers, 10 quotations');
    logInfo('  • Viajes: 10 truck trips with costs');
    logInfo('  • Mantenimiento: 8 orders, 5 supply purchases');
    logSuccess('\n✅ Ready to test all report types!');
    logInfo(`\nTo restore original data: cp ${backupFile} ${DB_FILE}`);
}

main();