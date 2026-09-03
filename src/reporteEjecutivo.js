/**
 * @fileoverview Módulo Executive Summary para CONSTRURAMSA.
 *
 * Transforma los datos operativos de `construramsa_db` en reportes
 * ejecutivos profesionales con KPIs, visualizaciones SVG inline,
 * alertas gerenciales automáticas y un layout corporativo con
 * page-breaks correctos para exportación a PDF.
 *
 * Modelo de datos asumido (extraído de `getProyectoData()` en index.html):
 *   caja_chica[]            -> {id, fecha, tipo, categoria, descripcion, monto}
 *                              (tipo 'apertura' = ingreso; resto = gasto.
 *                               módulos crean movimientos con gasto_id, por lo
 *                               que contar por caja_chica evita doble contabilidad)
 *   maquinaria_flota        -> { vehiculos[], registros[] } con
 *                              registros[]: {fecha, vehiculo_id, combustible_galones,
 *                              combustible_costo, mantenimiento_costo, ...}
 *   viajes_camiones         -> { viajes[], rutas_botadero[], camiones[], ... }
 *   personal                -> { trabajadores[], asistencia[] }
 *
 * Se expone como `window.CR_ReporteEjecutivo` (IIFE, sin fuga de
 * globales) y como CommonJS para testing en Node.
 *
 * @module reporteEjecutivo
 */

