'use strict';

/*
 * Regression checks for test-infrastructure contracts.  These tests execute
 * the public npm commands rather than inspect implementation text, so a
 * reporting regression cannot silently make CI green.
 */

const assert = require('assert');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const lighthouseReport = path.join(root, 'lighthouse_report.json');
const indexPath = path.join(root, 'index.html');

function run(command, args) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 120000,
    shell: process.platform === 'win32',
  });
}

function testLighthouseReportsEveryExecutedCheck() {
  const result = run(npm, ['run', 'test-lighthouse']);
  assert.notStrictEqual(
    result.error && result.error.code,
    'ETIMEDOUT',
    'Lighthouse must finish within its timeout'
  );
  assert(fs.existsSync(lighthouseReport), 'Lighthouse must write its JSON report');

  const report = JSON.parse(fs.readFileSync(lighthouseReport, 'utf8'));
  const passed = report.tests.filter((test) => test.status === 'PASSED').length;
  const failed = report.tests.filter((test) => test.status === 'FAILED').length;

  assert.strictEqual(
    report.summary.total,
    report.tests.length,
    'summary.total must count every executed Lighthouse check'
  );
  assert.strictEqual(report.summary.passed, passed, 'summary.passed must match the report');
  assert.strictEqual(report.summary.failed, failed, 'summary.failed must match the report');
  assert.strictEqual(
    result.status,
    failed > 0 ? 1 : 0,
    'Lighthouse exit status must reflect failed checks'
  );
  assert(
    !report.tests.some((test) => /127\.0\.0\.1:9222/.test(test.error || '')),
    'Lighthouse must use its launched browser instead of an assumed debug port'
  );
}

function testReportExportAuditIsAPublicTestCommand() {
  const result = run(npm, ['run', 'test-report-exports']);
  assert.strictEqual(
    result.status,
    0,
    `Report export audit must run successfully:\n${result.stdout}\n${result.stderr}`
  );
}

function testExportLibrariesDoNotBlockInitialRender() {
  const html = fs.readFileSync(indexPath, 'utf8');
  for (const library of ['html2pdf.bundle.min.js', 'xlsx.full.min.js', 'exceljs.min.js']) {
    const tag = html.match(new RegExp(`<script[^>]+src=["'][^"']*${library}[^"']*["'][^>]*>`, 'i'));
    assert(tag, `${library} must remain available for report exports`);
    assert(/\bdefer\b/i.test(tag[0]), `${library} must not block the initial application render`);
  }
}

try {
  testLighthouseReportsEveryExecutedCheck();
  testReportExportAuditIsAPublicTestCommand();
  testExportLibrariesDoNotBlockInitialRender();
  console.log('Quality infrastructure contract tests OK');
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
