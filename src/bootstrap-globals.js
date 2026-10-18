(function (globalScope) {
  'use strict';

  // Si ya existe, no sobrescribir
  if (!globalScope) return;

  // DB cache simple en memoria + localStorage fallback
  if (typeof globalScope._dbCache === 'undefined') {
    try {
      const existing =
        typeof globalScope.localStorage !== 'undefined'
          ? localStorage.getItem('construramsa_db')
          : null;
      globalScope._dbCache = existing ? JSON.parse(existing) : {};
    } catch (e) {
      globalScope._dbCache = {};
    }
  }

  // saveDB: punto único de persistencia si no existe
  if (typeof globalScope.saveDB !== 'function') {
    globalScope.saveDB = function (db) {
      try {
        globalScope._dbCache = db || {};
        if (typeof globalScope.localStorage !== 'undefined') {
          localStorage.setItem('construramsa_db', JSON.stringify(globalScope._dbCache));
        }
      } catch (e) {
        // Silencioso: no debe romper la app
        try {
          console.warn('[bootstrap-globals] saveDB fallback error', e.message);
        } catch (_) {
          // Logging must never interrupt the persistence fallback.
        }
      }
    };
  }

  // getDB: devuelve cache o lee localStorage
  if (typeof globalScope.getDB !== 'function') {
    globalScope.getDB = function () {
      try {
        if (globalScope._dbCache && Object.keys(globalScope._dbCache).length)
          return globalScope._dbCache;
        if (typeof globalScope.localStorage !== 'undefined') {
          const raw = localStorage.getItem('construramsa_db');
          if (raw) {
            globalScope._dbCache = JSON.parse(raw);
            return globalScope._dbCache;
          }
        }
      } catch (e) {
        try {
          console.warn('[bootstrap-globals] getDB fallback error', e.message);
        } catch (_) {
          // Logging must never interrupt the database fallback.
        }
      }
      return globalScope._dbCache || {};
    };
  }

  // importarBaseDatosConFusion: simple merge si no existe
  if (typeof globalScope.importarBaseDatosConFusion !== 'function') {
    globalScope.importarBaseDatosConFusion = function (remote) {
      try {
        const local = globalScope.getDB() || {};
        // merge shallow for top-level keys; favors remote for arrays/objects
        const merged = Object.assign({}, local);
        for (const k in remote) {
          try {
            merged[k] = remote[k];
          } catch (e) {
            merged[k] = remote[k];
          }
        }
        return merged;
      } catch (e) {
        return remote || {};
      }
    };
  }

  // _nubeCfg: devuelve objeto por defecto si no configurado
  if (typeof globalScope._nubeCfg !== 'function') {
    globalScope._nubeCfg = function () {
      return {
        od_connected: false,
        od_token: null,
        od_file_id: null,
        gs_url: null,
      };
    };
  }

  // onedriveSubirAhora / onedriveDescargarSilencioso / onedriveRenovarToken — stubs
  if (typeof globalScope.onedriveSubirAhora !== 'function') {
    globalScope.onedriveSubirAhora = async function (automatic) {
      // No-op: indicate not implemented
      return false;
    };
  }
  if (typeof globalScope.onedriveDescargarSilencioso !== 'function') {
    globalScope.onedriveDescargarSilencioso = async function () {
      return null;
    };
  }
  if (typeof globalScope.onedriveRenovarToken !== 'function') {
    globalScope.onedriveRenovarToken = async function () {
      return false;
    };
  }

  // _nubeSetUltimo: persistir timestamp en config si existe
  if (typeof globalScope._nubeSetUltimo !== 'function') {
    globalScope._nubeSetUltimo = function (isoString) {
      try {
        const db = globalScope.getDB() || {};
        db.configuracion = db.configuracion || {};
        db.configuracion.nube = db.configuracion.nube || {};
        db.configuracion.nube.ultimo_respaldo = isoString;
        globalScope.saveDB(db);
      } catch (e) {
        try {
          console.warn('[bootstrap-globals] _nubeSetUltimo error');
        } catch (_) {
          // Logging must never interrupt the cloud timestamp fallback.
        }
      }
    };
  }

  // showToast: notificación accesible mínima
  if (typeof globalScope.showToast !== 'function') {
    globalScope.showToast = function (message, level = 'info', timeout = 2000) {
      try {
        // create an aria-live region if missing
        let region = document.getElementById('bootstrap-toast-region');
        if (!region) {
          region = document.createElement('div');
          region.id = 'bootstrap-toast-region';
          region.setAttribute('aria-live', 'polite');
          region.style.position = 'fixed';
          region.style.bottom = '8px';
          region.style.left = '8px';
          region.style.zIndex = 99999;
          document.body.appendChild(region);
        }
        const el = document.createElement('div');
        el.textContent = message;
        el.style.background = 'rgba(0,0,0,0.8)';
        el.style.color = '#fff';
        el.style.padding = '8px 12px';
        el.style.marginTop = '6px';
        el.style.borderRadius = '6px';
        region.appendChild(el);
        setTimeout(() => {
          try {
            region.removeChild(el);
          } catch (_) {
            // The toast may already have been removed.
          }
        }, timeout);
      } catch (e) {
        try {
          console.log(message);
        } catch (_) {
          // Console access can be unavailable in embedded browsers.
        }
      }
    };
  }

  // expose a marker
  try {
    Object.defineProperty(globalScope, 'CR_Bootstrap', {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false,
    });
  } catch (e) {
    // The marker is optional in restricted browser contexts.
  }
})(typeof window !== 'undefined' ? window : globalThis);
