import type { Worker } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * Playwright não aciona a barra de ferramentas para conceder activeTab. Estes
 * testes simulam somente os metadados que esse gesto liberaria (a URL da aba);
 * a impressão, o cache e a conversão são os caminhos reais.
 */
async function grantTabUrl(extensionWorker: Worker): Promise<void> {
  await extensionWorker.evaluate(() => {
    const get = chrome.tabs.get.bind(chrome.tabs);
    chrome.tabs.get = (async (id: number) => {
      const tab = await get(id);
      const patch = (globalThis as { __webtopdfE2eUrl?: { tabId: number; url: string } }).__webtopdfE2eUrl;
      return patch && patch.tabId === id ? { ...tab, url: patch.url } : tab;
    }) as typeof chrome.tabs.get;
  });
}

test('PDF antecipado do menu alimenta a prévia mesmo com a aba presa por outro debugger', async ({ context, extensionWorker, extensionId, fixtureUrl }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id!, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');

  await grantTabUrl(extensionWorker);
  await extensionWorker.evaluate(({ tabId, url }) => {
    (globalThis as { __webtopdfE2eUrl?: unknown }).__webtopdfE2eUrl = { tabId, url };
  }, { tabId, url: fixtureUrl });

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const early = await popup.evaluate((id) => chrome.runtime.sendMessage({ type: 'early-print', tabId: id }), tabId);
  expect(early).toEqual({ ok: true });

  // Sessão do debugger presa à aba: a conversão ao vivo falharia ao anexar —
  // só o PDF antecipado guardado consegue fechar a conversão.
  await extensionWorker.evaluate(async (id) => { await chrome.debugger.attach({ tabId: id }, '1.3'); }, tabId);
  try {
    const preview = await context.newPage();
    await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}`);
    await expect(preview.getByRole('status')).toContainText('PDF pronto', { timeout: 30_000 });
    await expect(preview.locator('.textLayer')).toContainText('Relatório de teste WEBtoPDF');
  } finally {
    await extensionWorker.evaluate(async (id) => { await chrome.debugger.detach({ tabId: id }).catch(() => undefined); }, tabId);
  }
});

test('navegar depois da impressão antecipada descarta o PDF guardado', async ({ context, extensionWorker, extensionId, fixtureUrl }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id!, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');

  await grantTabUrl(extensionWorker);
  await extensionWorker.evaluate(({ tabId, url }) => {
    (globalThis as { __webtopdfE2eUrl?: unknown }).__webtopdfE2eUrl = { tabId, url };
  }, { tabId, url: fixtureUrl });

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const early = await popup.evaluate((id) => chrome.runtime.sendMessage({ type: 'early-print', tabId: id }), tabId);
  expect(early).toEqual({ ok: true });

  // Navega para outra página: nem a invalidação por URL nem o cache antigo
  // podem sobreviver — a prévia precisa mostrar a página nova.
  const nextUrl = `${new URL(fixtureUrl).origin}/dark-page.html`;
  await extensionWorker.evaluate(async ({ tabId, url }) => {
    (globalThis as { __webtopdfE2eUrl?: { tabId: number; url: string } }).__webtopdfE2eUrl = { tabId, url };
    await chrome.tabs.update(tabId, { url });
  }, { tabId, url: nextUrl });

  const preview = await context.newPage();
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}`);
  await expect(preview.getByRole('status')).toContainText('PDF pronto', { timeout: 30_000 });
  await expect(preview.locator('.textLayer')).toContainText('Conteúdo visível no tema escuro');
  await expect(preview.locator('.textLayer')).not.toContainText('Relatório de teste');
});

test('configurações trocadas depois da impressão antecipada regeneram o PDF na prévia', async ({ context, extensionWorker, extensionId, fixtureUrl }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id!, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');

  await grantTabUrl(extensionWorker);
  await extensionWorker.evaluate(({ tabId, url }) => {
    (globalThis as { __webtopdfE2eUrl?: unknown }).__webtopdfE2eUrl = { tabId, url };
  }, { tabId, url: fixtureUrl });

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const early = await popup.evaluate((id) => chrome.runtime.sendMessage({ type: 'early-print', tabId: id }), tabId);
  expect(early).toEqual({ ok: true });

  // A prévia vai abrir em paisagem; o PDF guardado é retrato. Ele não pode
  // ser reaproveitado: a conversão precisa reimprimir ao vivo.
  await extensionWorker.evaluate(() => chrome.storage.local.set({
    printSettings: {
      paperSize: 'A4', customWidthMm: 210, customHeightMm: 297,
      orientation: 'landscape', marginMm: 10, scale: 1,
      printBackground: true, displayHeaderFooter: false,
    },
  }));

  const preview = await context.newPage();
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}`);
  await expect(preview.getByRole('status')).toContainText('PDF pronto', { timeout: 30_000 });
  const box = await preview.getByLabel('Página 1 do PDF').boundingBox();
  expect(box?.width).toBeGreaterThan(box?.height ?? Infinity);
});
