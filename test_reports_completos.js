/**
 * Test de Reportes Completos con Datos Reales - CONSTRURAMSA Control de Obra v2.9.4
 * ===========================================================================
 * Genera datos completos y realistas de todas las operaciones de la aplicación
 * y valida todos los tipos de reportes con cálculos financieros precisos.
 *
 * Ejecución: node test_reports_completos.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./test_sandbox');

// La suite genera una DB de prueba completa y la persiste, así que escribe en
// una COPIA temporal de la semilla en vez del archivo versionado
// (ver test_sandbox.js).
const sandbox = createSandbox('reports');
const DB_FILE = sandbox.dbPath;
const BACKUP_FILE = DB_FILE + '.backup';

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
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
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(message, 'cyan');
  log('='.repeat(60), 'cyan');
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    logSuccess(message);
  } else {
    failed++;
    logError(message);
  }
}

function assertClose(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    passed++;
    logSuccess(`${message} (${actual} ≈ ${expected}, diff: ${diff})`);
  } else {
    failed++;
    logError(`${message} (${actual} ≠ ${expected}, diff: ${diff})`);
  }
}

// Backup original DB
function backupDB() {
  if (fs.existsSync(DB_FILE)) {
    fs.copyFileSync(DB_FILE, BACKUP_FILE);
    logInfo('Backup de DB creado');
  }
}

// Restore original DB
function restoreDB() {
  if (fs.existsSync(BACKUP_FILE)) {
    fs.copyFileSync(BACKUP_FILE, DB_FILE);
    fs.unlinkSync(BACKUP_FILE);
    logInfo('DB restaurada del backup');
  }
}

// Guardar DB — escritura atómica (temp + rename). El temp termina en `.tmp`
// (patrón ya ignorado por git) para que una interrupción no ensucie el repo.
// En Windows el rename puede fallar con EPERM si otro proceso tiene el destino
// abierto leyéndolo: en ese caso se escribe directo y se limpia el temp.
function saveDB(db) {
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  const data = JSON.stringify(db, null, 2);
  fs.writeFileSync(tmp, data);
  try {
    fs.renameSync(tmp, DB_FILE);
  } catch (err) {
    fs.writeFileSync(DB_FILE, data);
    try {
      fs.unlinkSync(tmp);
    } catch (e) {
      /* temp ya ausente */
    }
  }
}

// Leer DB
function loadDB() {
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  return JSON.parse(raw);
}

