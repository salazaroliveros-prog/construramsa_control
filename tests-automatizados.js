const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuracion
const URL_LOCAL = 'file://' + path.join(__dirname, 'index.html');
const URL_PRODUCCION = 'https://control-obra-construramsa-proyectoswm.vercel.app';
const USAR_PRODUCCION = false; // Cambiar a false para probar localmente
const BASE_URL = USAR_PRODUCCION ? URL_PRODUCCION : URL_LOCAL;
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Crear directorio de screenshots
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Funcion para tomar screenshot
async function tomarScreenshot(page, nombre, contexto = '') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const contextoStr = contexto ? `_${contexto}` : '';
    const filename = `${nombre}${contextoStr}_${timestamp}.png`;
    const filepath = path.join(SCREENSHOTS_DIR, filename);
    
    await page.screenshot({ 
        path: filepath, 
        fullPage: true 
    });
    
    console.log(`Screenshot guardado: ${filename}`);
    return filepath;
}

// Funcion para esperar un elemento
async function esperarElemento(page, selector, timeout = 5000) {
    try {
        await page.waitForSelector(selector, { timeout });
        return true;
    } catch (error) {
        console.log(`Elemento no encontrado: ${selector}`);
        return false;
    }
}

// Funcion para ejecutar prueba
async function ejecutarPrueba(nombre, funcionPrueba) {
    console.log(`\nEjecutando: ${nombre}`);
    try {
        await funcionPrueba();
        console.log(`${nombre}: PASO`);
        return true;
    } catch (error) {
        console.log(`${nombre}: FALLO - ${error.message}`);
        return false;
    }
}

// Pruebas automatizadas
const pruebas = [
    {
        nombre: 'Carga de pagina',
        funcion: async (page) => {
            await page.goto(BASE_URL);
            await page.waitForTimeout(2000);
            await tomarScreenshot(page, '01_carga_pagina');
        }
    },
    {
        nombre: 'Scroll vertical',
        funcion: async (page) => {
            await page.evaluate(() => {
                window.scrollTo(0, 0);
            });
            await page.waitForTimeout(500);
            await tomarScreenshot(page, '02_scroll_inicio');
            
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });
            await page.waitForTimeout(500);
            await tomarScreenshot(page, '03_scroll_fin');
            
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight / 2);
            });
            await page.waitForTimeout(500);
            await tomarScreenshot(page, '04_scroll_medio');
        }
    },
    {
        nombre: 'Scroll horizontal en tabs',
        funcion: async (page) => {
            const tabs = await page.$('.nav-tabs');
            if (tabs) {
                await tabs.scrollIntoViewIfNeeded();
                await page.waitForTimeout(500);
                await tomarScreenshot(page, '05_tabs_inicio');
                
                await page.evaluate((el) => {
                    el.scrollLeft = el.scrollWidth;
                }, tabs);
                await page.waitForTimeout(500);
                await tomarScreenshot(page, '06_tabs_fin');
            }
        }
    },
    {
        nombre: 'Navegacion entre modulos',
        funcion: async (page) => {
            const modulos = ['resumen', 'caja-chica', 'maquinaria', 'personal', 'adquisiciones', 'viajes', 'mantenimiento', 'reportes', 'configuracion'];
            
            for (let i = 0; i < modulos.length; i++) {
                const selector = `[data-module="${modulos[i]}"]`;
                const elemento = await page.$(selector);
                if (elemento) {
                    await elemento.click();
                    await page.waitForTimeout(500);
                    await esperarElemento(page, '.module.active');
                    await tomarScreenshot(page, `07_modulo_${i + 1}_${modulos[i].replace('-', '_')}`);
                }
            }
        }
    },
    {
        nombre: 'Modulo Resumen/Dashboard',
        funcion: async (page) => {
            await page.click('[data-module="resumen"]');
            await page.waitForTimeout(1000);
            await esperarElemento(page, '.module.active');
            await tomarScreenshot(page, '08_dashboard');
        }
    },
    {
        nombre: 'Modulo Caja Chica',
        funcion: async (page) => {
            await page.click('[data-module="caja-chica"]');
            await page.waitForTimeout(1000);
            await esperarElemento(page, '.module.active');
            await tomarScreenshot(page, '10_caja_chica');
            
            await esperarElemento(page, '#caja-fecha');
            await tomarScreenshot(page, '11_caja_chica_formulario');
        }
    },
    {
        nombre: 'Modulo Maquinaria',
        funcion: async (page) => {
            await page.click('[data-module="maquinaria"]');
            await page.waitForTimeout(1000);
            await esperarElemento(page, '.module.active');
            await tomarScreenshot(page, '12_maquinaria');
        }
    },
    {
        nombre: 'Modulo Personal',
        funcion: async (page) => {
            await page.click('[data-module="personal"]');
            await page.waitForTimeout(1000);
            await esperarElemento(page, '.module.active');
            await tomarScreenshot(page, '13_personal');
        }
    },
    {
        nombre: 'Modulo Viajes',
        funcion: async (page) => {
            await page.click('[data-module="viajes"]');
            await page.waitForTimeout(1000);
            await esperarElemento(page, '.module.active');
            await tomarScreenshot(page, '14_viajes');
        }
    },
    {
        nombre: 'Modulo Mantenimiento',
        funcion: async (page) => {
            await page.click('[data-module="mantenimiento"]');
            await page.waitForTimeout(1000);
            await esperarElemento(page, '.module.active');
            await tomarScreenshot(page, '15_mantenimiento');
            
            await esperarElemento(page, '#btn-iniciar-camara');
            await tomarScreenshot(page, '16_mantenimiento_camara');
        }
    },
    {
        nombre: 'Modulo Reportes',
        funcion: async (page) => {
            await page.click('[data-module="reportes"]');
            await page.waitForTimeout(1000);
            await esperarElemento(page, '.module.active');
            await tomarScreenshot(page, '17_reportes');
        }
    },
    {
        nombre: 'Modulo Configuracion',
        funcion: async (page) => {
            await page.click('[data-module="configuracion"]');
            await page.waitForTimeout(1000);
            await esperarElemento(page, '.module.active');
            await tomarScreenshot(page, '22_configuracion');
        }
    },
    {
        nombre: 'Responsive Desktop (1920x1080)',
        funcion: async (page) => {
            await page.setViewportSize({ width: 1920, height: 1080 });
            await page.goto(BASE_URL);
            await page.waitForLoadState('networkidle');
            await tomarScreenshot(page, '23_responsive_desktop');
        }
    },
    {
        nombre: 'Responsive Tablet (768x1024)',
        funcion: async (page) => {
            await page.setViewportSize({ width: 768, height: 1024 });
            await page.goto(BASE_URL);
            await page.waitForLoadState('networkidle');
            await tomarScreenshot(page, '24_responsive_tablet');
        }
    },
    {
        nombre: 'Responsive Movil (375x667)',
        funcion: async (page) => {
            await page.setViewportSize({ width: 375, height: 667 });
            await page.goto(BASE_URL);
            await page.waitForLoadState('networkidle');
            await tomarScreenshot(page, '25_responsive_movil');
        }
    },
    {
        nombre: 'Responsive Movil Pequeno (360x640)',
        funcion: async (page) => {
            await page.setViewportSize({ width: 360, height: 640 });
            await page.goto(BASE_URL);
            await page.waitForTimeout(2000);
            await tomarScreenshot(page, '26_responsive_movil_pequeno');
        }
    }
];

