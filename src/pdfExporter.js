/**
 * @fileoverview Generador de PDF corporativo para CONSTRURAMSA.
 *
 * Captura la plantilla de impresión a un ancho fijo (independiente del viewport)
 * y pagina el canvas manualmente. Esto evita los tres fallos históricos:
 *   1. `* { max-width: 100% }` recortaba el contenedor de 210 mm en móvil.
 *   2. html2pdf añadía una página completa de holgura y dejaba hojas vacías.
 *   3. Las tablas/firmas se partían entre páginas.
 *
 * El resultado conserva el membrete, firmas y pie de la plantilla, y agrega un
 * encabezado de continuación y numeración "Página i de N" en cada hoja.
 *
 * @module pdfExporter
 */

(function (globalScope) {
  'use strict';

  const MM_A_PX = 96 / 25.4;
  const MAX_CANVAS_DIM = 16384;
  const MARGEN_SEGURIDAD_INFERIOR_MM = 2;
  const BUSQUEDA_ARRIBA_MM = 24;
  const AVANCE_MINIMO_MM = 14;

  const PAGE_SIZES_POR_DEFECTO = Object.freeze({
    a4: { ancho: 210, alto: 297 },
    letter: { ancho: 216, alto: 279 },
    oficio: { ancho: 216, alto: 330 },
    legal: { ancho: 216, alto: 356 },
  });

  const MARGENES_POR_DEFECTO = Object.freeze({
    top: 12,
    right: 12,
    bottom: 16,
    left: 12,
  });

  function numero(valor, defecto) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : defecto;
  }

  function fechaCorta(fecha) {
    const d = fecha instanceof Date ? fecha : new Date();
    try {
      return d.toLocaleDateString('es-GT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch (_e) {
      return d.toISOString().slice(0, 10);
    }
  }

  function obtenerMedidas(pageSize) {
    const cfg = globalScope.CR_ExportConfig;
    const sizes = (cfg && cfg.PAGE_SIZES) || PAGE_SIZES_POR_DEFECTO;
    const margenes = (cfg && cfg.MARGENES_PDF) || MARGENES_POR_DEFECTO;
    const hoja = sizes[pageSize] || sizes.a4 || PAGE_SIZES_POR_DEFECTO.a4;

    const ancho = numero(hoja.ancho, 210);
    const alto = numero(hoja.alto, 297);
    const izquierda = numero(margenes.left, 12);
    const derecha = numero(margenes.right, 12);
    const superior = numero(margenes.top, 12);
    const inferior = numero(margenes.bottom, 16);

    return {
      anchoHoja: ancho,
      altoHoja: alto,
      izquierda,
      derecha,
      superior,
      inferior,
      anchoContenido: Math.max(20, ancho - izquierda - derecha),
      altoContenido: Math.max(20, alto - superior - inferior - MARGEN_SEGURIDAD_INFERIOR_MM),
    };
  }

  function textoElemento(id, defecto) {
    const el = document.getElementById(id);
    if (!el) return defecto || '';
    return String(el.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function leerMetadatos(opciones, pageSize) {
    const op = opciones || {};
    const db = typeof globalScope.getDB === 'function' ? globalScope.getDB() : null;
    const cfg = (db && db.configuracion) || {};

    return {
      empresa: op.empresa || cfg.nombre_empresa || textoElemento('pdf-pie-empresa', 'CONSTRURAMSA'),
      titulo: op.titulo || textoElemento('pdf-tipo-reporte', 'Reporte'),
      proyecto: op.proyecto || textoElemento('pdf-nombre-proyecto', ''),
      fecha: op.fecha || textoElemento('pdf-fecha-emision', fechaCorta()),
      filename: op.filename || 'reporte.pdf',
      pageSize,
    };
  }

  async function esperarRecursos(contenedor) {
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (_e) {
        /* fuentes del sistema */
      }
    }

    const imagenes = Array.from(contenedor.querySelectorAll('img'));
    await Promise.all(
      imagenes.map((img) => {
        if (img.complete) {
          if (typeof img.decode === 'function') {
            return img.decode().catch(() => undefined);
          }
          return Promise.resolve();
        }
        return new Promise((resolve) => {
          const finalizar = () => resolve();
          img.addEventListener('load', finalizar, { once: true });
          img.addEventListener('error', finalizar, { once: true });
        });
      })
    );
  }

  function aplicarEstiloCaptura(el, anchoContenidoMm) {
    const set = (propiedad, valor) => el.style.setProperty(propiedad, valor, 'important');
    const ancho = anchoContenidoMm + 'mm';

    set('position', 'fixed');
    set('left', '0');
    set('top', '0');
    set('right', 'auto');
    set('bottom', 'auto');
    set('margin', '0');
    set('padding', '0');
    set('border', '0');
    set('width', ancho);
    set('min-width', ancho);
    set('max-width', 'none');
    set('min-height', '0');
    set('height', 'auto');
    set('max-height', 'none');
    set('overflow', 'visible');
    set('opacity', '1');
    set('visibility', 'visible');
    set('z-index', '9999');
    set('background', '#FFFFFF');
    set('transform', 'none');
    set('box-sizing', 'border-box');
    set('float', 'none');
  }

  function variablesPlantilla() {
    return [
      '--pdf-azul-oscuro:#004B93',
      '--pdf-azul-claro:#00A4E4',
      '--pdf-gris-oscuro:#374151',
      '--pdf-gris-medio:#6B7280',
      '--pdf-gris-borde:#E5E7EB',
      '--pdf-fondo-claro:#F9FAFB',
      '--pdf-fondo-azul:#EFF6FF',
      '--pdf-rojo:#DC2626',
      '--pdf-verde:#059669',
      '--acento-purpura:#7C3AED',
      '--pdf-blanco:#FFFFFF',
      '--pdf-gris-claro:#9CA3AF',
    ].join(';');
  }

  function inyectarEstiloClon(clonedDoc, anchoContenidoMm) {
    const style = clonedDoc.createElement('style');
    const ancho = anchoContenidoMm + 'mm';
    style.textContent =
      ':root{' +
      variablesPlantilla() +
      '}' +
      '#plantilla-reporte-impresion{' +
      'width:' +
      ancho +
      '!important;' +
      'min-width:' +
      ancho +
      '!important;' +
      'max-width:none!important;' +
      'min-height:0!important;' +
      'margin:0!important;' +
      'padding:0!important;' +
      'border:0!important;' +
      'box-sizing:border-box!important;' +
      'position:fixed!important;' +
      'left:0!important;' +
      'top:0!important;' +
      'opacity:1!important;' +
      'z-index:9999!important;' +
      'background:#FFFFFF!important;' +
      '}' +
      '#plantilla-reporte-impresion *,#plantilla-reporte-impresion *::before,#plantilla-reporte-impresion *::after{max-width:100%;}' +
      '#plantilla-reporte-impresion img{height:auto;}' +
      '@page{margin:0;}';
    clonedDoc.head.appendChild(style);

    const el = clonedDoc.getElementById('plantilla-reporte-impresion');
    if (!el) return;
    const set = (propiedad, valor) => el.style.setProperty(propiedad, valor, 'important');
    set('position', 'fixed');
    set('left', '0');
    set('top', '0');
    set('margin', '0');
    set('padding', '0');
    set('border', '0');
    set('width', ancho);
    set('min-width', ancho);
    set('max-width', 'none');
    set('min-height', '0');
    set('height', 'auto');
    set('overflow', 'visible');
    set('opacity', '1');
    set('background', '#FFFFFF');
    set('box-sizing', 'border-box');
  }

  function resolverEscala(anchoCss, altoCss) {
    let escala = 2;
    if (altoCss > 6000) escala = 1.5;
    if (altoCss > 11000) escala = 1.25;
    if (altoCss > 16000) escala = 1;
    escala = Math.min(escala, MAX_CANVAS_DIM / anchoCss, MAX_CANVAS_DIM / altoCss);
    return Math.max(0.5, escala);
  }

  function medirGeometria(el, canvas, pxPorMm, altoPaginaPx) {
    const base = el.getBoundingClientRect();
    const anchoBase = Math.max(1, el.scrollWidth || base.width);
    const ratio = canvas.width / anchoBase;
    const tablas = [];
    const intervalos = [];

    const aPx = (valorPx) => valorPx * ratio;
    const agregarIntervalo = (top, bottom, pad = 0) => {
      if (!Number.isFinite(top) || !Number.isFinite(bottom)) return;
      if (bottom - top < 1) return;
      intervalos.push({ top: top - pad, bottom: bottom + pad });
    };

    const tablasDom = Array.from(el.querySelectorAll('table'));
    tablasDom.forEach((tabla) => {
      const r = tabla.getBoundingClientRect();
      if (r.height <= 0) return;

      const top = aPx(r.top - base.top);
      const bottom = aPx(r.bottom - base.top);
      const thead = tabla.querySelector('thead');
      const hr = thead ? thead.getBoundingClientRect() : null;
      const headerTop = hr ? aPx(hr.top - base.top) : top;
      const headerBottom = hr ? aPx(hr.bottom - base.top) : top;
      const info = { top, bottom, headerTop, headerBottom };
      tablas.push(info);

      if (bottom - top <= altoPaginaPx * 0.62) {
        agregarIntervalo(top, bottom, 2);
        return;
      }

      Array.from(tabla.querySelectorAll('tr')).forEach((fila) => {
        const fr = fila.getBoundingClientRect();
        agregarIntervalo(aPx(fr.top - base.top), aPx(fr.bottom - base.top));
      });

      const primeraFilaCuerpo = tabla.querySelector('tbody tr');
      if (hr && primeraFilaCuerpo) {
        const fr = primeraFilaCuerpo.getBoundingClientRect();
        agregarIntervalo(headerTop, aPx(fr.bottom - base.top));
      }
    });

    el.querySelectorAll('.pdf-keep-together, .info-box, .alert-box, .success-box, img').forEach(
      (nodo) => {
        const r = nodo.getBoundingClientRect();
        agregarIntervalo(aPx(r.top - base.top), aPx(r.bottom - base.top), 2);
      }
    );

    el.querySelectorAll('h2, h3').forEach((titulo) => {
      const r = titulo.getBoundingClientRect();
      const top = aPx(r.top - base.top);
      const bottom = aPx(r.bottom - base.top) + 10 * pxPorMm;
      agregarIntervalo(top, bottom);
    });

    intervalos.sort((a, b) => a.top - b.top);
    const unidos = [];
    intervalos.forEach((intervalo) => {
      const ultimo = unidos[unidos.length - 1];
      if (ultimo && intervalo.top < ultimo.bottom - 1) {
        ultimo.bottom = Math.max(ultimo.bottom, intervalo.bottom);
      } else {
        unidos.push({ ...intervalo });
      }
    });

    return { tablas, intervalos: unidos };
  }

  function estaProtegido(y, intervalos) {
    return intervalos.some((intervalo) => y > intervalo.top && y < intervalo.bottom);
  }

  function filaBlanca(data, ancho, desde, fila, stepX) {
    if (fila < desde) return false;
    const offset = (fila - desde) * ancho * 4;
    if (offset >= data.length) return false;
    for (let x = 0; x < ancho; x += stepX) {
      const i = offset + x * 4;
      if (data[i + 3] < 10) continue;
      const luminancia = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      if (luminancia < 210) return false;
    }
    return true;
  }

  function buscarCorte(canvas, objetivo, inicio, pxPorMm, intervalos) {
    const avanceMinimo = Math.round(AVANCE_MINIMO_MM * pxPorMm);
    const desde = Math.max(
      inicio + avanceMinimo,
      objetivo - Math.round(BUSQUEDA_ARRIBA_MM * pxPorMm)
    );
    if (desde >= objetivo) return objetivo;

    let data;
    try {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      data = ctx.getImageData(0, desde, canvas.width, objetivo - desde + 1).data;
    } catch (_e) {
      return objetivo;
    }

    const stepX = Math.max(1, Math.floor(canvas.width / 520));
    for (let y = objetivo; y >= desde; y--) {
      if (estaProtegido(y, intervalos)) continue;
      const limpia =
        filaBlanca(data, canvas.width, desde, y, stepX) &&
        filaBlanca(data, canvas.width, desde, y - 1, stepX) &&
        filaBlanca(data, canvas.width, desde, y + 1, stepX) &&
        filaBlanca(data, canvas.width, desde, y - 2, stepX) &&
        filaBlanca(data, canvas.width, desde, y + 2, stepX);
      if (limpia) return y;
    }

    const bloque = intervalos.find(
      (intervalo) => objetivo > intervalo.top && objetivo < intervalo.bottom
    );
    if (bloque && bloque.top > inicio + avanceMinimo && bloque.top <= objetivo) {
      return Math.floor(bloque.top);
    }
    return objetivo;
  }

  function calcularCortes(canvas, altoPaginaPx, pxPorMm, tablas, intervalos) {
    const cortes = [0];
    const total = canvas.height;
    let inicio = 0;

    while (inicio < total - 1) {
      const tabla = tablas.find((t) => inicio > t.top + 1 && inicio < t.bottom - 1) || null;
      const usaEncabezado =
        tabla && inicio >= tabla.headerBottom - 1 && tabla.headerBottom - tabla.headerTop > 2;
      const altoEncabezado = usaEncabezado ? tabla.headerBottom - tabla.headerTop : 0;
      const disponible = altoPaginaPx - altoEncabezado;
      if (disponible < 40) {
        cortes.push(total);
        break;
      }

      const objetivo = inicio + disponible;
      if (objetivo >= total - 2) {
        cortes.push(total);
        break;
      }

      let corte = buscarCorte(canvas, objetivo, inicio, pxPorMm, intervalos);
      if (corte <= inicio + Math.round(8 * pxPorMm)) {
        corte = Math.round(objetivo);
      }
      if (corte >= total - 2) {
        cortes.push(total);
        break;
      }
      if (corte <= inicio) {
        cortes.push(total);
        break;
      }
      cortes.push(corte);
      inicio = corte;
    }

    if (cortes[cortes.length - 1] < total) cortes.push(total);
    return cortes;
  }

  function recortarCanvas(canvas, desdeY, alto, calidad) {
    const recorte = document.createElement('canvas');
    recorte.width = canvas.width;
    recorte.height = Math.max(1, Math.round(alto));
    const ctx = recorte.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, recorte.width, recorte.height);
    ctx.drawImage(
      canvas,
      0,
      Math.max(0, Math.round(desdeY)),
      canvas.width,
      recorte.height,
      0,
      0,
      recorte.width,
      recorte.height
    );
    return recorte.toDataURL('image/jpeg', calidad);
  }

  function dibujarEncabezadoContinuacion(pdf, meta, medidas) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(107, 114, 128);
    pdf.text(meta.empresa + ' · ' + meta.titulo, medidas.izquierda, 7.5);
    if (meta.proyecto) {
      pdf.text('Proyecto: ' + meta.proyecto, medidas.anchoHoja - medidas.derecha, 7.5, {
        align: 'right',
      });
    }
    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.2);
    pdf.line(medidas.izquierda, 9.6, medidas.anchoHoja - medidas.derecha, 9.6);
  }

  function dibujarPie(pdf, meta, medidas, pagina, totalPaginas) {
    const y = medidas.altoHoja - 7.5;
    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.2);
    pdf.line(
      medidas.izquierda,
      medidas.altoHoja - 11.5,
      medidas.anchoHoja - medidas.derecha,
      medidas.altoHoja - 11.5
    );
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    pdf.text(meta.empresa, medidas.izquierda, y);
    pdf.text(meta.fecha, medidas.anchoHoja / 2, y, { align: 'center' });
    pdf.text('Página ' + pagina + ' de ' + totalPaginas, medidas.anchoHoja - medidas.derecha, y, {
      align: 'right',
    });
  }

  async function generarPDF(contenedor, filename, opciones) {
    if (!contenedor) throw new Error('No hay contenedor de impresión para el PDF');
    if (typeof globalScope.html2pdf !== 'function') {
      throw new Error('La librería html2pdf no está disponible');
    }

    const op = opciones || {};
    const pageSize = op.pageSize || 'a4';
    const medidas = obtenerMedidas(pageSize);
    const meta = leerMetadatos(
      Object.assign({}, op, { filename: filename || op.filename }),
      pageSize
    );
    const estabaGenerando = contenedor.classList.contains('pdf-generating');
    const estiloOriginal = contenedor.getAttribute('style');

    try {
      contenedor.classList.add('pdf-generating');
      aplicarEstiloCaptura(contenedor, medidas.anchoContenido);
      await esperarRecursos(contenedor);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const anchoCss = Math.max(1, contenedor.getBoundingClientRect().width);
      const altoCss =
        Math.max(
          1,
          Math.ceil(contenedor.scrollHeight || contenedor.getBoundingClientRect().height)
        ) + 4;
      const escala = resolverEscala(anchoCss, altoCss);
      const altoMm = altoCss / MM_A_PX;
      const altoFormato = Math.min(12000, Math.max(20, altoMm + 1));
      const calidad =
        (globalScope.CR_ExportConfig &&
          globalScope.CR_ExportConfig.EXPORT_CONFIG &&
          globalScope.CR_ExportConfig.EXPORT_CONFIG.pdfImageQuality) ||
        0.95;

      const opts = {
        margin: 0,
        filename: meta.filename,
        image: { type: 'jpeg', quality: calidad },
        html2canvas: {
          scale: escala,
          useCORS: true,
          allowTaint: false,
          logging: false,
          backgroundColor: '#FFFFFF',
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0,
          width: anchoCss,
          height: altoCss,
          windowWidth: Math.max(
            1200,
            Math.ceil(anchoCss + 80),
            document.documentElement.clientWidth
          ),
          windowHeight: Math.max(altoCss + 120, document.documentElement.clientHeight),
          imageTimeout: 15000,
          onclone: function (clonedDoc) {
            inyectarEstiloClon(clonedDoc, medidas.anchoContenido);
          },
        },
        jsPDF: {
          unit: 'mm',
          format: [medidas.anchoContenido, altoFormato],
          orientation: 'portrait',
          compress: true,
        },
        pagebreak: { mode: [] },
      };

      const worker = globalScope.html2pdf().set(opts).from(contenedor);
      const pdf = await worker.toPdf().get('pdf');
      const canvas =
        (typeof worker.get === 'function' ? await worker.get('canvas') : null) ||
        (worker.prop && worker.prop.canvas);

      if (!canvas || !canvas.width || !canvas.height) {
        throw new Error('No se pudo capturar la plantilla del reporte');
      }

      const pxPorMm = canvas.width / medidas.anchoContenido;
      const altoPaginaPx = Math.floor(medidas.altoContenido * pxPorMm);
      const { tablas, intervalos } = medirGeometria(contenedor, canvas, pxPorMm, altoPaginaPx);
      const cortes = calcularCortes(canvas, altoPaginaPx, pxPorMm, tablas, intervalos);
      const totalPaginas = cortes.length - 1;

      const totalInicial = pdf.internal.getNumberOfPages();
      for (let i = totalInicial; i >= 1; i--) {
        pdf.deletePage(i);
      }

      const cacheEncabezados = new Map();
      for (let pagina = 0; pagina < totalPaginas; pagina++) {
        const desde = cortes[pagina];
        const hasta = cortes[pagina + 1];
        const alto = hasta - desde;
        if (alto <= 0) continue;

        const tabla =
          pagina > 0 ? tablas.find((t) => desde > t.top + 1 && desde < t.bottom - 1) : null;
        const usaEncabezado =
          tabla && desde >= tabla.headerBottom - 1 && tabla.headerBottom - tabla.headerTop > 2;
        const altoEncabezado = usaEncabezado ? tabla.headerBottom - tabla.headerTop : 0;

        pdf.addPage([medidas.anchoHoja, medidas.altoHoja], 'portrait');
        const indice = pdf.internal.getNumberOfPages();
        pdf.setPage(indice);

        if (pagina > 0) dibujarEncabezadoContinuacion(pdf, meta, medidas);

        let y = medidas.superior;
        if (usaEncabezado) {
          const clave = Math.round(tabla.headerTop) + ':' + Math.round(altoEncabezado);
          let encabezado = cacheEncabezados.get(clave);
          if (!encabezado) {
            encabezado = recortarCanvas(canvas, tabla.headerTop, altoEncabezado, calidad);
            cacheEncabezados.set(clave, encabezado);
          }
          pdf.addImage(
            encabezado,
            'JPEG',
            medidas.izquierda,
            y,
            medidas.anchoContenido,
            altoEncabezado / pxPorMm,
            undefined,
            'FAST'
          );
          y += altoEncabezado / pxPorMm;
        }

        const imagen = recortarCanvas(canvas, desde, alto, calidad);
        pdf.addImage(
          imagen,
          'JPEG',
          medidas.izquierda,
          y,
          medidas.anchoContenido,
          alto / pxPorMm,
          undefined,
          'FAST'
        );

        dibujarPie(pdf, meta, medidas, pagina + 1, totalPaginas);
      }

      pdf.setProperties({
        title: meta.titulo + (meta.proyecto ? ' - ' + meta.proyecto : ''),
        subject: 'Reporte de control de obra',
        author: meta.empresa,
        creator: 'CONSTRURAMSA PWA',
      });

      return pdf;
    } finally {
      if (estiloOriginal === null) {
        contenedor.removeAttribute('style');
      } else {
        contenedor.setAttribute('style', estiloOriginal);
      }
      if (!estabaGenerando) contenedor.classList.remove('pdf-generating');
    }
  }

  const api = Object.freeze({
    generarPDF,
    _privado: Object.freeze({
      obtenerMedidas,
      calcularCortes,
      buscarCorte,
      recortarCanvas,
      MM_A_PX,
    }),
  });

  if (globalScope) {
    try {
      Object.defineProperty(globalScope, 'CR_PdfExport', {
        value: api,
        writable: false,
        enumerable: false,
        configurable: false,
      });
    } catch (_e) {
      globalScope.CR_PdfExport = api;
    }
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
