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

    // --- Paleta corporativa (constantes) ---
    var COLORES = Object.freeze({
        primario: '#0f6fb5',
        primarioOsc: '#0b4f82',
        acento: '#1f9d55',
        alerta: '#d33a2c',
        tinta: '#1f2a36',
        gris: '#5b6673',
        lineas: '#dce3ea',
        fondo: '#f4f7fa',
        blanco: '#ffffff'
    });
// ============================================================
    // MOTOR DE KPIs — calcula métricas a partir de la BD real
    // ============================================================

    /**
     * Calcula los indicadores clave de gestión para el período dado.
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

        var kpis = {
            totalGastos: 0, totalIngresos: 0, saldo: 0,
            nMovimientos: 0, nGastos: 0,
            porCategoria: {}, porDia: {},
            maquinaria: { galones: 0, costoCombustible: 0, costoMantenimiento: 0, registros: 0 },
            viajes: 0,
            asistencia: { registros: 0, ausencias: 0 },
            alertas: []
        };

        var db2 = db || {};

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
                kpis.porCategoria[cat] = (kpis.porCategoria[cat] || 0) + gasto;
            }
        });
        kpis.saldo = kpis.totalIngresos - kpis.totalGastos;

        var flota = db2.maquinaria_flota || {};
        var registros = Array.isArray(flota.registros) ? flota.registros : [];
        registros.forEach(function (r) {
            if (!r) return;
            var key = fechaMov(r);
            if (!enRango(key, inicio, fin)) return;
            kpis.maquinaria.registros++;
            kpis.maquinaria.galones += num(r.combustible_galones);
            kpis.maquinaria.costoCombustible += num(r.combustible_costo);
            kpis.maquinaria.costoMantenimiento += num(r.mantenimiento_costo);
        });

        (Array.isArray((db2.viajes_camiones || {}).viajes) ? db2.viajes_camiones.viajes : [])
            .forEach(function (v) { if (v && enRango(fechaMov(v), inicio, fin)) kpis.viajes++; });

        (Array.isArray((db2.personal || {}).asistencia) ? db2.personal.asistencia : [])
            .forEach(function (a) {
                if (!a) return;
                var key = fechaMov(a);
                if (!enRango(key, inicio, fin)) return;
                kpis.asistencia.registros++;
                var estado = String(a.estado || a.asistencia || '').toLowerCase();
                if (estado.indexOf('aus') === 0 || estado === 'falta') kpis.asistencia.ausencias++;
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
            // ---- cierre / espacio para firma ----
            + '<div style="margin-top:48px;display:flex;justify-content:flex-end;">'
            + '<div style="text-align:center;border-top:1px solid ' + COLORES.lineas + ';padding-top:8px;width:240px;">'
            + '<div style="font-size:13px;font-weight:600;color:' + COLORES.tinta + ';">' + esc(portada.responsable || 'Gerente de Proyecto') + '</div>'
            + '<div style="font-size:11px;color:' + COLORES.gris + ';">Firma y sello</div></div></div>'
            + '<div style="margin-top:16px;padding-top:12px;border-top:1px solid ' + COLORES.lineas + ';font-size:10px;color:' + COLORES.gris + ';text-align:center;">'
            + 'Informe generado por CONSTRURAMSA · ' + empresa + ' · Documento confidencial de uso gerencial</div>';
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
        '.ej-cover{font-family:Arial,Helvetica,sans-serif;}'
        + 'body{font-family:Arial,Helvetica,sans-serif;color:#1f2a36;margin:0;padding:0;}'
        + '.ej-grid{display:flex;flex-wrap:wrap;gap:10px;}'
        + '.ej-page-break{page-break-before:auto;}'
        + 'h2{page-break-after:avoid;}'
        + 'tr{page-break-inside:avoid;}'
        + '.ej-sin-datos{color:#5b6673;font-size:13px;padding:14px;background:#f4f7fa;border:1px dashed #dce3ea;border-radius:6px;}';

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