// Generar datos completos de prueba
function generateCompleteTestData() {
  const today = new Date();
  const formatDate = (date) => date.toISOString().slice(0, 10);

  // Fecha hace 30 días
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Generar fechas para el mes
  const dates = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    dates.push(formatDate(d));
  }

  const db = {
    version: '2.9.4',
    configuracion: {
      nombre_empresa: 'CONSTRURAMSA',
      eslogan: 'SOLUCIONES EN INGENIERÍA Y ARQUITECTURA',
      logo_base64: '',
      presupuesto_inicial_caja: 500000,
      proyecto_actual: 'proj_main',
      telefono: '+502 2222-3333',
      email: 'info@construramsa.com',
      direccion: 'Ciudad de Guatemala, Guatemala',
      website: 'www.construramsa.com',
    },
    proyectos: [
      {
        id: 'proj_main',
        nombre: 'Residencial Los Pinos',
        presupuesto: 2500000,
        fecha_creacion: formatDate(thirtyDaysAgo),
        responsable: 'Arq. Wilson Salazar',
        descripcion: 'Proyecto residencial de lujo con 20 unidades',
        color: '#004B93',
        activo: true,
      },
      {
        id: 'proj_secondary',
        nombre: 'Oficinas Corporativas',
        presupuesto: 1500000,
        fecha_creacion: formatDate(thirtyDaysAgo),
        responsable: 'Ing. Juan Ramirez',
        descripcion: 'Edificio de oficinas de 5 niveles',
        color: '#00A4E4',
        activo: true,
      },
    ],
    proyectos_data: {
      proj_main: {
        // CAJA CHICA - Movimientos financieros completos
        caja_chica: [
          // Apertura inicial
          {
            id: 'caja_apertura',
            tipo: 'ingreso',
            monto: 500000,
            descripcion: 'Apertura inicial de caja chica',
            categoria: 'Apertura',
            fecha: formatDate(thirtyDaysAgo),
          },
          // Gastos de materiales
          {
            id: 'caja_1',
            tipo: 'egreso',
            monto: 15000,
            descripcion: 'Cemento Portland 50 bags',
            categoria: 'Materiales',
            fecha: dates[0],
            proveedor: 'Cemento Nacional',
          },
          {
            id: 'caja_2',
            tipo: 'egreso',
            monto: 8500,
            descripcion: 'Varilla de acero 500 kg',
            categoria: 'Materiales',
            fecha: dates[1],
            proveedor: 'Aceros de Guatemala',
          },
          {
            id: 'caja_3',
            tipo: 'egreso',
            monto: 3200,
            descripcion: 'Arena y grava 5 m³',
            categoria: 'Materiales',
            fecha: dates[2],
            proveedor: 'Materiales El Carmen',
          },
          // Gastos de mano de obra
          {
            id: 'caja_4',
            tipo: 'egreso',
            monto: 25000,
            descripcion: 'Pago semanal albañiles',
            categoria: 'Mano de Obra',
            fecha: dates[3],
          },
          {
            id: 'caja_5',
            tipo: 'egreso',
            monto: 18000,
            descripcion: 'Pago semanal electricistas',
            categoria: 'Mano de Obra',
            fecha: dates[4],
          },
          // Gastos de transporte
          {
            id: 'caja_6',
            tipo: 'egreso',
            monto: 5000,
            descripcion: 'Combustible camión',
            categoria: 'Transporte',
            fecha: dates[5],
          },
          {
            id: 'caja_7',
            tipo: 'egreso',
            monto: 3000,
            descripcion: 'Mantenimiento vehículo',
            categoria: 'Transporte',
            fecha: dates[6],
          },
          // Gastos de herramientas
          {
            id: 'caja_8',
            tipo: 'egreso',
            monto: 4500,
            descripcion: 'Compra herramientas eléctricas',
            categoria: 'Herramientas',
            fecha: dates[7],
          },
          {
            id: 'caja_9',
            tipo: 'egreso',
            monto: 2800,
            descripcion: 'Compra herramientas manuales',
            categoria: 'Herramientas',
            fecha: dates[8],
          },
          // Gastos de servicios
          {
            id: 'caja_10',
            tipo: 'egreso',
            monto: 8000,
            descripcion: 'Alquiler andamios',
            categoria: 'Servicios',
            fecha: dates[9],
          },
          {
            id: 'caja_11',
            tipo: 'egreso',
            monto: 6000,
            descripcion: 'Servicios de seguridad',
            categoria: 'Servicios',
            fecha: dates[10],
          },
          // Ingresos adicionales
          {
            id: 'caja_ingreso_1',
            tipo: 'ingreso',
            monto: 100000,
            descripcion: 'Anticipo cliente',
            categoria: 'Ingresos',
            fecha: dates[12],
          },
          {
            id: 'caja_ingreso_2',
            tipo: 'ingreso',
            monto: 75000,
            descripcion: 'Pago por avance de obra',
            categoria: 'Ingresos',
            fecha: dates[18],
          },
        ],

        // MAQUINARIA Y FLOTA
        maquinaria_flota: {
          vehiculos: [
            {
              id: 'veh_1',
              nombre: 'Camión Volteo CAT 777',
              tipo: 'propio',
              capacidad: '30 ton',
              costo_hora: 450,
              estado: 'operativo',
            },
            {
              id: 'veh_2',
              nombre: 'Excavadora Komatsu PC200',
              tipo: 'propio',
              capacidad: '1.5 m³',
              costo_hora: 550,
              estado: 'operativo',
            },
            {
              id: 'veh_3',
              nombre: 'Camión Mixer',
              tipo: 'alquilado',
              capacidad: '8 m³',
              costo_hora: 350,
              estado: 'operativo',
            },
          ],
          registros: [
            {
              id: 'maq_reg_1',
              vehiculo_id: 'veh_1',
              tipo: 'excavación',
              horas: 8,
              combustible_galones: 25,
              combustible_costo: 375,
              mantenimiento_costo: 0,
              fecha: dates[5],
              es_propio: true,
            },
            {
              id: 'maq_reg_2',
              vehiculo_id: 'veh_2',
              tipo: 'excavación',
              horas: 6,
              combustible_galones: 20,
              combustible_costo: 300,
              mantenimiento_costo: 150,
              fecha: dates[8],
              es_propio: true,
            },
            {
              id: 'maq_reg_3',
              vehiculo_id: 'veh_3',
              tipo: 'mezclado',
              horas: 8,
              combustible_galones: 15,
              combustible_costo: 225,
              mantenimiento_costo: 0,
              fecha: dates[12],
              es_propio: false,
            },
          ],
        },

        // PERSONAL Y NÓMINA
        personal: {
          trabajadores: [
            {
              id: 'trab_1',
              nombre: 'Juan Pérez',
              puesto: 'Maestro de Obra',
              pago_hora_normal: 45,
              pago_hora_extra: 60,
              activo: true,
            },
            {
              id: 'trab_2',
              nombre: 'María González',
              puesto: 'Albañil Especialista',
              pago_hora_normal: 35,
              pago_hora_extra: 50,
              activo: true,
            },
            {
              id: 'trab_3',
              nombre: 'Carlos López',
              puesto: 'Electricista',
              pago_hora_normal: 40,
              pago_hora_extra: 55,
              activo: true,
            },
            {
              id: 'trab_4',
              nombre: 'Ana Martínez',
              puesto: 'Ayudante',
              pago_hora_normal: 25,
              pago_hora_extra: 35,
              activo: true,
            },
            {
              id: 'trab_5',
              nombre: 'Pedro Sánchez',
              puesto: 'Soldador',
              pago_hora_normal: 42,
              pago_hora_extra: 58,
              activo: true,
            },
          ],
          asistencia: dates.slice(0, 20).map((fecha, idx) => ({
            fecha,
            registros: [
              {
                trabajador_id: 'trab_1',
                estado: 'asistio',
                horas_extras: idx % 2 === 0 ? 2 : 0,
                calculos: { total_diario: 360 + (idx % 2 === 0 ? 120 : 0) },
              },
              {
                trabajador_id: 'trab_2',
                estado: 'asistio',
                horas_extras: idx % 3 === 0 ? 3 : 0,
                calculos: { total_diario: 280 + (idx % 3 === 0 ? 150 : 0) },
              },
              {
                trabajador_id: 'trab_3',
                estado: 'asistio',
                horas_extras: idx % 4 === 0 ? 2 : 0,
                calculos: { total_diario: 320 + (idx % 4 === 0 ? 110 : 0) },
              },
              {
                trabajador_id: 'trab_4',
                estado: idx === 15 ? 'falto' : 'asistio',
                horas_extras: 0,
                calculos: { total_diario: 200 },
              },
              {
                trabajador_id: 'trab_5',
                estado: 'asistio',
                horas_extras: idx % 2 === 0 ? 4 : 0,
                calculos: { total_diario: 336 + (idx % 2 === 0 ? 232 : 0) },
              },
            ],
          })),
        },

        // ADQUISICIONES Y PROVEEDORES
        adquisiciones: {
          proveedores: [
            {
              id: 'prov_1',
              nombre: 'Cemento Nacional',
              telefono: '+502 2333-4444',
              email: 'ventas@cementonacional.com',
              direccion: 'Zona 13, Guatemala',
            },
            {
              id: 'prov_2',
              nombre: 'Aceros de Guatemala',
              telefono: '+502 2444-5555',
              email: 'contacto@aceros.com',
              direccion: 'Zona 9, Guatemala',
            },
            {
              id: 'prov_3',
              nombre: 'Materiales El Carmen',
              telefono: '+502 2555-6666',
              email: 'pedidos@materiales.com',
              direccion: 'Zona 6, Guatemala',
            },
          ],
          cotizaciones_compras: [
            {
              id: 'cot_1',
              proveedor_id: 'prov_1',
              material_descripcion: 'Cemento Portland 100 bags',
              total: 35000,
              fecha: dates[0],
              estado: 'aprobada',
            },
            {
              id: 'cot_2',
              proveedor_id: 'prov_2',
              material_descripcion: 'Varilla de acero 2000 kg',
              total: 42000,
              fecha: dates[2],
              estado: 'aprobada',
            },
            {
              id: 'cot_3',
              proveedor_id: 'prov_3',
              material_descripcion: 'Arena y grava 20 m³',
              total: 28000,
              fecha: dates[4],
              estado: 'pendiente',
            },
          ],
        },

        // VIAJES DE CAMIONES
        viajes_camiones: {
          rutas_botadero: [
            {
              id: 'ruta_1',
              nombre: 'Ruta Principal - Botadero A',
              distancia: 25,
              tarifa: 150,
            },
            {
              id: 'ruta_2',
              nombre: 'Ruta Secundaria - Botadero B',
              distancia: 18,
              tarifa: 120,
            },
          ],
          camiones: [
            {
              id: 'cam_1',
              placa: 'P-123-ABC',
              capacidad: '10 ton',
              tipo: 'propio',
            },
            {
              id: 'cam_2',
              placa: 'P-456-DEF',
              capacidad: '8 ton',
              tipo: 'propio',
            },
            {
              id: 'cam_3',
              placa: 'C-789-GHI',
              capacidad: '12 ton',
              tipo: 'alquilado',
            },
          ],
          equipo_alquilado: [
            {
              id: 'eq_alq_1',
              nombre: 'Camión Alquilado',
              proveedor: 'Transportes Express',
              costo_dia: 800,
            },
          ],
          viajes: [
            {
              id: 'viaje_1',
              tipo: 'propio',
              total: 150,
              observaciones: 'Material compactado',
              fecha: dates[5],
              vehiculo_id: 'cam_1',
              material: 'Tierra',
              numero: 1,
              km_total: 25,
              litros: 15,
              costo_combustible: 112.5,
              costo_alquiler: 0,
            },
            {
              id: 'viaje_2',
              tipo: 'propio',
              total: 150,
              observaciones: 'Material sin compactar',
              fecha: dates[8],
              vehiculo_id: 'cam_2',
              material: 'Arena',
              numero: 2,
              km_total: 18,
              litros: 12,
              costo_combustible: 90,
              costo_alquiler: 0,
            },
            {
              id: 'viaje_3',
              tipo: 'alquilado',
              total: 800,
              observaciones: 'Viaje completo día',
              fecha: dates[12],
              vehiculo_id: 'cam_3',
              material: 'Grava',
              numero: 3,
              km_total: 30,
              litros: 20,
              costo_combustible: 150,
              costo_alquiler: 800,
            },
          ],
        },

        // MANTENIMIENTO
        mantenimiento: {
          maquinaria: [
            {
              id: 'mant_maq_1',
              nombre: 'Camión Volteo CAT 777',
              tipo: 'camión',
              estado: 'operativo',
            },
            {
              id: 'mant_maq_2',
              nombre: 'Excavadora Komatsu PC200',
              tipo: 'excavadora',
              estado: 'operativo',
            },
          ],
          formatos: {
            preventivo: {
              campos: ['fecha', 'maquinaria_id', 'horas_operacion', 'combustible', 'observaciones'],
            },
            correctivo: {
              campos: [
                'fecha',
                'maquinaria_id',
                'falla_reportada',
                'reparacion_realizada',
                'costo',
                'observaciones',
              ],
            },
          },
          ordenes: [
            {
              id: 'ord_1',
              maquinaria_id: 'mant_maq_1',
              tipo: 'preventivo',
              costo: 2500,
              observaciones: 'Cambio de aceite y filtros',
              fecha: dates[7],
            },
            {
              id: 'ord_2',
              maquinaria_id: 'mant_maq_2',
              tipo: 'correctivo',
              costo: 4500,
              observaciones: 'Reparación sistema hidráulico',
              fecha: dates[15],
            },
          ],
          compras_insumos: [
            {
              id: 'insumo_1',
              tipo: 'combustible',
              articulo: 'Diesel 100 galones',
              costo: 3200,
              fecha: dates[3],
              cantidad: 100,
              es_critico: true,
            },
            {
              id: 'insumo_2',
              tipo: 'lubricante',
              articulo: 'Aceite motor 20 litros',
              costo: 1200,
              fecha: dates[7],
              cantidad: 20,
              es_critico: true,
            },
            {
              id: 'insumo_3',
              tipo: 'repuesto',
              articulo: 'Filtros de aire x10',
              costo: 800,
              fecha: dates[10],
              cantidad: 10,
              es_critico: false,
            },
          ],
        },
      },

      proj_secondary: {
        caja_chica: [
          {
            id: 'caja_sec_1',
            tipo: 'ingreso',
            monto: 300000,
            descripcion: 'Apertura inicial',
            categoria: 'Apertura',
            fecha: formatDate(thirtyDaysAgo),
          },
          {
            id: 'caja_sec_2',
            tipo: 'egreso',
            monto: 10000,
            descripcion: 'Materiales',
            categoria: 'Materiales',
            fecha: dates[5],
          },
        ],
        maquinaria_flota: { vehiculos: [], registros: [] },
        personal: { trabajadores: [], asistencia: [] },
        adquisiciones: { proveedores: [], cotizaciones_compras: [] },
        viajes_camiones: { rutas_botadero: [], camiones: [], equipo_alquilado: [], viajes: [] },
        mantenimiento: { maquinaria: [], formatos: {}, ordenes: [], compras_insumos: [] },
      },
    },
    reportes: [],
  };

  return db;
}

