/**
 * test_sandbox.js — Aislamiento de la base de datos para las suites de prueba.
 * ============================================================================
 * Problema que resuelve
 * --------------------
 * Varias suites (`test_database_operations`, `test_database_connection`,
 * `test_reports_completos`, `functional_test`, `run_e2e_validation`) necesitan
 * ESCRIBIR en la base de datos para poder ejercitar el CRUD. Todas apuntaban
 * directamente a `construramsa_db.json`, que es un archivo versionado en git.
 * Eso producía dos fallos reales:
 *
 *   1. Si el proceso se interrumpía (Ctrl-C, timeout del runner, excepción), el
 *      `restoreDB()` del final nunca llegaba a ejecutarse y la semilla quedaba
 *      reemplazada por el fixture de prueba. El siguiente `git commit` se
 *      llevaba el fixture por delante sin que nadie lo notara.
 *   2. Dos suites ejecutadas en paralelo (o una suite y el runner de CI)
 *      escriben sobre el MISMO archivo: el backup de una restaura el estado
 *      que la otra está usando a medio test y ambas fallan de forma
 *      inexplicable ("Cannot read properties of undefined").
 *
 * Solución
 * --------
 * Cada suite trabaja sobre una COPIA en el directorio temporal del sistema,
 * con nombre único por proceso. La semilla versionada nunca se abre en modo
 * escritura, así que no hay estado que restaurar y las suites pueden correr en
 * paralelo sin colisionar.
 *
 * Uso
 * ---
 *   const { createSandbox } = require('./test_sandbox');
 *   const sandbox = createSandbox('db-ops');   // copia la semilla
 *   const DB_FILE = sandbox.dbPath;            // usar en lugar de la semilla
 *   ...
 *   sandbox.cleanup();                         // en el `finally`
 *
 * @module test_sandbox
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const SEED_DB = path.join(__dirname, 'construramsa_db.json');

/**
 * Crea un directorio temporal aislado con una copia de la semilla.
 *
 * @param {string} [label]  Sufijo identificador de la suite (para depurar).
 * @returns {{dir: string, dbPath: string, cleanup: () => void}}
 */
function createSandbox(label = 'sandbox') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `construramsa-${label}-`));
  const dbPath = path.join(dir, 'construramsa_db.json');

  if (fs.existsSync(SEED_DB)) {
    fs.copyFileSync(SEED_DB, dbPath);
  }

  let cleaned = false;
  return {
    dir,
    dbPath,
    /** Elimina el directorio temporal. Es idempotente y nunca lanza. */
    cleanup() {
      if (cleaned) return;
      cleaned = true;
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (e) {
        /* el temporal puede estar bloqueado en Windows; no es crítico */
      }
    },
  };
}

module.exports = { createSandbox, SEED_DB };
