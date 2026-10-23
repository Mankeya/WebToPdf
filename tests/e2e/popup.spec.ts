import { test, expect } from './fixtures';

test('menu de formatos lista as opções com PDF e PNG disponíveis e os próximos formatos marcados', async ({ context, extensionId }) => {
  const popup = await context.newPage();
  const errors: string[] = [];
  popup.on('pageerror', (error) => errors.push(error.message));

  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(popup.getByRole('heading', { name: 'Converter a página atual' })).toBeVisible();
  await expect(popup.locator('[data-format="pdf"]')).toBeEnabled();
  await expect(popup.locator('[data-format="png"]')).toBeEnabled();
  for (const format of ['txt', 'md']) {
    await expect(popup.locator(`[data-format="${format}"]`)).toBeDisabled();
  }
  await expect(popup.locator('[data-format="png"]')).toContainText('PNG');
  await expect(popup.locator('[data-format="txt"]')).toContainText('Texto');
  await expect(popup.locator('[data-format="md"]')).toContainText('Markdown');
  await expect(popup.getByText('Em breve')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('escolher PDF abre a prévia da aba ativa e conclui a conversão', async ({ context, extensionWorker, extensionId, fixtureUrl }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByRole('button', { name: /PDF/ })).toBeEnabled();

  // A aba de origem precisa ser a ativa, como no clique real no ícone.
  await source.bringToFront();
  const previewPromise = context.waitForEvent('page', { predicate: (page) => page.url().includes('preview.html') });
  await popup.getByRole('button', { name: /PDF/ }).click();
  const preview = await previewPromise;

  expect(preview.url()).toContain(`sourceTabId=${tabId}`);
  expect(preview.url()).toContain('format=pdf');
  await expect(preview.getByRole('status').filter({ hasText: 'PDF pronto' })).toBeVisible({ timeout: 30_000 });
});

test('recusa páginas internas no menu sem abrir a prévia', async ({ context, extensionId }) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  // O próprio popup é a aba ativa: uma página interna, que não pode ser convertida.
  await popup.getByRole('button', { name: /PDF/ }).click();

  await expect(popup.getByRole('status')).toHaveText('Esta página não pode ser convertida. Abra uma aba HTTP ou HTTPS.');
  expect(context.pages().filter((page) => page.url().includes('preview.html'))).toHaveLength(0);
});
