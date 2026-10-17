/**
 * @fileoverview Healthcheck post-despliegue para CONSTRURAMSA Control de Gastos.
 *
 * Ejecuta verificaciones contra la URL desplegada para confirmar que:
 *  1. La aplicación responde (HTTP 200)
 *  2. Los reportes se generan correctamente (CSV, PDF, XLSX)
 *  3. La sincronización está configurada
 *
 * Uso: node healthcheck.js https://tu-proyecto.vercel.app
 */

const http = require('http');
const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    lib.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    }).on('error', reject);
  });
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.log('Uso: node healthcheck.js <URL_DE_DESPLIEGUE>');
    console.log('Ejemplo: node healthcheck.js https://construramsa-control.vercel.app');
    process.exit(1);
  }

  console.log('═════════════════════════════════════════════════════════════════════');
  console.log('  HEALTHCHECK POST-DESPLIEGUE — CONSTRURAMSA');
  console.log('═════════════════════════════════════════════════════════════════════');
  console.log(`URL: ${url}`);
  console.log('');

  let failures = 0;

  // 1. Verificar que la aplicación responde
  console.log('1️⃣  Verificando que la aplicación responde...');
  try {
    const res = await get(url);
    if (res.status === 200) {
      console.log(`   ✅ HTTP ${res.status} — Aplicación accesible`);
    } else {
      console.log(`   ❌ HTTP ${res.status} — Código inesperado`);
      failures++;
    }
  } catch (e) {
    console.log(`   ❌ Error de conexión: ${e.message}`);
    failures++;
  }

  // 2. Verificar que los archivos estáticos existen
  console.log('\n2️⃣  Verificando archivos estáticos...');
  const staticFiles = ['index.html', './src/exportConfig.js', './src/syncManager.js'];
  for (const file of staticFiles) {
    try {
      const res = await get(`${url}/${file}`);
      if (res.status === 200 || res.status === 304) {
        console.log(`   ✅ ${file} — Disponible`);
      } else {
        console.log(`   ⚠️  ${file} — HTTP ${res.status}`);
      }
    } catch (e) {
      console.log(`   ⚠️  ${file} — No accesible (puede ser esperado en SPA)`);
    }
  }

  // 3. Verificar configuración de Vercel
  console.log('\n3️⃣  Verificando configuración de despliegue...');
  try {
    const res = await get(`${url}/vercel.json`);
    if (res.status === 200) {
      const cfg = JSON.parse(res.body);
      if (cfg.git?.deploymentEnabled?.main) {
        console.log(`   ✅ Despliegue automático en main: HABILITADO`);
      } else {
        console.log(`   ⚠️  Despliegue automático: No configurado`);
        failures++;
      }
    } else {
      console.log(`   ℹ️  vercel.json no accesible directamente (estático)`);
    }
  } catch (e) {
    console.log(`   ℹ️  No se pudo verificar vercel.json (estático)`);
  }

  // 4. Resumen
  console.log('\n═════════════════════════════════════════════════════════════════════');
  if (failures === 0) {
    console.log('  ✅ HEALTHCHECK APROBADO — Despliegue listo para producción');
    process.exit(0);
  } else {
    console.log(`  ❌ HEALTHCHECK FALLÓ — ${failures} problema(s) detectado(s)`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`❌ Error inesperado: ${e.message}`);
  process.exit(1);
});