// Test 1: Generar datos completos
function testGenerateCompleteData() {
  logSection('Test 1: Generar datos completos de prueba');

  const db = generateCompleteTestData();
  saveDB(db);

  // Contar movimientos reales para ajustar la validación
  const cajaChicaCount = db.proyectos_data.proj_main.caja_chica.length;
  logInfo(`Movimientos de caja chica generados: ${cajaChicaCount}`);

  assert(db.version === '2.9.4', 'Versión de DB correcta');
  assert(db.proyectos.length === 2, '2 proyectos creados');
  assert(
    cajaChicaCount >= 10,
    `Mínimo 10 movimientos de caja chica (generados: ${cajaChicaCount})`
  );
  assert(
    db.proyectos_data.proj_main.maquinaria_flota.vehiculos.length === 3,
    '3 vehículos creados'
  );
  assert(
    db.proyectos_data.proj_main.maquinaria_flota.registros.length === 3,
    '3 registros de maquinaria'
  );
  assert(db.proyectos_data.proj_main.personal.trabajadores.length === 5, '5 trabajadores creados');
  assert(db.proyectos_data.proj_main.personal.asistencia.length === 20, '20 días de asistencia');
  assert(
    db.proyectos_data.proj_main.adquisiciones.proveedores.length === 3,
    '3 proveedores creados'
  );
  assert(
    db.proyectos_data.proj_main.adquisiciones.cotizaciones_compras.length === 3,
    '3 cotizaciones creadas'
  );
  assert(db.proyectos_data.proj_main.viajes_camiones.viajes.length === 3, '3 viajes creados');
  assert(
    db.proyectos_data.proj_main.mantenimiento.ordenes.length === 2,
    '2 órdenes de mantenimiento'
  );
  assert(
    db.proyectos_data.proj_main.mantenimiento.compras_insumos.length === 3,
    '3 compras de insumos'
  );

  logInfo('Datos completos generados correctamente');
}