// Funcion principal
async function ejecutarTodasLasPruebas() {
    console.log('Iniciando pruebas automatizadas...');
    console.log(`URL: ${BASE_URL}`);
    console.log(`Screenshots: ${SCREENSHOTS_DIR}`);
    
    const browser = await chromium.launch({
        headless: false,
        slowMo: 500
    });
    
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    
    const page = await context.newPage();
    
    try {
        let pasadas = 0;
        let fallidas = 0;
        
        for (const prueba of pruebas) {
            try {
                const resultado = await ejecutarPrueba(prueba.nombre, () => prueba.funcion(page));
                if (resultado) pasadas++;
                else fallidas++;
            } catch (error) {
                console.log(`${prueba.nombre}: FALLO - ${error.message}`);
                fallidas++;
            }
        }
        
        console.log('\nRESUMEN DE PRUEBAS');
        console.log(`Pasadas: ${pasadas}/${pruebas.length}`);
        console.log(`Fallidas: ${fallidas}/${pruebas.length}`);
        console.log(`Screenshots guardados en: ${SCREENSHOTS_DIR}`);
        
        const reporte = `
# Reporte de Pruebas Automatizadas

**Fecha**: ${new Date().toLocaleString('es-GT')}
**URL**: ${BASE_URL}
**Screenshots**: ${SCREENSHOTS_DIR}

## Resultados
- **Pruebas Ejecutadas**: ${pruebas.length}
- **Pruebas Pasadas**: ${pasadas}
- **Pruebas Fallidas**: ${fallidas}
- **Tasa de Exito**: ${((pasadas / pruebas.length) * 100).toFixed(1)}%

## Screenshots Generados
Ver directorio: ${SCREENSHOTS_DIR}

---
`;
        
        fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'REPORTE.md'), reporte);
        console.log('Reporte generado: REPORTE.md');
        
    } catch (error) {
        console.error('Error en ejecucion de pruebas:', error);
    } finally {
        try {
            await context.close();
            await browser.close();
        } catch (e) {
            console.log('Error al cerrar browser:', e.message);
        }
    }
}

// Ejecutar pruebas
ejecutarTodasLasPruebas().catch(console.error);
