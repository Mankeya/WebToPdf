import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

describe('impressão antes do módulo do popup', () => {
  it('pede a impressão antecipada para a aba HTTP ativa', async () => {
    const sendMessage = vi.fn(async () => ({ ok: true }));
    const context = { chrome: {
      tabs: { query: async () => [{ id: 9, windowId: 2, url: 'https://example.com/painel' }] },
      runtime: { sendMessage },
    } };
    const result = runInNewContext(readFileSync('public/early-print.js', 'utf8') + '\nwebtopdfEarlyPrint;', context);
    await expect(result).resolves.toEqual({ tabId: 9 });
    expect(sendMessage).toHaveBeenCalledWith({ type: 'early-print', tabId: 9 });
  });

  it('não pede impressão para páginas internas', async () => {
    const sendMessage = vi.fn(async () => ({ ok: true }));
    const context = { chrome: {
      tabs: { query: async () => [{ id: 9, windowId: 2, url: 'chrome-extension://abc/popup.html' }] },
      runtime: { sendMessage },
    } };
    const result = runInNewContext(readFileSync('public/early-print.js', 'utf8') + '\nwebtopdfEarlyPrint;', context);
    await expect(result).resolves.toBeNull();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('falha de envio vira null, sem lançar erro', async () => {
    const context = { chrome: {
      tabs: { query: async () => [{ id: 9, windowId: 2, url: 'https://example.com/' }] },
      runtime: { sendMessage: async () => { throw new Error('worker dormindo'); } },
    } };
    const result = runInNewContext(readFileSync('public/early-print.js', 'utf8') + '\nwebtopdfEarlyPrint;', context);
    await expect(result).resolves.toBeNull();
  });

  it('resposta sem sucesso não vira promessa de cache', async () => {
    const context = { chrome: {
      tabs: { query: async () => [{ id: 9, windowId: 2, url: 'https://example.com/' }] },
      runtime: { sendMessage: async () => ({ ok: false }) },
    } };
    const result = runInNewContext(readFileSync('public/early-print.js', 'utf8') + '\nwebtopdfEarlyPrint;', context);
    await expect(result).resolves.toBeNull();
  });

  it('carrega o gatilho antes do módulo do popup', () => {
    const html = readFileSync('popup.html', 'utf8');
    expect(html.indexOf('early-print.js')).toBeLessThan(html.indexOf('type="module'));
  });

  it('declara o atalho PDF agora no manifesto', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8'));
    expect(manifest.commands['print-pdf-now']).toEqual({
      suggested_key: { default: 'Ctrl+Shift+P' },
      description: 'Gerar o PDF agora, com a página em foco e abrir a prévia',
    });
  });
});
