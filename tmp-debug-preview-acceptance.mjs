import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const html = await readFile('./docs/testing-artifacts/code.html', 'utf8');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3106' });
const page = await context.newPage();
page.on('console', msg => console.log('PAGE_CONSOLE', msg.type(), msg.text()));
page.on('pageerror', err => console.log('PAGE_ERROR', err.message));

async function req(method, url, body) {
  const res = await page.request.fetch(url, { method, data: body, headers: { 'content-type': 'application/json' } });
  const text = await res.text();
  console.log('REQ', method, url, res.status(), text.slice(0, 400));
  return { res, text };
}

await req('POST', '/api/platform/studio/reset');
await page.goto('/platform/onboarding/import');
await page.getByTestId('import-source-tab-html').click();
await page.getByTestId('import-source-input').fill(html);
await Promise.all([
  page.waitForResponse(r => r.request().method()==='POST' && r.url().includes('/api/platform/studio/import/process')),
  page.getByTestId('import-process-source').click(),
]);
await Promise.all([
  page.waitForResponse(r => r.request().method()==='POST' && r.url().includes('/api/platform/studio/blocks/publish')),
  page.getByTestId('import-publish-selected').click(),
]);

await page.goto('/platform/onboarding/pages');
await page.getByTestId('pages-add-new').click();
console.log('AFTER_ADD_SELECTED', await page.locator('[data-active="true"]').textContent());
await page.getByTestId('pages-add-block-select').selectOption({ index: 0 });
await page.getByTestId('pages-add-block-button').click();
await page.getByPlaceholder('Select product...').fill('lens-ai-revenue-platform');
await page.getByRole('button', { name: 'enterprise' }).click();
await page.getByPlaceholder('Button text').fill('Read Customer Stories');
await page.getByPlaceholder('Link URL').fill('/contact');
await page.getByPlaceholder('utm_source').fill('lmnas');
await page.getByPlaceholder('utm_medium').fill('studio');
await page.getByPlaceholder('utm_campaign').fill('transformercorp-testimonials');
await page.getByPlaceholder('Meta title').fill('Transformer Testimonials | LENS AI Revenue Platform');
await page.getByPlaceholder('Meta description').fill('Trusted by European transformer manufacturers. Explore customer stories and proof points from complex manufacturing environments.');
await page.locator("label:has-text('Taxonomy valid') input[type='checkbox']").check();
const [saveResponse] = await Promise.all([
  page.waitForResponse(r => r.request().method()==='POST' && r.url().includes('/api/platform/studio/pages')),
  page.getByRole('button', { name: 'Save Draft' }).click(),
]);
console.log('SAVE_RESPONSE', await saveResponse.text());
console.log('AFTER_SAVE_SELECTED', await page.locator('[data-active="true"]').textContent());
const popupPromise = page.waitForEvent('popup');
await page.getByTestId('pages-preview-page-button').click();
const popup = await popupPromise;
popup.on('console', msg => console.log('POPUP_CONSOLE', msg.type(), msg.text()));
popup.on('pageerror', err => console.log('POPUP_ERROR', err.message));
popup.on('request', req => {
  if (req.url().includes('/api/platform/studio/pages')) console.log('POPUP_REQUEST', req.method(), req.url());
});
popup.on('response', async r => {
  if (r.url().includes('/api/platform/studio/pages')) {
    console.log('POPUP_RESPONSE', r.request().method(), r.url(), r.status(), (await r.text()).slice(0,400));
  }
});
await popup.waitForLoadState('domcontentloaded');
console.log('POPUP_URL', popup.url());
console.log('POPUP_HEADER', await popup.locator('body').textContent());
await popup.getByTestId('preview-accept-button').click();
await popup.waitForTimeout(5000);
console.log('POPUP_AFTER_CLICK', await popup.locator('body').textContent());
await browser.close();
