import { test, expect } from './fixtures';

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
