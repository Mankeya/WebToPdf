import { test, expect } from './fixtures';

test('gate: imprime uma aba HTTP real via debugger e libera a conexão', async ({ extensionWorker, fixtureUrl, context }) => {
  const sourceId = await extensionWorker.evaluate(async (url) => {
    const tab = await chrome.tabs.create({ url });
    if (tab.id === undefined) throw new Error('Aba não criada.');
    return tab.id;
  }, fixtureUrl);
  const source = context.pages().find((page) => page.url() === fixtureUrl)
    ?? await context.waitForEvent('page');
  await source.waitForLoadState('load');

  const result = await extensionWorker.evaluate(async (tabId) => {
    const target = { tabId };
    await chrome.debugger.attach(target, '1.3');
    try {
      const response: unknown = await chrome.debugger.sendCommand(target, 'Page.printToPDF', {
        printBackground: true,
        paperWidth: 8.2677165354,
        paperHeight: 11.6929133858,
      });
      if (typeof response !== 'object' || response === null || !('data' in response) || typeof response.data !== 'string') {
        throw new Error('Resposta PDF ausente.');
      }
      return { signature: atob(response.data).slice(0, 5), bytes: atob(response.data).length };
    } finally {
      await chrome.debugger.detach(target);
    }
  }, sourceId);

  expect(result.signature).toBe('%PDF-');
  expect(result.bytes).toBeGreaterThan(1_000);
  // getTargets().attached também inclui o cliente do Playwright. Uma segunda
  // anexação pela extensão falharia se a sessão anterior ainda estivesse ativa.
  await extensionWorker.evaluate(async (tabId) => {
    await chrome.debugger.attach({ tabId }, '1.3');
    await chrome.debugger.detach({ tabId });
  }, sourceId);
});
