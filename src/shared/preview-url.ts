import { parseFormat } from './format';
import type { ConversionFormat } from './format';

export function isSupportedPage(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseSourceTabId(search: string): number | null {
  const value = new URLSearchParams(search).get('sourceTabId');
  if (value === null || !/^\d+$/.test(value)) return null;
  const tabId = Number(value);
  return Number.isSafeInteger(tabId) ? tabId : null;
}

/**
 * Formato escolhido no menu. Ausente ou inválido volta para `pdf`, para que
 * links antigos e edições manuais continuem abrindo a conversão de sempre.
 */
export function parseFormatParam(search: string): ConversionFormat {
  return parseFormat(new URLSearchParams(search).get('format')) ?? 'pdf';
}

export function buildPreviewUrl(baseUrl: string, tabId: number | undefined, format: ConversionFormat = 'pdf'): string {
  const preview = new URL(baseUrl);
  if (tabId !== undefined && Number.isSafeInteger(tabId) && tabId >= 0) {
    preview.searchParams.set('sourceTabId', String(tabId));
    preview.searchParams.set('format', format);
  } else {
    preview.searchParams.set('error', 'unsupported-page');
  }
  return preview.href;
}
