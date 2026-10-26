import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureSnapshot, convertSnapshot, removeSnapshots, storeSnapshot } from '../../src/background/snapshots';
import { base64ByteLength } from '../../src/shared/conversion';

const url = 'https://example.com/';
const jpeg = btoa(String.fromCharCode(255, 216, 255, 192, 0, 17, 8, 0, 3, 0, 2, 3, 1, 17, 0, 2, 17, 0, 3, 17, 0, 255, 217));
const message = { tabId: 7, url, data: `data:image/jpeg;base64,${jpeg}` };

describe('sessão da captura', () => {
  const tab = { id: 7, url, active: true, windowId: 1, title: 'Página', incognito: false };
  const getTab = vi.fn(async () => ({ ...tab }));
  beforeEach(() => {
    getTab.mockReset().mockImplementation(async () => ({ ...tab }));
    vi.useFakeTimers();
    vi.stubGlobal('chrome', { tabs: {
      get: getTab, query: vi.fn(async () => [{ ...tab }]),
      captureVisibleTab: vi.fn(async () => message.data),
    } });
  });
  afterEach(() => { removeSnapshots(7); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('captura sem anexar debugger e transmite PDF com tamanhos consistentes', async () => {
    const snapshot = await captureSnapshot();
    expect(snapshot?.tabId).toBe(7);
    const chunks: string[] = [];
    const result = await convertSnapshot(7, snapshot!.token, (data, size) => {
      expect(size).toBe(base64ByteLength(data)); chunks.push(atob(data));
    }, new AbortController().signal);
    expect(chunks.join('')).toMatch(/^%PDF-1.4/);
    expect(result.byteLength).toBe(chunks.join('').length);
    expect(result.title).toBe('Página');
  });

  it.each([null, {}, { ...message, tabId: '7' }, { ...message, url: 'file:///a' },
    { ...message, data: 'data:image/png;base64,YQ==' }, { ...message, data: 'data:image/jpeg;base64,%%%'}])('rejeita mensagem inválida %o', async (value) => {
    expect(await storeSnapshot(value)).toBeNull();
  });

  it('rejeita mudança de URL, aba inativa e janela anônima', async () => {
    for (const patch of [{ url: 'https://outro.com/' }, { active: false }, { incognito: true }]) {
      getTab.mockResolvedValueOnce({ ...tab, ...patch });
      expect(await storeSnapshot(message)).toBeNull();
    }
  });

  it('não usa uma captura após navegar, expirar ou remover a aba', async () => {
    const token = await storeSnapshot(message);
    getTab.mockResolvedValueOnce({ ...tab, url: 'https://outro.com/' });
    await expect(convertSnapshot(7, token, vi.fn(), new AbortController().signal)).rejects.toThrow('expirou');
    await vi.advanceTimersByTimeAsync(30_000);
    await expect(convertSnapshot(7, token, vi.fn(), new AbortController().signal)).rejects.toThrow('expirou');
    const next = await storeSnapshot(message);
    removeSnapshots(7);
    await expect(convertSnapshot(7, next, vi.fn(), new AbortController().signal)).rejects.toThrow('expirou');
  });

  it('respeita cancelamento sem transmitir dados', async () => {
    const controller = new AbortController(); controller.abort();
    const chunk = vi.fn();
    await expect(convertSnapshot(7, await storeSnapshot(message), chunk, controller.signal)).rejects.toThrow();
    expect(chunk).not.toHaveBeenCalled();
  });
});
