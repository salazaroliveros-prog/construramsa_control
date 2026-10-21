/**
 * @fileoverview Persistencia robusta para CONSTRURAMSA Control de Obra.
 *
 * Estrategia:
 *  - IndexedDB como almacenamiento principal (sobrevive a cierres de PWA y
 *    perfiles aislados en Windows).
 *  - localStorage como caché/fallback rápido.
 *  - Respaldo local automático en archivo JSON del mismo directorio.
 *
 * @module persistence
 * @version 2.9.5
 */
(function (globalScope) {
  'use strict';

  const DB_KEY = 'construramsa_db';
  const DB_BACKUP_KEY = 'construramsa_preimport_backup';
  const IDB_NAME = 'construramsa_control_obra';
  const IDB_STORE = 'database';
  const IDB_VERSION = 1;

  function isIdbAvailable() {
    try {
      return typeof indexedDB !== 'undefined' && typeof indexedDB.open === 'function';
    } catch (e) {
      return false;
    }
  }

  function openIdb() {
    return new Promise((resolve, reject) => {
      if (!isIdbAvailable()) {
        return reject(new Error('IndexedDB no disponible'));
      }
      const request = indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
    });
  }

  async function idbGet(db, key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const request = store.get(key);
      request.onerror = () => reject(request.error || new Error('IDB get failed'));
      request.onsuccess = () => resolve(request.result ?? null);
    });
  }

  async function idbSet(db, key, value) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const request = store.put(value, key);
      request.onerror = () => reject(request.error || new Error('IDB put failed'));
      request.onsuccess = () => resolve();
    });
  }

  async function idbDelete(db, key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const request = store.delete(key);
      request.onerror = () => reject(request.error || new Error('IDB delete failed'));
      request.onsuccess = () => resolve();
    });
  }

  async function writeLocalBackup(db) {
    try {
      const serialized = JSON.stringify(db);
      // Guardar copia en la clave de respaldo específica además de la clave normal.
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(DB_BACKUP_KEY, serialized);
        } catch (e) {
          // Puede fallar en entornos con storage lleno/restringido
          console.warn('[persistence] No se pudo escribir DB_BACKUP_KEY en localStorage:', e);
        }
        try {
          localStorage.setItem(DB_KEY, serialized);
        } catch (e) {
          console.warn('[persistence] No se pudo escribir DB_KEY en localStorage:', e);
        }
      }
      if (
        typeof globalScope !== 'undefined' &&
        typeof globalScope.Blob !== 'undefined' &&
        typeof globalScope.URL !== 'undefined' &&
        typeof globalScope.document !== 'undefined'
      ) {
        const blob = new Blob([serialized], { type: 'application/json' });
        const url = globalScope.URL.createObjectURL(blob);
        const a = globalScope.document.createElement('a');
        a.href = url;
        a.download = 'construramsa_db.local.json';
        a.style.display = 'none';
        globalScope.document.body.appendChild(a);
        a.click();
        globalScope.document.body.removeChild(a);
        globalScope.URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.warn('[persistence] No se pudo escribir el respaldo local:', e);
    }
  }

  async function readLocalBackup() {
    try {
      if (typeof localStorage !== 'undefined') {
        // Preferir la clave de respaldo específica si existe
        const backup = localStorage.getItem(DB_BACKUP_KEY);
        if (backup) return JSON.parse(backup);
        const normal = localStorage.getItem(DB_KEY);
        if (normal) return JSON.parse(normal);
      }
    } catch (e) {
      console.warn('[persistence] No se pudo leer localStorage:', e);
    }
    return null;
  }

  function writeLocalStorage(db) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DB_KEY, JSON.stringify(db));
        return true;
      }
    } catch (e) {
      console.warn('[persistence] No se pudo escribir en localStorage:', e);
    }
    return false;
  }

  async function writeIdb(db) {
    // Espejo síncrono en localStorage (fallback rápido) sin descargar archivos.
    writeLocalStorage(db);
    if (!isIdbAvailable()) {
      return false;
    }
    try {
      const idb = await openIdb();
      await idbSet(idb, DB_KEY, db);
      return true;
    } catch (e) {
      console.warn('[persistence] No se pudo escribir IndexedDB:', e);
      return false;
    }
  }

  async function readIdb() {
    if (!isIdbAvailable()) {
      return readLocalBackup();
    }
    try {
      const idb = await openIdb();
      const value = await idbGet(idb, DB_KEY);
      if (value !== null) {
        return value;
      }
    } catch (e) {
      console.warn('[persistence] Fallo leyendo IndexedDB, usando fallback:', e);
    }
    return readLocalBackup();
  }

  async function deleteIdb() {
    if (!isIdbAvailable()) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(DB_KEY);
        localStorage.removeItem(DB_BACKUP_KEY);
      }
      return;
    }
    try {
      const idb = await openIdb();
      await idbDelete(idb, DB_KEY);
    } catch (e) {
      console.warn('[persistence] No se pudo borrar IndexedDB:', e);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(DB_KEY);
      localStorage.removeItem(DB_BACKUP_KEY);
    }
  }

  const api = Object.freeze({
    DB_KEY,
    DB_BACKUP_KEY,
    isIdbAvailable,
    writeLocalBackup,
    readLocalBackup,
    writeLocalStorage,
    writeIdb,
    readIdb,
    deleteIdb,
  });

  if (globalScope) {
    try {
      Object.defineProperty(globalScope, 'CR_Persistence', {
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
