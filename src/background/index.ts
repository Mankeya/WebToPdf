import { buildPreviewUrl, parseSourceTabId } from '../shared/preview-url';
import { CONVERSION_PORT, CONVERSION_TIMEOUT_MS, ConversionError } from '../shared/conversion';
import type { ConversionEvent } from '../shared/conversion';
import { parsePrintSettings } from '../shared/settings';
import { convertTabToPdf } from './converter';

const activeTabs = new Set<number>();

/**
 * Nomes sugeridos para os downloads iniciados pela tela de prévia.
 *
 * O Chrome ignora a opção `filename` da API de downloads para URLs blob: e
 * substitui pelo UUID da origem. O evento `onDeterminingFilename` é o
 * mecanismo previsto para corrigir o nome, e o Chrome permite um único
 * ouvinte por extensão, registrado no service worker.
 */
const reservedFilenames = new Map<string, string>();
/** Teto de reservas guardadas, para que uma origem sem consumo não acumule. */
const MAX_RESERVED_FILENAMES = 20;

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  const reserved = reservedFilenames.get(item.url);
  if (reserved) {
    reservedFilenames.delete(item.url);
    suggest({ filename: reserved, conflictAction: 'uniquify' });
    return;
  }
  suggest();
});

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
    void convertTabToPdf(tabId, settings, (data, byteLength) => send({ type: 'chunk', data, byteLength }), controller.signal)
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

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false;
  if (message.type !== 'reserve-filename') return false;
  if (sender?.id !== chrome.runtime.id) return false;
  // Somente a tela de prévia, que é a origem legítima dos downloads.
  if (!sender.url || !sender.url.startsWith(chrome.runtime.getURL('preview.html'))) return false;
  if (!('url' in message) || typeof message.url !== 'string' || !message.url.startsWith('blob:')) return false;
  if (!('filename' in message) || typeof message.filename !== 'string') return false;
  if (message.filename.length === 0 || message.filename.length > 255) return false;
  if (reservedFilenames.size >= MAX_RESERVED_FILENAMES) {
    const oldest = reservedFilenames.keys().next();
    if (!oldest.done) reservedFilenames.delete(oldest.value);
  }
  reservedFilenames.set(message.url, message.filename);
  sendResponse({ ok: true });
  return false;
});
