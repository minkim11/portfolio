const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('#copy-email').click();
  await page.waitForFunction(() => document.getElementById('contact-status').textContent.includes('복사했습니다'));
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'minhykkimm@gmail.com');
  await page.waitForFunction(() => {
    const opacity = Number(getComputedStyle(document.getElementById('contact-status')).opacity);
    return opacity > 0 && opacity < .9;
  });
  await page.locator('#copy-email').click();
  await page.waitForFunction(() => getComputedStyle(document.getElementById('contact-status')).opacity === '1');
  await page.waitForFunction(() => document.getElementById('contact-status').textContent === '');
  assert.equal(await page.locator('a[href^="mailto:"]').count(), 0);
  assert.equal(await page.locator('.contact-list .contact-action[href]').getAttribute('href'), 'https://github.com/minkim11');
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => { throw new Error('Permission denied'); };
  });
  await page.locator('#copy-email').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('contact-status').textContent.includes('복사했습니다'));
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'minhykkimm@gmail.com');
  assert.equal(await page.locator('textarea').count(), 0);
  await page.evaluate(() => { document.execCommand = () => false; });
  await page.locator('#copy-email').click();
  await page.waitForFunction(() => document.getElementById('contact-status').textContent.includes('직접 복사'));
  assert.equal(await page.locator('textarea').count(), 0);
  await page.reload();
  assert.equal(await page.locator('#skills .star-tooltip, #skills button, #skills [aria-describedby]').count(), 0);
  assert.equal(await page.locator('#skills .photo-star').count(), 7);
  console.log('PASS email copy on file URL, keyboard fallback, denied-copy feedback, GitHub link');
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await page.waitForTimeout(150);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const projects = await page.locator('.project-summary').evaluateAll(items => items.map(item => item.getBoundingClientRect().top));
    assert(projects[0] < projects[1] && projects[1] < projects[2]);
    assert.equal(await page.locator('.constellation-lines polyline').count(), 2);
    assert.equal(await page.locator('.constellation-lines circle').count(), 4);
    for (const trigger of await page.locator('.project-summary .star-trigger').all()) {
      await trigger.focus();
      const tooltip = page.locator('#' + await trigger.getAttribute('aria-describedby'));
      await page.waitForTimeout(180);
      assert.equal(await tooltip.evaluate(el => getComputedStyle(el).visibility), 'visible');
      const box = await tooltip.boundingBox();
      assert(box.x >= 15 && box.x + box.width <= width - 15);
    }
    await page.locator('.project-summary').nth(1).hover();
    assert.equal(await page.locator('.constellation-lines g.is-active').count(), 2);
    assert.match(await page.locator('.project-summary').nth(1).locator('.photo-star').evaluate(el => getComputedStyle(el).filter), /brightness\(/);
    await page.evaluate(() => { document.activeElement.blur(); scrollTo({ top: 0, behavior: 'instant' }); });
    await page.mouse.move(0, 0);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(require('node:os').tmpdir(), `portfolio-night-sky-${width}.png`) });
    for (const trigger of await page.locator('.project-summary .star-trigger').all()) {
      await trigger.focus();
      await page.keyboard.press('Enter');
      const id = await trigger.getAttribute('aria-controls');
      await page.waitForFunction(id => document.getElementById(id).open, id);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('dialog[open]'));
      await page.waitForFunction(() => location.hash === '');
    }
    console.log(`PASS viewport ${width}: layout, tooltip, focus, modal`);
  }
  await page.evaluate(() => {
    const copy = document.querySelector('.project-summary').cloneNode(true);
    copy.id = 'temporary-project';
    document.querySelector('.project-list').append(copy);
  });
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.constellation-lines polyline').count(), 3);
  assert(await page.locator('#temporary-project').evaluate(el => el.getBoundingClientRect().top > el.previousElementSibling.getBoundingClientRect().top));
  await page.evaluate(() => document.getElementById('temporary-project').remove());
  await page.setViewportSize({width:1440,height:960});
  const first = page.locator('.project-summary .star-trigger').first();
  await first.click();
  await page.locator('#localstamp-detail .dialog-close').click();
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await first.click();
  await page.mouse.click(1, 1);
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await page.goto(pathToFileURL(path.resolve('index.html')).href + '#payment-detail');
  assert(await page.locator('#payment-detail').evaluate(el => el.open));
  await page.keyboard.press('Escape');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.photo-star').first().evaluate(el => getComputedStyle(el).transitionDuration), '0s');
  assert.equal(errors.length, 0, errors.join('\n'));
  await page.route('**/night-sky-background.png', route => route.abort());
  await page.reload();
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(3, 5, 11)');
  console.log('PASS added project, pointer open/close, deep link, reduced motion, no JS errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
