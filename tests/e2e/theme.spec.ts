import { test, expect } from './fixtures';

test('padrão: a prévia abre no modo claro, sem data-theme', async ({ context, extensionWorker, extensionId, fixtureUrl }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');

  const preview = await context.newPage();
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}&format=pdf`);
  await expect(preview.getByRole('status').filter({ hasText: 'PDF pronto' })).toBeVisible({ timeout: 30_000 });

  await expect(preview.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  await expect(preview.locator('#theme-toggle')).toHaveAttribute('aria-label', 'Ativar modo escuro');
});

test('o botão aplica o modo escuro na interface, mantém o documento branco e persiste', async ({ context, extensionWorker, extensionId, fixtureUrl }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');

  const preview = await context.newPage();
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}&format=pdf`);
  await expect(preview.getByRole('status').filter({ hasText: 'PDF pronto' })).toBeVisible({ timeout: 30_000 });

  await preview.locator('#theme-toggle').click();
  await expect(preview.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(preview.locator('#theme-toggle')).toHaveAttribute('aria-label', 'Ativar modo claro');

  // Só a interface escurece; o papel continua branco.
  const colors = await preview.evaluate(() => {
    const page = document.querySelector('.pdf-page');
    const sidebar = document.querySelector('.preview-sidebar');
    const title = document.querySelector('#preview-title');
    if (!page || !sidebar || !title) return null;
    return {
      page: getComputedStyle(page).backgroundColor,
      sidebar: getComputedStyle(sidebar).backgroundColor,
      title: getComputedStyle(title).color,
      scheme: getComputedStyle(document.documentElement).colorScheme,
    };
  });
  expect(colors).not.toBeNull();
  expect(colors!.page).toBe('rgb(255, 255, 255)');
  expect(colors!.sidebar).not.toBe('rgb(255, 255, 255)');
  expect(colors!.title).not.toBe('rgb(10, 23, 37)');
  expect(colors!.scheme).toContain('dark');

  const stored = await extensionWorker.evaluate(() => chrome.storage.local.get('theme'));
  expect(stored.theme).toBe('dark');

  // Persistência: recarregar a prévia mantém o escuro.
  await preview.reload();
  await expect(preview.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('a prévia carrega já no escuro quando a preferência está salva', async ({ context, extensionWorker, extensionId, fixtureUrl }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');
  await extensionWorker.evaluate(() => chrome.storage.local.set({ theme: 'dark' }));

  const preview = await context.newPage();
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}&format=pdf`);
  await expect(preview.getByRole('status').filter({ hasText: 'PDF pronto' })).toBeVisible({ timeout: 30_000 });
  await expect(preview.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('clicar de volta volta ao claro e persiste', async ({ context, extensionWorker, extensionId, fixtureUrl }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');
  await extensionWorker.evaluate(() => chrome.storage.local.set({ theme: 'dark' }));

  const preview = await context.newPage();
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}&format=pdf`);
  await expect(preview.getByRole('status').filter({ hasText: 'PDF pronto' })).toBeVisible({ timeout: 30_000 });

  await preview.locator('#theme-toggle').click();
  await expect(preview.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  await expect(preview.locator('#theme-toggle')).toHaveAttribute('aria-label', 'Ativar modo escuro');

  const stored = await extensionWorker.evaluate(() => chrome.storage.local.get('theme'));
  expect(stored.theme).toBe('light');
});

test('grade de papel: nenhuma caixa vaza e as oito células têm a mesma altura', async ({ context, extensionWorker, extensionId, fixtureUrl }) => {
  const tabId = await extensionWorker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');

  const preview = await context.newPage();
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}&format=pdf`);
  await expect(preview.getByRole('status').filter({ hasText: 'PDF pronto' })).toBeVisible({ timeout: 30_000 });

  const report = await preview.evaluate(() => {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.paper-option')];
    const sidebarEl = document.querySelector('.preview-sidebar');
    return {
      widths: buttons.map((b) => Math.round(b.getBoundingClientRect().width)),
      heights: buttons.map((b) => Math.round(b.getBoundingClientRect().height)),
      overflowing: buttons
        .filter((b) => b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1)
        .map((b) => b.dataset.paper ?? '?'),
      sidebar: sidebarEl ? Math.round(sidebarEl.getBoundingClientRect().width) : 0,
      sidebarPosition: sidebarEl ? getComputedStyle(sidebarEl).position : 'missing',
    };
  });

  // Causa raiz: a coluna tem 360px (o CSS do PDF.js não pode mais espremi-la).
  expect(report.sidebar).toBe(360);
  expect(report.sidebarPosition).toBe('sticky');
  // Nenhuma célula vaza texto ou retângulo para fora da caixa.
  expect(report.overflowing).toEqual([]);
  // E as oito caixas têm altura idêntica.
  expect(new Set(report.heights).size).toBe(1);
});
