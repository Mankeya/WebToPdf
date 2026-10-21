import { buildPreviewUrl, parseSourceTabId } from '../shared/preview-url';
import { CONVERSION_PORT, CONVERSION_TIMEOUT_MS, ConversionError } from '../shared/conversion';
import type { ConversionEvent } from '../shared/conversion';
import { parsePrintSettings } from '../shared/settings';
import { convertTabToPdf } from './converter';

const activeTabs = new Set<number>();

chrome.action.onClicked.addListener((tab) => {
  const url = buildPreviewUrl(chrome.runtime.getURL('preview.html'), tab.id, tab.url);
  void chrome.tabs.create({ url }).catch(() => {
    // Sem registrar URL, título ou conteúdo da página.
    void chrome.action.setBadgeText({ text: 'ERR' }).catch(() => undefined);
  });
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== CONVERSION_PORT) return;
  const sender = port.sender;
  let sourceTabId: number | null = null;
  try {
    const url = new URL(sender?.url ?? '');
    if (sender?.id !== chrome.runtime.id || `${url.protocol}//${url.host}${url.pathname}` !== chrome.runtime.getURL('preview.html')) {
      port.disconnect();
      return;
    }
    sourceTabId = parseSourceTabId(url.search);
  } catch {
    port.disconnect();
    return;
  }
  if (sourceTabId === null || sender?.tab?.id === sourceTabId) {
    port.disconnect();
    return;
  }
  const tabId = sourceTabId;

  const controller = new AbortController();
  let connected = true;
  let started = false;
  const send = (message: ConversionEvent): void => {
    if (connected) port.postMessage(message);
  };
  port.onDisconnect.addListener(() => {
    connected = false;
    controller.abort();
  });
  port.onMessage.addListener((request: unknown) => {
    if (started) return;
    started = true;
    if (typeof request !== 'object' || request === null || !('type' in request) || request.type !== 'convert'
      || !('sourceTabId' in request) || request.sourceTabId !== tabId || !('settings' in request)) {
      send({ type: 'error', message: 'Solicitação de conversão inválida.' });
      return;
    }
    const settings = parsePrintSettings(request.settings);
    if (!settings) {
      send({ type: 'error', message: 'Configurações de impressão inválidas.' });
      return;
    }
    if (activeTabs.has(tabId)) {
      send({ type: 'error', message: 'Esta página já está sendo convertida. Aguarde e tente novamente.' });
      return;
    }
    activeTabs.add(tabId);
    const timeout = setTimeout(() => controller.abort(new ConversionError('A conversão excedeu 60 segundos. Tente novamente com uma página menor.')), CONVERSION_TIMEOUT_MS);
    void convertTabToPdf(tabId, settings, (data) => send({ type: 'chunk', data }), controller.signal)
      .then((result) => send({ type: 'complete', ...result }))
      .catch((error: unknown) => {
        const reason: unknown = controller.signal.aborted ? controller.signal.reason : error;
        send({ type: 'error', message: reason instanceof ConversionError ? reason.message : 'Não foi possível converter a página. A impressão pode ter sido cancelada; tente novamente com o DevTools fechado.' });
      })
      .finally(() => {
        clearTimeout(timeout);
        activeTabs.delete(tabId);
      });
  });
});