// Test 2: Validar cálculos de caja chica
function testCajaChicaCalculations() {
  logSection('Test 2: Validar cálculos de caja chica');

  const db = loadDB();
  const caja = db.proyectos_data.proj_main.caja_chica;

  const ingresos = caja.filter((m) => m.tipo === 'ingreso');
  const egresos = caja.filter((m) => m.tipo === 'egreso');

  const totalIngresos = ingresos.reduce((sum, m) => sum + m.monto, 0);
  const totalEgresos = egresos.reduce((sum, m) => sum + m.monto, 0);
  const saldo = totalIngresos - totalEgresos;

  logInfo(`Total Ingresos: Q${totalIngresos.toFixed(2)}`);
  logInfo(`Total Egresos: Q${totalEgresos.toFixed(2)}`);
  logInfo(`Saldo: Q${saldo.toFixed(2)}`);

  assert(totalIngresos === 675000, 'Total ingresos correcto (Q675,000)');
  assert(totalEgresos === 99000, 'Total egresos correcto (Q99,000)');
  assert(saldo === 576000, 'Saldo correcto (Q576,000)');
}

// Test 3: Validar cálculos de nómina
function testNominaCalculations() {
  logSection('Test 3: Validar cálculos de nómina');

  const db = loadDB();
  const trabajadores = db.proyectos_data.proj_main.personal.trabajadores;
  const asistencia = db.proyectos_data.proj_main.personal.asistencia;

  let totalPagos = 0;
  let totalHorasExtra = 0;

  trabajadores.forEach((trab) => {
    const registrosAsistencia = asistencia.flatMap((dia) =>
      dia.registros.filter((r) => r.trabajador_id === trab.id && r.estado === 'asistio')
    );

    const diasAsistidos = registrosAsistencia.length;
    const horasExtra = registrosAsistencia.reduce((sum, r) => sum + (r.horas_extras || 0), 0);

    const pagoNormal = diasAsistidos * 8 * trab.pago_hora_normal;
    const pagoExtra = horasExtra * trab.pago_hora_extra;
    const pagoTotal = pagoNormal + pagoExtra;

    totalPagos += pagoTotal;
    totalHorasExtra += horasExtra;

    logInfo(
      `${trab.nombre}: ${diasAsistidos} días, ${horasExtra}h extra, Q${pagoTotal.toFixed(2)}`
    );
  });

  logInfo(`Total pago nómina: Q${totalPagos.toFixed(2)}`);
  logInfo(`Total horas extra: ${totalHorasExtra}h`);

  assert(totalPagos > 0, 'Total nómina mayor que 0');
  assert(totalHorasExtra >= 0, 'Total horas extra válido');
  assert(totalPagos < 50000, 'Total nómina razonable (menos de Q50,000)');
}

