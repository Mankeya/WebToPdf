import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

describe('captura antes do módulo do popup', () => {
  it('dispara automaticamente e guarda o token antes de navegar', async () => {
    const sendMessage = vi.fn(async () => ({ token: 'captura-1' }));
    const captureVisibleTab = vi.fn(async () => 'data:image/jpeg;base64,/9j/2Q==');
    const context = { chrome: {
      tabs: { query: async () => [{ id: 7, windowId: 1, url: 'https://example.com/' }], captureVisibleTab },
      runtime: { sendMessage },
    } };
    const result = runInNewContext(readFileSync('public/early-capture.js', 'utf8') + '\nwebtopdfEarlyCapture;', context);
    await expect(result).resolves.toEqual({ token: 'captura-1', tabId: 7 });
    expect(captureVisibleTab).toHaveBeenCalledWith(1, { format: 'jpeg', quality: 92 });
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'store-snapshot', tabId: 7 }));
    const html = readFileSync('popup.html', 'utf8');
    expect(html.indexOf('early-capture.js')).toBeLessThan(html.indexOf('type="module"'));
  });

  it('não captura páginas internas e falha sem interromper o popup', async () => {
    for (const url of ['chrome://settings', 'file:///segredo', 'https://example.com/']) {
      const captureVisibleTab = vi.fn(async () => { throw new Error('Sem activeTab'); });
      const context = { chrome: {
        tabs: { query: async () => [{ id: 7, windowId: 1, url }], captureVisibleTab },
        runtime: { sendMessage: vi.fn() },
      } };
      const result = runInNewContext(readFileSync('public/early-capture.js', 'utf8') + '\nwebtopdfEarlyCapture;', context);
      await expect(result).resolves.toBeNull();
      expect(captureVisibleTab).toHaveBeenCalledTimes(url.startsWith('https:') ? 1 : 0);
    }
  });
});
