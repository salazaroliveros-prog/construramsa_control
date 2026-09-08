/**
 * Build Script - CONSTRURAMSA Control de Obra v2.9.2
 * =================================================
 * Script de build que utiliza esbuild para bundling y minificación
 * de los módulos JavaScript de la aplicación.
 *
 * Ejecución: node build.js
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const DIST_DIR = path.join(__dirname, 'dist');

// Archivos JavaScript a procesar
const JS_FILES = [
  'types.js',
  'config.js',
  'reportDataAdapter.js',
  'kpiEngine.js',
  'exportador.js',
  'reporteEjecutivo.js',
  'signatureCapture.js',
  'nominaEngine.js',
  'plantillaPremium.js',
  'backgroundSync.js',
  'syncOptimizer.js',
  'silentDownload.js',
  'formValidator.js',
];

async function build() {
  console.log('🚀 Iniciando build de CONSTRURAMSA Control de Obra...');

  // Crear directorio dist si no existe
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  // Procesar cada archivo JavaScript
  for (const file of JS_FILES) {
    const inputFile = path.join(SRC_DIR, file);
    const outputFile = path.join(DIST_DIR, file.replace('.js', '.min.js'));

    if (!fs.existsSync(inputFile)) {
      console.warn(`⚠️  Archivo no encontrado: ${file}`);
      continue;
    }

    try {
      await esbuild.build({
        entryPoints: [inputFile],
        bundle: false, // No bundlear, solo minificar archivos individuales
        minify: true,
        target: 'es2015',
        outfile: outputFile,
        format: 'iife',
        sourcemap: true,
        drop: ['console', 'debugger'], // Eliminar console y debugger en producción
        treeShaking: true,
        charset: 'utf8',
      });

      console.log(`✅ ${file} → ${path.basename(outputFile)}`);
    } catch (error) {
      console.error(`❌ Error procesando ${file}:`, error.message);
      process.exit(1);
    }
  }

  // Crear bundle combinado opcional
  try {
    const bundleFile = path.join(DIST_DIR, 'bundle.min.js');
    await esbuild.build({
      entryPoints: JS_FILES.map((f) => path.join(SRC_DIR, f)),
      bundle: true,
      minify: true,
      target: 'es2015',
      outfile: bundleFile,
      format: 'iife',
      sourcemap: true,
      drop: ['console', 'debugger'],
      treeShaking: true,
      charset: 'utf8',
      external: [], // No external dependencies
    });

    console.log(`✅ Bundle combinado creado: bundle.min.js`);
  } catch (error) {
    console.warn(`⚠️  No se pudo crear bundle combinado: ${error.message}`);
  }

  // Procesar archivos HTML
  console.log('\n📄 Procesando archivos HTML...');
  const HTML_FILES = ['index.html'];
  for (const file of HTML_FILES) {
    const inputFile = path.join(__dirname, file);
    const outputFile = path.join(DIST_DIR, file);

    if (!fs.existsSync(inputFile)) {
      console.warn(`⚠️  Archivo HTML no encontrado: ${file}`);
      continue;
    }

    try {
      const htmlContent = fs.readFileSync(inputFile, 'utf8');

      // Minificar HTML básico (remover espacios en blanco, comentarios)
      const minifiedHTML = htmlContent
        .replace(/<!--[\s\S]*?-->/g, '') // Remover comentarios HTML
        .replace(/\s+/g, ' ') // Colapsar espacios múltiples
        .replace(/>\s+</g, '><') // Remover espacios entre tags
        .trim();

      fs.writeFileSync(outputFile, minifiedHTML, 'utf8');
      console.log(`✅ ${file} → ${path.basename(outputFile)} (minificado)`);
    } catch (error) {
      console.error(`❌ Error procesando ${file}:`, error.message);
      process.exit(1);
    }
  }

  // Generar reporte de tamaños
  const stats = {};
  JS_FILES.forEach((file) => {
    const minFile = path.join(DIST_DIR, file.replace('.js', '.min.js'));
    if (fs.existsSync(minFile)) {
      const originalSize = fs.statSync(path.join(SRC_DIR, file)).size;
      const minSize = fs.statSync(minFile).size;
      const reduction = ((1 - minSize / originalSize) * 100).toFixed(1);
      stats[file] = {
        original: `${(originalSize / 1024).toFixed(2)} KB`,
        minified: `${(minSize / 1024).toFixed(2)} KB`,
        reduction: `${reduction}%`,
      };
    }
  });

  // Agregar estadísticas de HTML
  HTML_FILES.forEach((file) => {
    const originalSize = fs.statSync(path.join(__dirname, file)).size;
    const minSize = fs.statSync(path.join(DIST_DIR, file)).size;
    const reduction = ((1 - minSize / originalSize) * 100).toFixed(1);
    stats[file] = {
      original: `${(originalSize / 1024).toFixed(2)} KB`,
      minified: `${(minSize / 1024).toFixed(2)} KB`,
      reduction: `${reduction}%`,
    };
  });

  console.log('\n📊 Reporte de optimización:');
  console.table(stats);

  console.log('\n✅ Build completado exitosamente!');
  console.log(`📁 Archivos generados en: ${DIST_DIR}`);
}

build().catch((error) => {
  console.error('❌ Error en build:', error);
  process.exit(1);
});
