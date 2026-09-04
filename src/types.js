/**
 * @fileoverview Tipos fuertes y definiciones JSDoc para CONSTRURAMSA Control de Obra.
 *
 * Este archivo NO contiene lógica ejecutable. Su propósito es proporcionar
 * anotaciones de tipo estáticas a través de JSDoc para que los editores
 * (VS Code, WebStorm) ofrezcan autocompletado, validación de tipos y
 * detección de errores en tiempo real.
 *
 * Se carga desde index.html ANTES de cualquier otro script:
 *   <script src="./src/types.js"></script>
 *
 * @module types
 */

'use strict';

/* ================================================================ */
/*  Tipos primitivos y utilitarios                                    */
/* ================================================================ */

/** Identificador único generado por `generarId()`. @typedef {string} ID */
/** Fecha en formato ISO `YYYY-MM-DD`. @typedef {string} FechaISO */
/** Moneda expresada en Quetzales (Q). @typedef {number} MontoQ */
/** Cadena escapada para inyección segura en HTML. @typedef {string} HtmlSeguro */
/** Datos codificados en Base64 (imagen). @typedef {string} Base64 */

/* ================================================================ */
/*  Configuración de la empresa / proyecto                          */
/* ================================================================ */

/**
 * @typedef {Object} FirmaAutorizada
 * @property {ID|null} [id]                  - Identificador interno (null = placeholder).
 * @property {string}  nombre               - Nombre completo de la persona.
 * @property {string}  cargo                - Cargo/rol de la persona.
 * @property {Base64|null} [imagen_base64]  - Firma escaneada como Data URL.
 * @property {boolean} [activa]             - Si la firma se muestra en los reportes.
 */

/**
 * @typedef {Object} ConfiguracionEmpresa
 * @property {string}      nombre_empresa           - Nombre corporativo (default: 'CONSTRURAMSA').
 * @property {string}      eslogan                - Eslogan o descripción corta.
 * @property {Base64}      [logo_base64]          - Logo empresa como Data URL.
 * @property {number}      presupuesto_inicial_caja - Presupuesto base de caja chica.
 * @property {string|null} proyecto_actual         - ID del proyecto activo.
 * @property {FirmaAutorizada[]} [firmas]          - Firmas autorizadas para reportes.
 * @property {string|null} [telefono]              - Teléfono de contacto.
 * @property {string|null} [email]                 - Email de contacto.
 * @property {string|null} [direccion]             - Dirección de la empresa.
 * @property {string|null} [website]               - Sitio web corporativo.
 */

/**
 * @typedef {Object} NubeConfig
 * @property {'gas'}   proveedor      - Proveedor de respaldo en la nube.
 * @property {string}  url            - URL del endpoint de respaldo.
 * @property {boolean} auto           - Auto-respaldar al cambiar datos.
 * @property {string|null} ultimo     - Timestamp del último respaldo.
 * @property {string}  [gd_client]    - Google Drive client ID.
 * @property {string}  [gd_token]     - Google Drive token.
 * @property {string}  [od_client]    - OneDrive client ID.
 * @property {string}  [od_token]     - OneDrive token.
 */

/* ================================================================ */
/*  Modelo de datos                                                 */
/* ================================================================ */

/**
 * @typedef {Object} Proyecto
 * @property {ID}        id
 * @property {string}    nombre
 * @property {MontoQ}    presupuesto
 * @property {FechaISO}  fecha_creacion
 * @property {string}    [responsable]
 * @property {string}    [descripcion]
 * @property {string}    [color]
 * @property {boolean}   [activo]
 */

/**
 * @typedef {Object} MovimientoCaja
 * @property {ID}        id
 * @property {string}    tipo           - 'ingreso' | 'egreso'
 * @property {MontoQ}    monto
 * @property {string}    descripcion
 * @property {FechaISO}  fecha
 * @property {string}    [categoria]
 * @property {string}    [detalle]
 * @property {string}    [proveedor]
 * @property {boolean}   [es_cierre]
 */

/**
 * @typedef {Object} RegistroMaquinaria
 * @property {ID}        id
 * @property {ID}        [vehiculo_id]
 * @property {string}    tipo
 * @property {number}    [horas]
 * @property {number}    [combustible_galones]
 * @property {MontoQ}    [combustible_costo]
 * @property {MontoQ}    [mantenimiento_costo]
 * @property {string}    [codigo]
 * @property {FechaISO}  fecha
 * @property {boolean}   [es_propio]
 */

/**
 * @typedef {Object} Trabajador
 * @property {ID}        id
 * @property {string}    nombre
 * @property {string}    puesto
 * @property {MontoQ}    pago_hora_normal
 * @property {MontoQ}    pago_hora_extra
 * @property {boolean}   [activo]
 */

