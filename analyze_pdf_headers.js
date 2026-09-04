/**
 * CONSTRURAMSA PDF Report Header/Layout Analysis
 * 
 * Analyzes the PDF template structure for:
 * - Redundancy between letterhead and page header
 * - Visual coherence and alignment
 * - Spacing consistency
 * - Professional presentation
 */

const fs = require('fs');
const path = require('path');

const HTML_FILE = path.join(__dirname, 'index.html');

// Colors
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color] || ''}${message}${colors.reset}`);
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
    log(`\n${'═'.repeat(70)}`, 'blue');
    log(`  ${message}`, 'bold');
    log(`${'═'.repeat(70)}`, 'blue');
}

// Load HTML
const htmlContent = fs.readFileSync(HTML_FILE, 'utf8');

// ============================================================
// ANALYSIS FUNCTIONS
// ============================================================

let issues = [];
let recommendations = [];

function addIssue(severity, description) {
    issues.push({ severity, description });
}

function addRecommendation(priority, description) {
    recommendations.push({ priority, description });
}

// 1. Analyze static letterhead
function analyzeLetterhead() {
    logSection('1. STATIC LETTERHEAD ANALYSIS');
    
    // Check if letterhead exists
    const hasLetterhead = htmlContent.includes('MEMBRETE CONSTRURAMSA');
    if (!hasLetterhead) {
        addIssue('HIGH', 'Missing static letterhead in PDF template');
        return;
    }
    logSuccess('Static letterhead exists');
    
    // Check letterhead structure
    const letterheadElements = {
        'Logo': htmlContent.includes('pdf-logo-membrete'),
        'Company name': htmlContent.includes('pdf-nombre-empresa'),
        'Slogan': htmlContent.includes('pdf-eslogan-empresa'),
        'Contact info': htmlContent.includes('pdf-tel-email-empresa'),
        'Project name': htmlContent.includes('pdf-nombre-proyecto'),
        'Report type': htmlContent.includes('pdf-tipo-reporte'),
        'Issue date': htmlContent.includes('pdf-fecha-emision'),
        'Seal/stamp area': htmlContent.includes('Sello / Timbre')
    };
    
    Object.entries(letterheadElements).forEach(([element, exists]) => {
        if (exists) {
            logSuccess(`Letterhead has: ${element}`);
        } else {
            addIssue('MEDIUM', `Letterhead missing: ${element}`);
        }
    });
    
    // Check for redundancy with page header
    logInfo('\n--- Redundancy Check ---');
    const redundantElements = {
        'Company name': htmlContent.includes('pdf-nombre-empresa') && htmlContent.includes('.brand-name'),
        'Project name': htmlContent.includes('pdf-nombre-proyecto') && htmlContent.includes('Proyecto:'),
        'Contact info': htmlContent.includes('pdf-tel-email-empresa') && htmlContent.includes('telefono'),
        'Report type': htmlContent.includes('pdf-tipo-reporte') && htmlContent.includes('report-label')
    };
    
    Object.entries(redundantElements).forEach(([element, redundant]) => {
        if (redundant) {
            addIssue('MEDIUM', `Redundant ${element} in both letterhead and page header`);
            logWarning(`Redundant: ${element}`);
        }
    });
    
    // Check visual structure
    logInfo('\n--- Visual Structure ---');
    const hasTable = htmlContent.includes('<table style="width: 100%; border-collapse: collapse; margin: 0;">');
    if (hasTable) {
        logSuccess('Letterhead uses table layout');
    } else {
        addIssue('HIGH', 'Letterhead missing table layout');
    }
    
    // Check padding/margins
    const hasPadding = htmlContent.includes('padding: 18px 20px 14px 20px;');
    if (hasPadding) {
        logSuccess('Letterhead has padding');
    } else {
        addIssue('LOW', 'Letterhead padding may need adjustment');
    }
    
    // Check borders
    const hasBorders = htmlContent.includes('border-left: 1px solid #E5E7EB') && 
                       htmlContent.includes('border-right: 1px solid #E5E7EB');
    if (hasBorders) {
        logSuccess('Letterhead has side borders');
    } else {
        addIssue('LOW', 'Letterhead missing side borders');
    }
}

// 2. Analyze page header
function analyzePageHeader() {
    logSection('2. PAGE HEADER ANALYSIS');
    
    const hasPageHeader = htmlContent.includes('pdf-page-header');
    if (!hasPageHeader) {
        addIssue('HIGH', 'Missing repeating page header');
        return;
    }
    logSuccess('Repeating page header exists');
    
    // Check page header structure
    const pageHeaderElements = {
        'Brand badge': htmlContent.includes('brand-badge'),
        'Brand name': htmlContent.includes('brand-name'),
        'Brand slogan': htmlContent.includes('brand-eslogan'),
        'Report label': htmlContent.includes('report-label'),
        'Meta row': htmlContent.includes('meta-row')
    };
    
    Object.entries(pageHeaderElements).forEach(([element, exists]) => {
        if (exists) {
            logSuccess(`Page header has: ${element}`);
        } else {
            addIssue('MEDIUM', `Page header missing: ${element}`);
        }
    });
    
    // Check page header CSS
    logInfo('\n--- Page Header CSS ---');
    const hasGradient = htmlContent.includes('background: linear-gradient(135deg, var(--pdf-azul-oscuro) 0%, var(--pdf-azul-claro) 100%)');
    if (hasGradient) {
        logSuccess('Page header has gradient background');
    } else {
        addIssue('MEDIUM', 'Page header missing gradient background');
    }
    
    const hasBorderRadius = htmlContent.includes('border-radius: 10px 10px 0 0');
    if (hasBorderRadius) {
        logSuccess('Page header has border radius');
    } else {
        addIssue('LOW', 'Page header missing border radius');
    }
    
    const hasShadow = htmlContent.includes('box-shadow: 0 4px 12px rgba(11, 59, 102, 0.18)');
    if (hasShadow) {
        logSuccess('Page header has box shadow');
    } else {
        addIssue('LOW', 'Page header missing box shadow');
    }
}

// 3. Analyze alignment and spacing
function analyzeAlignmentSpacing() {
    logSection('3. ALIGNMENT AND SPACING ANALYSIS');
    
    // Letterhead analysis
    logInfo('--- Letterhead ---');
    
    // Check column widths
    const hasLeftColumn = htmlContent.includes('width: 22%') && htmlContent.includes('border-right: 1px solid #E5E7EB');
    const hasCenterColumn = htmlContent.includes('width: 56%') && htmlContent.includes('text-align: center');
    const hasRightColumn = htmlContent.includes('width: 22%') && htmlContent.includes('border-left: 1px solid #E5E7EB');
    
    if (hasLeftColumn && hasCenterColumn && hasRightColumn) {
        logSuccess('Letterhead has 3-column layout (22%/56%/22%)');
    } else {
        addIssue('HIGH', 'Letterhead column structure incomplete');
    }
    
    // Check vertical alignment
    const hasVerticalAlign = htmlContent.includes('vertical-align: top') && htmlContent.includes('vertical-align: middle');
    if (hasVerticalAlign) {
        logSuccess('Letterhead has vertical alignment');
    } else {
        addIssue('MEDIUM', 'Letterhead vertical alignment inconsistent');
    }
    
    // Check padding consistency
    const paddingMatch = htmlContent.match(/padding:\s*(\d+)px\s+(\d+)px\s+(\d+)px\s+(\d+)px/g);
    if (paddingMatch && paddingMatch.length > 0) {
        logInfo(`Found ${paddingMatch.length} padding declarations`);
    }
    
    // Page header analysis
    logInfo('\n--- Page Header ---');
    
    // Check flex alignment
    const hasFlexAlign = htmlContent.includes('align-items: center');
    if (hasFlexAlign) {
        logSuccess('Page header uses flexbox alignment');
    } else {
        addIssue('MEDIUM', 'Page header alignment may be inconsistent');
    }
    
    // Check spacing
    const hasGap = htmlContent.includes('gap: 12px');
    if (hasGap) {
        logSuccess('Page header has consistent gap');
    } else {
        addIssue('LOW', 'Page header spacing may need adjustment');
    }
    
    // Check margin bottom
    const hasMarginBottom = htmlContent.includes('margin-bottom: 12px');
    if (hasMarginBottom) {
        logSuccess('Page header has margin bottom');
    } else {
        addIssue('LOW', 'Page header margin bottom may need adjustment');
    }
}

// 4. Analyze visual coherence
function analyzeVisualCoherence() {
    logSection('4. VISUAL COHERENCE ANALYSIS');
    
    // Color scheme
    logInfo('--- Color Scheme ---');
    
    const colors = {
        'Dark blue': htmlContent.includes('--pdf-azul-oscuro'),
        'Light blue': htmlContent.includes('--pdf-azul-claro'),
        'White': htmlContent.includes('--pdf-blanco'),
        'Dark gray': htmlContent.includes('--pdf-gris-oscuro'),
        'Medium gray': htmlContent.includes('--pdf-gris-medio'),
        'Green': htmlContent.includes('--pdf-verde'),
        'Red': htmlContent.includes('--pdf-rojo')
    };
    
    Object.entries(colors).forEach(([color, exists]) => {
        if (exists) {
            logSuccess(`Color defined: ${color}`);
        } else {
            addIssue('MEDIUM', `Missing color variable: ${color}`);
        }
    });
    
    // Check color usage consistency
    logInfo('\n--- Color Usage ---');
    
    // Letterhead uses specific colors
    const letterheadUsesBlue = htmlContent.includes('#004B93') || htmlContent.includes('var(--pdf-azul-oscuro)');
    const letterheadUsesWhite = htmlContent.includes('#ffffff') || htmlContent.includes('var(--pdf-blanco)');
    
    if (letterheadUsesBlue && letterheadUsesWhite) {
        logSuccess('Letterhead uses brand colors');
    } else {
        addIssue('LOW', 'Letterhead color usage may be inconsistent');
    }
    
    // Page header uses gradient
    const pageHeaderUsesGradient = htmlContent.includes('linear-gradient(135deg, var(--pdf-azul-oscuro) 0%, var(--pdf-azul-claro) 100%)');
    if (pageHeaderUsesGradient) {
        logSuccess('Page header uses brand gradient');
    } else {
        addIssue('MEDIUM', 'Page header missing brand gradient');
    }
    
    // Typography
    logInfo('\n--- Typography ---');
    
    // Check font family
    const hasArial = htmlContent.includes('Arial') || htmlContent.includes('Helvetica Neue');
    if (hasArial) {
        logSuccess('Consistent font family (Arial/Helvetica)');
    } else {
        addIssue('LOW', 'Font family may be inconsistent');
    }
    
    // Check font sizes
    const hasFontSizes = htmlContent.includes('font-size: 22px') && // Company name
                         htmlContent.includes('font-size: 9px') &&   // Slogan
                         htmlContent.includes('font-size: 8px');     // Contact info
    if (hasFontSizes) {
        logSuccess('Letterhead has consistent font sizing');
    } else {
        addIssue('LOW', 'Letterhead font sizing may need adjustment');
    }
    
    // Check letter spacing
    const hasLetterSpacing = htmlContent.includes('letter-spacing: 6px') || htmlContent.includes('letter-spacing: 1.5px');
    if (hasLetterSpacing) {
        logSuccess('Letterhead uses letter spacing for emphasis');
    } else {
        addIssue('LOW', 'Letterhead letter spacing may need adjustment');
    }
}

// 5. Analyze spacing consistency
function analyzeSpacingConsistency() {
    logSection('5. SPACING CONSISTENCY ANALYSIS');
    
    // Check margin between letterhead and content
    const hasLetterheadBottomMargin = htmlContent.includes('margin-bottom: 18px');
    if (hasLetterheadBottomMargin) {
        logSuccess('Letterhead has bottom margin');
    } else {
        addIssue('MEDIUM', 'Letterhead bottom margin missing or insufficient');
    }
    
    // Check page header margin
    const hasPageHeaderMargin = htmlContent.includes('margin-bottom: 12px');
    if (hasPageHeaderMargin) {
        logSuccess('Page header has bottom margin');
    } else {
        addIssue('LOW', 'Page header margin may need adjustment');
    }
    
    // Check for consistent spacing units
    logInfo('--- Spacing Units ---');
    
    // Count px vs mm usage
    const pxCount = (htmlContent.match(/padding:\s*\d+px/g) || []).length;
    const mmCount = (htmlContent.match(/padding:\s*\d+mm/g) || []).length;
    
    logInfo(`Padding declarations: ${pxCount} in px, ${mmCount} in mm`);
    
    if (pxCount > 0 && mmCount > 0) {
        addIssue('MEDIUM', 'Mixed units (px and mm) in template padding');
        logWarning('Mixed units detected - may cause inconsistency');
    } else if (pxCount > 0) {
        logSuccess('Consistent px units in template');
    } else if (mmCount > 0) {
        logSuccess('Consistent mm units in template');
    }
}

// 6. Analyze redundancy and suggest improvements
function analyzeRedundancy() {
    logSection('6. REDUNDANCY ANALYSIS AND IMPROVEMENTS');
    
    // Count occurrences of key elements
    const companyNameCount = (htmlContent.match(/pdf-nombre-empresa/g) || []).length;
    const projectNameCount = (htmlContent.match(/pdf-nombre-proyecto/g) || []).length;
    const sloganCount = (htmlContent.match(/pdf-eslogan-empresa/g) || []).length;
    const reportTypeCount = (htmlContent.match(/pdf-tipo-reporte/g) || []).length;
    
    logInfo('Element occurrences in template:');
    logInfo(`  Company name: ${companyNameCount}`);
    logInfo(`  Project name: ${projectNameCount}`);
    logInfo(`  Slogan: ${sloganCount}`);
    logInfo(`  Report type: ${reportTypeCount}`);
    
    if (companyNameCount > 1) {
        addIssue('MEDIUM', 'Company name appears multiple times - redundant');
        addRecommendation('HIGH', 'Consolidate company name to single occurrence');
    }
    
    if (projectNameCount > 1) {
        addIssue('MEDIUM', 'Project name appears multiple times - redundant');
        addRecommendation('HIGH', 'Consolidate project name to single occurrence');
    }
    
    if (sloganCount > 1) {
        addIssue('LOW', 'Slogan appears multiple times - minor redundancy');
    }
    
    if (reportTypeCount > 1) {
        addIssue('MEDIUM', 'Report type appears multiple times - redundant');
        addRecommendation('HIGH', 'Consolidate report type to single occurrence');
    }
    
    // Check for conflicting layouts
    logInfo('\n--- Layout Conflicts ---');
    
    const hasLetterhead = htmlContent.includes('MEMBRETE CONSTRURAMSA');
    const hasPageHeader = htmlContent.includes('pdf-page-header');
    
    if (hasLetterhead && hasPageHeader) {
        addIssue('HIGH', 'Both static letterhead AND repeating page header exist - visual conflict');
        addRecommendation('CRITICAL', 'Remove static letterhead and rely on repeating page header, OR simplify letterhead to avoid redundancy');
    }
    
    // Check for inconsistent styling
    logInfo('\n--- Styling Conflicts ---');
    
    // Letterhead uses white background, page header uses gradient
    const letterheadWhite = htmlContent.includes('background: #ffffff') || htmlContent.includes('background: var(--pdf-blanco)');
    const pageHeaderGradient = htmlContent.includes('linear-gradient(135deg, var(--pdf-azul-oscuro)');
    
    if (letterheadWhite && pageHeaderGradient) {
        addIssue('MEDIUM', 'Conflicting backgrounds: letterhead is white, page header is gradient');
        addRecommendation('HIGH', 'Unify header style: either both white or both gradient');
    }
    
    // Check border styles
    const letterheadBorder = htmlContent.includes('border-left: 1px solid #E5E7EB');
    const pageHeaderBorder = htmlContent.includes('border: 1px solid rgba(255,255,255,0.15)');
    
    if (letterheadBorder && pageHeaderBorder) {
        logInfo('Different border styles between letterhead and page header');
    }
}

// 7. Generate specific recommendations
function generateRecommendations() {
    logSection('7. SPECIFIC RECOMMENDATIONS');
    
    if (issues.length === 0) {
        logSuccess('No critical issues found!');
        return;
    }
    
    // Group issues by severity
    const highIssues = issues.filter(i => i.severity === 'HIGH');
    const mediumIssues = issues.filter(i => i.severity === 'MEDIUM');
    const lowIssues = issues.filter(i => i.severity === 'LOW');
    
    if (highIssues.length > 0) {
        log('\n🔴 HIGH SEVERITY ISSUES:', 'red');
        highIssues.forEach((issue, i) => {
            log(`  ${i + 1}. ${issue.description}`, 'red');
        });
    }
    
    if (mediumIssues.length > 0) {
        log('\n🟡 MEDIUM SEVERITY ISSUES:', 'yellow');
        mediumIssues.forEach((issue, i) => {
            log(`  ${i + 1}. ${issue.description}`, 'yellow');
        });
    }
    
    if (lowIssues.length > 0) {
        log('\n🟢 LOW SEVERITY ISSUES:', 'cyan');
        lowIssues.forEach((issue, i) => {
            log(`  ${i + 1}. ${issue.description}`, 'cyan');
        });
    }
    
    // Recommendations
    if (recommendations.length > 0) {
        log('\n💡 RECOMMENDATIONS:', 'blue');
        recommendations.forEach((rec, i) => {
            const priority = rec.priority === 'CRITICAL' ? '🔴' : rec.priority === 'HIGH' ? '🟡' : '🟢';
            log(`  ${priority} ${rec.description}`, 'blue');
        });
    }
}

// 8. Suggest improved structure
function suggestImprovedStructure() {
    logSection('8. SUGGESTED IMPROVED STRUCTURE');
    
    log('\n📋 OPTION A: Unified Repeating Header (Recommended)', 'green');
    log('   - Remove static letterhead completely');
    log('   - Enhance .pdf-page-header to include all necessary info');
    log('   - Appears on every page with consistent design');
    log('   - Cleaner, more professional, less redundancy');
    
    log('\n📋 OPTION B: Simplified Letterhead + Page Header', 'yellow');
    log('   - Keep letterhead only on page 1');
    log('   - Simplify letterhead: remove redundant info');
    log('   - Use page header for subsequent pages');
    log('   - Maintains brand presence while reducing clutter');
    
    log('\n📋 OPTION C: Minimal Header + Footer', 'cyan');
    log('   - Ultra-minimal header with just logo and report title');
    log('   - Move details to footer area');
    log('   - Maximizes content space');
    log('   - Modern, clean look');
}

// ============================================================
// MAIN EXECUTION
// ============================================================

function main() {
    console.log('\n' + '═'.repeat(70));
    console.log('  CONSTRURAMSA PDF REPORT HEADER ANALYSIS');
    console.log('  Letterhead vs Page Header Coherence');
    console.log('═'.repeat(70) + '\n');
    
    logInfo(`Analyzing: ${HTML_FILE}`);
    logInfo(`File size: ${fs.statSync(HTML_FILE).size} bytes\n`);
    
    // Run all analyses
    analyzeLetterhead();
    analyzePageHeader();
    analyzeAlignmentSpacing();
    analyzeVisualCoherence();
    analyzeSpacingConsistency();
    analyzeRedundancy();
    
    // Summary
    console.log('\n' + '═'.repeat(70));
    console.log('  ISSUES SUMMARY');
    console.log('═'.repeat(70));
    
    const highCount = issues.filter(i => i.severity === 'HIGH').length;
    const mediumCount = issues.filter(i => i.severity === 'MEDIUM').length;
    const lowCount = issues.filter(i => i.severity === 'LOW').length;
    
    console.log(`\nTotal Issues Found: ${issues.length}`);
    console.log(`  🔴 High:     ${highCount}`);
    console.log(`  🟡 Medium:   ${mediumCount}`);
    console.log(`  🟢 Low:      ${lowCount}`);
    console.log(`\nRecommendations: ${recommendations.length}\n`);
    
    if (highCount > 0) {
        log('❌ CRITICAL ISSUES REQUIRE ATTENTION', 'red');
    } else if (mediumCount > 0) {
        log('⚠️  MEDIUM ISSUES SHOULD BE ADDRESSED', 'yellow');
    } else {
        log('✅ LOW/NO ISSUES - TEMPLATE IS WELL STRUCTURED', 'green');
    }
    
    generateRecommendations();
    suggestImprovedStructure();
    
    console.log('\n' + '═'.repeat(70) + '\n');
}

main();
