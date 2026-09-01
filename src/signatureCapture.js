/**
 * @fileoverview Módulo de Captura de Firma Digital para CONSTRURAMSA.
 *
 * Componente reutilizable de firma digital basado en HTML5 Canvas que funciona
 * completamente offline. Optimizado para dispositivos táctiles (Android/iOS)
 * y exportación a PDF.
 *
 * Características:
 * - Dibujo suave con suavizado de líneas
 * - Soporte multi-touch (evita firmas multi-dedo accidentales)
 * - Optimizado para móviles (previene scroll mientras se firma)
 * - Exportación a base64 para almacenamiento
 * - Integración con sistema de exportación PDF existente
 *
 * Se expone como `window.CR_SignatureCapture` (IIFE, sin fuga de globales).
 *
 * @module signatureCapture
 */

(function (globalScope) {
    'use strict';

    /**
     * Crea un componente de captura de firma en el contenedor especificado.
     * @param {string} containerId - ID del elemento contenedor
     * @param {Object} options - Opciones de configuración
     * @param {string} [options.width='100%'] - Ancho del canvas
     * @param {string} [options.height='150px'] - Alto del canvas
     * @param {string} [options.lineColor='#000000'] - Color del trazo
     * @param {number} [options.lineWidth=2] - Grosor del trazo
     * @param {string} [options.backgroundColor='#ffffff'] - Color de fondo
     * @param {Function} [options.onSignatureChange] - Callback cuando cambia la firma
     * @returns {Object} Instancia del componente con métodos de control
     */
    function createSignatureCapture(containerId, options) {
        options = options || {};
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Contenedor no encontrado:', containerId);
            return null;
        }

        const config = {
            width: options.width || '100%',
            height: options.height || '150px',
            lineColor: options.lineColor || '#000000',
            lineWidth: options.lineWidth || 2,
            backgroundColor: options.backgroundColor || '#ffffff',
            onSignatureChange: options.onSignatureChange || null
        };

        // Crear estructura HTML del componente
        const wrapper = document.createElement('div');
        wrapper.className = 'signature-wrapper';
        wrapper.innerHTML = `
            <div class="signature-canvas-container" style="touch-action: none;">
                <canvas id="signature-canvas-${containerId}" style="width: ${config.width}; height: ${config.height}; background-color: ${config.backgroundColor}; border: 2px dashed #ccc; border-radius: 8px; cursor: crosshair;"></canvas>
                <div class="signature-placeholder" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #999; pointer-events: none; font-size: 14px;">
                    👆 Firme aquí
                </div>
            </div>
            <div class="signature-controls" style="margin-top: 10px; display: flex; gap: 10px;">
                <button type="button" class="btn-limpiar-firma btn-secundario" style="flex: 1; padding: 8px 12px; font-size: 12px;">🗑️ Limpiar</button>
            </div>
        `;

        container.appendChild(wrapper);

        const canvas = wrapper.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        const placeholder = wrapper.querySelector('.signature-placeholder');
        const limpiarBtn = wrapper.querySelector('.btn-limpiar-firma');

        // Configurar canvas para alta resolución
        function setupCanvas() {
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            
            ctx.scale(dpr, dpr);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = config.lineColor;
            ctx.lineWidth = config.lineWidth;
        }

        setupCanvas();

        // Estado del dibujo
        let isDrawing = false;
        let lastX = 0;
        let lastY = 0;
        let hasSignature = false;
        let activePointerId = null; // Para soporte multi-touch

        // Obtener coordenadas del evento
        function getCoordinates(e) {
            const rect = canvas.getBoundingClientRect();
            let clientX, clientY;

            if (e.touches && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }

            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        }

        // Iniciar dibujo
        function startDrawing(e) {
            e.preventDefault();
            
            // Soporte multi-touch: solo permitir un dedo a la vez
            if (e.pointerId !== undefined) {
                if (activePointerId !== null && activePointerId !== e.pointerId) {
                    return; // Ignorar segundo dedo
                }
                activePointerId = e.pointerId;
            }

            isDrawing = true;
            const coords = getCoordinates(e);
            lastX = coords.x;
            lastY = coords.y;
            
            placeholder.style.display = 'none';
        }

        // Dibujar
        function draw(e) {
            if (!isDrawing) return;
            e.preventDefault();

            // Verificar que es el mismo pointer (multi-touch)
            if (e.pointerId !== undefined && e.pointerId !== activePointerId) {
                return;
            }

            const coords = getCoordinates(e);
            
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(coords.x, coords.y);
            ctx.stroke();

            lastX = coords.x;
            lastY = coords.y;
            hasSignature = true;
        }

        // Detener dibujo
        function stopDrawing(e) {
            if (isDrawing) {
                isDrawing = false;
                activePointerId = null;
                
                if (config.onSignatureChange && hasSignature) {
                    config.onSignatureChange(getSignatureData());
                }
            }
        }

        // Event listeners para mouse
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);

        // Event listeners para touch (móvil)
        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDrawing);
        canvas.addEventListener('touchcancel', stopDrawing);

        // Event listeners para pointer (moderno)
        canvas.addEventListener('pointerdown', startDrawing);
        canvas.addEventListener('pointermove', draw);
        canvas.addEventListener('pointerup', stopDrawing);
        canvas.addEventListener('pointercancel', stopDrawing);

        // Limpiar firma
        function clearSignature() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            placeholder.style.display = 'block';
            hasSignature = false;
            activePointerId = null;
            
            if (config.onSignatureChange) {
                config.onSignatureChange(null);
            }
        }

        limpiarBtn.addEventListener('click', clearSignature);

        // Obtener datos de firma (base64)
        function getSignatureData() {
            if (!hasSignature) return null;
            return canvas.toDataURL('image/png');
        }

        // Establecer firma desde datos base64
        function setSignatureData(dataUrl) {
            if (!dataUrl) {
                clearSignature();
                return;
            }

            const img = new Image();
            img.onload = function() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
                placeholder.style.display = 'none';
                hasSignature = true;
                
                if (config.onSignatureChange) {
                    config.onSignatureChange(dataUrl);
                }
            };
            img.src = dataUrl;
        }

        // Verificar si hay firma
        function hasSignatureData() {
            return hasSignature;
        }

        // Redimensionar canvas cuando cambia el tamaño de ventana
        window.addEventListener('resize', function() {
            const currentData = getSignatureData();
            setupCanvas();
            if (currentData) {
                setSignatureData(currentData);
            }
        });

        // API pública del componente
        return {
            clear: clearSignature,
            getData: getSignatureData,
            setData: setSignatureData,
            hasData: hasSignatureData,
            canvas: canvas
        };
    }

    /**
     * API pública del módulo.
     */
    const api = Object.freeze({
        create: createSignatureCapture
    });

    /**
     * Exposición en navegador: un único global congelado.
     */
    if (globalScope) {
        try {
            Object.defineProperty(globalScope, 'CR_SignatureCapture', {
                value: api,
                writable: false,
                enumerable: false,
                configurable: false
            });
        } catch (e) {
            /* Entornos restringidos */
        }
    }

    /**
     * Exposición CommonJS para testing.
     */
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);