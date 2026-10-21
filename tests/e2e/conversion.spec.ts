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

test('gera a prévia real com texto selecionável e navegação de páginas', async ({ extensionWorker, fixtureUrl, context, extensionId }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');
  const preview = await context.newPage();
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}`);

  await expect(preview.getByRole('status')).toContainText('PDF pronto', { timeout: 20_000 });
  await expect(preview.getByLabel('Página 1 do PDF')).toBeVisible();
  await expect(preview.locator('.textLayer')).toContainText('Relatório de teste WEBtoPDF');
  await expect(preview.getByLabel('Página atual')).toHaveValue('1');
  await preview.getByRole('button', { name: 'Próxima página' }).click();
  await expect(preview.locator('.textLayer')).toContainText('Imagem e tabela');
  await expect(preview.getByLabel('Página atual')).toHaveValue('2');
});

test('aplica ajustes somente ao atualizar e lembra as preferências', async ({ extensionWorker, fixtureUrl, context, extensionId }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');
  const preview = await context.newPage();
  const previewUrl = `chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}`;
  await preview.goto(previewUrl);
  await expect(preview.getByRole('status')).toContainText('PDF pronto');
  const canvas = preview.getByLabel('Página 1 do PDF');
  const before = await canvas.boundingBox();
  await preview.getByLabel('Orientação', { exact: true }).selectOption('landscape');
  await expect(preview.getByRole('status')).toContainText('ajustes pendentes');
  expect(await canvas.boundingBox()).toEqual(before);
  await preview.getByRole('button', { name: 'Atualizar prévia' }).click();
  await expect(preview.getByRole('status')).toContainText('PDF pronto');
  const after = await canvas.boundingBox();
  expect(after?.width).toBeGreaterThan(after?.height ?? Infinity);

  await preview.close();
  const reopened = await context.newPage();
  await reopened.goto(previewUrl);
  await expect(reopened.getByRole('status')).toContainText('PDF pronto');
  await expect(reopened.getByLabel('Orientação', { exact: true })).toHaveValue('landscape');
});

test('habilita botões de download após conversão e usa nome padrão', async ({ extensionWorker, fixtureUrl, context, extensionId }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');
  const preview = await context.newPage();
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}`);

  await expect(preview.getByRole('status')).toContainText('PDF pronto', { timeout: 20_000 });
  await expect(preview.getByRole('button', { name: 'Baixar PDF' })).toBeEnabled();
  await expect(preview.getByRole('button', { name: 'Salvar como…' })).toBeEnabled();
  await expect(preview.getByLabel('Nome do arquivo')).toHaveValue(/^Relatório de teste WEBtoPDF - \d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.pdf$/);
});

test('atualiza nome do arquivo ao editar', async ({ extensionWorker, fixtureUrl, context, extensionId }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');
  const preview = await context.newPage();
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}`);

  await expect(preview.getByRole('status')).toContainText('PDF pronto', { timeout: 20_000 });
  await preview.getByLabel('Nome do arquivo').fill('meu-relatorio');
  await expect(preview.getByLabel('Nome do arquivo')).toHaveValue('meu-relatorio');
});

test('baixa o PDF exibido com nome válido e sem sobrescrever', async ({ extensionWorker, fixtureUrl, context, extensionId, downloadDir }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');
  const preview = await context.newPage();
  const session = await context.newCDPSession(preview);
  await session.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, eventsEnabled: true });
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}`);

  await expect(preview.getByRole('status')).toContainText('PDF pronto', { timeout: 20_000 });
  await preview.getByLabel('Nome do arquivo').fill('meu-relatorio');
  await preview.getByRole('button', { name: 'Baixar PDF' }).click();
  await expect(preview.getByRole('status')).toContainText('PDF salvo com sucesso');

  const items = await extensionWorker.evaluate(async () => chrome.downloads.search({ orderBy: ['-startTime'], limit: 3 }));
  expect(items.length).toBeGreaterThan(0);
  expect(items[0]?.state).toBe('complete');
  expect(items[0]?.filename).toContain('meu-relatorio');

  const first = await waitForDownload(downloadDir, 'meu-relatorio.pdf');
  expect(first.name).toBe('meu-relatorio.pdf');
  expect(await readFile(first.path).then((buffer) => buffer.subarray(0, 5).toString('latin1'))).toBe('%PDF-');

  await preview.getByRole('button', { name: 'Baixar PDF' }).click();
  await expect(preview.getByRole('status')).toContainText('PDF salvo com sucesso');
  const files = (await readdir(downloadDir)).sort();
  expect(files).toHaveLength(2);
  expect(files).toContain('meu-relatorio.pdf');
  expect(files.some((name) => name.startsWith('meu-relatorio ('))).toBe(true);
  expect(new Set(files).size).toBe(2);
});
