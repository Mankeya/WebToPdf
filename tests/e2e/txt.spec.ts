import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect } from './fixtures';

async function waitForDownload(directory: string, name: string, timeoutMs = 15_000): Promise<{ name: string; path: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const entries = await readdir(directory, { withFileTypes: true });
    const found = entries.find((entry) => entry.isFile() && entry.name === name);
    if (found) {
      const path = join(directory, found.name);
      const buffer = await readFile(path);
      if (buffer.length > 0) return { name: found.name, path };
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Download não encontrado: ${name}`);
}

test('escolher Texto abre a prévia da aba ativa e conclui a extração', async ({ context, extensionWorker, extensionId, fixtureUrl }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.locator('[data-format="txt"]')).toBeEnabled();

  // A aba de origem precisa ser a ativa, como no clique real no ícone.
  await source.bringToFront();
  const previewPromise = context.waitForEvent('page', { predicate: (page) => page.url().includes('preview.html') });
  await popup.locator('[data-format="txt"]').click();
  const preview = await previewPromise;

  expect(preview.url()).toContain(`sourceTabId=${tabId}`);
  expect(preview.url()).toContain('format=txt');
  await expect(preview.getByRole('status')).toContainText('Texto pronto', { timeout: 30_000 });
  await expect(preview.getByRole('button', { name: 'Baixar Texto' })).toBeEnabled();
});

test('exibe o texto extraído em prévia e esconde os ajustes de impressão', async ({ extensionWorker, fixtureUrl, context, extensionId }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');
  const preview = await context.newPage();
  const errors: string[] = [];
  preview.on('pageerror', (error) => errors.push(error.message));
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}&format=txt`);

  await expect(preview.getByRole('status')).toContainText('Texto pronto', { timeout: 30_000 });

  const text = preview.locator('#preview-text');
  await expect(text).toBeVisible();
  await expect(text).toContainText('Relatório de teste WEBtoPDF');
  await expect(text).toContainText('Documentos de teste');
  await expect(text).toContainText('42');

  // Ajustes de impressão não se aplicam a texto: só o nome do arquivo fica.
  await expect(preview.getByRole('heading', { name: 'Papel' })).toBeHidden();
  await expect(preview.getByRole('heading', { name: 'Orientação' })).toBeHidden();
  await expect(preview.getByRole('heading', { name: 'Layout' })).toBeHidden();
  await expect(preview.getByRole('heading', { name: 'Conteúdo' })).toBeHidden();
  await expect(preview.getByRole('heading', { name: 'Arquivo' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('baixa o texto exibido como UTF-8 com BOM e nome válido', async ({ extensionWorker, fixtureUrl, context, extensionId, downloadDir }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');
  const preview = await context.newPage();
  const session = await context.newCDPSession(preview);
  await session.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, eventsEnabled: true });
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}&format=txt`);

  await expect(preview.getByRole('status')).toContainText('Texto pronto', { timeout: 30_000 });
  await preview.getByLabel('Nome do arquivo').fill('meu-texto');
  await preview.getByRole('button', { name: 'Baixar Texto' }).click();
  await expect(preview.getByRole('status')).toContainText('Texto salvo com sucesso');

  const items = await extensionWorker.evaluate(async () => chrome.downloads.search({ orderBy: ['-startTime'], limit: 3 }));
  expect(items.length).toBeGreaterThan(0);
  expect(items[0]?.state).toBe('complete');

  const file = await waitForDownload(downloadDir, 'meu-texto.txt');
  const buffer = await readFile(file.path);
  // BOM UTF-8 para o Bloco do Windows reconhecer a acentuação.
  expect([...buffer.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(buffer.toString('utf8')).toContain('Relatório de teste WEBtoPDF');
});

test('recusa páginas sem texto visível com mensagem clara e sem download', async ({ extensionWorker, noTextFixtureUrl, context, extensionId, downloadDir }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, noTextFixtureUrl);
  const source = context.pages().find((page) => page.url() === noTextFixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');
  const preview = await context.newPage();
  const session = await context.newCDPSession(preview);
  await session.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, eventsEnabled: true });
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}&format=txt`);

  await expect(preview.getByRole('status')).toContainText('Nenhum texto visível para extrair nesta página', { timeout: 30_000 });
  await expect(preview.getByRole('button', { name: 'Baixar Texto' })).toBeDisabled();

  const items = await extensionWorker.evaluate(async () => chrome.downloads.search({ orderBy: ['-startTime'], limit: 5 }));
  expect(items).toHaveLength(0);
});
