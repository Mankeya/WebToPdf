import { base64ByteLength, chunkBase64, ConversionError, MAX_FILE_BYTES } from '../shared/conversion';
import { jpegToPdf } from '../shared/image-pdf';
import { isSupportedPage } from '../shared/preview-url';
import { SnapshotCache } from './snapshot-cache';

const cache = new SnapshotCache();

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

export async function convertSnapshot(tabId: number, token: string | null, onChunk: (data: string, size: number) => void, signal: AbortSignal): Promise<{ title: string; byteLength: number }> {
  signal.throwIfAborted();
  const tab = await chrome.tabs.get(tabId);
  const data = token && isSupportedPage(tab.url) ? cache.get(token, tabId, tab.url!) : null;
  if (!data) throw new ConversionError('A captura da tela expirou ou a página mudou. Abra a extensão novamente; o PDF normal continua disponível.');
  const jpeg = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const bytes = jpegToPdf(jpeg);
  // Fatias limitadas evitam estourar a pilha ou a porta de mensagens.
  for (let offset = 0; offset < bytes.length; offset += 3 * 64 * 1024) {
    signal.throwIfAborted();
    const slice = bytes.subarray(offset, offset + 3 * 64 * 1024);
    const parts: string[] = [];
    for (let i = 0; i < slice.length; i += 8192) parts.push(String.fromCharCode(...slice.subarray(i, i + 8192)));
    for (const chunk of chunkBase64(btoa(parts.join('')))) onChunk(chunk, base64ByteLength(chunk));
  }
  return { title: tab.title || 'pagina', byteLength: bytes.length };
}
