import { describe, expect, it } from 'vitest';
import { buildPreviewUrl, isSupportedPage, parseFormatParam, parseSourceTabId } from '../../src/shared/preview-url';

describe('isSupportedPage', () => {
  it.each(['https://example.com', 'http://localhost:3000'])('aceita %s', (url) => {
    expect(isSupportedPage(url)).toBe(true);
  });

  it.each([undefined, '', 'inválido', 'chrome://extensions', 'file:///C:/test.html', 'javascript:alert(1)', 'chrome-extension://id/preview.html'])('rejeita %s', (url) => {
    expect(isSupportedPage(url)).toBe(false);
  });
});

describe('parseSourceTabId', () => {
  it.each(['?sourceTabId=0', '?sourceTabId=42'])('aceita inteiro válido: %s', (search) => {
    expect(parseSourceTabId(search)).toBe(Number(new URLSearchParams(search).get('sourceTabId')));
  });

  it.each(['', '?sourceTabId=', '?sourceTabId=-1', '?sourceTabId=1.5', '?sourceTabId=NaN', '?sourceTabId=9007199254740992'])('rejeita ID inválido: %s', (search) => {
    expect(parseSourceTabId(search)).toBeNull();
  });
});

describe('parseFormatParam', () => {
  it.each(['pdf', 'png', 'txt', 'md'])('aceita o formato %s', (format) => {
    expect(parseFormatParam(`?format=${format}`)).toBe(format);
  });

  it.each(['', '?format=', '?format=docx', '?format=PDF', '?format=pdf%20'])('volta para pdf em valor ausente ou inválido: %s', (search) => {
    expect(parseFormatParam(search)).toBe('pdf');
  });
});

describe('buildPreviewUrl', () => {
  const base = 'chrome-extension://test-id/preview.html';

  it('transmite somente o ID e o formato, sem URL ou título da página', () => {
    expect(buildPreviewUrl(base, 42)).toBe(`${base}?sourceTabId=42&format=pdf`);
  });

  it('inclui o formato escolhido no menu', () => {
    expect(buildPreviewUrl(base, 42, 'md')).toBe(`${base}?sourceTabId=42&format=md`);
  });

  it('não aceita aba ausente', () => {
    expect(buildPreviewUrl(base, undefined)).toBe(`${base}?error=unsupported-page`);
  });
});
