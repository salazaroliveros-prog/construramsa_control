/**
 * Verificación Funcional de Todos los Módulos
 * 
 * Este script verifica que cada módulo de la aplicación funcione correctamente:
 * - Caja Chica
 * - Maquinaria
 * - Personal
 * - Adquisiciones
 * - Viajes
 * - Mantenimiento
 * - Reportes
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'construramsa_db.json');
const BACKUP_PATH = path.join(__dirname, 'construramsa_db.json.backup_verification');

// Colores para consola
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// Resultados de pruebas
const results = {
    passed: 0,
    failed: 0,
    tests: []
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function test(name, passed, details = '') {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const color = passed ? 'green' : 'red';
    log(`${status} - ${name}`, color);
    if (details) {
        log(`  ${details}`, 'yellow');
    }
    results.tests.push({ name, passed, details });
    if (passed) {
        results.passed++;
    } else {
        results.failed++;
    }
}

// Hacer backup de la base de datos
function backupDatabase() {
    if (fs.existsSync(DB_PATH)) {
        fs.copyFileSync(DB_PATH, BACKUP_PATH);
        log('Base de datos respaldada', 'cyan');
    }
}

// Restaurar base de datos
function restoreDatabase() {
    if (fs.existsSync(BACKUP_PATH)) {
        fs.copyFileSync(BACKUP_PATH, DB_PATH);
        log('Base de datos restaurada', 'cyan');
    }
}

// Leer base de datos
function readDatabase() {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return null;
    }
}

// Escribir base de datos
function writeDatabase(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Hacer petición HTTP
function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: '127.0.0.1',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

// Verificar servidor está corriendo
async function checkServer() {
    try {
        const response = await makeRequest('/');
        test('Servidor corriendo', response.status === 200);
        return true;
    } catch (error) {
        test('Servidor corriendo', false, error.message);
        return false;
    }
}

// Verificar módulo Caja Chica
async function testCajaChica() {
    log('\n=== Probando Módulo Caja Chica ===', 'cyan');
    
    const db = readDatabase();
    if (!db) {
        test('Leer base de datos', false, 'No se pudo leer la base de datos');
        return;
    }
    
    test('Estructura de configuración existe', !!db.configuracion);
    test('Estructura proyectos_data existe', !!db.proyectos_data);
    
    const proyectos = db.proyectos || [];
    if (proyectos.length === 0) {
        test('Proyectos existentes', false, 'No hay proyectos en db.proyectos');
        return;
    }
    
    test('Proyectos existentes', true, `${proyectos.length} proyectos en db.proyectos`);
    
    const primerProyecto = proyectos[0];
    const proyectoData = db.proyectos_data[primerProyecto.id];
    
    if (proyectoData) {
        test('Datos de proyecto existen', true);
        test('Estructura caja_chica existe', !!proyectoData.caja_chica);
        test('Movimientos de caja', Array.isArray(proyectoData.caja_chica));
    } else {
        test('Datos de proyecto existen', false, 'No hay datos para el primer proyecto');
    }
}

// Verificar módulo Maquinaria
async function testMaquinaria() {
    log('\n=== Probando Módulo Maquinaria ===', 'cyan');
    
    const db = readDatabase();
    if (!db) return;
    
    const proyectos = db.configuracion.proyectos || [];
    if (proyectos.length === 0) return;
    
    const primerProyecto = proyectos[0];
    const proyectoData = db.proyectos_data[primerProyecto.id];
    
    if (proyectoData) {
        test('Estructura maquinaria_flota existe', !!proyectoData.maquinaria_flota);
        
        if (proyectoData.maquinaria_flota) {
            test('Vehículos definidos', Array.isArray(proyectoData.maquinaria_flota.vehiculos));
            test('Registros de maquinaria', Array.isArray(proyectoData.maquinaria_flota.registros));
        }
    }
}

// Verificar módulo Personal
async function testPersonal() {
    log('\n=== Probando Módulo Personal ===', 'cyan');
    
    const db = readDatabase();
    if (!db) return;
    
    const proyectos = db.configuracion.proyectos || [];
    if (proyectos.length === 0) return;
    
    const primerProyecto = proyectos[0];
    const proyectoData = db.proyectos_data[primerProyecto.id];
    
    if (proyectoData) {
        test('Estructura personal existe', !!proyectoData.personal);
        
        if (proyectoData.personal) {
            test('Trabajadores definidos', Array.isArray(proyectoData.personal.trabajadores));
            test('Registros de asistencia', Array.isArray(proyectoData.personal.asistencia));
        }
    }
}

// Verificar módulo Adquisiciones
async function testAdquisiciones() {
    log('\n=== Probando Módulo Adquisiciones ===', 'cyan');
    
    const db = readDatabase();
    if (!db) return;
    
    const proyectos = db.configuracion.proyectos || [];
    if (proyectos.length === 0) return;
    
    const primerProyecto = proyectos[0];
    const proyectoData = db.proyectos_data[primerProyecto.id];
    
    if (proyectoData) {
        test('Estructura adquisiciones existe', !!proyectoData.adquisiciones);
        
        if (proyectoData.adquisiciones) {
            test('Proveedores definidos', Array.isArray(proyectoData.adquisiciones.proveedores));
            test('Cotizaciones registradas', Array.isArray(proyectoData.adquisiciones.cotizaciones));
        }
    }
}

// Verificar módulo Viajes
async function testViajes() {
    log('\n=== Probando Módulo Viajes ===', 'cyan');
    
    const db = readDatabase();
    if (!db) return;
    
    const proyectos = db.configuracion.proyectos || [];
    if (proyectos.length === 0) return;
    
    const primerProyecto = proyectos[0];
    const proyectoData = db.proyectos_data[primerProyecto.id];
    
    if (proyectoData) {
        test('Estructura viajes_camiones existe', !!proyectoData.viajes_camiones);
        
        if (proyectoData.viajes_camiones) {
            test('Camiones definidos', Array.isArray(proyectoData.viajes_camiones.camiones));
            test('Rutas definidas', Array.isArray(proyectoData.viajes_camiones.rutas));
            test('Viajes registrados', Array.isArray(proyectoData.viajes_camiones.viajes));
        }
    }
}

// Verificar módulo Mantenimiento
async function testMantenimiento() {
    log('\n=== Probando Módulo Mantenimiento ===', 'cyan');
    
    const db = readDatabase();
    if (!db) return;
    
    const proyectos = db.configuracion.proyectos || [];
    if (proyectos.length === 0) return;
    
    const primerProyecto = proyectos[0];
    const proyectoData = db.proyectos_data[primerProyecto.id];
    
    if (proyectoData) {
        test('Estructura mantenimiento existe', !!proyectoData.mantenimiento);
        
        if (proyectoData.mantenimiento) {
            test('Maquinaria de mantenimiento', Array.isArray(proyectoData.mantenimiento.maquinaria));
            test('Órdenes de mantenimiento', Array.isArray(proyectoData.mantenimiento.ordenes));
            test('Insumos registrados', Array.isArray(proyectoData.mantenimiento.insumos));
        }
    }
}

// Verificar generación de reportes
async function testReportes() {
    log('\n=== Probando Generación de Reportes ===', 'cyan');
    
    const reportTypes = ['diario', 'semanal', 'mensual', 'asistencia', 'viajes', 'mantenimiento', 'categoria', 'nomina', 'ejecutivo'];
    
    for (const tipo of reportTypes) {
        try {
            const response = await makeRequest(`/?report=${tipo}&periodo=2026-09-01`);
            test(`Reporte ${tipo} accesible`, response.status === 200 || response.status === 304);
        } catch (error) {
            test(`Reporte ${tipo} accesible`, false, error.message);
        }
    }
}

// Verificar PWA
async function testPWA() {
    log('\n=== Probando PWA ===', 'cyan');
    
    const files = ['manifest.json', 'sw.js', 'icon.png'];
    
    for (const file of files) {
        const exists = fs.existsSync(path.join(__dirname, file));
        test(`Archivo ${file} existe`, exists);
    }
    
    // Verificar manifest.json
    if (fs.existsSync('manifest.json')) {
        try {
            const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
            test('Manifest JSON válido', !!manifest.name && !!manifest.start_url);
            test('Iconos definidos', Array.isArray(manifest.icons) && manifest.icons.length > 0);
        } catch (error) {
            test('Manifest JSON válido', false, error.message);
        }
    }
}

// Ejecutar todas las pruebas
async function runAllTests() {
    log('=== VERIFICACIÓN FUNCIONAL DE MÓDULOS ===', 'cyan');
    log('Iniciando pruebas...\n', 'cyan');
    
    // Backup de base de datos
    backupDatabase();
    
    // Esperar a que el servidor esté listo
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verificar servidor
    const serverRunning = await checkServer();
    
    if (!serverRunning) {
        log('Servidor no está corriendo. Abortando pruebas.', 'red');
        return;
    }
    
    // Ejecutar pruebas
    await testCajaChica();
    await testMaquinaria();
    await testPersonal();
    await testAdquisiciones();
    await testViajes();
    await testMantenimiento();
    await testReportes();
    await testPWA();
    
    // Restaurar base de datos
    restoreDatabase();
    
    // Imprimir resumen
    log('\n=== RESUMEN DE PRUEBAS ===', 'cyan');
    log(`Total: ${results.passed + results.failed}`, 'white');
    log(`✅ Pasadas: ${results.passed}`, 'green');
    log(`❌ Fallidas: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
    log(`Porcentaje: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`, 'white');
    
    if (results.failed === 0) {
        log('\n✅ Todas las pruebas pasaron exitosamente', 'green');
    } else {
        log('\n❌ Algunas pruebas fallaron', 'red');
    }
    
    // Guardar resultados
    const resultsPath = path.join(__dirname, 'functional_test_results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    log(`\nResultados guardados en: ${resultsPath}`, 'cyan');
}

// Ejecutar
runAllTests().catch(error => {
    log(`Error: ${error.message}`, 'red');
    restoreDatabase();
    process.exit(1);
});
