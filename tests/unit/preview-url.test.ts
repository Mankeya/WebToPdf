import { describe, expect, it } from 'vitest';
import { buildPreviewUrl, isSupportedPage, parseSourceTabId } from '../../src/shared/preview-url';

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

describe('buildPreviewUrl', () => {
  const base = 'chrome-extension://test-id/preview.html';

  it('transmite somente o ID, sem URL ou título da página', () => {
    expect(buildPreviewUrl(base, 42, 'https://example.com/private?token=secret')).toBe(`${base}?sourceTabId=42`);
  });

  it('sinaliza página incompatível', () => {
    expect(buildPreviewUrl(base, 42, 'chrome://extensions')).toBe(`${base}?error=unsupported-page`);
  });

  it('não aceita aba ausente', () => {
    expect(buildPreviewUrl(base, undefined, 'https://example.com')).toBe(`${base}?error=unsupported-page`);
  });
});