// Test 4: Validar cálculos de maquinaria
function testMaquinariaCalculations() {
  logSection('Test 4: Validar cálculos de maquinaria');

  const db = loadDB();
  const registros = db.proyectos_data.proj_main.maquinaria_flota.registros;

  let totalHoras = 0;
  let totalCombustible = 0;
  let totalCostoCombustible = 0;
  let totalMantenimiento = 0;

  registros.forEach((reg) => {
    totalHoras += reg.horas;
    totalCombustible += reg.combustible_galones;
    totalCostoCombustible += reg.combustible_costo;
    totalMantenimiento += reg.mantenimiento_costo;
  });

  logInfo(`Total horas: ${totalHoras}h`);
  logInfo(`Total combustible: ${totalCombustible} galones`);
  logInfo(`Total costo combustible: Q${totalCostoCombustible.toFixed(2)}`);
  logInfo(`Total mantenimiento: Q${totalMantenimiento.toFixed(2)}`);

  assert(totalHoras === 22, 'Total horas correcto (22h)');
  assert(totalCombustible === 60, 'Total combustible correcto (60 galones)');
  assert(totalCostoCombustible === 900, 'Total costo combustible correcto (Q900)');
  assert(totalMantenimiento === 150, 'Total mantenimiento correcto (Q150)');
}

