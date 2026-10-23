import { beforeEach, describe, expect, it, vi } from 'vitest';
import { convertTabToTxt } from '../../src/background/converter';

let evaluationResult: unknown;
let getTab: ReturnType<typeof vi.fn>;

beforeEach(() => {
  evaluationResult = { result: { value: 'Conteúdo de teste com acentuação: ação.' } };
  getTab = vi.fn(async () => ({ url: 'http://exemplo.teste/pagina', status: 'complete' }));
  vi.stubGlobal('chrome', {
    tabs: { get: getTab },
    debugger: {
      attach: vi.fn(async () => undefined),
      detach: vi.fn(async () => undefined),
      sendCommand: vi.fn(async (_target: unknown, method: string) => {
        if (method === 'Page.getNavigationHistory') {
          return { entries: [{ url: 'http://exemplo.teste/pagina', title: 'Página de teste' }], currentIndex: 0 };
        }
        if (method === 'Runtime.evaluate') return evaluationResult;
        throw new Error(`Comando inesperado: ${method}`);
      }),
    },
  });
});

describe('convertTabToTxt', () => {
  it('devolve o texto da página em UTF-8 com BOM e título da aba', async () => {
    const chunks: { data: string; byteLength: number }[] = [];
    const result = await convertTabToTxt(7, (data, byteLength) => chunks.push({ data, byteLength }), new AbortController().signal);

    expect(result.title).toBe('Página de teste');
    expect(chunks.length).toBeGreaterThan(0);
    const bytes = new Uint8Array(chunks.flatMap((chunk) => [...Uint8Array.from(atob(chunk.data), (char) => char.charCodeAt(0))]));
    expect(result.byteLength).toBe(bytes.length);
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.subarray(3))).toBe('Conteúdo de teste com acentuação: ação.');
  });

  it('rejeita páginas sem texto visível com mensagem clara', async () => {
    evaluationResult = { result: { value: '   \n\t  ' } };
    await expect(convertTabToTxt(7, () => undefined, new AbortController().signal))
      .rejects.toThrow('Nenhum texto visível para extrair nesta página.');
  });

  it('rejeita texto acima do teto de 32 MB antes de montar o arquivo', async () => {
    evaluationResult = { result: { value: 'a'.repeat(32 * 1024 * 1024 + 1) } };
    await expect(convertTabToTxt(7, () => undefined, new AbortController().signal))
      .rejects.toThrow('excedeu o limite de 32 MB');
  });

  it('rejeita resposta do debugger que não é texto', async () => {
    evaluationResult = { result: { type: 'object' } };
    await expect(convertTabToTxt(7, () => undefined, new AbortController().signal))
      .rejects.toThrow('Não foi possível ler o texto desta página.');
  });

  it('rejeita páginas não suportadas sem anexar o debugger', async () => {
    getTab.mockResolvedValueOnce({ url: 'chrome://settings', status: 'complete' });
    await expect(convertTabToTxt(7, () => undefined, new AbortController().signal))
      .rejects.toThrow('Página não compatível');
    expect(chrome.debugger.attach).not.toHaveBeenCalled();
  });
});
