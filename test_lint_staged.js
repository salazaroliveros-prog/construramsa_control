/**
 * Test de lint-staged - CONSTRURAMSA Control de Obra v2.9.2
 * ===================================================
 * Valida que lint-staged esté configurado correctamente y
 * el pre-commit hook funcione.
 *
 * Ejecución: node test_lint_staged.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

console.log('[lint-staged] Iniciando validación de lint-staged...');

try {
  // Verificar que el pre-commit hook existe
  const preCommitHook = path.join(__dirname, '.husky', 'pre-commit');
  if (!fs.existsSync(preCommitHook)) {
    console.error('[lint-staged] ❌ Pre-commit hook no encontrado');
    process.exit(1);
  }
  console.log('[lint-staged] ✅ Pre-commit hook existe');

  // Verificar contenido del pre-commit hook
  const hookContent = fs.readFileSync(preCommitHook, 'utf8');
  if (!hookContent.includes('lint-staged')) {
    console.error('[lint-staged] ❌ Pre-commit hook no ejecuta lint-staged');
    process.exit(1);
  }
  console.log('[lint-staged] ✅ Pre-commit hook ejecuta lint-staged');

  // Verificar configuración de lint-staged en package.json
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  if (!packageJson['lint-staged']) {
    console.error('[lint-staged] ❌ Configuración lint-staged no encontrada en package.json');
    process.exit(1);
  }
  console.log('[lint-staged] ✅ Configuración lint-staged encontrada en package.json');

  // Verificar reglas de lint-staged
  const lintStagedConfig = packageJson['lint-staged'];
  if (!lintStagedConfig['src/**/*.js'] && !lintStagedConfig['test_*.js']) {
    console.error('[lint-staged] ❌ No hay reglas configuradas para archivos JS');
    process.exit(1);
  }
  console.log('[lint-staged] ✅ Reglas de lint-staged configuradas correctamente');

  console.log('[lint-staged] ✅ Validación completada exitosamente');
  console.log('[lint-staged] lint-staged está configurado y funcionará en commits');
  process.exit(0);
} catch (error) {
  console.error('[lint-staged] ❌ Error en validación:', error.message);
  process.exit(1);
}