/**
 * @typedef {Object} RegistroAsistencia
 * @property {ID}        trabajador_id
 * @property {'asistio'|'falto'|'justificado'} estado
 * @property {number}    [horas_extras]
 * @property {{total_diario?: MontoQ}} [calculos]
 */

/**
 * @typedef {Object} AsistenciaDiaria
 * @property {FechaISO}  fecha
 * @property {RegistroAsistencia[]} registros
 */

/**
 * @typedef {Object} Proveedor
 * @property {ID}        id
 * @property {string}    nombre
 * @property {string}    [telefono]
 * @property {string}    [email]
 * @property {string}    [direccion]
 */

/**
 * @typedef {Object} CotizacionCompra
 * @property {ID}        id
 * @property {ID|null}   proveedor_id
 * @property {MontoQ}    total
 * @property {string}    material_descripcion
 * @property {FechaISO}  fecha
 * @property {'pendiente'|'aprobada'|'rechazada'} estado
 */

/**
 * @typedef {Object} ViajeCamion
 * @property {ID}        id
 * @property {string}    [tipo]         - 'propio' | 'alquilado'
 * @property {MontoQ}    total
 * @property {string}    [observaciones]
 * @property {FechaISO}  fecha
 * @property {ID}        [vehiculo_id]
 * @property {string}    [material]
 * @property {number}    [numero]
 * @property {number}    [km_total]
 * @property {number}    [litros]
 * @property {MontoQ}    [costo_combustible]
 * @property {MontoQ}    [costo_alquiler]
 */

/**
 * @typedef {Object} OrdenMantenimiento
 * @property {ID}        id
 * @property {ID}        maquinaria_id
 * @property {string}    tipo       - 'preventivo' | 'correctivo'
 * @property {MontoQ}    costo
 * @property {string}    [observaciones]
 * @property {FechaISO}  fecha
 */

/**
 * @typedef {Object} CompraInsumo
 * @property {ID}        id
 * @property {string}    tipo
 * @property {string}    articulo
 * @property {MontoQ}    costo
 * @property {FechaISO}  fecha
 * @property {number}    [cantidad]
 * @property {boolean}   [es_critico]
 */

/**
 * @typedef {Object} ProyectoData
 * @property {MovimientoCaja[]}             caja_chica
 * @property {{vehiculos: Object[], registros: RegistroMaquinaria[]}} maquinaria_flota
 * @property {{trabajadores: Trabajador[], asistencia: AsistenciaDiaria[]}} personal
 * @property {{proveedores: Proveedor[], cotizaciones_compras: CotizacionCompra[]}} adquisiciones
 * @property {{rutas_botadero: Object[], camiones: Object[], equipo_alquilado: Object[], viajes: ViajeCamion[]}} viajes_camiones
 * @property {{maquinaria: Object[], formatos: Object<string,Object>, ordenes: OrdenMantenimiento[], compras_insumos: CompraInsumo[]}} mantenimiento
 */

/**
 * @typedef {Object} ConstruramsaDB
 * @property {string}            version
 * @property {ConfiguracionEmpresa} configuracion
 * @property {Proyecto[]}        proyectos
 * @property {Record<string, ProyectoData>} proyectos_data
 * @property {ReporteGuardado[]}             reportes     - Reportes generados y guardados.
 */

/* ================================================================ */
/*  Reportes y exportaciones                                        */
/* ================================================================ */

/**
 * @typedef {Object} ReporteGuardado
 * @property {ID}        id
 * @property {'diario'|'semanal'|'mensual'|'asistencia'|'nomina'|'viajes'|'mantenimiento'|'categoria'|'ejecutivo'} tipo
 * @property {FechaISO}  fecha
 * @property {string}    proyecto_id
 * @property {FechaISO}  [desde]
 * @property {FechaISO}  [hasta]
 * @property {MontoQ}    total_ingresos
 * @property {MontoQ}    total_egresos
 * @property {MontoQ}    saldo
 * @property {Object<string, Object>} [detalle]
 */

/**
 * @typedef {Object} FiltrosReporte
 * @property {FechaISO} desde
 * @property {FechaISO} hasta
 * @property {string}  proyecto_id
 * @property {string}  categoria     - Vacío = todas las categorías.
 */

/**
 * @typedef {Object} MetadatosReporte
 * @property {string}   empresa
 * @property {string}   proyecto_nombre
 * @property {string}   tipo_reporte     - 'diario' | 'semanal' | 'mensual'.
 * @property {FechaISO} fecha_generado
 * @property {string}   rango_fechas     - Representación legible (p. ej. "01-ago - 31-ago").
 */