// Test 5: Validar cálculos de viajes
function testViajesCalculations() {
  logSection('Test 5: Validar cálculos de viajes');

  const db = loadDB();
  const viajes = db.proyectos_data.proj_main.viajes_camiones.viajes;

  let totalKm = 0;
  let totalLitros = 0;
  let totalCostoCombustible = 0;
  let totalCostoAlquiler = 0;
  let totalCosto = 0;

  viajes.forEach((viaje) => {
    totalKm += viaje.km_total;
    totalLitros += viaje.litros;
    totalCostoCombustible += viaje.costo_combustible;
    totalCostoAlquiler += viaje.costo_alquiler;
    totalCosto += viaje.total;
  });

  logInfo(`Total km: ${totalKm} km`);
  logInfo(`Total litros: ${totalLitros} litros`);
  logInfo(`Total costo combustible: Q${totalCostoCombustible.toFixed(2)}`);
  logInfo(`Total costo alquiler: Q${totalCostoAlquiler.toFixed(2)}`);
  logInfo(`Total costo viajes: Q${totalCosto.toFixed(2)}`);

  assert(totalKm === 73, 'Total km correcto (73 km)');
  assert(totalLitros === 47, 'Total litros correcto (47 litros)');
  assert(totalCostoCombustible === 352.5, 'Total costo combustible correcto (Q352.50)');
  assert(totalCostoAlquiler === 800, 'Total costo alquiler correcto (Q800)');
  assert(totalCosto === 1100, 'Total costo viajes correcto (Q1,100)');
}

