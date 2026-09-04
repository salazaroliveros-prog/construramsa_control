/**
 * Comprehensive Test Data Generator for CONSTRURAMSA Control de Gastos
 * 
 * Generates complete, linked test data for ALL modules:
 * - Projects
 * - Caja Chica (with linked expenses)
 * - Maquinaria y Flota
 * - Personal (workers + attendance)
 * - Adquisiciones (suppliers + quotations)
 * - Viajes de Camiones (with linked expenses)
 * - Mantenimiento (orders + supplies, with linked expenses)
 * 
 * All linked expenses are properly connected via gasto_id to avoid double-counting.
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'construramsa_db.json');

// ============================================================
// UTILITIES
// ============================================================

function generateId(prefix = 'test') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return formatDate(d);
}

function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
    return Math.floor(randomBetween(min, max));
}

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================================
// DATABASE LOAD/SAVE
// ============================================================

function loadDatabase() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            console.error('❌ Database file not found:', DB_FILE);
            return null;
        }
        const content = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error('❌ Error loading database:', error.message);
        return null;
    }
}

function saveDatabase(db) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
        console.log('✅ Database saved successfully');
    } catch (error) {
        console.error('❌ Error saving database:', error.message);
    }
}

// ============================================================
// TEST DATA GENERATOR
// ============================================================

function generateComprehensiveTestData(db) {
    console.log('\n📊 Generating comprehensive test data...\n');

    // Ensure projects_data exists
    if (!db.proyectos_data) db.proyectos_data = {};

    // ============================================================
    // 1. CREATE PROJECT
    // ============================================================
    const projectId = generateId('proj');
    const projectName = 'Proyecto de Prueba Integral';
    
    const project = {
        id: projectId,
        nombre: projectName,
        descripcion: 'Proyecto para pruebas completas de todos los módulos',
        presupuesto_inicial: 500000,
        fecha_creacion: daysAgo(45),
        fecha_ultima_modificacion: formatDate(new Date()),
        activo: true,
        color: '#004B93'
    };

    db.proyectos.push(project);
    db.configuracion.proyecto_actual = projectId;

    // Initialize project data with all required sub-structures
    db.proyectos_data[projectId] = {
        caja_chica: [],
        maquinaria_flota: { vehiculos: [], registros: [] },
        personal: { trabajadores: [], asistencia: [] },
        adquisiciones: { proveedores: [], cotizaciones_compras: [] },
        viajes_camiones: { rutas_botadero: [], camiones: [], equipo_alquilado: [], viajes: [] },
        mantenimiento: { maquinaria: [], formatos: {}, ordenes: [], compras_insumos: [] }
    };

    const datos = db.proyectos_data[projectId];

    // Generate dates for last 30 days
    const dates = [];
    for (let i = 29; i >= 0; i--) {
        dates.push(daysAgo(i));
    }

    // Track all generated gasto_ids for verification
    const linkedExpenses = new Map(); // gasto_id -> { module, description, amount }

    // ============================================================
    // 2. CAJA CHICA - Movements (core of the system)
    // ============================================================
    console.log('  💰 Generating caja chica movements...');
    
    // Initial balance / opening
    datos.caja_chica.push({
        id: generateId('cc'),
        tipo: 'ingreso',
        monto: 50000,
        descripcion: 'Aporte inicial de capital',
        fecha: dates[0],
        categoria: 'capital',
        responsable: 'Administrador',
        proyecto_id: projectId
    });

    // Weekly income
    dates.forEach((fecha, idx) => {
        if (idx % 7 === 0) {
            datos.caja_chica.push({
                id: generateId('cc'),
                tipo: 'ingreso',
                monto: 15000 + randomInt(0, 5000),
                descripcion: 'Aporte semanal de capital',
                fecha: fecha,
                categoria: 'capital',
                responsable: 'Administrador',
                proyecto_id: projectId
            });
        }
    });

    // ============================================================
    // 3. PERSONAL - Workers and Attendance
    // ============================================================
    console.log('  👷 Generating personal data...');

    const workers = [
        { id: generateId('t'), nombre: 'Juan Pérez García', puesto: 'Albañil', pago_hora_normal: 25, pago_hora_extra: 35 },
        { id: generateId('t'), nombre: 'María García López', puesto: 'Ayudante', pago_hora_normal: 20, pago_hora_extra: 28 },
        { id: generateId('t'), nombre: 'Carlos López Martínez', puesto: 'Maestro de Obra', pago_hora_normal: 30, pago_hora_extra: 42 },
        { id: generateId('t'), nombre: 'Ana Martínez Sánchez', puesto: 'Soldador', pago_hora_normal: 28, pago_hora_extra: 38 },
        { id: generateId('t'), nombre: 'Pedro Sánchez Rodríguez', puesto: 'Ayudante General', pago_hora_normal: 20, pago_hora_extra: 28 },
        { id: generateId('t'), nombre: 'Luis Hernández Díaz', puesto: 'Electricista', pago_hora_normal: 32, pago_hora_extra: 45 },
        { id: generateId('t'), nombre: 'Roberto Gómez Ruiz', puesto: 'Fontanero', pago_hora_normal: 28, pago_hora_extra: 38 }
    ];

    datos.personal.trabajadores = workers;

    // Generate attendance for last 20 days
    const attendanceDates = dates.slice(0, 20);
    datos.personal.asistencia = [];

    attendanceDates.forEach(fecha => {
        const registros = workers.map(trabajador => {
            const rand = Math.random();
            let estado = 'asistio';
            if (rand > 0.9) estado = 'falto';
            else if (rand > 0.85) estado = 'justificado';

            const horasExtras = estado === 'asistio' && Math.random() > 0.7 ? randomInt(1, 3) : 0;

            return {
                id: generateId('as'),
                fecha: fecha,
                trabajador_id: trabajador.id,
                estado: estado,
                horas_extras: horasExtras,
                calculos: estado === 'asistio' ? {
                    total_diario: 8 * trabajador.pago_hora_normal + horasExtras * trabajador.pago_hora_extra,
                    pago_normal: 8 * trabajador.pago_hora_normal,
                    pago_extra: horasExtras * trabajador.pago_hora_extra
                } : undefined
            };
        });

        datos.personal.asistencia.push({
            fecha: fecha,
            registros: registros
        });
    });

    // ============================================================
    // 4. ADQUISICIONES - Suppliers and Quotations
    // ============================================================
    console.log('  🏭 Generating adquisiciones...');

    const suppliers = [
        { id: generateId('prov'), nombre: 'Constructora Los Ángeles S.A.', telefono: '5555-1234', email: 'ventas@losangeles.com', direccion: 'Zona 12, Guatemala', contacto: 'Carlos Mendoza' },
        { id: generateId('prov'), nombre: 'Distribuidora de Cemento Nacional', telefono: '5555-5678', email: 'info@cementonacional.com', direccion: 'Carretera a El Salvador', contacto: 'Marta López' },
        { id: generateId('prov'), nombre: 'Hierros y Aceros del Norte', telefono: '5555-9012', email: 'ventas@hierrosnorte.com', direccion: 'Zona 18, Guatemala', contacto: 'Roberto Díaz' },
        { id: generateId('prov'), nombre: 'Materiales de Construcción Bella Vista', telefono: '5555-3456', email: 'info@bellavista.com', direccion: 'Zona 7, Guatemala', contacto: 'Ana Torres' }
    ];

    datos.adquisiciones.proveedores = suppliers;

    // Generate quotations
    const quotationMaterials = [
        'Cemento Portland Tipo I', 'Varilla de acero #4', 'Bloque de concreto 6"',
        'Arena de río', 'Grava triturada 3/4"', 'Pintura látex blanca',
        'Tubo PVC 4"', 'Cable eléctrico #12', 'Cerámica para piso',
        'Puerta de madera', 'Ventana de aluminio', 'Fierro corrugado'
    ];

    datos.adquisiciones.cotizaciones_compras = [];
    dates.slice(0, 15).forEach((fecha, idx) => {
        const proveedor = suppliers[idx % suppliers.length];
        const material = quotationMaterials[idx % quotationMaterials.length];
        const cantidad = randomInt(10, 100);
        const precioUnitario = randomBetween(50, 500);
        
        const cotizacion = {
            id: generateId('cot'),
            proveedor_id: proveedor.id,
            material_descripcion: material,
            cantidad: cantidad,
            precio_unitario: parseFloat(precioUnitario.toFixed(2)),
            total: parseFloat((cantidad * precioUnitario).toFixed(2)),
            fecha: fecha,
            estado: idx < 10 ? 'aprobada' : (idx < 13 ? 'pendiente' : 'rechazada'),
            gasto_id: null // Will be set if approved
        };

        // If approved, create linked expense in caja_chica
        if (cotizacion.estado === 'aprobada') {
            const gastoId = generateId('gasto');
            datos.caja_chica.push({
                id: gastoId,
                tipo: 'egreso',
                monto: cotizacion.total,
                descripcion: `Compra aprobada: ${material}`,
                fecha: fecha,
                categoria: 'materiales',
                proveedor: proveedor.nombre,
                responsable: 'Gerente de Compras',
                proyecto_id: projectId
            });
            cotizacion.gasto_id = gastoId;
            linkedExpenses.set(gastoId, { module: 'adquisiciones', description: material, amount: cotizacion.total });
        }

        datos.adquisiciones.cotizaciones_compras.push(cotizacion);
    });

    // ============================================================
    // 5. VIAJES DE CAMIONES
    // ============================================================
    console.log('  🚛 Generating viajes de camiones...');

    const rutas = [
        { id: generateId('ruta'), nombre: 'Ruta Principal - Botadero Central', distancia_km: 15 },
        { id: generateId('ruta'), nombre: 'Ruta Norte - Botadero San Juan', distancia_km: 22 },
        { id: generateId('ruta'), nombre: 'Ruta Sur - Botadero Las Flores', distancia_km: 18 }
    ];

    const camiones = [
        { id: generateId('cam'), nombre: 'Volvo FH16', propiedad: 'propio', capacidad: 25, consumo: 0.35 },
        { id: generateId('cam'), nombre: 'Scania R450', propiedad: 'propio', capacidad: 25, consumo: 0.32 },
        { id: generateId('cam'), nombre: 'Mercedes-Benz Actros', propiedad: 'propio', capacidad: 20, consumo: 0.38 }
    ];

    const equipoAlquilado = [
        { id: generateId('eq'), nombre: 'Camión de carga pesado', propiedad: 'alquilado', tarifa_diaria: 1200, consumo: 0 }
    ];

    datos.viajes_camiones.rutas_botadero = rutas;
    datos.viajes_camiones.camiones = camiones;
    datos.viajes_camiones.equipo_alquilado = equipoAlquilado;

    // Generate trips
    const materiales = ['Tierra', 'Grava', 'Arena', 'Escombros', 'Cemento', 'Bloques', 'Agua'];
    
    dates.slice(0, 18).forEach((fecha, idx) => {
        const esAlquilado = idx % 4 === 0;
        const ruta = rutas[idx % rutas.length];
        const camion = esAlquilado ? equipoAlquilado[0] : camiones[idx % camiones.length];
        const distancia = ruta.distancia_km;
        const numeroViajes = randomInt(2, 8);
        const kmTotal = distancia * 2 * numeroViajes;
        const litros = esAlquilado ? 0 : kmTotal * camion.consumo;
        const costoCombustible = litros * 32; // Q32 per liter
        const costoAlquiler = esAlquilado ? camion.tarifa_diaria : 0;
        const total = costoCombustible + costoAlquiler;

        const viaje = {
            id: generateId('viaje'),
            fecha: fecha,
            vehiculo_id: camion.id,
            ruta_id: ruta.id,
            material: pickRandom(materiales),
            numero: numeroViajes,
            km_total: parseFloat(kmTotal.toFixed(2)),
            litros: parseFloat(litros.toFixed(2)),
            costo_combustible: parseFloat(costoCombustible.toFixed(2)),
            costo_alquiler: parseFloat(costoAlquiler.toFixed(2)),
            total: parseFloat(total.toFixed(2)),
            propiedad: camion.propiedad,
            tarifa_modalidad: 'dia',
            gasto_id: null
        };

        // Create linked expense in caja_chica
        const gastoId = generateId('gasto');
        datos.caja_chica.push({
            id: gastoId,
            tipo: 'egreso',
            monto: viaje.total,
            descripcion: `Viaje ${camion.nombre} - ${ruta.nombre}`,
            fecha: fecha,
            categoria: 'transporte',
            responsable: 'Transportista',
            proyecto_id: projectId
        });
        viaje.gasto_id = gastoId;
        linkedExpenses.set(gastoId, { module: 'viajes', description: `Viaje ${camion.nombre}`, amount: viaje.total });

        datos.viajes_camiones.viajes.push(viaje);
    });

    // ============================================================
    // 6. MANTENIMIENTO
    // ============================================================
    console.log('  🔧 Generating mantenimiento data...');

    const maquinariaMant = [
        { id: generateId('mm'), nombre: 'Excavadora CAT 320', tipo: 'excavadora' },
        { id: generateId('mm'), nombre: 'Camión Volvo FH16', tipo: 'camion' },
        { id: generateId('mm'), nombre: 'Compactor Vibratorio', tipo: 'compactor' },
        { id: generateId('mm'), nombre: 'Retroexcavadora John Deere', tipo: 'retroexcavadora' }
    ];

    datos.mantenimiento.maquinaria = maquinariaMant;
    datos.mantenimiento.formatos = {
        'excavadora': ['Inspección de motor', 'Cambio de aceite', 'Revisión de hidráulicos', 'Estado de cadenas'],
        'camion': ['Inspección de frenos', 'Nivel de aceite', 'Estado de llantas', 'Sistema eléctrico'],
        'compactor': ['Inspección de rodillo', 'Sistema de vibración', 'Nivel de combustible'],
        'retroexcavadora': ['Inspección general', 'Cambio de filtros', 'Estado de brazo']
    };

    // Generate maintenance orders
    const tiposMantenimiento = ['preventivo', 'correctivo'];
    const observacionesMantenimiento = [
        'Cambio de aceite y filtros',
        'Revisión general de motor',
        'Reparación de sistema hidráulico',
        'Ajuste de frenos',
        'Cambio de llantas',
        'Reparación de transmisión',
        'Mantenimiento preventivo programado',
        'Reparación de sistema eléctrico'
    ];

    dates.slice(0, 12).forEach((fecha, idx) => {
        const maquina = maquinariaMant[idx % maquinariaMant.length];
        const costo = randomBetween(500, 3000);
        
        const orden = {
            id: generateId('ord'),
            fecha: fecha,
            maquinaria_id: maquina.id,
            tipo: tiposMantenimiento[idx % 2],
            observaciones: observacionesMantenimiento[idx % observacionesMantenimiento.length],
            costo: parseFloat(costo.toFixed(2)),
            items: [
                { estado: 'Bien', descripcion: 'Componente principal' },
                { estado: idx % 3 === 0 ? 'Revisar' : 'Bien', descripcion: 'Sistema secundario' }
            ],
            fotos: [],
            firma: '',
            gasto_id: null
        };

        // Create linked expense
        const gastoId = generateId('gasto');
        datos.caja_chica.push({
            id: gastoId,
            tipo: 'egreso',
            monto: orden.costo,
            descripcion: `Mantenimiento ${orden.tipo}: ${maquina.nombre}`,
            fecha: fecha,
            categoria: 'mantenimiento',
            responsable: 'Jefe de Mantenimiento',
            proyecto_id: projectId
        });
        orden.gasto_id = gastoId;
        linkedExpenses.set(gastoId, { module: 'mantenimiento', description: `Mantenimiento ${maquina.nombre}`, amount: orden.costo });

        datos.mantenimiento.ordenes.push(orden);
    });

    // Generate supply purchases
    const tiposInsumos = ['repuesto', 'aceite', 'filtro', 'hidraulico', 'electrico'];
    const articulosInsumos = [
        'Aceite motor 15W-40', 'Filtro de aceite', 'Filtro de aire',
        'Aceite hidráulico', 'Correa de transmisión', 'Bujía de encendido',
        'Líquido de frenos', 'Grasa multiusos', 'Juego de empaques'
    ];

    dates.slice(5, 15).forEach((fecha, idx) => {
        const articulo = articulosInsumos[idx % articulosInsumos.length];
        const cantidad = randomInt(2, 10);
        const costoUnitario = randomBetween(50, 300);
        const costoTotal = cantidad * costoUnitario;

        const insumo = {
            id: generateId('ins'),
            fecha: fecha,
            tipo: tiposInsumos[idx % tiposInsumos.length],
            articulo: articulo,
            cantidad: cantidad,
            costo: parseFloat(costoTotal.toFixed(2)),
            stock_min: 5,
            firma: '',
            gasto_id: null
        };

        // Create linked expense
        const gastoId = generateId('gasto');
        datos.caja_chica.push({
            id: gastoId,
            tipo: 'egreso',
            monto: insumo.costo,
            descripcion: `Compra insumo: ${articulo}`,
            fecha: fecha,
            categoria: 'insumos',
            responsable: 'Almacén',
            proyecto_id: projectId
        });
        insumo.gasto_id = gastoId;
        linkedExpenses.set(gastoId, { module: 'mantenimiento', description: articulo, amount: insumo.costo });

        datos.mantenimiento.compras_insumos.push(insumo);
    });

    // ============================================================
    // 7. MAQUINARIA Y FLOTA (legacy module - separate from mantenimiento)
    // ============================================================
    console.log('  🏗️ Generating maquinaria flota records...');

    const vehiculosFlota = [
        { id: generateId('veh'), nombre: 'Retroexcavadora CAT 320D', tipo: 'retroexcavadora', marca_modelo: 'CAT 320D' },
        { id: generateId('veh'), nombre: 'Excavadora Hidráulica', tipo: 'excavadora', marca_modelo: 'Komatsu PC200' },
        { id: generateId('veh'), nombre: 'Camión de Volteo', tipo: 'camion', marca_modelo: 'Volvo FM12' }
    ];

    datos.maquinaria_flota.vehiculos = vehiculosFlota;

    // Generate usage records
    dates.slice(0, 15).forEach((fecha, idx) => {
        const vehiculo = vehiculosFlota[idx % vehiculosFlota.length];
        const odometroInicial = 10000 + idx * 100;
        const horasTrabajadas = randomInt(6, 10);
        const combustibleGalones = randomBetween(15, 35);
        const combustibleCosto = combustibleGalones * 32;
        const mantenimientoCosto = randomBetween(0, 500);

        const registro = {
            id: generateId('reg'),
            vehiculo_id: vehiculo.id,
            fecha: fecha,
            odometro_inicial: odometroInicial,
            odometro_final: odometroInicial + randomInt(50, 150),
            horas_trabajadas: horasTrabajadas,
            combustible_galones: parseFloat(combustibleGalones.toFixed(2)),
            combustible_costo: parseFloat(combustibleCosto.toFixed(2)),
            mantenimiento_detalles: idx % 3 === 0 ? 'Revisión de niveles' : '',
            mantenimiento_costo: parseFloat(mantenimientoCosto.toFixed(2)),
            gasto_id: null
        };

        // Create linked expense if there's a cost
        const totalCosto = combustibleCosto + mantenimientoCosto;
        if (totalCosto > 0) {
            const gastoId = generateId('gasto');
            datos.caja_chica.push({
                id: gastoId,
                tipo: 'egreso',
                monto: parseFloat(totalCosto.toFixed(2)),
                descripcion: `Combustible y mantenimiento ${vehiculo.nombre}`,
                fecha: fecha,
                categoria: 'combustible',
                responsable: 'Operador',
                proyecto_id: projectId
            });
            registro.gasto_id = gastoId;
            linkedExpenses.set(gastoId, { module: 'maquinaria_flota', description: vehiculo.nombre, amount: totalCosto });
        }

        datos.maquinaria_flota.registros.push(registro);
    });

    // ============================================================
    // SUMMARY
    // ============================================================
    console.log('\n✅ Test data generated successfully!');
    console.log(`   📁 Project: ${projectName} (${projectId})`);
    console.log(`   💰 Caja Chica: ${datos.caja_chica.length} movements`);
    console.log(`   🏗️ Maquinaria Flota: ${vehiculosFlota.length} vehicles, ${datos.maquinaria_flota.registros.length} records`);
    console.log(`   👷 Personal: ${workers.length} workers, ${attendanceDates.length} attendance days`);
    console.log(`   🏭 Adquisiciones: ${suppliers.length} suppliers, ${datos.adquisiciones.cotizaciones_compras.length} quotations`);
    console.log(`   🚛 Viajes: ${rutas.length} routes, ${camiones.length} trucks, ${datos.viajes_camiones.viajes.length} trips`);
    console.log(`   🔧 Mantenimiento: ${maquinariaMant.length} machines, ${datos.mantenimiento.ordenes.length} orders, ${datos.mantenimiento.compras_insumos.length} supplies`);
    console.log(`   🔗 Linked expenses: ${linkedExpenses.size}`);

    return { db, projectId, projectName, linkedExpenses };
}

// ============================================================
// MAIN
// ============================================================

function main() {
    console.log('\n══════════════════════════════════════════════');
    console.log('  CONSTRURAMSA COMPREHENSIVE TEST DATA GENERATOR');
    console.log('══════════════════════════════════════════════\n');

    // Backup existing database
    if (fs.existsSync(DB_FILE)) {
        const backupFile = DB_FILE + '.backup.' + Date.now();
        fs.copyFileSync(DB_FILE, backupFile);
        console.log(`✅ Backup created: ${path.basename(backupFile)}`);
    }

    // Load database
    const db = loadDatabase();
    if (!db) {
        process.exit(1);
    }

    // Generate test data
    const result = generateComprehensiveTestData(db);

    // Save database
    saveDatabase(result.db);

    console.log('\n══════════════════════════════════════════════');
    console.log('  GENERATION COMPLETE');
    console.log('══════════════════════════════════════════════');
    console.log(`\n✅ Project created: ${result.projectName}`);
    console.log(`✅ Project ID: ${result.projectId}`);
    console.log('\n💡 Next step: Run verification script to validate all read modules\n');
}

main();
