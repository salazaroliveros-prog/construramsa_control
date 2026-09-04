/**
 * @fileoverview Comprehensive Application Audit for CONSTRURAMSA
 * 
 * Performs a complete audit of the application to identify:
 * - Module logic inconsistencies
 * - Data integrity issues
 * - UI/UX problems
 * - Form validation gaps
 * - Accessibility compliance
 * - PWA configuration issues
 * - Security vulnerabilities
 * - Performance bottlenecks
 * 
 * Usage: node comprehensive_audit.js
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠️ ${message}`, 'yellow');
}

function logInfo(message) {
    log(`ℹ️ ${message}`, 'cyan');
}

function logSection(message) {
    log(`\n${'='.repeat(60)}`, 'blue');
    log(message, 'blue');
    log('='.repeat(60), 'blue');
}

// Audit results
const auditResults = {
    moduleLogic: { passed: 0, failed: 0, warnings: [], errors: [] },
    dataIntegrity: { passed: 0, failed: 0, warnings: [], errors: [] },
    uiUx: { passed: 0, failed: 0, warnings: [], errors: [] },
    formValidation: { passed: 0, failed: 0, warnings: [], errors: [] },
    accessibility: { passed: 0, failed: 0, warnings: [], errors: [] },
    pwaConfig: { passed: 0, failed: 0, warnings: [], errors: [] },
    security: { passed: 0, failed: 0, warnings: [], errors: [] },
    performance: { passed: 0, failed: 0, warnings: [], errors: [] }
};

// Load files
function loadFile(filename) {
    try {
        const content = fs.readFileSync(filename, 'utf8');
        return content;
    } catch (error) {
        logError(`Error loading ${filename}: ${error.message}`);
        return null;
    }
}

// Audit Module Logic
function auditModuleLogic(indexHtml) {
    logSection('AUDIT: Module Logic & Functionality');
    
    const issues = [];
    
    // Check for duplicate function definitions
    const functionDefs = indexHtml.match(/function\s+(\w+)\s*\(/g);
    if (functionDefs) {
        const functionNames = functionDefs.map(m => m.match(/function\s+(\w+)/)[1]);
        const duplicates = functionNames.filter((item, index) => functionNames.indexOf(item) !== index);
        if (duplicates.length > 0) {
            issues.push(`Duplicate function definitions: ${duplicates.join(', ')}`);
            auditResults.moduleLogic.errors.push(...duplicates.map(d => `Duplicate function: ${d}`));
        } else {
            logSuccess('No duplicate function definitions found');
        }
    }
    
    // Check for undefined function calls
    const functionCalls = indexHtml.match(/\b(\w+)\(/g);
    if (functionCalls) {
        const calledFunctions = [...new Set(functionCalls.map(m => m.replace(/\(/, '')))];
        const definedFunctions = functionDefs ? [...new Set(functionDefs.map(m => m.match(/function\s+(\w+)/)[1]))] : [];
        const undefinedCalls = calledFunctions.filter(f => 
            !definedFunctions.includes(f) && 
            !['console','alert','confirm','prompt','setTimeout','setInterval','fetch','XMLHttpRequest','addEventListener','querySelector','querySelectorAll','getElementById','getElementsByClassName','getElementsByName','createElement','appendChild','insertBefore','removeChild','replaceChild','cloneNode','classList','addEventListener','removeEventListener','classList','getAttribute','setAttribute','removeAttribute','hasAttribute','dataset','innerHTML','textContent','innerText','outerHTML','insertAdjacentHTML','scrollIntoView','focus','blur','click','submit','reset','preventDefault','stopPropagation','stopImmediatePropagation','capture','bubbles','cancelable','currentTarget','defaultPrevented','eventPhase','isTrusted','returnValue','srcElement','target','timeStamp','type','initEvent','initMouseEvent','initKeyboardEvent','initUIEvent','JSON','Date','Math','Number','String','Boolean','Array','Object','RegExp','Error','TypeError','ReferenceError','SyntaxError','URIError','EvalError','RangeError','parseInt','parseFloat','isNaN','isFinite','isNaN','isFinite','decodeURI','decodeURIComponent','encodeURI','encodeURIComponent','escape','unescape','eval','undefined','null','true','false','Infinity','NaN','undefined'].includes(f)
        );
        if (undefinedCalls.length > 0) {
            issues.push(`Potentially undefined function calls: ${undefinedCalls.slice(0, 5).join(', ')}`);
            auditResults.moduleLogic.warnings.push(`Potentially undefined functions: ${undefinedCalls.slice(0, 5).join(', ')}`);
        } else {
            logSuccess('All function calls appear to be defined');
        }
    }
    
    // Check for inconsistent data access patterns
    if (indexHtml.includes('getProyectoData()') && indexHtml.includes('getDB()')) {
        logSuccess('Data access patterns are consistent');
    } else {
        issues.push('Inconsistent data access patterns');
        auditResults.moduleLogic.errors.push('Inconsistent data access patterns');
    }
    
    // Check for console.log statements in production code
    const consoleLogs = (indexHtml.match(/console\.log/g) || []).length;
    if (consoleLogs > 50) {
        issues.push(`Excessive console.log statements: ${consoleLogs}`);
        auditResults.moduleLogic.warnings.push(`Excessive console.log: ${consoleLogs} statements`);
    } else {
        logSuccess(`Console.log statements within reasonable limits: ${consoleLogs}`);
    }
    
    // Check for TODO comments indicating incomplete features
    const todos = (indexHtml.match(/TODO|FIXME|HACK|XXX/gi) || []).length;
    if (todos > 0) {
        issues.push(`${todos} TODO/FIXME comments found in code`);
        auditResults.moduleLogic.warnings.push(`${todos} TODO/FIXME comments found`);
    } else {
        logSuccess('No TODO/FIXME comments found');
    }
    
    auditResults.moduleLogic.passed = 5 - issues.length;
    auditResults.moduleLogic.failed = issues.length;
    
    issues.forEach(issue => logWarning(issue));
    
    return issues.length === 0;
}

// Audit Data Integrity
function auditDataIntegrity(db) {
    logSection('AUDIT: Data Integrity & Consistency');
    
    const issues = [];
    
    if (!db) {
        logError('Database not available for audit');
        return false;
    }
    
    // Check configuration integrity
    if (!db.configuracion) {
        issues.push('Missing configuracion in database');
        auditResults.dataIntegrity.errors.push('Missing configuracion');
    } else {
        logSuccess('Configuracion present');
        
        // Check required config fields
        const requiredConfigFields = ['nombre_empresa', 'proyecto_actual'];
        const missingFields = requiredConfigFields.filter(f => !db.configuracion[f]);
        if (missingFields.length > 0) {
            issues.push(`Missing config fields: ${missingFields.join(', ')}`);
            auditResults.dataIntegrity.errors.push(`Missing config: ${missingFields.join(', ')}`);
        } else {
            logSuccess('All required config fields present');
        }
    }
    
    // Check projects integrity
    if (!db.proyectos || db.proyectos.length === 0) {
        issues.push('No projects defined');
        auditResults.dataIntegrity.errors.push('No projects defined');
    } else {
        logSuccess(`${db.proyectos.length} projects defined`);
        
        // Check for duplicate project names
        const projectNames = db.proyectos.map(p => p.nombre);
        const duplicateNames = projectNames.filter((item, index) => projectNames.indexOf(item) !== index);
        if (duplicateNames.length > 0) {
            issues.push(`Duplicate project names: ${duplicateNames.join(', ')}`);
            auditResults.dataIntegrity.errors.push(`Duplicate project names: ${duplicateNames.join(', ')}`);
        } else {
            logSuccess('No duplicate project names');
        }
        
        // Check for missing project data structures
        if (!db.proyectos_data) {
            issues.push('Missing proyectos_data structure');
            auditResults.dataIntegrity.errors.push('Missing proyectos_data');
        } else {
            const missingData = db.proyectos.filter(p => !db.proyectos_data[p.id]);
            if (missingData.length > 0) {
                issues.push(`${missingData.length} projects missing data structures`);
                auditResults.dataIntegrity.errors.push(`${missingData.length} projects missing data`);
            } else {
                logSuccess('All projects have data structures');
            }
        }
    }
    
    // Check data type consistency
    if (db.proyectos_data) {
        Object.keys(db.proyectos_data).forEach(pid => {
            const data = db.proyectos_data[pid];
            
            // Check caja_chica
            if (data.caja_chica) {
                const invalidMontos = data.caja_chica.filter(m => typeof m.monto !== 'number' || isNaN(m.monto));
                if (invalidMontos.length > 0) {
                    issues.push(`Project ${pid}: ${invalidMontos.length} invalid monto values in caja_chica`);
                    auditResults.dataIntegrity.errors.push(`Invalid montos in caja_chica for project ${pid}`);
                }
            }
            
            // Check viajes
            if (data.viajes_camiones && data.viajes_camiones.viajes) {
                const invalidTotals = data.viajes_camiones.viajes.filter(v => typeof v.total !== 'number' || isNaN(v.total));
                if (invalidTotals.length > 0) {
                    issues.push(`Project ${pid}: ${invalidTotals.length} invalid total values in viajes`);
                    auditResults.dataIntegrity.errors.push(`Invalid totals in viajes for project ${pid}`);
                }
            }
        });
    }
    
    auditResults.dataIntegrity.passed = 4 - issues.length;
    auditResults.dataIntegrity.failed = issues.length;
    
    issues.forEach(issue => logWarning(issue));
    
    return issues.length === 0;
}

// Audit UI/UX Inconsistencies
function auditUIUx(indexHtml) {
    logSection('AUDIT: UI/UX Inconsistencies');
    
    const issues = [];
    
    // Check for inconsistent class naming
    const classPattern = /class="([^"]+)"/g;
    const classes = [];
    let match;
    while ((match = classPattern.exec(indexHtml)) !== null) {
        classes.push(...match[1].split(/\s+/));
    }
    const uniqueClasses = [...new Set(classes)];
    
    // Check for kebab-case vs camelCase inconsistency
    const camelCaseClasses = uniqueClasses.filter(c => /[a-z][A-Z]/.test(c));
    if (camelCaseClasses.length > 10) {
        issues.push(`${camelCaseClasses.length} camelCase class names found (should use kebab-case)`);
        auditResults.uiUx.warnings.push(`${camelCaseClasses.length} camelCase classes`);
    } else {
        logSuccess('Class naming mostly consistent (kebab-case)');
    }
    
    // Check for inline styles (should be in CSS)
    const inlineStyles = (indexHtml.match(/style="[^"]+"/g) || []).length;
    if (inlineStyles > 100) {
        issues.push(`Excessive inline styles: ${inlineStyles} (should use CSS classes)`);
        auditResults.uiUx.warnings.push(`Excessive inline styles: ${inlineStyles}`);
    } else {
        logSuccess(`Inline styles within reasonable limits: ${inlineStyles}`);
    }
    
    // Check for inconsistent button classes
    const buttonClasses = uniqueClasses.filter(c => c.includes('btn'));
    if (buttonClasses.length > 10) {
        issues.push(`Many button class variations: ${buttonClasses.length} (should standardize)`);
        auditResults.uiUx.warnings.push(`Many button class variations: ${buttonClasses.length}`);
    } else {
        logSuccess('Button classes reasonably standardized');
    }
    
    // Check for missing alt attributes on images
    const imgWithoutAlt = (indexHtml.match(/<img(?![^>]*alt=)/gi) || []).length;
    if (imgWithoutAlt > 0) {
        issues.push(`${imgWithoutAlt} images without alt attributes`);
        auditResults.uiUx.errors.push(`${imgWithoutAlt} images missing alt`);
    } else {
        logSuccess('All images have alt attributes');
    }
    
    // Check for color inconsistency (hardcoded colors)
    const hexColors = (indexHtml.match(/#[0-9a-fA-F]{6}/g) || []).length;
    if (hexColors > 50) {
        issues.push(`${hexColors} hardcoded hex colors (should use CSS variables)`);
        auditResults.uiUx.warnings.push(`${hexColors} hardcoded colors`);
    } else {
        logSuccess('Hardcoded colors within reasonable limits');
    }
    
    auditResults.uiUx.passed = 5 - issues.length;
    auditResults.uiUx.failed = issues.length;
    
    issues.forEach(issue => logWarning(issue));
    
    return issues.length === 0;
}

// Audit Form Validations
function auditFormValidation(indexHtml) {
    logSection('AUDIT: Form Validations');
    
    const issues = [];
    
    // Check for required attribute usage
    const requiredInputs = (indexHtml.match(/required/g) || []).length;
    if (requiredInputs < 10) {
        issues.push(`Few required attributes: ${requiredInputs} (should validate important fields)`);
        auditResults.formValidation.warnings.push(`Few required attributes: ${requiredInputs}`);
    } else {
        logSuccess(`Required attributes used: ${requiredInputs}`);
    }
    
    // Check for input type attributes
    const typeAttributes = (indexHtml.match(/type="(text|number|email|date|tel|url)"/g) || []).length;
    if (typeAttributes < 20) {
        issues.push(`Few input type attributes: ${typeAttributes} (should use appropriate types)`);
        auditResults.formValidation.warnings.push(`Few input type attributes: ${typeAttributes}`);
    } else {
        logSuccess(`Input type attributes used: ${typeAttributes}`);
    }
    
    // Check for pattern attributes for validation
    const patternAttributes = (indexHtml.match(/pattern=/g) || []).length;
    if (patternAttributes < 5) {
        issues.push(`Few pattern attributes: ${patternAttributes} (should validate formats)`);
        auditResults.formValidation.warnings.push(`Few pattern attributes: ${patternAttributes}`);
    } else {
        logSuccess(`Pattern attributes used: ${patternAttributes}`);
    }
    
    // Check for validation functions
    const validationFunctions = (indexHtml.match(/validar|validate/gi) || []).length;
    if (validationFunctions < 10) {
        issues.push(`Few validation functions: ${validationFunctions}`);
        auditResults.formValidation.warnings.push(`Few validation functions: ${validationFunctions}`);
    } else {
        logSuccess(`Validation functions found: ${validationFunctions}`);
    }
    
    // Check for error message display elements
    const errorElements = (indexHtml.match(/error|aviso|warning/gi) || []).length;
    if (errorElements < 10) {
        issues.push(`Few error message elements: ${errorElements}`);
        auditResults.formValidation.warnings.push(`Few error message elements: ${errorElements}`);
    } else {
        logSuccess(`Error message elements found: ${errorElements}`);
    }
    
    auditResults.formValidation.passed = 4 - issues.length;
    auditResults.formValidation.failed = issues.length;
    
    issues.forEach(issue => logWarning(issue));
    
    return issues.length === 0;
}

// Audit Accessibility
function auditAccessibility(indexHtml) {
    logSection('AUDIT: Accessibility Compliance');
    
    const issues = [];
    
    // Check for ARIA labels
    const ariaLabels = (indexHtml.match(/aria-label=/g) || []).length;
    if (ariaLabels < 20) {
        issues.push(`Few aria-label attributes: ${ariaLabels} (should label interactive elements)`);
        auditResults.accessibility.warnings.push(`Few aria-labels: ${ariaLabels}`);
    } else {
        logSuccess(`ARIA labels used: ${ariaLabels}`);
    }
    
    // Check for role attributes
    const roleAttributes = (indexHtml.match(/role=/g) || []).length;
    if (roleAttributes < 10) {
        issues.push(`Few role attributes: ${roleAttributes} (should define component roles)`);
        auditResults.accessibility.warnings.push(`Few role attributes: ${roleAttributes}`);
    } else {
        logSuccess(`Role attributes used: ${roleAttributes}`);
    }
    
    // Check for heading hierarchy
    const headings = indexHtml.match(/<h[1-6]/g) || [];
    if (headings.length < 10) {
        issues.push(`Few headings: ${headings.length} (should have proper heading hierarchy)`);
        auditResults.accessibility.warnings.push(`Few headings: ${headings.length}`);
    } else {
        logSuccess(`Headings found: ${headings.length}`);
    }
    
    // Check for labels on form inputs
    const labelElements = (indexHtml.match(/<label/g) || []).length;
    const inputElements = (indexHtml.match(/<input/g) || []).length;
    if (labelElements < inputElements * 0.5) {
        issues.push(`Labels on inputs: ${labelElements}/${inputElements} (should label all inputs)`);
        auditResults.accessibility.errors.push(`Insufficient labels: ${labelElements}/${inputElements}`);
    } else {
        logSuccess(`Labels on inputs: ${labelElements}/${inputElements}`);
    }
    
    // Check for tabindex
    const tabindexElements = (indexHtml.match(/tabindex/g) || []).length;
    if (tabindexElements < 5) {
        issues.push(`Few tabindex attributes: ${tabindexElements} (should enable keyboard navigation)`);
        auditResults.accessibility.warnings.push(`Few tabindex: ${tabindexElements}`);
    } else {
        logSuccess(`Tabindex attributes used: ${tabindexElements}`);
    }
    
    auditResults.accessibility.passed = 5 - issues.length;
    auditResults.accessibility.failed = issues.length;
    
    issues.forEach(issue => logWarning(issue));
    
    return issues.length === 0;
}

// Audit PWA Configuration
function auditPWAConfig() {
    logSection('AUDIT: PWA Configuration');
    
    const issues = [];
    
    // Check for manifest.json
    if (!fs.existsSync('manifest.json')) {
        issues.push('Missing manifest.json');
        auditResults.pwaConfig.errors.push('Missing manifest.json');
    } else {
        logSuccess('manifest.json exists');
        
        try {
            const manifest = JSON.parse(loadFile('manifest.json'));
            
            // Check required manifest fields
            const requiredFields = ['name', 'short_name', 'start_url', 'display', 'background_color', 'theme_color'];
            const missingFields = requiredFields.filter(f => !manifest[f]);
            if (missingFields.length > 0) {
                issues.push(`Missing manifest fields: ${missingFields.join(', ')}`);
                auditResults.pwaConfig.errors.push(`Missing manifest fields: ${missingFields.join(', ')}`);
            } else {
                logSuccess('All required manifest fields present');
            }
            
            // Check for icons
            if (!manifest.icons || manifest.icons.length === 0) {
                issues.push('No icons defined in manifest');
                auditResults.pwaConfig.errors.push('No icons in manifest');
            } else {
                logSuccess(`${manifest.icons.length} icons defined in manifest`);
            }
        } catch (error) {
            issues.push(`Invalid manifest.json: ${error.message}`);
            auditResults.pwaConfig.errors.push(`Invalid manifest.json`);
        }
    }
    
    // Check for service worker
    if (!fs.existsSync('sw.js')) {
        issues.push('Missing sw.js (service worker)');
        auditResults.pwaConfig.errors.push('Missing service worker');
    } else {
        logSuccess('sw.js exists');
    }
    
    // Check for PWA meta tags in index.html
    const indexHtml = loadFile('index.html');
    const pwaMetaTags = [
        'theme-color',
        'apple-mobile-web-app-capable',
        'apple-mobile-web-app-status-bar-style',
        'apple-mobile-web-app-title'
    ];
    
    const missingMetaTags = pwaMetaTags.filter(tag => !indexHtml.includes(tag));
    if (missingMetaTags.length > 0) {
        issues.push(`Missing PWA meta tags: ${missingMetaTags.join(', ')}`);
        auditResults.pwaConfig.warnings.push(`Missing PWA meta tags: ${missingMetaTags.join(', ')}`);
    } else {
        logSuccess('PWA meta tags present');
    }
    
    auditResults.pwaConfig.passed = 4 - issues.length;
    auditResults.pwaConfig.failed = issues.length;
    
    issues.forEach(issue => logWarning(issue));
    
    return issues.length === 0;
}

// Audit Security
function auditSecurity(indexHtml) {
    logSection('AUDIT: Security Vulnerabilities');
    
    const issues = [];
    
    // Check for eval() usage
    const evalUsage = (indexHtml.match(/eval\(/g) || []).length;
    if (evalUsage > 0) {
        issues.push(`eval() usage detected: ${evalUsage} (security risk)`);
        auditResults.security.errors.push(`eval() usage: ${evalUsage}`);
    } else {
        logSuccess('No eval() usage detected');
    }
    
    // Check for innerHTML with user input
    const innerHTMLUsage = (indexHtml.match(/innerHTML/g) || []).length;
    if (innerHTMLUsage > 20) {
        issues.push(`innerHTML usage: ${innerHTMLUsage} (potential XSS risk)`);
        auditResults.security.warnings.push(`innerHTML usage: ${innerHTMLUsage}`);
    } else {
        logSuccess(`innerHTML usage within limits: ${innerHTMLUsage}`);
    }
    
    // Check for localStorage/sessionStorage without encryption
    const storageUsage = (indexHtml.match(/localStorage|sessionStorage/g) || []).length;
    if (storageUsage > 0) {
        issues.push(`Local storage usage: ${storageUsage} (should encrypt sensitive data)`);
        auditResults.security.warnings.push(`Local storage usage: ${storageUsage}`);
    } else {
        logSuccess('No local storage usage detected');
    }
    
    // Check for inline event handlers
    const inlineEventHandlers = (indexHtml.match(/onclick=/g) || []).length;
    if (inlineEventHandlers > 50) {
        issues.push(`Inline event handlers: ${inlineEventHandlers} (should use addEventListener)`);
        auditResults.security.warnings.push(`Inline event handlers: ${inlineEventHandlers}`);
    } else {
        logSuccess(`Inline event handlers within limits: ${inlineEventHandlers}`);
    }
    
    // Check for external script sources
    const externalScripts = (indexHtml.match(/src="http/g) || []).length;
    if (externalScripts > 0) {
        issues.push(`External HTTP scripts: ${externalScripts} (should use HTTPS)`);
        auditResults.security.errors.push(`HTTP scripts: ${externalScripts}`);
    } else {
        logSuccess('No external HTTP scripts');
    }
    
    auditResults.security.passed = 5 - issues.length;
    auditResults.security.failed = issues.length;
    
    issues.forEach(issue => logWarning(issue));
    
    return issues.length === 0;
}

// Audit Performance
function auditPerformance(indexHtml) {
    logSection('AUDIT: Performance Issues');
    
    const issues = [];
    
    // Check file size
    const fileSize = Buffer.byteLength(indexHtml, 'utf8') / 1024; // KB
    if (fileSize > 500) {
        issues.push(`Large HTML file: ${fileSize.toFixed(2)} KB (should split into modules)`);
        auditResults.performance.warnings.push(`Large HTML: ${fileSize.toFixed(2)} KB`);
    } else {
        logSuccess(`HTML file size reasonable: ${fileSize.toFixed(2)} KB`);
    }
    
    // Check for synchronous XHR
    const syncXHR = (indexHtml.match(/XMLHttpRequest.*false/g) || []).length;
    if (syncXHR > 0) {
        issues.push(`Synchronous XHR: ${syncXHR} (blocks main thread)`);
        auditResults.performance.errors.push(`Sync XHR: ${syncXHR}`);
    } else {
        logSuccess('No synchronous XHR detected');
    }
    
    // Check for large inline scripts
    const scriptTags = indexHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
    const largeScripts = scriptTags.filter(s => s.length > 5000);
    if (largeScripts.length > 0) {
        issues.push(`${largeScripts.length} large inline scripts (should be external files)`);
        auditResults.performance.warnings.push(`${largeScripts.length} large inline scripts`);
    } else {
        logSuccess('Inline scripts reasonably sized');
    }
    
    // Check for DOM queries in loops (basic check)
    const querySelectorInLoop = (indexHtml.match(/for.*querySelector/g) || []).length;
    if (querySelectorInLoop > 0) {
        issues.push(`querySelector in loops: ${querySelectorInLoop} (should cache selectors)`);
        auditResults.performance.warnings.push(`querySelector in loops: ${querySelectorInLoop}`);
    } else {
        logSuccess('No obvious querySelector in loops');
    }
    
    // Check for missing async/defer on scripts
    const scriptWithoutAsync = (indexHtml.match(/<script(?![^>]*(async|defer))/g) || []).length;
    if (scriptWithoutAsync > 5) {
        issues.push(`Scripts without async/defer: ${scriptWithoutAsync}`);
        auditResults.performance.warnings.push(`Scripts without async/defer: ${scriptWithoutAsync}`);
    } else {
        logSuccess('Scripts have async/defer or are inline');
    }
    
    auditResults.performance.passed = 5 - issues.length;
    auditResults.performance.failed = issues.length;
    
    issues.forEach(issue => logWarning(issue));
    
    return issues.length === 0;
}

// Main function
function main() {
    logInfo('\n══════════════════════════════════════════════');
    logInfo('  CONSTRURAMSA COMPREHENSIVE APPLICATION AUDIT');
    logInfo('══════════════════════════════════════════════\n');
    
    const indexHtml = loadFile('index.html');
    const db = loadFile('construramsa_db.json');
    
    if (!indexHtml) {
        logError('Cannot load index.html for audit');
        process.exit(1);
    }
    
    // Parse database if available
    let dbObj = null;
    if (db) {
        try {
            dbObj = JSON.parse(db);
        } catch (error) {
            logError('Cannot parse database');
        }
    }
    
    // Run audits
    auditModuleLogic(indexHtml);
    if (dbObj) auditDataIntegrity(dbObj);
    auditUIUx(indexHtml);
    auditFormValidation(indexHtml);
    auditAccessibility(indexHtml);
    auditPWAConfig();
    auditSecurity(indexHtml);
    auditPerformance(indexHtml);
    
    // Summary
    logSection('AUDIT SUMMARY');
    
    const categories = [
        { name: 'Module Logic', results: auditResults.moduleLogic },
        { name: 'Data Integrity', results: auditResults.dataIntegrity },
        { name: 'UI/UX', results: auditResults.uiUx },
        { name: 'Form Validation', results: auditResults.formValidation },
        { name: 'Accessibility', results: auditResults.accessibility },
        { name: 'PWA Config', results: auditResults.pwaConfig },
        { name: 'Security', results: auditResults.security },
        { name: 'Performance', results: auditResults.performance }
    ];
    
    let totalPassed = 0;
    let totalFailed = 0;
    let totalWarnings = 0;
    
    categories.forEach(cat => {
        logInfo(`${cat.name}:`);
        logSuccess(`  Passed: ${cat.results.passed}`);
        if (cat.results.failed > 0) {
            logError(`  Failed: ${cat.results.failed}`);
        }
        if (cat.results.warnings.length > 0) {
            logWarning(`  Warnings: ${cat.results.warnings.length}`);
        }
        totalPassed += cat.results.passed;
        totalFailed += cat.results.failed;
        totalWarnings += cat.results.warnings.length;
    });
    
    logInfo(`\nTotal Passed: ${totalPassed}`);
    logInfo(`Total Failed: ${totalFailed}`);
    logInfo(`Total Warnings: ${totalWarnings}`);
    
    // Save results
    fs.writeFileSync('comprehensive_audit_results.json', JSON.stringify(auditResults, null, 2));
    logSuccess('\n✅ Audit results saved to: comprehensive_audit_results.json');
    
    if (totalFailed === 0) {
        logSuccess('\n✅ Audit completed with no critical issues!');
        process.exit(0);
    } else {
        logError(`\n❌ ${totalFailed} critical issue(s) found that need fixing`);
        process.exit(1);
    }
}

main();