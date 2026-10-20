/**
 * Adaptador único para datos de reportes.
 * Normaliza el esquema persistido antes de que lo consuman CSV, PDF o KPIs.
 * @module reportDataAdapter
 */
(function (globalScope) {
  'use strict';

  const REPORT_TYPES = Object.freeze([
    'diario',
    'semanal',
    'mensual',
    'asistencia',
    'nomina',
    'viajes',
    'mantenimiento',
    'categoria',
    'ejecutivo',
  ]);

  const EMPTY_PROJECT_DATA = () => ({
    caja_chica: [],
    maquinaria_flota: { vehiculos: [], registros: [] },
    personal: { trabajadores: [], asistencia: [] },
    adquisiciones: { proveedores: [], cotizaciones_compras: [] },
    viajes_camiones: { rutas_botadero: [], camiones: [], equipo_alquilado: [], viajes: [] },
    mantenimiento: { maquinaria: [], formatos: {}, ordenes: [], compras_insumos: [] },
  });

  function array(value) {
    return Array.isArray(value) ? value : [];
  }

  function number(value) {
    const result = Number(value);
    if (!Number.isFinite(result)) return 0;
    return Number(Math.round(result * 100) / 100);
  }

  const TIPO_ALIASES = Object.freeze({
    apertura: 'ingreso',
    entrada: 'ingreso',
    deposito: 'ingreso',
    salida: 'egreso',
    gasto: 'egreso',
  });

  const ESTADO_ALIASES = Object.freeze({
    presente: 'asistio',
    asistió: 'asistio',
    falta: 'falto',
    ausente: 'falto',
    permiso: 'justificado',
  });

  function tipoCaja(value) {
    const text = String(value ?? '')
      .trim()
      .toLowerCase();
    return TIPO_ALIASES[text] || text;
  }

  function estadoAsistencia(value) {
    const text = String(value ?? '')
      .trim()
      .toLowerCase();
    return ESTADO_ALIASES[text] || text;
  }

  /** Formatea una fecha en horario local como 'YYYY-MM-DD'. */
  function localDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function dateKey(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return localDateKey(value);
    }
    const text = String(value ?? '');
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : localDateKey(parsed);
  }

  function inRange(value, range) {
    const date = dateKey(value);
    if (!date) return false;
    return (!range?.inicio || date >= range.inicio) && (!range?.fin || date <= range.fin);
  }

  /**
   * IDs de movimientos de caja ya detallados en otra sección del reporte.
   * Si se pasa `range`, solo se excluyen los registros cuyo propio `fecha`
   * cae en el período; así un movimiento vinculado a un registro de otra
   * fecha no desaparece del reporte (ni se duplica).
   * @param {Object} data
   * @param {{inicio?:string, fin?:string}} [range]
   * @returns {Set<string>}
   */
  function linkedExpenseIds(data, range) {
    const source = data || {};
    const include = (item) => !range || inRange(item?.fecha, range);
    return new Set(
      [
        ...array(source.viajes_camiones?.viajes),
        ...array(source.mantenimiento?.ordenes),
        ...array(source.mantenimiento?.compras_insumos),
        ...array(source.adquisiciones?.cotizaciones_compras),
      ]
        .filter(include)
        .map((item) => item?.gasto_id)
        .filter(Boolean)
    );
  }

  function normalizeProjectData(raw) {
    const source = raw || {};
    return {
      caja_chica: array(source.caja_chica).map((item) => ({
        ...item,
        monto: number(item?.monto),
        descripcion: String(item?.descripcion ?? item?.concepto ?? item?.detalle ?? ''),
        fecha: dateKey(item?.fecha),
        tipo: tipoCaja(item?.tipo),
      })),
      maquinaria_flota: {
        vehiculos: array(source.maquinaria_flota?.vehiculos),
        registros: array(source.maquinaria_flota?.registros).map((item) => ({
          ...item,
          fecha: dateKey(item?.fecha),
          horas: number(item?.horas),
          combustible_galones: number(item?.combustible_galones ?? item?.galones),
          combustible_costo: number(item?.combustible_costo ?? item?.costo_combustible),
          mantenimiento_costo: number(item?.mantenimiento_costo ?? item?.costo_mantenimiento),
        })),
      },
      personal: {
        trabajadores: array(source.personal?.trabajadores).map((item) => ({
          ...item,
          nombre: String(item?.nombre ?? ''),
          puesto: String(item?.puesto ?? item?.cargo ?? ''),
          pago_hora_normal: number(item?.pago_hora_normal ?? item?.salario_diario),
          pago_hora_extra: number(item?.pago_hora_extra),
        })),
        asistencia: array(source.personal?.asistencia).map((day) => ({
          ...day,
          fecha: dateKey(day?.fecha),
          registros: array(day?.registros).map((record) => ({
            ...record,
            trabajador_id: String(record?.trabajador_id ?? ''),
            estado: estadoAsistencia(record?.estado),
            horas_extras: number(record?.horas_extras ?? record?.horas_extra),
            calculos: record?.calculos
              ? {
                  ...record.calculos,
                  total_diario: number(record.calculos.total_diario),
                }
              : undefined,
          })),
        })),
      },
      adquisiciones: {
        proveedores: array(source.adquisiciones?.proveedores),
        cotizaciones_compras: array(
          source.adquisiciones?.cotizaciones_compras ?? source.adquisiciones?.cotizaciones
        ).map((item) => ({
          ...item,
          total: number(item?.total ?? item?.monto),
          fecha: dateKey(item?.fecha),
          material_descripcion: String(item?.material_descripcion ?? item?.concepto ?? ''),
        })),
      },
      viajes_camiones: {
        rutas_botadero: array(
          source.viajes_camiones?.rutas_botadero ?? source.viajes_camiones?.rutas
        ),
        camiones: array(source.viajes_camiones?.camiones),
        equipo_alquilado: array(source.viajes_camiones?.equipo_alquilado),
        viajes: array(source.viajes_camiones?.viajes).map((item) => ({
          ...item,
          fecha: dateKey(item?.fecha),
          numero: number(item?.numero),
          km_total: number(item?.km_total ?? item?.distancia),
          litros: number(item?.litros),
          costo_combustible: number(item?.costo_combustible),
          costo_alquiler: number(item?.costo_alquiler),
          total: number(item?.total ?? item?.costo),
        })),
      },
      mantenimiento: {
        maquinaria: array(source.mantenimiento?.maquinaria),
        formatos: source.mantenimiento?.formatos || {},
        ordenes: array(source.mantenimiento?.ordenes).map((item) => ({
          ...item,
          fecha: dateKey(item?.fecha),
          maquinaria_id: String(item?.maquinaria_id ?? item?.maquina_id ?? ''),
          costo: number(item?.costo),
        })),
        compras_insumos: array(
          source.mantenimiento?.compras_insumos ?? source.mantenimiento?.insumos
        ).map((item) => ({
          ...item,
          fecha: dateKey(item?.fecha),
          articulo: String(item?.articulo ?? item?.concepto ?? ''),
          cantidad: number(item?.cantidad),
          costo: number(item?.costo ?? item?.monto),
        })),
      },
    };
  }

  function resolve(db, projectId) {
    const source = db || {};
    const configuration = source.configuracion || {};
    const id = projectId ?? configuration.proyecto_actual ?? null;
    const project = array(source.proyectos).find((item) => item?.id === id) || null;
    const rawData = id && source.proyectos_data?.[id] ? source.proyectos_data[id] : source;
    const data = normalizeProjectData(rawData || EMPTY_PROJECT_DATA());
    return Object.freeze({
      db: source,
      configuration,
      project,
      projectId: id,
      projectName: project?.nombre || 'General',
      data,
    });
  }

  function attendanceSummary(report, range) {
    const workers = report.data.personal.trabajadores;
    const days = report.data.personal.asistencia.filter((day) => inRange(day.fecha, range));
    return workers
      .map((worker) => {
        let attended = 0;
        let absent = 0;
        let justified = 0;
        let overtime = 0;
        let total = 0;
        days.forEach((day) => {
          const record = day.registros.find((item) => item.trabajador_id === worker.id);
          if (!record) return;
          if (record.estado === 'asistio' || record.estado === 'presente') {
            attended++;
            overtime += record.horas_extras;
            total +=
              record.calculos?.total_diario ??
              8 * worker.pago_hora_normal + record.horas_extras * worker.pago_hora_extra;
          } else if (record.estado === 'falto' || record.estado === 'falta') {
            absent++;
          } else if (record.estado === 'justificado') {
            justified++;
          }
        });
        return Object.freeze({ worker, attended, absent, justified, overtime, total });
      })
      .filter(
        (item) => item.attended || item.absent || item.justified || item.overtime || item.total
      );
  }

  const api = Object.freeze({
    REPORT_TYPES,
    EMPTY_PROJECT_DATA,
    array,
    number,
    dateKey,
    inRange,
    linkedExpenseIds,
    normalizeProjectData,
    resolve,
    attendanceSummary,
  });

  if (globalScope) {
    try {
      Object.defineProperty(globalScope, 'CR_ReportData', {
        value: api,
        writable: false,
        enumerable: false,
        configurable: false,
      });
    } catch (e) {
      /* entornos restringidos */
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
