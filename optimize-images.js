/**
 * Image Optimization Script - CONSTRURAMSA Control de Obra v2.9.2
 * ============================================================
 * Script que optimiza las imágenes splash del PWA usando Sharp.
 *
 * Ejecución: node optimize-images.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SPLASH_IMAGES = [
  'splash-640x1136.png',
  'splash-750x1334.png',
  'splash-1125x2436.png',
  'splash-828x1792.png',
  'splash-1242x2208.png',
  'splash-1170x2532.png',
  'splash-1284x2778.png',
  'splash-1179x2556.png',
  'splash-1290x2796.png',
  'splash-1024x1366.png',
  'splash-1536x2048.png',
  'splash-1668x2388.png',
];

const OPTIMIZED_DIR = path.join(__dirname, 'optimized-splash');

async function optimizeImages() {
  console.log('🖼️  Iniciando optimización de imágenes splash...');

  // Crear directorio para imágenes optimizadas
  if (!fs.existsSync(OPTIMIZED_DIR)) {
    fs.mkdirSync(OPTIMIZED_DIR, { recursive: true });
  }

  const stats = {};

  for (const image of SPLASH_IMAGES) {
    const inputPath = path.join(__dirname, image);
    const outputPath = path.join(OPTIMIZED_DIR, image);

    if (!fs.existsSync(inputPath)) {
      console.warn(`⚠️  Imagen no encontrada: ${image}`);
      continue;
    }

    try {
      const originalSize = fs.statSync(inputPath).size;

      // Optimizar imagen con Sharp
      await sharp(inputPath)
        .png({ quality: 85, compressionLevel: 9 }) // Alta compresión PNG
        .toFile(outputPath);

      const optimizedSize = fs.statSync(outputPath).size;
      const reduction = ((1 - optimizedSize / originalSize) * 100).toFixed(1);

      stats[image] = {
        original: `${(originalSize / 1024).toFixed(2)} KB`,
        optimized: `${(optimizedSize / 1024).toFixed(2)} KB`,
        reduction: `${reduction}%`,
      };

      console.log(`✅ ${image} optimizado (${reduction}% reducción)`);
    } catch (error) {
      console.error(`❌ Error optimizando ${image}:`, error.message);
    }
  }

  console.log('\n📊 Reporte de optimización:');
  console.table(stats);

  const totalOriginal = Object.values(stats).reduce((sum, stat) => {
    return sum + parseFloat(stat.original);
  }, 0);

  const totalOptimized = Object.values(stats).reduce((sum, stat) => {
    return sum + parseFloat(stat.optimized);
  }, 0);

  const totalReduction = ((1 - totalOptimized / totalOriginal) * 100).toFixed(1);

  console.log(`\n📈 Resumen:`);
  console.log(`   Total original: ${totalOriginal.toFixed(2)} KB`);
  console.log(`   Total optimizado: ${totalOptimized.toFixed(2)} KB`);
  console.log(`   Reducción total: ${totalReduction}%`);

  console.log(`\n✅ Optimización completada!`);
  console.log(`📁 Imágenes optimizadas en: ${OPTIMIZED_DIR}`);
  console.log(
    `\n💡 Para usar las imágenes optimizadas, reemplaza las originales con las de ${OPTIMIZED_DIR}`
  );
}

optimizeImages().catch((error) => {
  console.error('❌ Error en optimización:', error);
  process.exit(1);
});
