import { base64ByteLength, chunkBase64, ConversionError, MAX_FILE_BYTES } from '../shared/conversion';
import { jpegToPdf, jpegToPdfWithOcr, type OcrResult } from '../shared/image-pdf';
import { isSupportedPage } from '../shared/preview-url';
import { SnapshotCache } from './snapshot-cache';

const cache = new SnapshotCache();

let ocrQueue: Promise<unknown> = Promise.resolve();

async function ensureOffscreenDocument(): Promise<boolean> {
  try {
    if (await chrome.offscreen.hasDocument()) return true;
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ['WORKERS'],
      justification: 'Executar OCR local via Tesseract.js (WASM) para PDF da tela',
    });
    return true;
  } catch {
    return false;
  }
}

async function runOcr(jpegBase64: string, signal: AbortSignal): Promise<OcrResult | null> {
  signal.throwIfAborted();
  const ready = await ensureOffscreenDocument();
  if (!ready) return null;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | undefined;
  try {
    const response: unknown = await Promise.race([
      chrome.runtime.sendMessage({ type: 'ocr-recognize', image: `data:image/jpeg;base64,${jpegBase64}` }),
      new Promise<null>((resolve) => {
        cancel = () => resolve(null);
        signal.addEventListener('abort', cancel, { once: true });
        timer = setTimeout(() => resolve(null), 15_000);
        if (signal.aborted) resolve(null);
      }),
    ]);
    if (!response || typeof response !== 'object' || !('text' in response) || typeof response.text !== 'string'
      || !response.text.trim() || !('words' in response) || !Array.isArray(response.words) || !response.words.length) return null;
    if (response.words.length > 50_000 || response.words.some((word: unknown) => {
      if (!word || typeof word !== 'object' || !('text' in word) || typeof word.text !== 'string'
        || word.text.length > 4096 || !('bbox' in word) || !word.bbox || typeof word.bbox !== 'object') return true;
      const box = word.bbox as Record<string, unknown>;
      return ['x0', 'y0', 'x1', 'y1'].some((key) => typeof box[key] !== 'number' || !Number.isFinite(box[key]) || box[key] < 0 || box[key] > 16_384);
    })) return null;
    return response as OcrResult;
  } finally {
    clearTimeout(timer);
    if (cancel) signal.removeEventListener('abort', cancel);
    await chrome.offscreen.closeDocument().catch(() => undefined);
  }
}

function queuedOcr(data: string, signal: AbortSignal): Promise<OcrResult | null> {
  const task = ocrQueue.then(() => runOcr(data, signal));
  ocrQueue = task.catch(() => undefined);
  return task;
}

export async function storeSnapshot(message: unknown): Promise<string | null> {
  if (!message || typeof message !== 'object' || !('tabId' in message) || !Number.isSafeInteger(message.tabId)
    || !('url' in message) || typeof message.url !== 'string' || !isSupportedPage(message.url)
    || !('data' in message) || typeof message.data !== 'string' || !message.data.startsWith('data:image/jpeg;base64,')) return null;
  const data = message.data.slice('data:image/jpeg;base64,'.length);
  if (data.length === 0 || base64ByteLength(data) > MAX_FILE_BYTES - 2048 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return null;
  const tab = await chrome.tabs.get(message.tabId as number);
  // Mudança de aba ou navegação durante a captura invalida os pixels.
  if (!tab.active || tab.url !== message.url || tab.incognito) return null;
  const token = cache.put(tab.id!, message.url, data);
  setTimeout(() => cache.prune(), 30_000);
  return token;
}

export async function captureSnapshot(): Promise<{ token: string; tabId: number } | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined || !isSupportedPage(tab.url) || tab.incognito) return null;
  const data = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 92 });
  const token = await storeSnapshot({ tabId: tab.id, url: tab.url, data });
  return token ? { token, tabId: tab.id } : null;
}

export function removeSnapshots(tabId: number): void { cache.removeTab(tabId); }

export async function convertSnapshot(tabId: number, token: string | null, onChunk: (data: string, size: number) => void, signal: AbortSignal): Promise<{ title: string; byteLength: number; ocrFailed: boolean }> {
  signal.throwIfAborted();
  const tab = await chrome.tabs.get(tabId);
  const data = token && isSupportedPage(tab.url) ? cache.get(token, tabId, tab.url!) : null;
  if (!data) throw new ConversionError('A captura da tela expirou ou a página mudou. Abra a extensão novamente; o PDF normal continua disponível.');
  const jpeg = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));

  // Tenta OCR primeiro
  let pdfBytes: Uint8Array;
  let ocrFailed = false;
  try {
      const ocrResult = await queuedOcr(data, signal);
      if (ocrResult) {
        pdfBytes = jpegToPdfWithOcr(jpeg, ocrResult);
      } else {
        pdfBytes = jpegToPdf(jpeg);
        ocrFailed = true;
      }
  } catch {
    pdfBytes = jpegToPdf(jpeg);
    ocrFailed = true;
  }

  signal.throwIfAborted();
  if (pdfBytes.length > MAX_FILE_BYTES) throw new ConversionError('O PDF excedeu o limite de 32 MB.');
  // Fatias limitadas evitam estourar a pilha ou a porta de mensagens.
  for (let offset = 0; offset < pdfBytes.length; offset += 3 * 64 * 1024) {
    signal.throwIfAborted();
    const slice = pdfBytes.subarray(offset, offset + 3 * 64 * 1024);
    const parts: string[] = [];
    for (let i = 0; i < slice.length; i += 8192) parts.push(String.fromCharCode(...slice.subarray(i, i + 8192)));
    for (const chunk of chunkBase64(btoa(parts.join('')))) onChunk(chunk, base64ByteLength(chunk));
  }
  return { title: tab.title || 'pagina', byteLength: pdfBytes.length, ocrFailed };
}