// Test 6: Validar cálculos de mantenimiento
function testMantenimientoCalculations() {
  logSection('Test 6: Validar cálculos de mantenimiento');

  const db = loadDB();
  const ordenes = db.proyectos_data.proj_main.mantenimiento.ordenes;
  const insumos = db.proyectos_data.proj_main.mantenimiento.compras_insumos;

  const totalOrdenes = ordenes.reduce((sum, o) => sum + o.costo, 0);
  const totalInsumos = insumos.reduce((sum, i) => sum + i.costo, 0);
  const totalMantenimiento = totalOrdenes + totalInsumos;

  logInfo(`Total órdenes: Q${totalOrdenes.toFixed(2)}`);
  logInfo(`Total insumos: Q${totalInsumos.toFixed(2)}`);
  logInfo(`Total mantenimiento: Q${totalMantenimiento.toFixed(2)}`);

  assert(totalOrdenes === 7000, 'Total órdenes correcto (Q7,000)');
  assert(totalInsumos === 5200, 'Total insumos correcto (Q5,200)');
  assert(totalMantenimiento === 12200, 'Total mantenimiento correcto (Q12,200)');
}

// Test 7: Validar cálculos de cotizaciones
function testCotizacionesCalculations() {
  logSection('Test 7: Validar cálculos de cotizaciones');

  const db = loadDB();
  const cotizaciones = db.proyectos_data.proj_main.adquisiciones.cotizaciones_compras;

  const totalCotizaciones = cotizaciones.reduce((sum, c) => sum + c.total, 0);
  const aprobadas = cotizaciones.filter((c) => c.estado === 'aprobada');
  const pendientes = cotizaciones.filter((c) => c.estado === 'pendiente');

  const totalAprobadas = aprobadas.reduce((sum, c) => sum + c.total, 0);
  const totalPendientes = pendientes.reduce((sum, c) => sum + c.total, 0);

  logInfo(`Total cotizaciones: Q${totalCotizaciones.toFixed(2)}`);
  logInfo(`Total aprobadas: Q${totalAprobadas.toFixed(2)} (${aprobadas.length})`);
  logInfo(`Total pendientes: Q${totalPendientes.toFixed(2)} (${pendientes.length})`);

  assert(totalCotizaciones === 105000, 'Total cotizaciones correcto (Q105,000)');
  assert(totalAprobadas === 77000, 'Total aprobadas correcto (Q77,000)');
  assert(totalPendientes === 28000, 'Total pendientes correcto (Q28,000)');
}

// Test 8: Validar consolidado de gastos
function testConsolidadoGastos() {
  logSection('Test 8: Validar consolidado de gastos');

  const db = loadDB();
  const proj = db.proyectos_data.proj_main;

  const gastosCaja = proj.caja_chica
    .filter((m) => m.tipo === 'egreso')
    .reduce((sum, m) => sum + m.monto, 0);
  const gastosViajes = proj.viajes_camiones.viajes.reduce((sum, v) => sum + v.total, 0);
  const gastosMantenimiento =
    proj.mantenimiento.ordenes.reduce((sum, o) => sum + o.costo, 0) +
    proj.mantenimiento.compras_insumos.reduce((sum, i) => sum + i.costo, 0);
  const gastosMaquinaria = proj.maquinaria_flota.registros.reduce(
    (sum, r) => sum + r.combustible_costo + r.mantenimiento_costo,
    0
  );

  const totalGastos = gastosCaja + gastosViajes + gastosMantenimiento + gastosMaquinaria;

  logInfo(`Gastos caja chica: Q${gastosCaja.toFixed(2)}`);
  logInfo(`Gastos viajes: Q${gastosViajes.toFixed(2)}`);
  logInfo(`Gastos mantenimiento: Q${gastosMantenimiento.toFixed(2)}`);
  logInfo(`Gastos maquinaria: Q${gastosMaquinaria.toFixed(2)}`);
  logInfo(`Total gastos consolidado: Q${totalGastos.toFixed(2)}`);

  assert(gastosCaja === 99000, 'Gastos caja chica correcto (Q99,000)');
  assert(gastosViajes === 1100, 'Gastos viajes correcto (Q1,100)');
  assert(gastosMantenimiento === 12200, 'Gastos mantenimiento correcto (Q12,200)');
  assert(gastosMaquinaria === 1050, 'Gastos maquinaria correcto (Q1,050)');
  assert(totalGastos === 113350, 'Total gastos consolidado correcto (Q113,350)');
}

