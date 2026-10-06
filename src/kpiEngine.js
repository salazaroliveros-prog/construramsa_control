/**
 * @fileoverview Motor funcional de KPIs para el dashboard de Resumen de CONSTRURAMSA.
 *
 * Funciones puras (FP), sin efectos secundarios, reutilizables y tipadas con JSDoc.
 * No depende del DOM; recibe datos estructurados (ver getProyectoData) y devuelve cálculos.
 *
 * Se expone como `window.CR_KPIEngine` (IIFE, sin fuga de globales) y como
 * CommonJS para testing en Node.
 *
 * @module kpiEngine
 * @version 2.9.4
 */
(function (globalScope) {
  'use strict';

  /**
   * @typedef {Object} KPIs
   * @property {number} presupuesto
   * @property {number} totalIngresos
   * @property {number} totalEgresos
   * @property {number} saldo
   * @property {number} movimientosIngreso
   * @property {number} movimientosEgreso
   * @property {number} totalViajes
   * @property {number} viajesPropios
   * @property {number} viajesAlquilados
   * @property {number} totalKm
   * @property {number} totalLitros
   * @property {number} totalMantenimiento
   * @property {number} totalNomina
   * @property {number} gastoDiarioPromedio
   * @property {number} proyeccionFinDeMes
   * @property {number} diasRestantes
   * @property {'excedera'|'dentro'|'sin_datos'} tendencia
   * @property {number} variacionMensual - Variación % vs el período ANTERIOR
   *   equivalente (semana/mes/trimestre/año anterior según `periodo`).
   * @property {number} costoPorM3
   * @property {number} costoHoraMaquinaria
   * @property {number} eficienciaCombustible
   * @property {number} nominaPeriodo - Nómina del período efectivo.
   * @property {Object<string,number>} gastosPorCategoria - Claves = etiquetas legibles de categoría
   * @property {Date} periodoInicio - Inicio del rango efectivo de las métricas de período.
   * @property {Date} periodoFin - Fin del rango efectivo de las métricas de período.
   * @property {string} periodoInicioISO - Igual que `periodoInicio` en 'YYYY-MM-DD'.
   * @property {string} periodoFinISO - Igual que `periodoFin` en 'YYYY-MM-DD'.
   */

  /**
   * Suma montos de movimientos filtrados por tipo.
   * @param {Array<{tipo:string,monto:number}>} movimientos
   * @param {string} tipo
   * @returns {number}
   */
  const sumaTipo = (movimientos, tipo) =>
    (movimientos || [])
      .filter((m) => m.tipo === tipo)
      .reduce((s, m) => s + Math.abs(Number(m.monto) || 0), 0);

  /**
   * Cuenta movimientos por tipo.
   * @param {Array<{tipo:string}>} movimientos
   * @param {string} tipo
   * @returns {number}
   */
  const cuentaTipo = (movimientos, tipo) =>
    (movimientos || []).filter((m) => m.tipo === tipo).length;

  /**
   * Convierte un Date a 'YYYY-MM-DD' usando los componentes LOCALES.
   *
   * Preferido sobre `toISOString()` porque evita el corrimiento de día en
   * zonas horarias con desfase respecto a UTC (el string resultante se
   * compara lexicográficamente contra las fechas 'YYYY-MM-DD' del dominio).
   *
   * @private
   * @param {Date} d
   * @returns {string} 'YYYY-MM-DD'
   */
  const _fechaISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  /**
   * Días de calendario entre dos fechas (b - a), ignorando hora y DST.
   * @private
   */
  const _diasEntre = (a, b) =>
    Math.round(
      (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
        Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) /
        86400000
    );

  /**
   * Rango del período ANTERIOR equivalente al seleccionado.
   *
   * Útil para la variación vs período anterior: corre `fecha` una unidad
   * hacia atrás (día/semana/mes/trimestre/año) y reutiliza
   * `_obtenerRangoPeriodo` para obtener sus límites exactos.
   * @private
   * @param {string} periodo - 'dia'|'semana'|'mes'|'trimestre'|'anio'
   * @param {Date} fecha
   * @returns {{inicio:Date, fin:Date}}
   */
  const _rangoPeriodoAnterior = (periodo, fecha) => {
    const d = new Date(fecha);
    switch (periodo) {
      case 'dia':
        d.setDate(d.getDate() - 1);
        break;
      case 'semana':
        d.setDate(d.getDate() - 7);
        break;
      case 'trimestre':
        d.setDate(1); // normaliza para evitar overflow (ej. 31 → mes corto)
        d.setMonth(d.getMonth() - 3);
        break;
      case 'anio':
        d.setDate(1);
        d.setFullYear(d.getFullYear() - 1);
        break;
      default:
        // 'mes'
        d.setDate(1);
        d.setMonth(d.getMonth() - 1);
        break;
    }
    return _obtenerRangoPeriodo(periodo, d);
  };

  /**
   * Ventana temporal (días del período) para proyecciones.
   *
   * Deriva la ventana del MISMO rango que usa `_obtenerRangoPeriodo` para
   * filtrar las métricas de período: así los días transcurridos/restantes y
   * el gasto del período siempre se refieren al mismo intervalo (antes, los
   * períodos 'semana'/'anio' contaban días de MES mientras el gasto se
   * filtraba por semana/año, produciendo proyecciones sin sentido; además el
   * cálculo con `Math.round` sobre timestamps con hora cambiaba el número de
   * días transcurridos según la hora del día).
   * @private
   * @param {string} periodo - 'dia'|'semana'|'mes'|'trimestre'|'anio'
   * @param {Date} fechaHoy
   * @returns {{diasEnVentana:number, diasTranscurridos:number, diasRestantes:number}}
   */
  const _ventanaPeriodo = (periodo, fechaHoy) => {
    const { inicio, fin } = _obtenerRangoPeriodo(periodo, fechaHoy);
    const diasEnVentana = Math.max(_diasEntre(inicio, fin) + 1, 1);
    const diasTranscurridos = Math.min(
      Math.max(_diasEntre(inicio, fechaHoy) + 1, 1),
      diasEnVentana
    );
    return {
      diasEnVentana,
      diasTranscurridos,
      diasRestantes: Math.max(diasEnVentana - diasTranscurridos, 0),
    };
  };

  /**
   * Calcula gastos por categoría desde caja chica.
   *
   * Las categorías se acumulan usando la ETIQUETA LEGIBLE tal como aparece en
   * `m.categoria` (ej: 'Combustible', 'Mano de Obra'). Si un movimiento tiene
   * categoría compuesta con '/' (ej: 'Combustible/Viajes'), se registra bajo la
   * primera categoría únicamente para evitar doble conteo.
   *
   * @param {Array<{tipo:string, categoria:string, monto:number}>} movimientos
   * @returns {Object<string,number>} Mapa categoria → monto acumulado
   */
  const gastosPorCategoria = (movimientos) => {
    /** @type {Object<string,number>} */
    const gastos = {};

    (movimientos || []).forEach((m) => {
      if (m.tipo !== 'egreso' || !m.categoria) return;

      const monto = Number(m.monto) || 0;
      if (monto === 0) return;

      // Si la categoría es compuesta (separada por '/'), usar solo la primera
      // parte para evitar doble conteo. Ej: 'Combustible/Viajes' → 'Combustible'.
      const categoriaKey = String(m.categoria).split('/')[0].trim() || 'Otros';

      gastos[categoriaKey] = (gastos[categoriaKey] || 0) + monto;
    });

    return gastos;
  };

  /**
   * Obtiene el rango de fechas según el período.
   * @private
   * @param {string} periodo - 'dia'|'semana'|'mes'|'trimestre'|'anio'
   * @param {Date} fechaHoy
   * @returns {{inicio:Date, fin:Date}}
   */
  const _obtenerRangoPeriodo = (periodo, fechaHoy) => {
    const y = fechaHoy.getFullYear();
    const m = fechaHoy.getMonth();
    const d = fechaHoy.getDate();
    let inicio;
    let fin;

    switch (periodo) {
      case 'dia': {
        inicio = new Date(y, m, d);
        fin = new Date(y, m, d);
        break;
      }
      case 'semana': {
        const diaSemana = fechaHoy.getDay();
        inicio = new Date(y, m, d - diaSemana);
        fin = new Date(y, m, d + (6 - diaSemana));
        break;
      }
      case 'mes': {
        inicio = new Date(y, m, 1);
        fin = new Date(y, m + 1, 0);
        break;
      }
      case 'trimestre': {
        const trimestreInicio = Math.floor(m / 3) * 3;
        inicio = new Date(y, trimestreInicio, 1);
        fin = new Date(y, trimestreInicio + 3, 0);
        break;
      }
      case 'anio': {
        inicio = new Date(y, 0, 1);
        fin = new Date(y, 11, 31);
        break;
      }
      default: {
        inicio = new Date(y, m, 1);
        fin = new Date(y, m + 1, 0);
        break;
      }
    }

    return { inicio, fin };
  };

  /**
   * Filtra registros por rango de fechas.
   * @private
   * @param {Array} registros
   * @param {string} campoFecha
   * @param {Date} inicio
   * @param {Date} fin
   * @returns {Array}
   */
  const _normalizarFecha = (v) => {
    if (v == null || v === '') return '';
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    var d = new Date(v);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };

  const _filtrarPorRango = (registros, campoFecha, inicio, fin) => {
    const i = _normalizarFecha(inicio);
    const f = _normalizarFecha(fin);
    return (registros || []).filter((r) => {
      const fecha = _normalizarFecha(r[campoFecha]);
      return (!i || fecha >= i) && (!f || fecha <= f);
    });
  };

  /**
   * Calcula todos los KPIs del dashboard de resumen.
   * Coherente con cargarResumen y actualizarDashboard (index.html).
   *
   * Semántica de rangos:
   * - `totalIngresos`, `totalEgresos`, `saldo`, contadores, `totalViajes`,
   *   `totalKm`, `totalLitros`, `totalMantenimiento` y `totalNomina` son
   *   ACUMULADOS: se filtran SOLO si el llamador pasa un `rango` explícito
   *   (reportes); sin rango son históricos (coherentes con los sublabels de
   *   las tarjetas y con el cálculo inline de respaldo de `cargarResumen`).
   * - Las métricas de PERÍODO (`gastoPeriodo`, `gastosPorCategoria`,
   *   `gastoDiarioPromedio`, `proyeccionFinDeMes`, `tendencia`,
   *   `variacionMensual`, `costoPorM3`, `costoHoraMaquinaria`,
   *   `eficienciaCombustible`) se filtran por el `rango` si se pasa, y si no
   *   por la ventana del `periodo` seleccionado en el dashboard
   *   (semana/mes/trimestre/año). Antes, sin `rango` no se filtraba nada y
   *   el selector de período no afectaba el gráfico ni las proyecciones.
   *
   * @param {Object} datos - Salida de getProyectoData()
   * @param {{presupuestoInicial:number}} config
   * @param {string} [periodo='mes']
   * @param {{inicio?:string, fin?:string}} [rango=null] - Rango explícito
   *   'YYYY-MM-DD' (reportes). Si se pasa aunque sea vacío, manda él y NO se
   *   aplica el fallback al período (preserva el comportamiento histórico de
   *   los reportes sin fecha).
   * @returns {KPIs}
   */
  const calcularKPIs = (datos, config, periodo = 'mes', rango = null) => {
    const db = datos || {};
    const fechaHoy = new Date();
    const { diasTranscurridos, diasRestantes } = _ventanaPeriodo(periodo, fechaHoy);
    const { inicio: periodoInicio, fin: periodoFin } = _obtenerRangoPeriodo(periodo, fechaHoy);

    const _rangoDado = rango != null;
    const _inicio = (_rangoDado && rango.inicio) || '';
    const _fin = (_rangoDado && rango.fin) || '';
    // Rango efectivo de las métricas de período: el rango explícito (reportes)
    // tiene prioridad; sin él (dashboard) se usa la ventana del `periodo`.
    const _pInicio = _rangoDado ? _inicio : _fechaISO(periodoInicio);
    const _pFin = _rangoDado ? _fin : _fechaISO(periodoFin);

    // ── Caja chica (acumulados) ──────────────────────────────────────────
    const caja = db.caja_chica || [];
    const cajaPeriodo = _filtrarPorRango(caja, 'fecha', _inicio, _fin);
    const totalIngresos = sumaTipo(cajaPeriodo, 'ingreso');
    const totalEgresos = sumaTipo(cajaPeriodo, 'egreso');

    const presupuesto = (config && Number(config.presupuestoInicial)) || 0;
    const saldo = presupuesto + totalIngresos - totalEgresos;

    // ── Viajes ───────────────────────────────────────────────────────────
    const viajes = (db.viajes_camiones && db.viajes_camiones.viajes) || [];
    const camiones = (db.viajes_camiones && db.viajes_camiones.camiones) || [];
    let viajesPropios = 0;
    let viajesAlq = 0;
    let totalKm = 0;
    let totalLitros = 0;

    // Totales acumulados (tarjetas del Resumen / totales de reporte).
    const viajesRango = _filtrarPorRango(viajes, 'fecha', _inicio, _fin);
    viajesRango.forEach((v) => {
      totalKm += v.km_total || 0;
      totalLitros += v.litros || 0;
      // La propiedad puede estar en el viaje (datos nuevos) o hay que buscarla
      // en el catálogo de camiones (datos migrados de versiones anteriores).
      const prop =
        v.propiedad || (camiones.find((c) => c.id === v.vehiculo_id) || {}).propiedad || 'propio';
      if (prop === 'alquilado') {
        viajesAlq += 1;
      } else {
        viajesPropios += 1;
      }
    });

    // Viajes del período efectivo (métricas de eficiencia del dashboard).
    const viajesPeriodo = _filtrarPorRango(viajes, 'fecha', _pInicio, _pFin);

    // ── Mantenimiento e insumos ──────────────────────────────────────────
    const ordenes = _filtrarPorRango(
      (db.mantenimiento && db.mantenimiento.ordenes) || [],
      'fecha',
      _inicio,
      _fin
    );
    const insumos = _filtrarPorRango(
      (db.mantenimiento && db.mantenimiento.compras_insumos) || [],
      'fecha',
      _inicio,
      _fin
    );
    const totalMantenimiento =
      ordenes.reduce((s, o) => s + (Number(o.costo) || 0), 0) +
      insumos.reduce((s, i) => s + (Number(i.costo) || 0), 0);

    // ── Nómina ───────────────────────────────────────────────────────────
    // Acumulada (sólo con rango explícito de reporte) + del período efectivo
    // para el filtro por módulo del dashboard.
    const asist = (db.personal && db.personal.asistencia) || [];
    const personal = db.personal || {};
    const _nominaDe = (ini, fin) => {
      if (
        typeof globalScope.CR_NominaEngine !== 'undefined' &&
        typeof globalScope.CR_NominaEngine.calcularNomina === 'function'
      ) {
        return globalScope.CR_NominaEngine.calcularNomina(
          personal.trabajadores || [],
          personal.asistencia || [],
          ini,
          fin
        ).totalPagable;
      }
      // Respaldo cuando CR_NominaEngine no está cargado (Node/tests).
      return asist
        .filter((dia) => {
          const f = _normalizarFecha(dia.fecha);
          return (!ini || f >= ini) && (!fin || f <= fin);
        })
        .flatMap((dia) => (dia.registros || []).map((r) => ({ ...r, fecha: dia.fecha })))
        .reduce((s, r) => {
          if (r.calculos && Number.isFinite(Number(r.calculos.total_diario))) {
            return s + Number(r.calculos.total_diario);
          }
          const trabajador = (personal.trabajadores || []).find((t) => t.id === r.trabajador_id);
          const normal = Number(trabajador?.pago_hora_normal) || 0;
          const extra = Number(trabajador?.pago_hora_extra) || 0;
          return (
            s + (r.estado === 'asistio' ? 8 * normal + (Number(r.horas_extras) || 0) * extra : 0)
          );
        }, 0);
    };
    const totalNomina = _nominaDe(_inicio, _fin);
    const nominaPeriodo = _nominaDe(_pInicio, _pFin);

    // ── Gastos del período efectivo (proyección y análisis) ───────────────
    // Con `rango` explícito filtra el reporte; sin él, la ventana del
    // `periodo` seleccionado en el dashboard (antes no filtraba nada y el
    // selector de período no afectaba el gráfico de categorías).
    const movimientosPeriodo = _filtrarPorRango(caja, 'fecha', _pInicio, _pFin).filter(
      (m) => m.tipo === 'egreso'
    );
    const gastoPeriodo = movimientosPeriodo.reduce((s, m) => s + (Number(m.monto) || 0), 0);
    const gastoDiarioPromedio = diasTranscurridos > 0 ? gastoPeriodo / diasTranscurridos : 0;
    const proyeccionFinDeMes = gastoPeriodo + gastoDiarioPromedio * diasRestantes;

    const tendencia =
      gastoDiarioPromedio > 0
        ? proyeccionFinDeMes > presupuesto
          ? 'excedera'
          : 'dentro'
        : 'sin_datos';

    // ── Variación vs período anterior (cualquier período) ─────────────────
    // Antes sólo se calculaba para 'mes' y comparaba el gasto del período
    // (sin filtrar) contra el mes anterior, dando porcentajes sin sentido.
    const rangoAnterior = _rangoPeriodoAnterior(periodo, fechaHoy);
    const gastosPeriodoAnt = _filtrarPorRango(
      caja,
      'fecha',
      _fechaISO(rangoAnterior.inicio),
      _fechaISO(rangoAnterior.fin)
    )
      .filter((m) => m.tipo === 'egreso')
      .reduce((s, m) => s + (Number(m.monto) || 0), 0);
    const variacionPeriodo =
      gastosPeriodoAnt > 0 ? ((gastoPeriodo - gastosPeriodoAnt) / gastosPeriodoAnt) * 100 : 0;

    // ── Eficiencia con datos del período efectivo ─────────────────────────
    const kmPeriodo = viajesPeriodo.reduce((s, v) => s + (v.km_total || 0), 0);
    const litrosPeriodo = viajesPeriodo.reduce((s, v) => s + (v.litros || 0), 0);

    const maquinariaRegistros = _filtrarPorRango(
      (db.maquinaria_flota && db.maquinaria_flota.registros) || [],
      'fecha',
      _pInicio,
      _pFin
    );
    const totalHorasMaq = maquinariaRegistros.reduce((s, r) => s + (r.horas || 0), 0);

    const gastoMaqPeriodo = movimientosPeriodo
      .filter((m) => m.categoria && m.categoria.toLowerCase().includes('maquinaria'))
      .reduce((s, m) => s + (Number(m.monto) || 0), 0);

    const costoHoraMaquinaria = totalHorasMaq > 0 ? gastoMaqPeriodo / totalHorasMaq : 0;
    const eficienciaCombustible = kmPeriodo > 0 ? litrosPeriodo / kmPeriodo : 0;
    const costoPorM3 = viajesPeriodo.length > 0 ? gastoPeriodo / (viajesPeriodo.length * 12) : 0;

    // ── Gastos por categoría del período ─────────────────────────────────
    // gastosPorCategoria recibe los movimientos del período ya filtrados.
    // Las claves del resultado son etiquetas legibles (tal como se almacenan
    // en caja_chica[].categoria), NO claves snake_case internas.
    const gastosPorCategoriaPeriodo = gastosPorCategoria(movimientosPeriodo);

    return {
      presupuesto,
      totalIngresos,
      totalEgresos,
      saldo,
      movimientosIngreso: cuentaTipo(cajaPeriodo, 'ingreso'),
      movimientosEgreso: cuentaTipo(cajaPeriodo, 'egreso'),
      totalViajes: viajesRango.length,
      viajesPropios,
      viajesAlquilados: viajesAlq,
      totalKm,
      totalLitros,
      totalMantenimiento,
      totalNomina,
      // Nómina del período efectivo (rango del reporte o ventana del
      // `periodo`): la usa el filtro por módulo del dashboard para que la
      // barra de "Personal" sea comparable con las barras del gráfico.
      nominaPeriodo,
      gastoDiarioPromedio,
      proyeccionFinDeMes,
      diasRestantes,
      tendencia,
      variacionMensual: variacionPeriodo,
      costoPorM3,
      costoHoraMaquinaria,
      eficienciaCombustible,
      gastosPorCategoria: gastosPorCategoriaPeriodo,
      gastoPeriodo,
      // Rango efectivo de las métricas de período (rango del reporte si se
      // pasó; si no, la ventana del período seleccionado en el dashboard).
      // Si el rango venía vacío (reporte sin fecha → sin filtro, histórico),
      // se expone la ventana del período como referencia. El sufijo
      // 'T00:00:00' sin Z fuerza parseo local y evita el corrimiento de día
      // que produce `new Date('YYYY-MM-DD')` (parseado como UTC).
      periodoInicio: _pInicio ? new Date(_pInicio + 'T00:00:00') : periodoInicio,
      periodoFin: _pFin ? new Date(_pFin + 'T00:00:00') : periodoFin,
      // Mismo rango en 'YYYY-MM-DD' (string) para comparaciones directas
      // sin riesgo de corrimiento de zona horaria.
      periodoInicioISO: _pInicio,
      periodoFinISO: _pFin,
    };
  };

  /**
   * API pública del módulo.
   * @type {Readonly<object>}
   */
  const api = Object.freeze({
    calcularKPIs,
    gastosPorCategoria,
    sumaTipo,
    cuentaTipo,
  });

  // ── Exposición en navegador: un único global congelado y no enumerable ──
  if (globalScope) {
    try {
      Object.defineProperty(globalScope, 'CR_KPIEngine', {
        value: api,
        writable: false,
        enumerable: false,
        configurable: false,
      });
    } catch (e) {
      // Entornos restringidos: la definición falla pero el módulo sigue vivo.
    }
  }

  // ── Exposición CommonJS para testing / SSR ──────────────────────────────
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
