'use strict';

const assert = require('assert');
const exportConfig = require('./src/exportConfig');

assert.strictEqual(
  exportConfig.pdfScaleForHeight(1123),
  1.5,
  'normal report PDFs must retain the high-resolution html2canvas scale'
);
assert.strictEqual(
  exportConfig.pdfScaleForHeight(5001),
  1.5,
  'medium report PDFs must retain the high-resolution html2canvas scale'
);
assert.strictEqual(
  exportConfig.pdfScaleForHeight(8001),
  1.2,
  'very long report PDFs must reduce scale only to control memory use'
);

console.log('Export PDF scale policy OK');
