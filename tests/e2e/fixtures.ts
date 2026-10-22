import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, test as base, expect } from '@playwright/test';
import type { Worker } from '@playwright/test';

export const test = base.extend<{ extensionWorker: Worker; extensionId: string; fixtureUrl: string; longFixtureUrl: string; downloadDir: string }>({
  context: async ({ headless }, use) => {
    const profile = await mkdtemp(join(tmpdir(), 'webtopdf-conversion-'));
    const extensionPath = resolve('dist');
    try {
      const context = await chromium.launchPersistentContext(profile, {
        channel: 'chromium',
        headless,
        acceptDownloads: true,
        args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
      });
      try {
        await use(context);
      } finally {
        await context.close();
      }
    } finally {
      await rm(profile, { recursive: true, force: true });
    }
  },
  downloadDir: async ({}, use) => {
    const directory = await mkdtemp(join(tmpdir(), 'webtopdf-downloads-'));
    try {
      await use(directory);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  extensionWorker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await use(worker);
  },
  extensionId: async ({ extensionWorker }, use) => {
    await use(new URL(extensionWorker.url()).hostname);
  },
  fixtureUrl: async ({}, use) => {
    const html = await readFile(resolve('tests/fixtures/report.html'));
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(html);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Servidor de fixture indisponível.');
      await use(`http://127.0.0.1:${address.port}/report.html`);
    } finally {
      // O Chrome mantém conexões alive; sem encerrá-las o close() nunca
      // concluiria e o teardown estouraria o tempo limite do teste.
      server.closeAllConnections();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  },
  longFixtureUrl: async ({}, use) => {
    const html = await readFile(resolve('tests/fixtures/longo.html'));
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(html);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Servidor de fixture indisponível.');
      await use(`http://127.0.0.1:${address.port}/longo.html`);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  },
});

export { expect };
