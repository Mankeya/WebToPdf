import { test, expect } from './fixtures';
import { readdir } from 'node:fs/promises';
import { jpegToPdf } from '../../src/shared/image-pdf';

test('captura indisponível não bloqueia o menu nem produz um PDF da página errada', async ({ context, extensionId }) => {
  const popup = await context.newPage();
  const errors: string[] = [];
  popup.on('pageerror', (error) => errors.push(error.message));
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.locator('[data-format="screen-pdf"]')).toBeEnabled();
  await expect(popup.locator('[data-format="pdf"]')).toBeEnabled();
  expect(await popup.evaluate(() => globalThis.webtopdfEarlyCapture)).toBeNull();
  expect(errors).toEqual([]);
});

test('captura guardada atravessa conversão OCR até a prévia com texto', async ({ context, extensionWorker, extensionId, fixtureUrl }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id!, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');
  const image = `data:image/jpeg;base64,${(await source.screenshot({ type: 'jpeg' })).toString('base64')}`;
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await source.bringToFront();
  // Playwright não aciona a barra de ferramentas para conceder activeTab.
  // Simula somente os metadados que esse gesto liberaria; OCR e mensagens são reais.
  await extensionWorker.evaluate(({ tabId, url }) => {
    const get = chrome.tabs.get.bind(chrome.tabs);
    chrome.tabs.get = (async (id: number) => {
      const tab = await get(id);
      return id === tabId ? { ...tab, url } : tab;
    }) as typeof chrome.tabs.get;
  }, { tabId, url: fixtureUrl });
  const snapshot = await popup.evaluate(async (data) => chrome.runtime.sendMessage({ type: 'store-snapshot', ...data }), { tabId, url: fixtureUrl, data: image });
  expect(snapshot.token).toBeTruthy();
  const preview = await context.newPage();
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}&format=screen-pdf&snapshot=${snapshot.token}`);
  await expect(preview.getByRole('status')).toContainText('com texto reconhecido', { timeout: 30_000 });
  await expect(preview.locator('.textLayer')).not.toBeEmpty();
  await expect(preview.locator('#download-pdf')).toBeEnabled();
});

test('token ausente não substitui a captura por uma tela posterior', async ({ context, extensionWorker, extensionId, fixtureUrl }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, fixtureUrl);
  const preview = await context.newPage();
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}&format=screen-pdf`);
  await expect(preview.getByRole('status')).toContainText('captura da tela expirou', { timeout: 10_000 });
  await expect(preview.locator('#download-pdf')).toBeDisabled();
  await expect(preview.getByRole('heading', { name: 'Papel', exact: true })).toBeHidden();
  await expect(preview.getByRole('button', { name: 'Atualizar prévia' })).toBeHidden();
});

test('writer gera PDF real renderizável com os pixels capturados e sem camada de texto', async ({ context, extensionId, fixtureUrl }) => {
  const source = await context.newPage();
  await source.goto(fixtureUrl);
  await source.evaluate(() => {
    const panel = document.createElement('div');
    panel.textContent = 'Menu aberto';
    panel.style.cssText = 'position:fixed;left:0;top:0;width:100px;height:100px;background:rgb(255,0,0);z-index:99999';
    document.body.append(panel);
  });
  const jpeg = await source.screenshot({ type: 'jpeg', quality: 92 });
  const bytes = jpegToPdf(jpeg);
  const preview = await context.newPage();
  await preview.goto(`chrome-extension://${extensionId}/preview.html`);
  const viewerFile = (await readdir('dist/assets')).find((name) => /^pdf-viewer-.*\.js$/.test(name))!;
  const result = await preview.evaluate(async ({ data, moduleUrl }) => {
    const { PdfViewer } = await import(moduleUrl);
    const container = document.querySelector('#pdf-container')!;
    const viewer = new PdfViewer(container);
    await viewer.load(new Uint8Array(data));
    const canvas = container.querySelector('canvas')!;
    const pixel = [...canvas.getContext('2d')!.getImageData(50, 50, 1, 1).data];
    return { pages: viewer.pageCount, pixel, text: container.querySelector('.textLayer')?.textContent };
  }, { data: [...bytes], moduleUrl: `chrome-extension://${extensionId}/assets/${viewerFile}` });
  expect(result.pages).toBe(1);
  expect(result.pixel[0]).toBeGreaterThan(240);
  expect(result.pixel[1]).toBeLessThan(15);
  expect(result.pixel[2]).toBeLessThan(15);
  expect(result.text).toBe('');
});
