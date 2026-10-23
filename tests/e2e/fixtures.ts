import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, test as base, expect } from '@playwright/test';
import type { Worker } from '@playwright/test';

export const test = base.extend<{ extensionWorker: Worker; extensionId: string; fixtureUrl: string; longFixtureUrl: string; tallFixtureUrl: string; noTextFixtureUrl: string; downloadDir: string }>({
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
    const darkHtml = await readFile(resolve('tests/fixtures/dark-page.html'));
    const systemDarkHtml = await readFile(resolve('tests/fixtures/system-dark.html'));
    const server = createServer((request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (request.url === '/dark-page.html') response.end(darkHtml);
      else if (request.url === '/system-dark.html') response.end(systemDarkHtml);
      else response.end(html);
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
  tallFixtureUrl: async ({}, use) => {
    // Página com mais de 16.384 px de altura, acima do teto de captura PNG.
    const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><title>Página alta de teste</title></head>'
      + '<body style="margin:0"><div style="height:17000px;width:400px;background:#ddeeff">Conteúdo alto</div></body></html>';
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(html);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Servidor de fixture indisponível.');
      await use(`http://127.0.0.1:${address.port}/tall.html`);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  },
  noTextFixtureUrl: async ({}, use) => {
    // Página só com imagens: nenhum texto visível para o TXT extrair.
    const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><title>Só imagens</title></head>'
      + '<body style="margin:0"><div style="width:400px;height:300px;background:#ddeeff"></div>'
      + '<img alt="" src="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27200%27 height=%27100%27%3E%3Crect width=%27200%27 height=%27100%27 fill=%27%23164f8e%27/%3E%3C/svg%3E" /></body></html>';
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(html);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Servidor de fixture indisponível.');
      await use(`http://127.0.0.1:${address.port}/no-text.html`);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  },
});

export { expect };
