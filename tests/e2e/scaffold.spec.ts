import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, expect, test } from '@playwright/test';

test('carrega a extensão MV3 e a tela inicial sem simular conversão', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'webtopdf-test-'));
  const extensionPath = resolve('dist');

  try {
    const context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    try {
      const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
      expect(await worker.evaluate(() => chrome.action.onClicked.hasListeners())).toBe(true);
      const extensionId = new URL(worker.url()).hostname;
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));

      await page.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=42`);
      await expect(page.getByRole('heading', { name: 'WEBtoPDF', exact: true })).toBeVisible();
      await expect(page.getByRole('status')).toContainText('ainda não estão implementadas');
      await expect(page.getByLabel('Papel', { exact: true })).toHaveValue('A4');
      await expect(page.getByLabel('Margens (mm)', { exact: true })).toHaveValue('10');
      await expect(page.getByLabel('Incluir fundos')).toBeChecked();
      await expect(page.getByRole('button', { name: 'Atualizar prévia' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Baixar PDF' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Salvar como…' })).toBeDisabled();

      await page.goto(`chrome-extension://${extensionId}/preview.html?error=unsupported-page`);
      await expect(page.getByRole('status')).toContainText('Página não compatível');
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
});
