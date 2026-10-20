'use strict';

/*
 * First-load regression: production deployments do not publish the local
 * seed (construramsa_db.json). The app must create a fresh DB and finish its
 * normal initialization instead of returning early when the seed is absent.
 */
const assert = require('assert');
const http = require('http');
const { chromium } = require('playwright');
const staticHandler = require('./server.js');

const PORT = 8173;
const LOCAL_URL = `http://127.0.0.1:${PORT}/`;
const PRODUCTION_URL = `http://produccion.test:${PORT}/`;

async function bootState(browser, url, expectedSeedRequests) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const httpErrors = [];
  let seedRequests = 0;

  page.on('response', (response) => {
    if (response.status() >= 400) {
      httpErrors.push({ status: response.status(), url: response.url() });
    }
  });

  const server = http.createServer((request, response) => {
    if ((request.url || '').split('?')[0] === '/construramsa_db.json') {
      seedRequests += 1;
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not Found');
      return;
    }
    staticHandler(request, response);
  });
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);

    const before = await page.evaluate(() => {
      const raw = localStorage.getItem('construramsa_db');
      const db = raw ? JSON.parse(raw) : null;
      return {
        activeModule: document.querySelector('.module.active')?.id || null,
        projects: db && Array.isArray(db.proyectos) ? db.proyectos.length : null,
      };
    });

    await page.locator('[data-module="configuracion"]').first().click();
    await page.waitForTimeout(300);
    const activeAfterNavigation = await page.evaluate(
      () => document.querySelector('.module.active')?.id || null
    );

    assert.strictEqual(seedRequests, expectedSeedRequests, 'unexpected seed requests');
    assert.strictEqual(before.activeModule, 'resumen', 'the app must boot in the summary view');
    assert.strictEqual(before.projects, 0, 'a fresh production boot must create an empty DB');
    assert.strictEqual(
      activeAfterNavigation,
      'configuracion',
      'tab navigation must be initialized after a fresh boot'
    );
    if (expectedSeedRequests === 0) {
      assert.deepStrictEqual(httpErrors, [], 'production boot must not request the local seed');
    }
  } finally {
    await context.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--host-resolver-rules=MAP produccion.test 127.0.0.1'],
  });
  try {
    await bootState(browser, PRODUCTION_URL, 0);
    await bootState(browser, LOCAL_URL, 1);
    console.log('First-load boot fallback tests OK');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