(function (globalScope) {
    'use strict';

    // --- helpers de formato ---

    function fmtQ(n) {
        if (typeof globalScope !== 'undefined' && globalScope.CR_Export && globalScope.CR_Export.formatearMonto) {
            return 'Q' + globalScope.CR_Export.formatearMonto(n, 2);
        }
        var v = Number.isFinite(Number(n)) ? Number(n) : 0;
        return 'Q' + v.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function fmtPct(n, d) {
        var v = Number.isFinite(Number(n)) ? Number(n) : 0;
        return v.toFixed(d === undefined ? 1 : d) + '%';
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /** Convierte cualquier valor a un número finito (default 0). */
    function num(v) {
        var n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    /** Devuelve 'YYYY-MM-DD' a partir de una fecha string/Date/número. */
    function fechaKey(v) {
        if (v == null || v === '') return '';
        var d = new Date(v);
        if (isNaN(d.getTime())) return String(v);
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var di = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + di;
    }

    /** Filtra por rango [inicio, fin] inclusivo sobre claves fecha. */
    function enRango(key, inicio, fin) {
        if (!key) return true;
        if (inicio && key < inicio) return false;
        if (fin && key > fin) return false;
        return true;
    }

    /** Normaliza la fecha de un movimiento (admite 'YYYY-MM-DD' puro). */
    function fechaMov(m) {
        if (m && typeof m.fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(m.fecha)) {
            return m.fecha.slice(0, 10);
        }
        return fechaKey(m && m.fecha);
    }

    // --- Paleta corporativa (sincronizada con PALETA_CORPORATIVA de config.js) ---
    // Usa los colores canónicos de CR_CONFIG.PALETA_CORPORATIVA cuando está disponible,
    // con fallback a los valores definidos aquí para compatibilidad con Node/testing.
    var _paleta = (typeof globalScope !== 'undefined' &&
                   globalScope.CR_CONFIG &&
                   globalScope.CR_CONFIG.PALETA_CORPORATIVA)
        ? globalScope.CR_CONFIG.PALETA_CORPORATIVA
        : null;

    var COLORES = Object.freeze({
        primario:    _paleta ? _paleta.primario   : '#004B93',   // Azul corporativo CONSTRURAMSA
        primarioOsc: _paleta ? _paleta.primario   : '#004B93',
        acento:      _paleta ? _paleta.secundario : '#00A4E4',   // Cian corporativo
        alerta:      _paleta ? _paleta.rojo       : '#DC2626',
        tinta:       _paleta ? _paleta.grisOscuro : '#374151',
        gris:        _paleta ? _paleta.grisMedio  : '#6B7280',
        lineas:      '#E5E7EB',
        fondo:       _paleta ? _paleta.fondoClaro : '#F9FAFB',
        blanco:      '#ffffff'
    });

    // ============================================================
    // MOTOR DE KPIs — delega a CR_KPIEngine cuando está disponible,
    // o usa implementación local de respaldo para reportes ejecutivos.
    // ============================================================

    /**
     * Calcula los indicadores clave de gestión para el período dado.
     * Delega a window.CR_KPIEngine.calcularKPIs si está disponible,
     * adaptando el resultado al formato esperado por generarHTML.
     * @param {Object} db                 Base de datos completa
     * @param {Object} [opts]
     * @param {string} [opts.inicio]      'YYYY-MM-DD'
     * @param {string} [opts.fin]         'YYYY-MM-DD'
     * @returns {Object} KPIs, distribuciones y alertas.
     */
    function calcularKPIs(db, opts) {
        opts = opts || {};
        var inicio = opts.inicio || '';
        var fin = opts.fin || '';
        var db2 = db || {};

        // Intentar delegar al motor centralizado si está cargado
        if (typeof globalScope !== 'undefined' &&
            globalScope.CR_KPIEngine &&
            typeof globalScope.CR_KPIEngine.calcularKPIs === 'function') {
            var datosProyecto = db2;
            var cfg = db2.configuracion || {};
            var kpisEngine = globalScope.CR_KPIEngine.calcularKPIs(
                datosProyecto,
                { presupuestoInicial: num(cfg.presupuesto_inicial_caja || cfg.presupuesto) },
                'mes',
                { inicio: opts.inicio, fin: opts.fin }
            );
            // Adaptar al formato de reporte ejecutivo (agrega porCategoria, porDia, alertas)
            return _enriquecerKPIsParaReporte(kpisEngine, db2, inicio, fin);
        }

        // Implementación local de respaldo (usada en Node/testing sin CR_KPIEngine)
        return _calcularKPIsLocal(db2, inicio, fin);
    }

    /**
     * Enriquece el resultado de CR_KPIEngine con los campos extra
     * que necesita el reporte ejecutivo (porCategoria, porDia, alertas, maquinaria).
     * @private
     */
    function _enriquecerKPIsParaReporte(kpisEngine, db2, inicio, fin) {
        var porCategoria = (kpisEngine && kpisEngine.gastosPorCategoria) ? kpisEngine.gastosPorCategoria : {};
        var porDia = {};

        var caja = Array.isArray(db2.caja_chica) ? db2.caja_chica : [];
        caja.forEach(function (m) {
            if (!m) return;
            var key = fechaMov(m);
            if (!enRango(key, inicio, fin)) return;
            var monto = num(m.monto);
            var tipo = String(m.tipo || '').toLowerCase();
            porDia[key] = porDia[key] || { gastos: 0, ingresos: 0 };
            if (tipo === 'apertura' || tipo === 'ingreso' || tipo === 'entrada') {
                porDia[key].ingresos += Math.abs(monto);
            } else {
                porDia[key].gastos += Math.abs(monto);
            }
        });

        var maquinaria = { galones: 0, costoCombustible: 0, costoMantenimiento: 0, registros: 0 };
        var flota = db2.maquinaria_flota || {};
        (Array.isArray(flota.registros) ? flota.registros : []).forEach(function (r) {
            if (!r || !enRango(fechaMov(r), inicio, fin)) return;
            maquinaria.registros++;
            maquinaria.galones += num(r.combustible_galones);
            maquinaria.costoCombustible += num(r.combustible_costo);
            maquinaria.costoMantenimiento += num(r.mantenimiento_costo);
        });

        var viajesCount = 0;
        (Array.isArray((db2.viajes_camiones || {}).viajes) ? db2.viajes_camiones.viajes : [])
            .forEach(function (v) { if (v && enRango(fechaMov(v), inicio, fin)) viajesCount++; });

        // Iteramos registros individuales dentro de cada día para contar
        // trabajadores presentes/ausentes, no días completos de asistencia.
        var asistencia = { registros: 0, ausencias: 0 };
        (Array.isArray((db2.personal || {}).asistencia) ? db2.personal.asistencia : [])
            .forEach(function (dia) {
                if (!dia || !enRango(fechaMov(dia), inicio, fin)) return;
                (Array.isArray(dia.registros) ? dia.registros : []).forEach(function (reg) {
                    asistencia.registros++;
                    var estado = String(reg.estado || '').toLowerCase();
                    if (estado === 'falto' || estado === 'falta' || estado.indexOf('aus') === 0) {
                        asistencia.ausencias++;
                    }
                });
            });

        var kpis = {
            totalGastos: kpisEngine.totalEgresos || 0,
            totalIngresos: kpisEngine.totalIngresos || 0,
            saldo: kpisEngine.saldo || 0,
            nMovimientos: (kpisEngine.movimientosIngreso || 0) + (kpisEngine.movimientosEgreso || 0),
            nGastos: kpisEngine.movimientosEgreso || 0,
            porCategoria: porCategoria,
            porDia: porDia,
            maquinaria: maquinaria,
            viajes: viajesCount,
            asistencia: asistencia,
            alertas: []
        };
        return _alertas(kpis, db2);
    }

    /**
     * Implementación local de cálculo de KPIs (respaldo cuando CR_KPIEngine no está disponible).
     * @private
     */
    function _calcularKPIsLocal(db2, inicio, fin) {
        var kpis = {
            totalGastos: 0, totalIngresos: 0, saldo: 0,
            nMovimientos: 0, nGastos: 0,
            porCategoria: {}, porDia: {},
            maquinaria: { galones: 0, costoCombustible: 0, costoMantenimiento: 0, registros: 0 },
            viajes: 0,
            asistencia: { registros: 0, ausencias: 0 },
            alertas: []
        };

        var caja = Array.isArray(db2.caja_chica) ? db2.caja_chica : [];
        caja.forEach(function (m) {
            if (!m) return;
            var key = fechaMov(m);
            if (!enRango(key, inicio, fin)) return;
            var monto = num(m.monto);
            var tipo = String(m.tipo || '').toLowerCase();
            kpis.nMovimientos++;
            kpis.porDia[key] = kpis.porDia[key] || { gastos: 0, ingresos: 0 };
            if (tipo === 'apertura' || tipo === 'ingreso' || tipo === 'entrada') {
                kpis.totalIngresos += Math.abs(monto);
                kpis.porDia[key].ingresos += Math.abs(monto);
            } else {
                var gasto = Math.abs(monto);
                kpis.totalGastos += gasto;
                kpis.nGastos++;
                kpis.porDia[key].gastos += gasto;
                var cat = String(m.categoria || 'Sin categoría').trim();
                var categoriaKey = cat.split('/')[0].trim() || 'Otros';
                kpis.porCategoria[categoriaKey] = (kpis.porCategoria[categoriaKey] || 0) + gasto;
            }
        });
        kpis.saldo = kpis.totalIngresos - kpis.totalGastos;

        var flota = db2.maquinaria_flota || {};
        (Array.isArray(flota.registros) ? flota.registros : []).forEach(function (r) {
            if (!r || !enRango(fechaMov(r), inicio, fin)) return;
            kpis.maquinaria.registros++;
            kpis.maquinaria.galones += num(r.combustible_galones);
            kpis.maquinaria.costoCombustible += num(r.combustible_costo);
            kpis.maquinaria.costoMantenimiento += num(r.mantenimiento_costo);
        });

        (Array.isArray((db2.viajes_camiones || {}).viajes) ? db2.viajes_camiones.viajes : [])
            .forEach(function (v) { if (v && enRango(fechaMov(v), inicio, fin)) kpis.viajes++; });

        (Array.isArray((db2.personal || {}).asistencia) ? db2.personal.asistencia : [])
            .forEach(function (dia) {
                if (!dia) return;
                var key = fechaMov(dia);
                if (!enRango(key, inicio, fin)) return;
                // Iterar registros individuales para contar trabajadores, no días.
                (Array.isArray(dia.registros) ? dia.registros : []).forEach(function (reg) {
                    kpis.asistencia.registros++;
                    var estado = String(reg.estado || '').toLowerCase();
                    if (estado === 'falto' || estado === 'falta' || estado.indexOf('aus') === 0) {
                        kpis.asistencia.ausencias++;
                    }
                });
            });

        return _alertas(kpis, db2);
    }

    /** Genera alertas gerenciales según reglas de negocio. */
    function _alertas(kpis, db2) {
        var cfg = db2.configuracion || {};
        var presupuesto = num(cfg.presupuesto) || num(cfg.presupuesto_inicial_caja);
        if (presupuesto > 0 && kpis.totalGastos > 0) {
            var ejecucion = kpis.totalGastos / presupuesto * 100;
            if (ejecucion >= 90) kpis.alertas.push({ nivel: 'danger', texto: 'Ejecución presupuestaria al ' + fmtPct(ejecucion, 0) + ' — riesgo de sobregiro.' });
            else if (ejecucion >= 70) kpis.alertas.push({ nivel: 'warning', texto: 'Ejecución presupuestaria al ' + fmtPct(ejecucion, 0) + ' — monitorear remanente.' });
        }
        var cats = Object.keys(kpis.porCategoria);
        if (cats.length && kpis.totalGastos > 0) {
            var mayor = cats[0];
            cats.forEach(function (c) { if (kpis.porCategoria[c] > kpis.porCategoria[mayor]) mayor = c; });
            var share = kpis.porCategoria[mayor] / kpis.totalGastos * 100;
            if (share >= 50) kpis.alertas.push({ nivel: 'warning', texto: 'La categoría «' + esc(mayor) + '» concentra el ' + fmtPct(share, 0) + ' del gasto.' });
        }
        if (kpis.totalGastos > 0 && kpis.saldo < 0) {
            kpis.alertas.push({ nivel: 'danger', texto: 'Egresos superan a ingresos del período (déficit ' + fmtQ(Math.abs(kpis.saldo)) + ').' });
        }
        if (kpis.totalGastos === 0 && kpis.totalIngresos === 0) {
            kpis.alertas.push({ nivel: 'info', texto: 'Sin movimientos en el período seleccionado.' });
        }
        if (kpis.alertas.length === 0) kpis.alertas.push({ nivel: 'info', texto: 'Operación estable: sin hallazgos relevantes.' });
        return kpis;
    }

    // ============================================================
    // VISUALIZACIONES SVG inline y escalables
    // ============================================================

    function svgBarrasCategorias(porCategoria, maxItems) {
        var items = Object.keys(porCategoria || {})
            .map(function (k) { return { name: k, value: num(porCategoria[k]) }; })
            .sort(function (a, b) { return b.value - a.value; });
        maxItems = maxItems || 6;
        items = items.slice(0, maxItems);
        var total = items.reduce(function (s, it) { return s + it.value; }, 0);
        if (total <= 0) return '<p class="ej-sin-datos">Sin datos para graficar.</p>';

        var w = 660, rowH = 34, padL = 165, padR = 100, topPad = 10;
        var h = topPad + items.length * rowH + 14;
        var usable = w - padL - padR;
        var maxVal = Math.max.apply(null, items.map(function (it) { return it.value; })) || 1;
        var rows = items.map(function (it, i) {
            var y = topPad + i * rowH;
            var bw = (it.value / maxVal) * usable;
            var pct = total > 0 ? Math.round(it.value / total * 100) : 0;
            return '<text x="' + (padL - 10) + '" y="' + (y + 17) + '" text-anchor="end" font-size="12" fill="' + COLORES.gris + '">' + esc(it.name) + '</text>'
                + '<rect x="' + padL + '" y="' + (y + 5) + '" width="' + bw + '" height="20" rx="3" fill="' + COLORES.primario + '"></rect>'
                + '<text x="' + (padL + bw + 8) + '" y="' + (y + 19) + '" font-size="12" fill="' + COLORES.tinta + '" font-weight="600">' + fmtQ(it.value) + ' <tspan fill="' + COLORES.gris + '">(' + pct + '%)</tspan></text>';
        }).join('');

        return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" role="img" aria-label="Distribución de gastos por categoría">' + rows + '</svg>';
    }

    function svgTendencia(porDia) {
        var dias = Object.keys(porDia || {}).sort();
        if (dias.length === 0) return '<p class="ej-sin-datos">Sin tendencia disponible.</p>';
        var w = 660, h = 200, padL = 60, padB = 34, padT = 15, padR = 15;
        var innerW = w - padL - padR, innerH = h - padT - padB;
        var vals = dias.map(function (d) { return num((porDia[d] || {}).gastos); });
        var maxV = Math.max.apply(null, vals.concat([1])) * 1.1;

        function px(i, v) {
            return { x: padL + (i / (dias.length - 1 || 1)) * innerW, y: padT + innerH - (v / maxV) * innerH };
        }

        var pts = dias.map(function (d, i) {
            var p = px(i, num((porDia[d] || {}).gastos));
            return p.x.toFixed(1) + ',' + p.y.toFixed(1);
        });
        var polyArea = padL + ',' + (padT + innerH) + ' ' + pts.join(' ') + ' ' + (padL + innerW) + ',' + (padT + innerH);

        var grid = '';
        for (var t = 0; t <= 4; t++) {
            var gy = padT + innerH - t / 4 * innerH;
            grid += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (w - padR) + '" y2="' + gy + '" stroke="' + COLORES.lineas + '" stroke-width="1"></line>';
        }

        var step = Math.max(1, Math.ceil(dias.length / 6));
        var xLabels = '';
        dias.forEach(function (d, i) {
            if (i % step !== 0 && i !== dias.length - 1) return;
            var p = px(i, 0);
            xLabels += '<text x="' + p.x + '" y="' + (h - 10) + '" text-anchor="middle" font-size="10" fill="' + COLORES.gris + '">' + esc(d) + '</text>';
        });

        var dots = dias.map(function (d, i) {
            var p = px(i, num((porDia[d] || {}).gastos));
            return '<circle cx="' + p.x + '" cy="' + p.y + '" r="3.2" fill="' + COLORES.acento + '"></circle>';
        }).join('');

        return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" role="img" aria-label="Tendencia de gastos diarios">'
            + grid
            + '<polygon points="' + polyArea + '" fill="' + COLORES.primario + '" fill-opacity="0.12"></polygon>'
            + '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + COLORES.primarioOsc + '" stroke-width="2.5"></polyline>'
            + dots + xLabels + '</svg>';
    }

    // ============================================================
    // GENERADOR DE HTML DEL REPORTE EJECUTIVO (layout corporativo)
    // ============================================================

    /**
     * Renderiza el documento HTML ejecutivo completo.
     * @param {Object} db           BD real
     * @param {Object} [portada]    {logo, empresa, direccion, ...}
     * @param {Object} [opts]       {tipo, inicio, fin, proyecto}
     * @returns {string} HTML listo para imprimir/convertir a PDF.
     */
    function generarHTML(db, portada, opts) {
        opts = opts || {};
        portada = portada || {};
        var kpis = calcularKPIs(db, { inicio: opts.inicio, fin: opts.fin });
        var rangoTxt = opts.inicio && opts.fin && opts.inicio !== opts.fin
            ? esc(opts.inicio) + ' al ' + esc(opts.fin)
            : esc(opts.inicio || opts.fin || 'Período sin definir');

        var empresa = esc(portada.empresa || 'CONSTRURAMSA');
        var eslogan = esc((db && db.configuracion && db.configuracion.eslogan) || 'SOLUCIONES EN INGENIERÍA Y ARQUITECTURA');
        var proyecto = esc(opts.proyecto || portada.proyecto || 'Proyecto');
        var fechaEmision = new Date().toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' });
        var horaEmision  = new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
        var tipoLbl = esc(opts.tipo || 'ejecutivo');

        var kpiCards =
            cardKPI('Total de Gastos', fmtQ(kpis.totalGastos), 'Gastos operativos del período') +
            cardKPI('Ingresos', fmtQ(kpis.totalIngresos), 'Apertura / reposición') +
            cardKPI('Saldo del Período', fmtQ(kpis.saldo), kpis.saldo >= 0 ? 'Superávit' : 'Déficit', kpis.saldo >= 0 ? COLORES.acento : COLORES.alerta) +
            cardKPI('Movimientos', String(kpis.nMovimientos), kpis.nGastos + ' egresos contabilizados');

        var kpiOp =
            cardKPI('Combustible', fmtQ(kpis.maquinaria.costoCombustible), kpis.maquinaria.galones.toFixed(1) + ' galones') +
            cardKPI('Mantenimiento', fmtQ(kpis.maquinaria.costoMantenimiento), kpis.maquinaria.registros + ' registros') +
            cardKPI('Viajes', String(kpis.viajes), 'viajes de camiones') +
            cardKPI('Asistencia', String(kpis.asistencia.registros), kpis.asistencia.ausencias + ' ausencias');

        var adquisiciones = (db.adquisiciones || {}).cotizaciones_compras || [];
        var comprasPeriodo = adquisiciones.filter(function(c) { return enRango(fechaMov(c), opts.inicio, opts.fin) && c.estado === 'aprobada'; });
        var totalCompras = comprasPeriodo.reduce(function(s, c) { return s + num(c.total); }, 0);
        var proveedoresUnicos = {};
        comprasPeriodo.forEach(function(c) { proveedoresUnicos[c.proveedor_id] = true; });
        var proveedoresActivos = Object.keys(proveedoresUnicos).length;

        var kpiAdq = cardKPI('Compras', fmtQ(totalCompras), proveedoresActivos + ' proveedores activos');

        var proveedoresDb = (db.adquisiciones || {}).proveedores || [];
        var proveedorNombre = {};
        proveedoresDb.forEach(function(p) { proveedorNombre[p.id] = p.nombre || 'Sin nombre'; });
        var resumenProveedores = {};
        comprasPeriodo.forEach(function(c) {
            var pid = c.proveedor_id || 'sin_proveedor';
            if (!resumenProveedores[pid]) resumenProveedores[pid] = { nombre: proveedorNombre[pid] || 'Desconocido', total: 0, cantidad: 0 };
            resumenProveedores[pid].total += num(c.total);
            resumenProveedores[pid].cantidad += 1;
        });
        var filasProv = Object.keys(resumenProveedores).sort(function(a, b) { return resumenProveedores[b].total - resumenProveedores[a].total; }).map(function(pid, i) {
            var r = resumenProveedores[pid];
            var share = totalCompras > 0 ? r.total / totalCompras * 100 : 0;
            return '<tr>'
                + '<td style="padding:7px 10px;border-bottom:1px solid ' + COLORES.lineas + ';color:' + COLORES.gris + ';font-size:12px;">' + (i + 1) + '</td>'
                + '<td style="padding:7px 10px;border-bottom:1px solid ' + COLORES.lineas + ';color:' + COLORES.tinta + ';font-size:13px;font-weight:600;">' + esc(r.nombre) + '</td>'
                + '<td style="padding:7px 10px;border-bottom:1px solid ' + COLORES.lineas + ';text-align:right;color:' + COLORES.tinta + ';font-size:13px;">' + r.cantidad + '</td>'
                + '<td style="padding:7px 10px;border-bottom:1px solid ' + COLORES.lineas + ';text-align:right;color:' + COLORES.tinta + ';font-size:13px;">' + fmtQ(r.total) + '</td>'
                + '<td style="padding:7px 10px;border-bottom:1px solid ' + COLORES.lineas + ';text-align:right;color:' + COLORES.gris + ';font-size:12px;">' + fmtPct(share, 1) + '</td>'
                + '</tr>';
        }).join('');

        var tablaProvHtml = filasProv.length
            ? '<div style="border:1px solid ' + COLORES.lineas + ';border-radius:8px;overflow:hidden;">'
                + '<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:' + COLORES.fondo + ';">'
                + '<th style="padding:8px 10px;text-align:left;font-size:11px;color:' + COLORES.gris + ';">#</th>'
                + '<th style="padding:8px 10px;text-align:left;font-size:11px;color:' + COLORES.gris + ';">Proveedor</th>'
                + '<th style="padding:8px 10px;text-align:right;font-size:11px;color:' + COLORES.gris + ';">Compras</th>'
                + '<th style="padding:8px 10px;text-align:right;font-size:11px;color:' + COLORES.gris + ';">Total</th>'
                + '<th style="padding:8px 10px;text-align:right;font-size:11px;color:' + COLORES.gris + ';">%</th>'
                + '</tr></thead><tbody>' + filasProv + '</tbody></table></div>'
            : '<div class="ej-sin-datos">Sin compras aprobadas en el período.</div>';

        var alertasHtml = kpis.alertas.map(function (a) {
            var color = a.nivel === 'danger' ? COLORES.alerta : a.nivel === 'warning' ? '#b67c1f' : COLORES.acento;
            var icono = a.nivel === 'danger' ? '▲' : a.nivel === 'warning' ? '⚠' : 'ℹ';
            return '<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid ' + COLORES.lineas + ';border-left:4px solid ' + color + ';border-radius:6px;margin-bottom:8px;background:' + COLORES.blanco + ';">'
                + '<span style="color:' + color + ';font-size:15px;line-height:1.2;">' + icono + '</span>'
                + '<span style="font-size:13px;color:' + COLORES.tinta + ';">' + a.texto + '</span></div>';
        }).join('');

        var cats = Object.keys(kpis.porCategoria).sort(function (a, b) { return kpis.porCategoria[b] - kpis.porCategoria[a]; }).slice(0, 8);
        var tablaRows = cats.length
            ? cats.map(function (c, i) {
                var share = kpis.totalGastos > 0 ? kpis.porCategoria[c] / kpis.totalGastos * 100 : 0;
                return '<tr>'
                    + '<td style="padding:7px 10px;border-bottom:1px solid ' + COLORES.lineas + ';color:' + COLORES.gris + ';font-size:12px;">' + (i + 1) + '</td>'
                    + '<td style="padding:7px 10px;border-bottom:1px solid ' + COLORES.lineas + ';color:' + COLORES.tinta + ';font-size:13px;font-weight:600;">' + esc(c) + '</td>'
                    + '<td style="padding:7px 10px;border-bottom:1px solid ' + COLORES.lineas + ';text-align:right;color:' + COLORES.tinta + ';font-size:13px;">' + fmtQ(kpis.porCategoria[c]) + '</td>'
                    + '<td style="padding:7px 10px;border-bottom:1px solid ' + COLORES.lineas + ';text-align:right;color:' + COLORES.gris + ';font-size:12px;">' + fmtPct(share, 1) + '</td>'
                    + '</tr>';
            }).join('')
            : '<tr><td colspan="4" style="padding:12px;color:' + COLORES.gris + ';font-size:13px;text-align:center;">Sin movimientos de gasto en el período.</td></tr>';

        return '<style>' + CSS_CORPORATIVO + '</style>'
            // ---- PORTADA / MEMBRETE ----
            + '<div class="ej-cover">'
            + '<div style="display:flex;align-items:center;gap:16px;">'
            + (portada.logo ? '<img src="' + esc(portada.logo) + '" style="height:64px;object-fit:contain;" alt="">' : '<div style="width:64px;height:64px;border-radius:12px;background:' + COLORES.primario + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;">' + (empresa.charAt(0) || 'C') + '</div>')
            + '<div><div style="font-size:11px;letter-spacing:2px;color:' + COLORES.gris + ';text-transform:uppercase;">Reporte Ejecutivo</div>'
            + '<div style="font-size:22px;font-weight:800;color:' + COLORES.tinta + ';">' + empresa + '</div>'
            + '<div style="font-size:11px;font-weight:700;color:' + COLORES.primario + ';text-transform:uppercase;letter-spacing:1px;">' + eslogan + '</div>'
            + '<div style="font-size:13px;color:' + COLORES.gris + ';">' + proyecto + '</div></div>'
            + '</div>'
            + '<div style="height:2px;background:linear-gradient(90deg,' + COLORES.primario + ',' + COLORES.acento + ');margin:14px 0 20px;"></div>'
            + '<div style="font-size:26px;font-weight:800;color:' + COLORES.primarioOsc + ';">Resumen Ejecutivo</div>'
            + '<div style="font-size:13px;color:' + COLORES.gris + ';margin:4px 0 18px;">Período: ' + rangoTxt + ' · Emitido: ' + fechaEmision + ' · Tipo: ' + tipoLbl + '</div>'
            // ---- KPIs ----
            + '<div class="ej-grid">' + kpiCards + '</div>'
            + '<div class="ej-grid" style="margin-top:10px;">' + kpiOp + '</div>'
            + '<div class="ej-grid" style="margin-top:10px;">' + kpiAdq + '</div>'
            // ---- ANÁLISIS ----
            + '<div class="ej-page-break">' + tituloSeccion('Distribución de Gastos por Categoría') + '</div>'
            + '<div style="display:flex;gap:18px;align-items:flex-start;">'
            + '<div style="flex:0 0 56%;">' + svgBarrasCategorias(kpis.porCategoria) + '</div>'
            + '<div style="flex:1;min-width:0;">' + tablaCategorias(tablaRows) + '</div>'
            + '</div>'
            + '<div class="ej-page-break" style="margin-top:20px;">' + tituloSeccion('Tendencia de Gastos Diarios') + '</div>'
            + svgTendencia(kpis.porDia)
            + '<div class="ej-page-break" style="margin-top:22px;">' + tituloSeccion('Alertas Gerenciales') + '</div>'
            + alertasHtml
            + '<div class="ej-page-break" style="margin-top:22px;">' + tituloSeccion('Resumen de Adquisiciones') + '</div>'
            + '<div class="info-box"><strong>Compras del período</strong> ' + proveedoresActivos + ' proveedor(es) activo(s) · Total: ' + fmtQ(totalCompras) + '</div>'
            + tablaProvHtml
            // ---- cierre / espacio para firma ----
            + '<div style="margin-top:48px;display:flex;justify-content:flex-end;">'
            + '<div style="text-align:center;border-top:1px solid ' + COLORES.lineas + ';padding-top:8px;width:240px;">'
            + '<div style="font-size:13px;font-weight:600;color:' + COLORES.tinta + ';">' + esc(portada.responsable || 'Gerente de Proyecto') + '</div>'
            + '<div style="font-size:11px;color:' + COLORES.gris + ';">Firma y sello</div></div></div>'
            + '<div style="margin-top:16px;padding-top:12px;border-top:1px solid ' + COLORES.lineas + ';font-size:10px;color:' + COLORES.gris + ';text-align:center;">'
            + 'Informe generado por CONSTRURAMSA · ' + empresa + ' · Documento confidencial de uso gerencial</div>'
            // ── Footer de metadata visible en el PDF generado por html2pdf ──
            // (la numeración "Página i de N" la estampa generarPDFPlantilla() via jsPDF post-render)
            + '<div class="ej-pdf-footer">'
            + '<div class="ej-footer-left">' + esc(empresa) + ' — ' + esc(eslogan)
            + '<br>' + esc(proyecto) + ' · ' + esc(rangoTxt) + '</div>'
            + '<div class="ej-footer-right">Generado: ' + esc(fechaEmision) + ' ' + esc(horaEmision)
            + '<br><span style="color:#6B7280;">Documento confidencial</span></div>'
            + '</div>'
            + '</div>';  // ← cierre de div.ej-cover
    }

    function cardKPI(titulo, valor, sub, color) {
        var c = color || COLORES.primarioOsc;
        return '<div style="flex:1;min-width:130px;background:' + COLORES.blanco + ';border:1px solid ' + COLORES.lineas + ';border-radius:10px;padding:12px 14px;border-top:3px solid ' + c + ';">'
            + '<div style="font-size:11px;color:' + COLORES.gris + ';text-transform:uppercase;letter-spacing:0.5px;">' + esc(titulo) + '</div>'
            + '<div style="font-size:20px;font-weight:800;color:' + c + ';margin-top:4px;">' + valor + '</div>'
            + '<div style="font-size:11px;color:' + COLORES.gris + ';margin-top:2px;">' + esc(sub) + '</div></div>';
    }

    function tituloSeccion(txt) {
        return '<h2 style="font-size:16px;font-weight:800;color:' + COLORES.primarioOsc + ';margin:0 0 12px;padding-bottom:6px;border-bottom:2px solid ' + COLORES.primario + ';">' + txt + '</h2>';
    }

    function tablaCategorias(rowsHtml) {
        return '<div style="border:1px solid ' + COLORES.lineas + ';border-radius:8px;overflow:hidden;">'
            + '<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:' + COLORES.fondo + ';">'
            + '<th style="padding:8px 10px;text-align:left;font-size:11px;color:' + COLORES.gris + ';">#</th>'
            + '<th style="padding:8px 10px;text-align:left;font-size:11px;color:' + COLORES.gris + ';">Categoría</th>'
            + '<th style="padding:8px 10px;text-align:right;font-size:11px;color:' + COLORES.gris + ';">Monto</th>'
            + '<th style="padding:8px 10px;text-align:right;font-size:11px;color:' + COLORES.gris + ';">%</th>'
            + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';
    }

    var CSS_CORPORATIVO =
        '@page{margin:12mm;}'
        + '@page{@bottom-left{content:"CONSTRURAMSA";font-size:8pt;color:#6B7280;}'
        + '@bottom-center{content:"Generado el " attr(data-fecha-gen);font-size:8pt;color:#6B7280;}'
        + '@bottom-right{content:counter(page) " / " counter(pages);font-size:8pt;color:#6B7280;}}'
        + '*{box-sizing:border-box;}'
        + 'body{font-family:Arial,Helvetica,sans-serif;color:#374151;margin:0;padding:0;font-size:10px;}'
        + '.ej-cover{font-family:Arial,Helvetica,sans-serif;width:100%;max-width:100%;}'
        + '.ej-grid{display:flex;flex-wrap:wrap;gap:8px;width:100%;}'
        + '.ej-grid>div{flex:1 1 140px;min-width:120px;max-width:100%;}'
        + '.ej-page-break{page-break-before:auto;break-before:auto;}'
        + 'h2{page-break-after:avoid;break-after:avoid;font-size:13px;margin:0 0 10px;}'
        + 'h3{page-break-after:avoid;break-after:avoid;font-size:11px;margin:14px 0 8px;}'
        + 'table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9px;}'
        + 'thead{display:table-header-group;}'
        + 'th{background:#004B93;color:#fff;padding:7px 8px;text-align:left;font-size:8px;font-weight:700;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
        + 'td{padding:5px 8px;border:1px solid #E5E7EB;vertical-align:middle;word-wrap:break-word;overflow-wrap:break-word;}'
        + 'tr:nth-child(even){background:#F9FAFB;}'
        + 'tr{page-break-inside:avoid;break-inside:avoid;}'
        + 'svg{max-width:100%;height:auto;}'
        + '.ej-sin-datos{color:#6B7280;font-size:11px;padding:12px;background:#F9FAFB;border:1px dashed #E5E7EB;border-radius:6px;text-align:center;}'
        + '.ej-total-row td{font-weight:700;background:#EFF6FF;border-top:2px solid #004B93;}'
        + '.ej-total-egreso{color:#DC2626;background:#FEF2F2;border-top:2px solid #DC2626;}'
        + '.ej-total-ingreso{color:#059669;background:#ECFDF5;border-top:2px solid #059669;}'
        // Footer de metadatos visible en el PDF (html2canvas renderiza vista normal, no @media print)
        + '.ej-pdf-footer{margin-top:24px;padding-top:8px;border-top:1px solid #E5E7EB;display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#6B7280;page-break-inside:avoid;break-inside:avoid;}'
        + '.ej-pdf-footer .ej-footer-left{text-align:left;}'
        + '.ej-pdf-footer .ej-footer-right{text-align:right;}'
        + '@media print{'
        + '.ej-page-break{page-break-before:always;break-before:always;}'
        + '.ej-page-break:first-child{page-break-before:avoid;break-before:avoid;}'
        + 'svg{max-width:100% !important;}'
        + '}';

    // ============================================================
    // API PÚBLICA
    // ============================================================
    var api = Object.freeze({
        calcularKPIs: calcularKPIs,
        generarHTML: generarHTML,
        svgBarrasCategorias: svgBarrasCategorias,
        svgTendencia: svgTendencia,
        COLORES: COLORES
    });

    if (globalScope) {
        try {
            Object.defineProperty(globalScope, 'CR_ReporteEjecutivo', {
                value: api,
                writable: false,
                enumerable: false,
                configurable: false
            });
        } catch (e) { /* ignorar */ }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
