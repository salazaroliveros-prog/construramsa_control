/**
 * Validación de Formularios Robusta - CONSTRURAMSA Control de Obra v2.9.2
 * ================================================================
 * Sistema de validación avanzado para formularios de la aplicación.
 * Proporciona validación de formato, reglas de negocio y feedback UX.
 *
 * Uso:
 * const validator = new FormValidator();
 * const result = validator.validate(formData, rules);
 */

(function (globalScope) {
  'use strict';

  /**
   * Validador de formularios robusto
   * @class FormValidator
   */
  class FormValidator {
    constructor() {
      this.validators = this._initializeValidators();
    }

    /**
     * Inicializa los validadores disponibles
     * @private
     */
    _initializeValidators() {
      return {
        required: (value) => ({
          valid: value !== null && value !== undefined && value !== '',
          message: 'Este campo es requerido',
        }),

        email: (value) => {
          if (!value) return { valid: true, message: '' };
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return {
            valid: emailRegex.test(value),
            message: 'Email inválido',
          };
        },

        telefono: (value) => {
          if (!value) return { valid: true, message: '' };
          // Formato guatemalteco: +502 XXXX-XXXX o XXXX-XXXX
          const telefonoRegex = /^(\+502\s?)?(\d{4}[-\s]?\d{4}|\d{8})$/;
          return {
            valid: telefonoRegex.test(value),
            message: 'Teléfono inválido (formato: +502 XXXX-XXXX o XXXX-XXXX)',
          };
        },

        monto: (value, params = {}) => {
          if (!value) return { valid: true, message: '' };
          const numValue = parseFloat(value);
          if (isNaN(numValue)) {
            return { valid: false, message: 'Monto inválido' };
          }
          if (params.min !== undefined && numValue < params.min) {
            return { valid: false, message: `Monto mínimo: Q${params.min}` };
          }
          if (params.max !== undefined && numValue > params.max) {
            return { valid: false, message: `Monto máximo: Q${params.max}` };
          }
          return { valid: true, message: '' };
        },

        fecha: (value, params = {}) => {
          if (!value) return { valid: true, message: '' };
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            return { valid: false, message: 'Fecha inválida' };
          }
          if (params.minDate) {
            const minDate = new Date(params.minDate);
            if (date < minDate) {
              return { valid: false, message: `Fecha mínima: ${params.minDate}` };
            }
          }
          if (params.maxDate) {
            const maxDate = new Date(params.maxDate);
            if (date > maxDate) {
              return { valid: false, message: `Fecha máxima: ${params.maxDate}` };
            }
          }
          return { valid: true, message: '' };
        },

        numero: (value) => {
          if (!value) return { valid: true, message: '' };
          const numRegex = /^\d+$/;
          return {
            valid: numRegex.test(value),
            message: 'Solo se permiten números',
          };
        },

        texto: (value, params = {}) => {
          if (!value) return { valid: true, message: '' };
          const minLength = params.minLength || 0;
          const maxLength = params.maxLength || 1000;

          if (value.length < minLength) {
            return { valid: false, message: `Mínimo ${minLength} caracteres` };
          }
          if (value.length > maxLength) {
            return { valid: false, message: `Máximo ${maxLength} caracteres` };
          }
          return { valid: true, message: '' };
        },

        seleccion: (value, params = {}) => {
          if (!value) return { valid: true, message: '' };
          const opciones = params.opciones || [];
          if (opciones.length > 0 && !opciones.includes(value)) {
            return { valid: false, message: 'Opción inválida' };
          }
          return { valid: true, message: '' };
        },

        stock: (value, params = {}) => {
          if (!value) return { valid: true, message: '' };
          const stock = parseInt(value);
          if (isNaN(stock) || stock < 0) {
            return { valid: false, message: 'Stock debe ser un número positivo' };
          }
          if (params.minStock !== undefined && stock < params.minStock) {
            return { valid: false, message: `Stock mínimo: ${params.minStock}` };
          }
          return { valid: true, message: '' };
        },

        placa: (value) => {
          if (!value) return { valid: true, message: '' };
          // Formato de placa guatemalteca: P-XXX-XXX o XXXXXX
          const placaRegex = /^[A-Z]{1,2}-?\d{3}-?\d{3}$|^[A-Z0-9]{6}$/;
          return {
            valid: placaRegex.test(value.toUpperCase()),
            message: 'Formato de placa inválido (ej: P-123-ABC o 123ABC)',
          };
        },
      };
    }

    /**
     * Valida un formulario completo contra reglas
     * @param {Object} formData - Datos del formulario
     * @param {Object} rules - Reglas de validación
     * @returns {Object} Resultado de validación
     */
    validate(formData, rules) {
      const errors = {};
      const warnings = {};
      let isValid = true;

      for (const field in rules) {
        const fieldRules = rules[field];
        const value = formData[field];

        for (const rule of fieldRules) {
          const validator = this.validators[rule.type];
          if (!validator) {
            console.warn(`Validador no encontrado: ${rule.type}`);
            continue;
          }

          const result = validator(value, rule.params);

          if (!result.valid) {
            isValid = false;
            if (!errors[field]) {
              errors[field] = [];
            }
            errors[field].push(result.message);
          }
        }
      }

      return {
        isValid,
        errors,
        warnings,
        firstError: this._getFirstError(errors),
      };
    }

    /**
     * Obtiene el primer error encontrado
     * @private
     */
    _getFirstError(errors) {
      for (const field in errors) {
        if (errors[field].length > 0) {
          return errors[field][0];
        }
      }
      return null;
    }

    /**
     * Valida un campo individual
     * @param {string} field - Nombre del campo
     * @param {*} value - Valor a validar
     * @param {Array} rules - Reglas de validación
     * @returns {Object} Resultado de validación
     */
    validateField(field, value, rules) {
      const errors = [];

      for (const rule of rules) {
        const validator = this.validators[rule.type];
        if (!validator) continue;

        const result = validator(value, rule.params);
        if (!result.valid) {
          errors.push(result.message);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    }

    /**
     * Sanitiza un valor para prevenir XSS
     * @param {*} value - Valor a sanitizar
     * @returns {*} Valor sanitizado
     */
    sanitize(value) {
      if (typeof value !== 'string') return value;

      // Escapar caracteres HTML peligrosos
      return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    /**
     * Formatea un error para mostrar en UI
     * @param {Object} errors - Objeto de errores
     * @returns {string} Mensaje formateado
     */
    formatErrors(errors) {
      const messages = [];
      for (const field in errors) {
        errors[field].forEach((msg) => {
          messages.push(`${field}: ${msg}`);
        });
      }
      return messages.join('\n');
    }
  }

  // Exponer la clase globalmente
  if (globalScope) {
    globalScope.FormValidator = FormValidator;
  }

  // Exponer como CommonJS para testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FormValidator;
  }

  // Exponer instancia singleton por defecto
  if (globalScope) {
    globalScope.CR_FormValidator = new FormValidator();
  }
})(typeof window !== 'undefined' ? window : globalThis);
