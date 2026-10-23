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

test('escolher PNG abre a prévia da aba ativa e conclui a conversão', async ({ context, extensionWorker, extensionId, fixtureUrl }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.locator('[data-format="png"]')).toBeEnabled();

  // A aba de origem precisa ser a ativa, como no clique real no ícone.
  await source.bringToFront();
  const previewPromise = context.waitForEvent('page', { predicate: (page) => page.url().includes('preview.html') });
  await popup.locator('[data-format="png"]').click();
  const preview = await previewPromise;

  expect(preview.url()).toContain(`sourceTabId=${tabId}`);
  expect(preview.url()).toContain('format=png');
  await expect(preview.getByRole('status')).toContainText('PNG pronto', { timeout: 30_000 });
  await expect(preview.getByRole('button', { name: 'Baixar PNG' })).toBeEnabled();
});

test('exibe a imagem da página inteira e esconde os ajustes de impressão', async ({ extensionWorker, fixtureUrl, context, extensionId }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');
  const preview = await context.newPage();
  const errors: string[] = [];
  preview.on('pageerror', (error) => errors.push(error.message));
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}&format=png`);

  await expect(preview.getByRole('status')).toContainText('PNG pronto', { timeout: 30_000 });

  // A captura cobre o conteúdo todo, não só a janela visível.
  const image = preview.locator('#preview-image');
  await expect(image).toBeVisible();
  const size = await image.evaluate((element: HTMLImageElement) => ({ width: element.naturalWidth, height: element.naturalHeight }));
  expect(size.width).toBeGreaterThan(0);
  expect(size.height).toBeGreaterThan(700);

  // Ajustes de impressão não se aplicam a imagem: só o nome do arquivo fica.
  await expect(preview.getByRole('heading', { name: 'Papel' })).toBeHidden();
  await expect(preview.getByRole('heading', { name: 'Orientação' })).toBeHidden();
  await expect(preview.getByRole('heading', { name: 'Layout' })).toBeHidden();
  await expect(preview.getByRole('heading', { name: 'Conteúdo' })).toBeHidden();
  await expect(preview.getByRole('heading', { name: 'Arquivo' })).toBeVisible();
  await expect(preview.getByRole('button', { name: 'Atualizar prévia' })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('baixa o PNG exibido com nome válido e assinatura correta', async ({ extensionWorker, fixtureUrl, context, extensionId, downloadDir }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');
  const preview = await context.newPage();
  const session = await context.newCDPSession(preview);
  await session.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, eventsEnabled: true });
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}&format=png`);

  await expect(preview.getByRole('status')).toContainText('PNG pronto', { timeout: 30_000 });
  await expect(preview.getByLabel('Nome do arquivo')).toHaveValue(/^Relatório de teste WEBtoPDF - \d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/);
  await preview.getByLabel('Nome do arquivo').fill('minha-imagem');
  await preview.getByRole('button', { name: 'Baixar PNG' }).click();
  await expect(preview.getByRole('status')).toContainText('PNG salvo com sucesso');

  const items = await extensionWorker.evaluate(async () => chrome.downloads.search({ orderBy: ['-startTime'], limit: 3 }));
  expect(items.length).toBeGreaterThan(0);
  expect(items[0]?.state).toBe('complete');

  const file = await waitForDownload(downloadDir, 'minha-imagem.png');
  const buffer = await readFile(file.path);
  expect([...buffer.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
});

test('recusa páginas acima do teto de captura com mensagem clara', async ({ extensionWorker, tallFixtureUrl, context, extensionId }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, tallFixtureUrl);
  const source = context.pages().find((page) => page.url() === tallFixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');
  const preview = await context.newPage();
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}&format=png`);

  await expect(preview.getByRole('status')).toContainText('grande demais para virar uma imagem', { timeout: 30_000 });
  await expect(preview.getByRole('button', { name: 'Baixar PNG' })).toBeDisabled();
});

test('recusa páginas internas no menu sem abrir a prévia', async ({ context, extensionId }) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  // O próprio popup é a aba ativa: uma página interna, que não pode ser convertida.
  await popup.locator('[data-format="png"]').click();

  await expect(popup.getByRole('status')).toHaveText('Esta página não pode ser convertida. Abra uma aba HTTP ou HTTPS.');
  expect(context.pages().filter((page) => page.url().includes('preview.html'))).toHaveLength(0);
});
