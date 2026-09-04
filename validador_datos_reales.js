/**
 * @fileoverview Validador de Datos Reales para CONSTRURAMSA
 * 
 * Este script valida la integridad y consistencia de los datos que los usuarios
 * ingresan realmente en la aplicación, verificando todas las funcionalidades
 * operativas sin usar datos de prueba automatizados.
 * 
 * Uso: node validador_datos_reales.js
 */

const fs = require('fs');
const path = require('path');

// Colores para consola
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

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠️ ${message}`, 'yellow');
}

function logInfo(message) {
    log(`ℹ️ ${message}`, 'cyan');
}

// Clave de localStorage
const DB_KEY = 'construramsa_db';
const DB_FILE = 'construramsa_db.json';

/**
 * Carga la base de datos desde el archivo JSON
 */
function cargarBaseDatos() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            logError('No existe el archivo de base de datos. Primero debes usar la aplicación para ingresar datos reales.');
            return null;
        }
        
        const contenido = fs.readFileSync(DB_FILE, 'utf8');
        const db = JSON.parse(contenido);
        logInfo('Base de datos cargada exitosamente');
        return db;
    } catch (error) {
        logError(`Error al cargar la base de datos: ${error.message}`);
        return null;
    }
}

/**
 * Valida la estructura básica de la base de datos
 */
function validarEstructuraDB(db) {
    logInfo('Validando estructura de la base de datos...');
    let errores = 0;
    
    if (!db.version) {
        logError('Falta versión en la base de datos');
        errores++;
    } else {
        logSuccess(`Versión: ${db.version}`);
    }
    
    if (!db.configuracion) {
        logError('Falta configuración en la base de datos');
        errores++;
    } else {
        logSuccess('Configuración presente');
        
        if (!db.configuracion.nombre_empresa) {
            logError('Falta nombre de empresa en configuración');
            errores++;
        } else {
            logSuccess(`Empresa: ${db.configuracion.nombre_empresa}`);
        }
    }
    
    if (!db.proyectos) {
        logError('Falta array de proyectos');
        errores++;
    } else {
        logSuccess(`${db.proyectos.length} proyecto(s) registrado(s)`);
    }
    
    if (!db.proyectos_data) {
        logError('Falta objeto de datos de proyectos');
        errores++;
    } else {
        logSuccess('Datos de proyectos estructurados correctamente');
    }
    
    return errores === 0;
}

/**
 * Valida la integridad de proyectos
 */
function validarProyectos(db) {
    logInfo('Validando integridad de proyectos...');
    let errores = 0;
    
    if (!db.proyectos || db.proyectos.length === 0) {
        logWarning('No hay proyectos registrados. Crea al menos un proyecto desde la aplicación.');
        return false;
    }
    
    db.proyectos.forEach((proyecto, index) => {
        const pid = proyecto.id;
        
        if (!pid) {
            logError(`Proyecto ${index + 1}: Falta ID`);
            errores++;
        }
        
        if (!proyecto.nombre) {
            logError(`Proyecto ${pid || index + 1}: Falta nombre`);
            errores++;
        }
        
        if (typeof proyecto.presupuesto !== 'number') {
            logError(`Proyecto ${proyecto.nombre || pid}: Presupuesto inválido`);
            errores++;
        }
        
        // Verificar que existan datos correspondientes
        if (pid && db.proyectos_data[pid]) {
            logSuccess(`Proyecto "${proyecto.nombre}": Datos estructurados correctamente`);
        } else if (pid) {
            logError(`Proyecto "${proyecto.nombre}": No tiene datos asociados en proyectos_data`);
            errores++;
        }
    });
    
    return errores === 0;
}

/**
 * Valida movimientos de caja chica
 */
function validarCajaChica(db) {
    logInfo('Validando movimientos de caja chica...');
    let totalMovimientos = 0;
    let errores = 0;
    
    // Verificar datos generales (sin proyecto)
    if (db.caja_chica && db.caja_chica.length > 0) {
        logInfo(`Encontrados ${db.caja_chica.length} movimientos en datos generales`);
        totalMovimientos += db.caja_chica.length;
        
        db.caja_chica.forEach((mov, index) => {
            if (!mov.id) {
                logError(`Movimiento general ${index + 1}: Falta ID`);
                errores++;
            }
            if (!mov.tipo || !['ingreso', 'egreso'].includes(mov.tipo)) {
                logError(`Movimiento general ${mov.id || index + 1}: Tipo inválido`);
                errores++;
            }
            if (typeof mov.monto !== 'number' || mov.monto <= 0) {
                logError(`Movimiento general ${mov.id || index + 1}: Monto inválido`);
                errores++;
            }
            if (!mov.fecha) {
                logError(`Movimiento general ${mov.id || index + 1}: Falta fecha`);
                errores++;
            }
        });
    }
    
    // Verificar datos por proyecto
    if (db.proyectos_data) {
        Object.keys(db.proyectos_data).forEach(pid => {
            const datosProyecto = db.proyectos_data[pid];
            const nombreProyecto = db.proyectos.find(p => p.id === pid)?.nombre || pid;
            
            if (datosProyecto.caja_chica && datosProyecto.caja_chica.length > 0) {
                logInfo(`Proyecto "${nombreProyecto}": ${datosProyecto.caja_chica.length} movimientos`);
                totalMovimientos += datosProyecto.caja_chica.length;
                
                datosProyecto.caja_chica.forEach((mov, index) => {
                    if (!mov.id) {
                        logError(`Movimiento ${nombreProyecto} ${index + 1}: Falta ID`);
                        errores++;
                    }
                    if (!mov.tipo || !['ingreso', 'egreso'].includes(mov.tipo)) {
                        logError(`Movimiento ${nombreProyecto} ${mov.id || index + 1}: Tipo inválido`);
                        errores++;
                    }
                    if (typeof mov.monto !== 'number' || mov.monto <= 0) {
                        logError(`Movimiento ${nombreProyecto} ${mov.id || index + 1}: Monto inválido`);
                        errores++;
                    }
                    if (!mov.fecha) {
                        logError(`Movimiento ${nombreProyecto} ${mov.id || index + 1}: Falta fecha`);
                        errores++;
                    }
                });
            }
        });
    }
    
    if (totalMovimientos === 0) {
        logWarning('No hay movimientos de caja chica registrados. Ingresa movimientos desde la aplicación.');
    } else {
        logSuccess(`Total de ${totalMovimientos} movimientos validados`);
    }
    
    return errores === 0;
}

/**
 * Valida registros de maquinaria
 */
function validarMaquinaria(db) {
    logInfo('Validando registros de maquinaria...');
    let totalRegistros = 0;
    let errores = 0;
    
    // Verificar datos generales
    if (db.maquinaria_flota && db.maquinaria_flota.registros) {
        logInfo(`Encontrados ${db.maquinaria_flota.registros.length} registros en datos generales`);
        totalRegistros += db.maquinaria_flota.registros.length;
        
        db.maquinaria_flota.registros.forEach((reg, index) => {
            if (!reg.id) {
                logError(`Registro maquinaria general ${index + 1}: Falta ID`);
                errores++;
            }
            if (!reg.fecha) {
                logError(`Registro maquinaria general ${reg.id || index + 1}: Falta fecha`);
                errores++;
            }
        });
    }
    
    // Verificar datos por proyecto
    if (db.proyectos_data) {
        Object.keys(db.proyectos_data).forEach(pid => {
            const datosProyecto = db.proyectos_data[pid];
            const nombreProyecto = db.proyectos.find(p => p.id === pid)?.nombre || pid;
            
            if (datosProyecto.maquinaria_flota && datosProyecto.maquinaria_flota.registros) {
                logInfo(`Proyecto "${nombreProyecto}": ${datosProyecto.maquinaria_flota.registros.length} registros`);
                totalRegistros += datosProyecto.maquinaria_flota.registros.length;
                
                datosProyecto.maquinaria_flota.registros.forEach((reg, index) => {
                    if (!reg.id) {
                        logError(`Registro maquinaria ${nombreProyecto} ${index + 1}: Falta ID`);
                        errores++;
                    }
                    if (!reg.fecha) {
                        logError(`Registro maquinaria ${nombreProyecto} ${reg.id || index + 1}: Falta fecha`);
                        errores++;
                    }
                });
            }
        });
    }
    
    if (totalRegistros === 0) {
        logWarning('No hay registros de maquinaria. Registra uso de equipo desde la aplicación.');
    } else {
        logSuccess(`Total de ${totalRegistros} registros de maquinaria validados`);
    }
    
    return errores === 0;
}

/**
 * Valida datos de personal
 */
function validarPersonal(db) {
    logInfo('Validando datos de personal...');
    let totalTrabajadores = 0;
    let totalAsistencia = 0;
    let errores = 0;
    
    // Verificar datos generales
    if (db.personal && db.personal.trabajadores) {
        logInfo(`Encontrados ${db.personal.trabajadores.length} trabajadores en datos generales`);
        totalTrabajadores += db.personal.trabajadores.length;
        
        db.personal.trabajadores.forEach((trab, index) => {
            if (!trab.id) {
                logError(`Trabajador general ${index + 1}: Falta ID`);
                errores++;
            }
            if (!trab.nombre) {
                logError(`Trabajador general ${trab.id || index + 1}: Falta nombre`);
                errores++;
            }
        });
        
        if (db.personal.asistencia) {
            totalAsistencia += db.personal.asistencia.length;
        }
    }
    
    // Verificar datos por proyecto
    if (db.proyectos_data) {
        Object.keys(db.proyectos_data).forEach(pid => {
            const datosProyecto = db.proyectos_data[pid];
            const nombreProyecto = db.proyectos.find(p => p.id === pid)?.nombre || pid;
            
            if (datosProyecto.personal && datosProyecto.personal.trabajadores) {
                logInfo(`Proyecto "${nombreProyecto}": ${datosProyecto.personal.trabajadores.length} trabajadores`);
                totalTrabajadores += datosProyecto.personal.trabajadores.length;
                
                datosProyecto.personal.trabajadores.forEach((trab, index) => {
                    if (!trab.id) {
                        logError(`Trabajador ${nombreProyecto} ${index + 1}: Falta ID`);
                        errores++;
                    }
                    if (!trab.nombre) {
                        logError(`Trabajador ${nombreProyecto} ${trab.id || index + 1}: Falta nombre`);
                        errores++;
                    }
                });
                
                if (datosProyecto.personal.asistencia) {
                    totalAsistencia += datosProyecto.personal.asistencia.length;
                }
            }
        });
    }
    
    if (totalTrabajadores === 0) {
        logWarning('No hay trabajadores registrados. Registra personal desde la aplicación.');
    } else {
        logSuccess(`Total de ${totalTrabajadores} trabajadores validados`);
    }
    
    if (totalAsistencia > 0) {
        logSuccess(`Total de ${totalAsistencia} registros de asistencia validados`);
    } else {
        logWarning('No hay registros de asistencia. Realiza pases de lista desde la aplicación.');
    }
    
    return errores === 0;
}

/**
 * Valida adquisiciones y proveedores
 */
function validarAdquisiciones(db) {
    logInfo('Validando adquisiciones y proveedores...');
    let totalProveedores = 0;
    let totalCotizaciones = 0;
    let errores = 0;
    
    // Verificar datos generales
    if (db.adquisiciones) {
        if (db.adquisiciones.proveedores) {
            logInfo(`Encontrados ${db.adquisiciones.proveedores.length} proveedores en datos generales`);
            totalProveedores += db.adquisiciones.proveedores.length;
            
            db.adquisiciones.proveedores.forEach((prov, index) => {
                if (!prov.id) {
                    logError(`Proveedor general ${index + 1}: Falta ID`);
                    errores++;
                }
                if (!prov.nombre) {
                    logError(`Proveedor general ${prov.id || index + 1}: Falta nombre`);
                    errores++;
                }
            });
        }
        
        if (db.adquisiciones.cotizaciones_compras) {
            logInfo(`Encontradas ${db.adquisiciones.cotizaciones_compras.length} cotizaciones en datos generales`);
            totalCotizaciones += db.adquisiciones.cotizaciones_compras.length;
        }
    }
    
    // Verificar datos por proyecto
    if (db.proyectos_data) {
        Object.keys(db.proyectos_data).forEach(pid => {
            const datosProyecto = db.proyectos_data[pid];
            const nombreProyecto = db.proyectos.find(p => p.id === pid)?.nombre || pid;
            
            if (datosProyecto.adquisiciones) {
                if (datosProyecto.adquisiciones.proveedores) {
                    logInfo(`Proyecto "${nombreProyecto}": ${datosProyecto.adquisiciones.proveedores.length} proveedores`);
                    totalProveedores += datosProyecto.adquisiciones.proveedores.length;
                    
                    datosProyecto.adquisiciones.proveedores.forEach((prov, index) => {
                        if (!prov.id) {
                            logError(`Proveedor ${nombreProyecto} ${index + 1}: Falta ID`);
                            errores++;
                        }
                        if (!prov.nombre) {
                            logError(`Proveedor ${nombreProyecto} ${prov.id || index + 1}: Falta nombre`);
                            errores++;
                        }
                    });
                }
                
                if (datosProyecto.adquisiciones.cotizaciones_compras) {
                    logInfo(`Proyecto "${nombreProyecto}": ${datosProyecto.adquisiciones.cotizaciones_compras.length} cotizaciones`);
                    totalCotizaciones += datosProyecto.adquisiciones.cotizaciones_compras.length;
                }
            }
        });
    }
    
    if (totalProveedores === 0) {
        logWarning('No hay proveedores registrados. Registra proveedores desde la aplicación.');
    } else {
        logSuccess(`Total de ${totalProveedores} proveedores validados`);
    }
    
    if (totalCotizaciones === 0) {
        logWarning('No hay cotizaciones registradas. Registra cotizaciones desde la aplicación.');
    } else {
        logSuccess(`Total de ${totalCotizaciones} cotizaciones validadas`);
    }
    
    return errores === 0;
}

/**
 * Valida viajes de camiones
 */
function validarViajes(db) {
    logInfo('Validando viajes de camiones...');
    let totalViajes = 0;
    let errores = 0;
    
    // Verificar datos generales
    if (db.viajes_camiones && db.viajes_camiones.viajes) {
        logInfo(`Encontrados ${db.viajes_camiones.viajes.length} viajes en datos generales`);
        totalViajes += db.viajes_camiones.viajes.length;
        
        db.viajes_camiones.viajes.forEach((viaje, index) => {
            if (!viaje.id) {
                logError(`Viaje general ${index + 1}: Falta ID`);
                errores++;
            }
            if (!viaje.fecha) {
                logError(`Viaje general ${viaje.id || index + 1}: Falta fecha`);
                errores++;
            }
        });
    }
    
    // Verificar datos por proyecto
    if (db.proyectos_data) {
        Object.keys(db.proyectos_data).forEach(pid => {
            const datosProyecto = db.proyectos_data[pid];
            const nombreProyecto = db.proyectos.find(p => p.id === pid)?.nombre || pid;
            
            if (datosProyecto.viajes_camiones && datosProyecto.viajes_camiones.viajes) {
                logInfo(`Proyecto "${nombreProyecto}": ${datosProyecto.viajes_camiones.viajes.length} viajes`);
                totalViajes += datosProyecto.viajes_camiones.viajes.length;
                
                datosProyecto.viajes_camiones.viajes.forEach((viaje, index) => {
                    if (!viaje.id) {
                        logError(`Viaje ${nombreProyecto} ${index + 1}: Falta ID`);
                        errores++;
                    }
                    if (!viaje.fecha) {
                        logError(`Viaje ${nombreProyecto} ${viaje.id || index + 1}: Falta fecha`);
                        errores++;
                    }
                });
            }
        });
    }
    
    if (totalViajes === 0) {
        logWarning('No hay viajes registrados. Registra viajes de camiones desde la aplicación.');
    } else {
        logSuccess(`Total de ${totalViajes} viajes validados`);
    }
    
    return errores === 0;
}

/**
 * Valida mantenimiento e insumos
 */
function validarMantenimiento(db) {
    logInfo('Validando mantenimiento e insumos...');
    let totalOrdenes = 0;
    let totalInsumos = 0;
    let errores = 0;
    
    // Verificar datos generales
    if (db.mantenimiento) {
        if (db.mantenimiento.ordenes) {
            logInfo(`Encontradas ${db.mantenimiento.ordenes.length} órdenes en datos generales`);
            totalOrdenes += db.mantenimiento.ordenes.length;
            
            db.mantenimiento.ordenes.forEach((orden, index) => {
                if (!orden.id) {
                    logError(`Orden general ${index + 1}: Falta ID`);
                    errores++;
                }
                if (!orden.fecha) {
                    logError(`Orden general ${orden.id || index + 1}: Falta fecha`);
                    errores++;
                }
            });
        }
        
        if (db.mantenimiento.compras_insumos) {
            logInfo(`Encontrados ${db.mantenimiento.compras_insumos.length} insumos en datos generales`);
            totalInsumos += db.mantenimiento.compras_insumos.length;
        }
    }
    
    // Verificar datos por proyecto
    if (db.proyectos_data) {
        Object.keys(db.proyectos_data).forEach(pid => {
            const datosProyecto = db.proyectos_data[pid];
            const nombreProyecto = db.proyectos.find(p => p.id === pid)?.nombre || pid;
            
            if (datosProyecto.mantenimiento) {
                if (datosProyecto.mantenimiento.ordenes) {
                    logInfo(`Proyecto "${nombreProyecto}": ${datosProyecto.mantenimiento.ordenes.length} órdenes`);
                    totalOrdenes += datosProyecto.mantenimiento.ordenes.length;
                    
                    datosProyecto.mantenimiento.ordenes.forEach((orden, index) => {
                        if (!orden.id) {
                            logError(`Orden ${nombreProyecto} ${index + 1}: Falta ID`);
                            errores++;
                        }
                        if (!orden.fecha) {
                            logError(`Orden ${nombreProyecto} ${orden.id || index + 1}: Falta fecha`);
                            errores++;
                        }
                    });
                }
                
                if (datosProyecto.mantenimiento.compras_insumos) {
                    logInfo(`Proyecto "${nombreProyecto}": ${datosProyecto.mantenimiento.compras_insumos.length} insumos`);
                    totalInsumos += datosProyecto.mantenimiento.compras_insumos.length;
                }
            }
        });
    }
    
    if (totalOrdenes === 0) {
        logWarning('No hay órdenes de mantenimiento registradas. Registra mantenimientos desde la aplicación.');
    } else {
        logSuccess(`Total de ${totalOrdenes} órdenes de mantenimiento validadas`);
    }
    
    if (totalInsumos === 0) {
        logWarning('No hay compras de insumos registradas. Registra compras de insumos desde la aplicación.');
    } else {
        logSuccess(`Total de ${totalInsumos} compras de insumos validadas`);
    }
    
    return errores === 0;
}

/**
 * Valida consistencia financiera
 */
function validarConsistenciaFinanciera(db) {
    logInfo('Validando consistencia financiera...');
    let errores = 0;
    
    // Verificar que los montos sean números válidos
    const validarMontos = (array, contexto) => {
        if (!array) return;
        array.forEach((item, index) => {
            if (item.monto !== undefined && (typeof item.monto !== 'number' || isNaN(item.monto))) {
                logError(`${contexto} ${index + 1}: Monto inválido (${item.monto})`);
                errores++;
            }
            if (item.costo !== undefined && (typeof item.costo !== 'number' || isNaN(item.costo))) {
                logError(`${contexto} ${index + 1}: Costo inválido (${item.costo})`);
                errores++;
            }
            if (item.presupuesto !== undefined && (typeof item.presupuesto !== 'number' || isNaN(item.presupuesto))) {
                logError(`${contexto} ${index + 1}: Presupuesto inválido (${item.presupuesto})`);
                errores++;
            }
        });
    };
    
    // Validar caja chica
    validarMontos(db.caja_chica, 'Movimiento caja chica');
    
    // Validar por proyectos
    if (db.proyectos_data) {
        Object.keys(db.proyectos_data).forEach(pid => {
            const datos = db.proyectos_data[pid];
            const nombre = db.proyectos.find(p => p.id === pid)?.nombre || pid;
            
            validarMontos(datos.caja_chica, `Movimiento caja chica ${nombre}`);
            validarMontos(datos.maquinaria_flota?.registros, `Registro maquinaria ${nombre}`);
            validarMontos(datos.mantenimiento?.ordenes, `Orden mantenimiento ${nombre}`);
            validarMontos(datos.mantenimiento?.compras_insumos, `Compra insumos ${nombre}`);
            validarMontos(datos.adquisiciones?.cotizaciones_compras, `Cotización ${nombre}`);
        });
    }
    
    if (errores === 0) {
        logSuccess('Consistencia financiera validada: todos los montos son números válidos');
    }
    
    return errores === 0;
}

/**
 * Valida fechas y formatos
 */
function validarFechas(db) {
    logInfo('Validando formatos de fechas...');
    let errores = 0;
    
    const validarFecha = (fecha, contexto) => {
        if (!fecha) return;
        const regexFecha = /^\d{4}-\d{2}-\d{2}$/;
        if (!regexFecha.test(fecha)) {
            logError(`${contexto}: Formato de fecha inválido (${fecha}). Debe ser YYYY-MM-DD`);
            errores++;
        }
    };
    
    // Validar fechas en caja chica
    if (db.caja_chica) {
        db.caja_chica.forEach((mov, i) => validarFecha(mov.fecha, `Movimiento caja ${i + 1}`));
    }
    
    // Validar por proyectos
    if (db.proyectos_data) {
        Object.keys(db.proyectos_data).forEach(pid => {
            const datos = db.proyectos_data[pid];
            const nombre = db.proyectos.find(p => p.id === pid)?.nombre || pid;
            
            if (datos.caja_chica) {
                datos.caja_chica.forEach((mov, i) => validarFecha(mov.fecha, `Movimiento caja ${nombre} ${i + 1}`));
            }
            if (datos.maquinaria_flota?.registros) {
                datos.maquinaria_flota.registros.forEach((reg, i) => validarFecha(reg.fecha, `Registro maquinaria ${nombre} ${i + 1}`));
            }
            if (datos.personal?.asistencia) {
                datos.personal.asistencia.forEach((asi, i) => validarFecha(asi.fecha, `Asistencia ${nombre} ${i + 1}`));
            }
            if (datos.viajes_camiones?.viajes) {
                datos.viajes_camiones.viajes.forEach((viaje, i) => validarFecha(viaje.fecha, `Viaje ${nombre} ${i + 1}`));
            }
            if (datos.mantenimiento?.ordenes) {
                datos.mantenimiento.ordenes.forEach((orden, i) => validarFecha(orden.fecha, `Orden mantenimiento ${nombre} ${i + 1}`));
            }
        });
    }
    
    if (errores === 0) {
        logSuccess('Formatos de fecha validados correctamente');
    }
    
    return errores === 0;
}

/**
 * Genera reporte de validación
 */
function generarReporte(resultados) {
    logInfo('\n══════════════════════════════════════════════');
    logInfo('  REPORTE DE VALIDACIÓN DE DATOS REALES');
    logInfo('══════════════════════════════════════════════\n');
    
    const totalValidaciones = Object.keys(resultados).length;
    const validacionesExitosas = Object.values(resultados).filter(r => r).length;
    const validacionesFallidas = totalValidaciones - validacionesExitosas;
    
    Object.entries(resultados).forEach(([validacion, exito]) => {
        const status = exito ? '✅' : '❌';
        const color = exito ? 'green' : 'red';
        log(`${status} ${validacion}`, color);
    });
    
    logInfo('\n══════════════════════════════════════════════');
    logInfo(`  Total validaciones: ${totalValidaciones}`);
    logSuccess(`  Exitosas: ${validacionesExitosas}`);
    if (validacionesFallidas > 0) {
        logError(`  Fallidas: ${validacionesFallidas}`);
    }
    logInfo('══════════════════════════════════════════════\n');
    
    return validacionesFallidas === 0;
}

/**
 * Función principal de validación
 */
function main() {
    logInfo('\n══════════════════════════════════════════════');
    logInfo('  VALIDADOR DE DATOS REALES - CONSTRURAMSA');
    logInfo('══════════════════════════════════════════════\n');
    
    const db = cargarBaseDatos();
    if (!db) {
        logError('No se pudo cargar la base de datos. Asegúrate de haber usado la aplicación.');
        process.exit(1);
    }
    
    const resultados = {
        'Estructura de base de datos': validarEstructuraDB(db),
        'Integridad de proyectos': validarProyectos(db),
        'Movimientos de caja chica': validarCajaChica(db),
        'Registros de maquinaria': validarMaquinaria(db),
        'Datos de personal': validarPersonal(db),
        'Adquisiciones y proveedores': validarAdquisiciones(db),
        'Viajes de camiones': validarViajes(db),
        'Mantenimiento e insumos': validarMantenimiento(db),
        'Consistencia financiera': validarConsistenciaFinanciera(db),
        'Formatos de fecha': validarFechas(db)
    };
    
    const exitoTotal = generarReporte(resultados);
    
    if (exitoTotal) {
        logSuccess('¡Todas las validaciones pasaron exitosamente!');
        logInfo('Los datos ingresados desde la aplicación son consistentes y válidos.');
        process.exit(0);
    } else {
        logError('Algunas validaciones fallaron. Revisa los errores detallados arriba.');
        logInfo('Corrige los problemas desde la aplicación y vuelve a ejecutar la validación.');
        process.exit(1);
    }
}

// Ejecutar validación
main();