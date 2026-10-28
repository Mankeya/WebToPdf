import { parseFormatParam, parseSourceTabId } from '../shared/preview-url';
import { isFormatAvailable } from '../shared/format';
import { CONVERSION_PORT, CONVERSION_TIMEOUT_MS, ConversionError } from '../shared/conversion';
import type { ConversionEvent } from '../shared/conversion';
import { parsePrintSettings } from '../shared/settings';
import { convertTabToPng, convertTabToTxt } from './converter';
import { buildPreviewUrl } from '../shared/preview-url';
import { cancelEarlyPrint, convertTabToPdfWithEarlyPrint, settleEarlyPrint, startEarlyPrint } from './early-print';
import { captureSnapshot, convertSnapshot, removeSnapshots, storeSnapshot } from './snapshots';

chrome.tabs.onRemoved.addListener((tabId) => {
  removeSnapshots(tabId);
  cancelEarlyPrint(tabId);
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === 'loading' || change.url) {
    removeSnapshots(tabId);
    cancelEarlyPrint(tabId);
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'capture-screen-pdf') {
    void captureSnapshot().then(async (snapshot) => {
      if (!snapshot) return;
      const url = new URL(buildPreviewUrl(chrome.runtime.getURL('preview.html'), snapshot.tabId, 'screen-pdf'));
      url.searchParams.set('snapshot', snapshot.token);
      await chrome.tabs.create({ url: url.href });
    }).catch(() => undefined);
    return;
  }
  if (command !== 'print-pdf-now') return;
  // "PDF agora": a página segue em foco enquanto o PDF é gerado (nenhum menu
  // perde o foco antes da impressão); a prévia abre em seguida, pronta.
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id === undefined) return;
    await startEarlyPrint(tab.id);
    await chrome.tabs.create({ url: buildPreviewUrl(chrome.runtime.getURL('preview.html'), tab.id, 'pdf') });
  })().catch(() => undefined);
});

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

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== CONVERSION_PORT) return;
  const sender = port.sender;
  let sourceTabId: number | null = null;
  let format: ReturnType<typeof parseFormatParam> | null = null;
  try {
    const url = new URL(sender?.url ?? '');
    if (sender?.id !== chrome.runtime.id || `${url.protocol}//${url.host}${url.pathname}` !== chrome.runtime.getURL('preview.html')) {
      port.disconnect();
      return;
    }
    sourceTabId = parseSourceTabId(url.search);
    format = parseFormatParam(url.search);
  } catch {
    port.disconnect();
    return;
  }
  if (sourceTabId === null || format === null || sender?.tab?.id === sourceTabId) {
    port.disconnect();
    return;
  }
  const tabId = sourceTabId;
  const requestedFormat = format;
  const snapshotToken = new URL(sender!.url!).searchParams.get('snapshot');

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
      || !('sourceTabId' in request) || request.sourceTabId !== tabId
      || !('format' in request) || request.format !== requestedFormat
      || !('settings' in request)) {
      send({ type: 'error', message: 'Solicitação de conversão inválida.' });
      return;
    }
    if (!isFormatAvailable(requestedFormat)) {
      send({ type: 'error', message: 'Este formato ainda não está disponível nesta versão.' });
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
    // Só o PDF usa as configurações de impressão; os demais formatos as
    // recebem no mesmo formato de contrato, mas as ignoram.
    const convert = requestedFormat === 'screen-pdf'
      ? (onChunk: (data: string, byteLength: number) => void, signal: AbortSignal) => convertSnapshot(tabId, snapshotToken, onChunk, signal)
      : requestedFormat === 'pdf'
      // O PDF pode sair da impressão antecipada do menu (cache de uso único,
      // amarrado à URL e às configurações); sem casamento, reimprime ao vivo.
      ? (onChunk: (data: string, byteLength: number) => void, signal: AbortSignal) => convertTabToPdfWithEarlyPrint(tabId, settings, onChunk, signal)
      : async (onChunk: (data: string, byteLength: number) => void, signal: AbortSignal) => {
          // PNG e TXT não consomem o PDF antecipado: a impressão em voo só
          // seguraria o debugger da aba, então é abortada e esperada.
          await settleEarlyPrint(tabId);
          return requestedFormat === 'txt'
            ? convertTabToTxt(tabId, onChunk, signal)
            : convertTabToPng(tabId, onChunk, signal);
        };
    void convert((data, byteLength) => send({ type: 'chunk', data, byteLength }), controller.signal)
      .then((result) => send({ type: 'complete', ...result }))
      .catch((error: unknown) => {
        const reason: unknown = controller.signal.aborted ? controller.signal.reason : error;
        const fallback = requestedFormat === 'pdf'
          ? 'Não foi possível converter a página. A impressão pode ter sido cancelada; tente novamente com o DevTools fechado.'
          : requestedFormat === 'txt'
            ? 'Não foi possível extrair o texto da página; tente novamente com o DevTools fechado.'
            : 'Não foi possível capturar a página; tente novamente com o DevTools fechado.';
        send({ type: 'error', message: reason instanceof ConversionError ? reason.message : fallback });
      })
      .finally(() => {
        clearTimeout(timeout);
        activeTabs.delete(tabId);
      });
  });
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false;
  if (message.type === 'early-print') {
    // Somente o popup, na origem legítima, pode pedir a impressão antecipada.
    if (sender?.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) return false;
    if (!('tabId' in message) || typeof message.tabId !== 'number') return false;
    void startEarlyPrint(message.tabId).then((ok) => sendResponse({ ok })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (message.type === 'store-snapshot') {
    if (sender?.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) return false;
    void storeSnapshot(message).then((token) => sendResponse({ token })).catch(() => sendResponse({ token: null }));
    return true;
  }
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
