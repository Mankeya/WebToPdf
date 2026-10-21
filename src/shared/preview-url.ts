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

export function buildPreviewUrl(baseUrl: string, tabId: number | undefined, pageUrl: string | undefined): string {
  const preview = new URL(baseUrl);
  if (tabId !== undefined && Number.isSafeInteger(tabId) && tabId >= 0 && isSupportedPage(pageUrl)) {
    preview.searchParams.set('sourceTabId', String(tabId));
  } else {
    preview.searchParams.set('error', 'unsupported-page');
  }
  return preview.href;
}
