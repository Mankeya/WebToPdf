import { test, expect } from './fixtures';

test('padrão: o clique no ícone continua abrindo o menu de formatos', async ({ context, extensionId }) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(popup.getByRole('heading', { name: 'Converter a página atual' })).toBeVisible();
  await expect(popup.locator('[data-format="pdf"]')).toBeEnabled();
  await expect(popup.locator('#direct-conversion')).not.toBeChecked();
});

test('ligar a conversão direta no menu persiste a escolha e avisa o próximo clique', async ({ context, extensionId, extensionWorker }) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  await popup.locator('.direct-label').click();
  await expect(popup.locator('#direct-conversion')).toBeChecked();
  await expect(popup.getByRole('status')).toContainText('o próximo clique no ícone abre o PDF direto');

  const stored = await extensionWorker.evaluate(() => chrome.storage.local.get('directConversion'));
  expect(stored.directConversion).toBe(true);
});

test('com a conversão direta ligada, o ícone leva à prévia do PDF já convertendo, sem menu', async ({ context, extensionWorker, extensionId, fixtureUrl }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');
  await extensionWorker.evaluate(() => chrome.storage.local.set({ directConversion: true }));

  // A aba de origem precisa ser a ativa, como no clique real no ícone.
  await source.bringToFront();
  const previewPromise = context.waitForEvent('page', { predicate: (page) => page.url().includes('preview.html') });
  const popup = await context.newPage();
  await popup.bringToFront();
  await source.bringToFront();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const preview = await previewPromise;

  expect(preview.url()).toContain(`sourceTabId=${tabId}`);
  expect(preview.url()).toContain('format=pdf');
  await expect(preview.getByRole('status').filter({ hasText: 'PDF pronto' })).toBeVisible({ timeout: 30_000 });
  // O menu não foi renderizado: o próprio popup se fecha ao abrir a prévia.
  const menuRendered = popup.isClosed() ? false : await popup.locator('[data-format="pdf"]').count() > 0;
  expect(menuRendered).toBe(false);
});

test('com a conversão direta ligada, página interna abre a prévia com o aviso de incompatibilidade', async ({ context, extensionId }) => {
  await context.serviceWorkers()[0]?.evaluate(() => chrome.storage.local.set({ directConversion: true }));

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  // O próprio popup é a aba ativa: uma página interna, que não pode ser convertida.
  const preview = await context.waitForEvent('page', { predicate: (page) => page.url().includes('preview.html') });
  expect(preview.url()).toContain('error=unsupported-page');
  await expect(preview.getByRole('status')).toContainText('Página não compatível', { timeout: 30_000 });
});

test('a prévia desliga a conversão direta e devolve o menu', async ({ extensionWorker, fixtureUrl, context, extensionId }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');
  await extensionWorker.evaluate(() => chrome.storage.local.set({ directConversion: true }));

  const preview = await context.newPage();
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}&format=pdf`);
  await expect(preview.getByRole('status').filter({ hasText: 'PDF pronto' })).toBeVisible({ timeout: 30_000 });

  const toggle = preview.locator('#direct-conversion');
  await expect(toggle).toBeChecked();
  // O input é oculto pelo estilo (padrão dos interruptores da prévia): o clique
  // acontece no rótulo, como o usuário faria.
  await preview.locator('label.switch', { has: toggle }).click();
  await expect(toggle).not.toBeChecked();

  const stored = await extensionWorker.evaluate(() => chrome.storage.local.get('directConversion'));
  expect(stored.directConversion).toBe(false);

  // Com a flag desligada, o ícone volta a abrir o menu.
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByRole('heading', { name: 'Converter a página atual' })).toBeVisible();
  await expect(popup.locator('#direct-conversion')).not.toBeChecked();
});

test('a prévia carrega a conversão direta já ligada quando o modo está ativo', async ({ extensionWorker, fixtureUrl, context, extensionId }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');
  await extensionWorker.evaluate(() => chrome.storage.local.set({ directConversion: true }));

  const preview = await context.newPage();
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}&format=pdf`);
  await expect(preview.getByRole('status').filter({ hasText: 'PDF pronto' })).toBeVisible({ timeout: 30_000 });
  await expect(preview.locator('#direct-conversion')).toBeChecked();
});
