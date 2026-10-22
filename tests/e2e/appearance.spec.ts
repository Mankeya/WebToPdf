import { test, expect } from './fixtures';

test('preserva fundo escuro e conteúdo da tela em vez do CSS de impressão', async ({ extensionWorker, fixtureUrl, context, extensionId }) => {
  const url = new URL('dark-page.html', fixtureUrl).href;
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, url);
  const source = context.pages().find((page) => page.url() === url) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');
  await expect(source.locator('body')).toHaveCSS('background-color', 'rgb(16, 24, 32)');
  const originalDom = await source.locator('html').innerHTML();
  const preview = await context.newPage();
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}`);
  await expect(preview.getByRole('status')).toContainText('PDF pronto', { timeout: 20_000 });

  const background = await preview.getByLabel('Página 1 do PDF').evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error('Canvas ausente.');
    const pixel = element.getContext('2d')?.getImageData(Math.floor(element.width / 2), Math.floor(element.height / 2), 1, 1).data;
    return pixel ? Array.from(pixel) : null;
  });
  expect(background).toEqual([16, 24, 32, 255]);
  await expect(preview.locator('.textLayer')).toContainText('Conteúdo visível no tema escuro');
  expect(await source.locator('html').innerHTML()).toBe(originalDom);
  await expect(source.locator('body')).toHaveCSS('background-color', 'rgb(16, 24, 32)');
  expect(await source.evaluate(() => matchMedia('print').matches)).toBe(false);
});

test('preserva o esquema de cor do sistema em vez de reimprimir em claro', async ({ extensionWorker, fixtureUrl, context, extensionId }) => {
  const url = new URL('system-dark.html', fixtureUrl).href;
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, url);
  const source = context.pages().find((page) => page.url() === url) ?? await context.waitForEvent('page');
  await source.emulateMedia({ colorScheme: 'dark' });
  await source.waitForLoadState('load');
  await expect(source.locator('body')).toHaveCSS('background-color', 'rgb(16, 24, 32)');

  const preview = await context.newPage();
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}`);
  await expect(preview.getByRole('status')).toContainText('PDF pronto', { timeout: 20_000 });

  const background = await preview.getByLabel('Página 1 do PDF').evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error('Canvas ausente.');
    const pixel = element.getContext('2d')?.getImageData(Math.floor(element.width / 2), Math.floor(element.height / 2), 1, 1).data;
    return pixel ? Array.from(pixel) : null;
  });
  expect(background).toEqual([16, 24, 32, 255]);
  await expect(source.locator('body')).toHaveCSS('background-color', 'rgb(16, 24, 32)');
});
