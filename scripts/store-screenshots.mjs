import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const output = resolve('store/screenshots');
await mkdir(output, { recursive: true });

const html = await readFile(resolve('tests/fixtures/report.html'));
const server = createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(html);
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const port = server.address().port;
const fixtureUrl = `http://127.0.0.1:${port}/report.html`;

const profile = await mkdtemp(join(tmpdir(), 'webtopdf-store-'));
const extensionPath = resolve('dist');

const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
});

try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).hostname;
  const tabId = await worker.evaluate(async (url) => (await chrome.tabs.create({ url })).id, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl) ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');

  const preview = await context.newPage();
  await preview.setViewportSize({ width: 1280, height: 800 });
  await preview.goto(`chrome-extension://${extensionId}/preview.html?sourceTabId=${tabId}`);
  await preview.getByRole('status').filter({ hasText: 'PDF pronto' }).waitFor({ timeout: 30_000 });
  await preview.waitForTimeout(800);

  await preview.screenshot({ path: resolve(output, '01-previa.png') });

  await preview.getByLabel('Orientação', { exact: true }).selectOption('landscape');
  await preview.getByRole('button', { name: 'Atualizar prévia' }).click();
  await preview.getByRole('status').filter({ hasText: 'PDF pronto' }).waitFor({ timeout: 30_000 });
  await preview.waitForTimeout(800);
  await preview.screenshot({ path: resolve(output, '02-ajustes.png') });

  await preview.getByRole('button', { name: 'Próxima página' }).click();
  await preview.waitForTimeout(800);
  await preview.screenshot({ path: resolve(output, '03-paginas.png') });

  await preview.getByLabel('Nome do arquivo').fill('Relatório de teste');
  await preview.waitForTimeout(300);
  await preview.screenshot({ path: resolve(output, '04-nome-arquivo.png') });

  console.log(`Capturas geradas em ${output}`);
} finally {
  await context.close();
  await rm(profile, { recursive: true, force: true });
  server.close();
}
