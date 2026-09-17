// Browser regressions for responsive navigation and read-only viewing.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.MITO_CHROMIUM_EXECUTABLE || undefined });
 try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.message().includes('下書き') ? d.dismiss() : d.accept());
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  await page.setInputFiles('#json-file-input', path.resolve(__dirname, '../sample/sample_space_race.json'));
  await page.waitForFunction(() => currentData?.active?.length > 10);
  for (const width of [320, 390, 639, 640, 768, 1023, 1024, 1440]) {
   await page.setViewportSize({ width, height: 844 });
   await page.waitForFunction(expected => document.querySelector("#toggle-left-panel").getAttribute("aria-expanded") === String(expected), width >= 1024);
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `no page overflow at ${width}`);
   assert.equal(await page.locator('#toggle-left-panel').getAttribute('aria-expanded'), String(width >= 1024));
   console.log(`OK responsive width ${width}`);
  }
  await page.click('#toggle-left-panel');
  await page.reload();
  assert.equal(await page.locator('#toggle-left-panel').getAttribute('aria-expanded'), 'false', 'desktop preference persists');
  await page.setInputFiles('#json-file-input', path.resolve(__dirname, '../sample/sample_space_race.json'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#topbar-menu-toggle');
  assert.ok(await page.locator('#open-file').isVisible());
  await page.keyboard.press('Escape');
  assert.ok(!(await page.locator('#open-file').isVisible()));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'topbar-menu-toggle');
  await page.click('#toggle-left-panel');
  assert.equal(await page.locator('#left-panel').getAttribute('aria-modal'), 'true');
  await page.keyboard.press('Shift+Tab');
  assert.ok(await page.evaluate(() => document.querySelector('#left-panel').contains(document.activeElement)));
  await page.locator('input[name="name"]').fill('保持する下書き');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'toggle-left-panel');
  await page.setViewportSize({ width: 768, height: 844 });
  await page.click('#toggle-left-panel');
  assert.equal(await page.locator('input[name="name"]').inputValue(), '保持する下書き');
  await page.locator('input[name="name"]').fill('');
  await page.locator('#panel-backdrop').click({ position: { x: 700, y: 100 } });
  await page.setViewportSize({ width: 390, height: 844 });
  const before = await page.evaluate(() => JSON.stringify(currentData));
  await page.locator('.dashboard-focus-chip').nth(1).click();
  assert.equal(await page.evaluate(() => JSON.stringify(currentData)), before, 'filter does not mutate document');
  assert.equal(await page.evaluate(() => isDirty), false);
  await page.locator('.dashboard-focus-chip').nth(1).click();
  const sticky = await page.evaluate(() => {
   const wrap = document.querySelector('.dashboard-table-wrap');
   wrap.scrollLeft = 300; wrap.scrollTop = 100;
   const cell = document.querySelector('.dashboard-table tbody tr > :first-child').getBoundingClientRect();
   return { scroll: wrap.scrollLeft, cell: cell.left, wrap: wrap.getBoundingClientRect().left };
  });
  assert.ok(sticky.scroll > 0 && Math.abs(sticky.cell - sticky.wrap) < 3, 'year remains visible during horizontal scroll');
  await page.evaluate(() => { const w = document.querySelector('.dashboard-table-wrap'); w.scrollTop=0; w.scrollLeft=0; });
  await page.locator('.dashboard-entry-card').first().tap();
  assert.ok(await page.locator('.entry-wiki').isVisible());
  assert.equal(await page.evaluate(() => editingEntryId), null, 'reading does not edit');
  assert.equal(await page.evaluate(() => isDirty), false);
  await page.locator('.entry-wiki-edit-button').click();
  assert.equal(await page.locator('#toggle-left-panel').getAttribute('aria-expanded'), 'true');
  assert.ok(await page.evaluate(() => editingEntryId !== null));
  await page.keyboard.press('Escape');
  await page.locator('.entry-wiki-back-button').click();
  assert.ok(await page.locator('.dashboard-table-wrap').isVisible());
  await page.setViewportSize({ width: 768, height: 600 });
  await page.click('#toggle-left-panel');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForFunction(() => document.querySelector('#left-panel').getAttribute('aria-modal') !== 'true');
  assert.equal(await page.locator('#toggle-left-panel').getAttribute('aria-expanded'), 'false', 'desktop choice survives mobile');
  await page.click('#toggle-left-panel');
  assert.deepEqual(errors, []);
  console.log('OK menu, drawer, draft, readonly filters, sticky year, detail and edit, responsive state');
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
