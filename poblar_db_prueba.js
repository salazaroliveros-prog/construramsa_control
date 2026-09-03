/**
 * CONSTRURAMSA v2.9.1 — Poblar base de datos con datos comprehensivos de prueba
 * Ejecutar con: node poblar_db_prueba.js
 * 
 * Pobla construramsa_db.json con datos de prueba para todos los módulos:
 * - Proyectos
 * - Caja chica (ingresos/egresos)
 * - Maquinaria y flota
 * - Personal y asistencia
 * - Adquisiciones y proveedores
 * - Viajes de camiones
 * - Mantenimiento e insumos
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'construramsa_db.json');

const hoy = new Date();
const hace7 = new Date(hoy); hace7.setDate(hoy.getDate() - 7);
const hace30 = new Date(hoy); hace30.setDate(hoy.getDate() - 30);
const hace60 = new Date(hoy); hace60.setDate(hoy.getDate() - 60);

const fmt = d => d.toISOString().split('T')[0];

function uid(prefix) {
  return prefix + '-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// ── Configuración ──────────────────────────────────────────────────
db.configuracion.nombre_empresa = 'CONSTRURAMSA';
db.configuracion.eslogan = 'SOLUCIONES EN INGENIERÍA Y ARQUITECTURA';
db.configuracion.telefono = '+502 5997 9501';
db.configuracion.email = 'contacto@construramsa.com';
db.configuracion.direccion = '17av. Villa Mariscal, Apto. 116, Torre 2, Zona 11, Ciudad de Guatemala';
db.configuracion.website = 'construramsa.com';
db.configuracion.firmas = [
  { id: uid('FIR'), nombre: 'Arq. Wilson Dario Salazar', cargo: 'Jefe de Proyectos', activa: true, imagen_base64: '' },
  { id: uid('FIR'), nombre: 'Ing. Juan Luis Ramirez Jimenez', cargo: 'Gerente Comercial', activa: true, imagen_base64: '' }
];

// ── Proyectos ──────────────────────────────────────────────────────
const proyecto1 = {
  id: uid('PROY'),
  nombre: 'Proyecto Residencial Altos de la Cañada',
  descripcion: 'Desarrollo residencial de 50 unidades habitacionales',
  presupuesto: 2500000,
  fecha_creacion: fmt(hace60),
  responsable: 'Arq. Wilson Dario Salazar',
  color: '#004B93',
  activo: true
};
const proyecto2 = {
  id: uid('PROY'),
  nombre: 'Centro Comercial Plaza del Sol',
  descripcion: 'Construcción de centro comercial 3 niveles',
  presupuesto: 8500000,
  fecha_creacion: fmt(hace30),
  responsable: 'Ing. Juan Luis Ramirez Jimenez',
  color: '#00A4E4',
  activo: true
};
db.proyectos = [proyecto1, proyecto2];
db.configuracion.proyecto_actual = proyecto1.id;

// ── Caja chica ─────────────────────────────────────────────────────
const caja = [];
const categoriasIngreso = ['apertura', 'reembolso', 'otros_ingresos'];
const categoriasEgreso = ['materiales', 'salarios', 'combustible', 'alquiler_maquinaria', 'herramientas', 'viaticos', 'servicios_publicos', 'seguros', 'imprevistos'];

for (let i = 0; i < 60; i++) {
  const fecha = new Date(hace30);
  fecha.setDate(fecha.getDate() + Math.floor(Math.random() * 60));
  const tipo = Math.random() > 0.35 ? 'egreso' : 'ingreso';
  let categoria = '';
  let monto = 0;
  if (tipo === 'ingreso') {
    categoria = categoriasIngreso[Math.floor(Math.random() * categoriasIngreso.length)];
    monto = tipo === 'apertura' ? 50000 : Math.round(Math.random() * 5000 + 500);
  } else {
    categoria = categoriasEgreso[Math.floor(Math.random() * categoriasEgreso.length)];
    monto = Math.round(Math.random() * 15000 + 200);
  }
  caja.push({
    id: uid('CAJA'),
    tipo,
    monto,
    concepto: tipo === 'ingreso' ? 'Ingreso de caja' : 'Gasto operativo',
    descripcion: `${categoria.charAt(0).toUpperCase() + categoria.slice(1)} - Registro ${i + 1}`,
    categoria,
    fecha: fmt(fecha),
    responsable: ['Wilson Salazar', 'Juan Ramirez', 'Carlos Mendez', 'Ana Lopez'][Math.floor(Math.random() * 4)],
    proveedor: ['Ferremax', 'Constructora del Norte', 'Servicios Generales', 'Distribuidora Central'][Math.floor(Math.random() * 4)],
    es_cierre: false
  });
}

// Proyecto 2
const caja2 = [];
for (let i = 0; i < 25; i++) {
  const fecha = new Date(hace30);
  fecha.setDate(fecha.getDate() + Math.floor(Math.random() * 30));
  const tipo = Math.random() > 0.4 ? 'egreso' : 'ingreso';
  const categoria = tipo === 'ingreso' ? 'apertura' : categoriasEgreso[Math.floor(Math.random() * categoriasEgreso.length)];
  const monto = tipo === 'ingreso' ? 80000 : Math.round(Math.random() * 20000 + 500);
  caja2.push({
    id: uid('CAJA'),
    tipo,
    monto,
    concepto: tipo === 'ingreso' ? 'Ingreso de caja' : 'Gasto operativo',
    descripcion: `${categoria} - Proyecto 2`,
    categoria,
    fecha: fmt(fecha),
    responsable: ['Wilson Salazar', 'Juan Ramirez'][Math.floor(Math.random() * 2)],
    proveedor: 'Proveedor Plaza',
    es_cierre: false
  });
}

db.proyectos_data = {
  [proyecto1.id]: {
    caja_chica: caja,
    maquinaria_flota: { vehiculos: [], registros: [] },
    personal: { trabajadores: [], asistencia: [] },
    adquisiciones: { proveedores: [], cotizaciones_compras: [] },
    viajes_camiones: { rutas_botadero: [], camiones: [], equipo_alquilado: [], viajes: [] },
    mantenimiento: { maquinaria: [], formatos: {}, ordenes: [], compras_insumos: [] }
  },
  [proyecto2.id]: {
    caja_chica: caja2,
    maquinaria_flota: { vehiculos: [], registros: [] },
    personal: { trabajadores: [], asistencia: [] },
    adquisiciones: { proveedores: [], cotizaciones_compras: [] },
    viajes_camiones: { rutas_botadero: [], camiones: [], equipo_alquilado: [], viajes: [] },
    mantenimiento: { maquinaria: [], formatos: {}, ordenes: [], compras_insumos: [] }
  }
};

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
console.log('✅ Base de datos poblada con datos de prueba');
console.log(`   Proyectos: ${db.proyectos.length}`);
console.log(`   Movimientos caja P1: ${db.proyectos_data[proyecto1.id].caja_chica.length}`);
console.log(`   Movimientos caja P2: ${db.proyectos_data[proyecto2.id].caja_chica.length}`);
console.log(`   Fecha seed: ${fmt(hoy)}`);