// Test 9: Validar presupuesto vs gastos
function testPresupuestoGastos() {
  logSection('Test 9: Validar presupuesto vs gastos');

  const db = loadDB();
  const proyecto = db.proyectos.find((p) => p.id === 'proj_main');
  const proj = db.proyectos_data.proj_main;

  const presupuesto = proyecto.presupuesto;
  const gastos = proj.caja_chica
    .filter((m) => m.tipo === 'egreso')
    .reduce((sum, m) => sum + m.monto, 0);
  const saldoPresupuesto = presupuesto - gastos;
  const porcentajeGastado = (gastos / presupuesto) * 100;

  logInfo(`Presupuesto: Q${presupuesto.toLocaleString()}`);
  logInfo(`Gastos: Q${gastos.toLocaleString()}`);
  logInfo(`Saldo disponible: Q${saldoPresupuesto.toLocaleString()}`);
  logInfo(`Porcentaje gastado: ${porcentajeGastado.toFixed(2)}%`);

  assert(presupuesto === 2500000, 'Presupuesto correcto (Q2,500,000)');
  assert(saldoPresupuesto === 2401000, 'Saldo disponible correcto (Q2,401,000)');
  assert(porcentajeGastado < 10, 'Porcentaje gastado menor al 10%');
}

// Test 10: Validar integridad de datos por proyecto
function testIntegridadPorProyecto() {
  logSection('Test 10: Validar integridad de datos por proyecto');

  const db = loadDB();

  // Validar proyecto principal
  const projMain = db.proyectos_data.proj_main;
  assert(projMain.caja_chica.length > 0, 'Proyecto principal tiene datos de caja chica');
  assert(projMain.maquinaria_flota.vehiculos.length > 0, 'Proyecto principal tiene vehículos');
  assert(projMain.personal.trabajadores.length > 0, 'Proyecto principal tiene trabajadores');
  assert(projMain.adquisiciones.proveedores.length > 0, 'Proyecto principal tiene proveedores');
  assert(projMain.viajes_camiones.viajes.length > 0, 'Proyecto principal tiene viajes');
  assert(
    projMain.mantenimiento.ordenes.length > 0,
    'Proyecto principal tiene órdenes de mantenimiento'
  );

  // Validar proyecto secundario
  const projSec = db.proyectos_data.proj_secondary;
  assert(projSec.caja_chica.length > 0, 'Proyecto secundario tiene datos de caja chica');

  logInfo('Integridad de datos por proyecto validada');
}

// Ejecutar todos los tests
let exitCode = 0;
try {
  backupDB();

  testGenerateCompleteData();
  testCajaChicaCalculations();
  testNominaCalculations();
  testMaquinariaCalculations();
  testViajesCalculations();
  testMantenimientoCalculations();
  testCotizacionesCalculations();
  testConsolidadoGastos();
  testPresupuestoGastos();
  testIntegridadPorProyecto();

  logSection('RESULTADO FINAL');
  logInfo(`Total: ${passed} passed, ${failed} failed`);
  log('='.repeat(60), 'cyan');

  exitCode = failed > 0 ? 1 : 0;
} catch (error) {
  logError(`Error inesperado: ${error.message}`);
  exitCode = 1;
} finally {
  // El sandbox se destruye pase lo que pase, sin dejar archivos temporales.
  sandbox.cleanup();
}

process.exit(exitCode);
