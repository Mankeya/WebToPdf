import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PRINT_SETTINGS } from '../../src/shared/settings';
import type { PrintSettings } from '../../src/shared/settings';

const mocks = vi.hoisted(() => ({
  printTabToPdfBase64: vi.fn(),
  convertTabToPdf: vi.fn(),
}));

vi.mock('../../src/background/converter', () => mocks);

import {
  cancelEarlyPrint,
  convertTabToPdfWithEarlyPrint,
  settleEarlyPrint,
  startEarlyPrint,
} from '../../src/background/early-print';

const URL_PADRAO = 'http://exemplo.teste/painel';
function makePrint(byteLength = 300): { data: string; title: string; byteLength: number } {
  return { data: Buffer.from('x'.repeat(byteLength)).toString('base64'), title: 'Página de teste', byteLength };
}

let storageGet: ReturnType<typeof vi.fn>;
let tabsGet: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  storageGet = vi.fn(async () => ({ printSettings: { ...DEFAULT_PRINT_SETTINGS } }));
  tabsGet = vi.fn(async () => ({ url: URL_PADRAO, status: 'complete' }));
  vi.stubGlobal('chrome', {
    storage: { local: { get: storageGet } },
    tabs: { get: tabsGet },
  });
});

describe('impressão antecipada do menu', () => {
  it('imprime com as configurações salvas e o PDF guardado alimenta a conversão', async () => {
    const print = makePrint();
    mocks.printTabToPdfBase64.mockResolvedValue(print);

    await expect(startEarlyPrint(71)).resolves.toBe(true);
    expect(mocks.printTabToPdfBase64).toHaveBeenCalledWith(71, { ...DEFAULT_PRINT_SETTINGS }, expect.any(AbortSignal));

    const chunks: Array<{ data: string; byteLength: number }> = [];
    const result = await convertTabToPdfWithEarlyPrint(
      71,
      { ...DEFAULT_PRINT_SETTINGS },
      (data, byteLength) => chunks.push({ data, byteLength }),
      new AbortController().signal,
    );
    expect(result).toEqual({ title: 'Página de teste', byteLength: print.byteLength });
    expect(chunks.map((chunk) => chunk.data).join('')).toBe(print.data);
    expect(mocks.convertTabToPdf).not.toHaveBeenCalled();
  });

  it('falha de impressão vira falso e a conversão segue ao vivo', async () => {
    mocks.printTabToPdfBase64.mockRejectedValue(new Error('Outro debugger já anexado'));
    await expect(startEarlyPrint(72)).resolves.toBe(false);

    mocks.convertTabToPdf.mockResolvedValue({ title: 'pagina', byteLength: 10 });
    const result = await convertTabToPdfWithEarlyPrint(72, { ...DEFAULT_PRINT_SETTINGS }, () => undefined, new AbortController().signal);
    expect(result).toEqual({ title: 'pagina', byteLength: 10 });
    expect(mocks.convertTabToPdf).toHaveBeenCalled();
  });

  it('configurações alteradas na prévia regeneram o PDF ao vivo', async () => {
    mocks.printTabToPdfBase64.mockResolvedValue(makePrint());
    await startEarlyPrint(73);

    const altered: PrintSettings = { ...DEFAULT_PRINT_SETTINGS, orientation: 'landscape' };
    mocks.convertTabToPdf.mockResolvedValue({ title: 'paisagem', byteLength: 20 });
    const result = await convertTabToPdfWithEarlyPrint(73, altered, () => undefined, new AbortController().signal);
    expect(result).toEqual({ title: 'paisagem', byteLength: 20 });
    expect(mocks.convertTabToPdf).toHaveBeenCalledWith(73, altered, expect.any(Function), expect.any(AbortSignal));
  });

  it('URL diferente na leitura descarta o PDF antecipado e reimprime ao vivo', async () => {
    mocks.printTabToPdfBase64.mockResolvedValue(makePrint());
    await startEarlyPrint(74);
    tabsGet.mockResolvedValue({ url: 'http://exemplo.teste/outra-pagina', status: 'complete' });

    mocks.convertTabToPdf.mockResolvedValue({ title: 'outra', byteLength: 30 });
    const result = await convertTabToPdfWithEarlyPrint(74, { ...DEFAULT_PRINT_SETTINGS }, () => undefined, new AbortController().signal);
    expect(result).toEqual({ title: 'outra', byteLength: 30 });
    expect(mocks.convertTabToPdf).toHaveBeenCalled();
  });

  it('sem URL legível na conversão, reimprime ao vivo em vez de confiar no cache', async () => {
    mocks.printTabToPdfBase64.mockResolvedValue(makePrint());
    await startEarlyPrint(75);
    tabsGet.mockRejectedValue(new Error('aba indisponível'));

    mocks.convertTabToPdf.mockResolvedValue({ title: 'ao vivo', byteLength: 5 });
    const result = await convertTabToPdfWithEarlyPrint(75, { ...DEFAULT_PRINT_SETTINGS }, () => undefined, new AbortController().signal);
    expect(result).toEqual({ title: 'ao vivo', byteLength: 5 });
  });

  it('espera a impressão em voo antes de consumir o cache', async () => {
    let finish: ((print: ReturnType<typeof makePrint>) => void) | undefined;
    mocks.printTabToPdfBase64.mockImplementation((_tabId: number, _settings: unknown, _signal: AbortSignal) => new Promise((resolve) => {
      finish = resolve;
    }));
    const attempt = startEarlyPrint(76);

    const conversion = convertTabToPdfWithEarlyPrint(76, { ...DEFAULT_PRINT_SETTINGS }, () => undefined, new AbortController().signal);
    let settled = false;
    void conversion.then(() => { settled = true; });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);

    const print = makePrint();
    finish?.(print);
    await attempt;
    await expect(conversion).resolves.toEqual({ title: 'Página de teste', byteLength: print.byteLength });
    expect(mocks.convertTabToPdf).not.toHaveBeenCalled();
  });

  it('substitui a tentativa anterior da mesma aba', async () => {
    const signals: AbortSignal[] = [];
    mocks.printTabToPdfBase64.mockImplementation((_tabId: number, _settings: unknown, signal: AbortSignal) => new Promise((resolve, reject) => {
      signals.push(signal);
      signal.addEventListener('abort', () => reject(new Error('abortado')), { once: true });
      // A segunda tentativa conclui; a primeira só morre ao ser abortada.
      if (signals.length >= 2) resolve(makePrint());
    }));

    const first = startEarlyPrint(77);
    await vi.waitFor(() => expect(mocks.printTabToPdfBase64).toHaveBeenCalledTimes(1));
    await expect(startEarlyPrint(77)).resolves.toBe(true);
    await expect(first).resolves.toBe(false);
    expect(signals).toHaveLength(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
  });

  it('cancelEarlyPrint aborta a tentativa em voo e nada fica guardado', async () => {
    mocks.printTabToPdfBase64.mockImplementation((_tabId: number, _settings: unknown, signal: AbortSignal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('abortado')), { once: true });
    }));
    const attempt = startEarlyPrint(78);
    cancelEarlyPrint(78);
    await expect(attempt).resolves.toBe(false);

    mocks.convertTabToPdf.mockResolvedValue({ title: 'ao vivo', byteLength: 5 });
    const result = await convertTabToPdfWithEarlyPrint(78, { ...DEFAULT_PRINT_SETTINGS }, () => undefined, new AbortController().signal);
    expect(result).toEqual({ title: 'ao vivo', byteLength: 5 });
  });

  it('settleEarlyPrint aborta e espera a impressão em voo liberar o debugger', async () => {
    let aborted = false;
    mocks.printTabToPdfBase64.mockImplementation((_tabId: number, _settings: unknown, signal: AbortSignal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => { aborted = true; reject(new Error('abortado')); }, { once: true });
    }));
    const attempt = startEarlyPrint(79);
    await vi.waitFor(() => expect(mocks.printTabToPdfBase64).toHaveBeenCalledTimes(1));
    await settleEarlyPrint(79);
    expect(aborted).toBe(true);
    await expect(attempt).resolves.toBe(false);
  });

  it('sem aba numérica não chama a impressão', async () => {
    await expect(startEarlyPrint(Number.NaN)).resolves.toBe(false);
    expect(mocks.printTabToPdfBase64).not.toHaveBeenCalled();
  });

  it('sem configurações salvas usa os padrões', async () => {
    storageGet.mockResolvedValue({});
    mocks.printTabToPdfBase64.mockResolvedValue(makePrint());
    await expect(startEarlyPrint(80)).resolves.toBe(true);
    expect(mocks.printTabToPdfBase64).toHaveBeenCalledWith(80, { ...DEFAULT_PRINT_SETTINGS }, expect.any(AbortSignal));
  });

  it('falha de leitura do armazenamento cai nos padrões sem quebrar a impressão', async () => {
    storageGet.mockRejectedValue(new Error('storage indisponível'));
    mocks.printTabToPdfBase64.mockResolvedValue(makePrint());
    await expect(startEarlyPrint(81)).resolves.toBe(true);
    expect(mocks.printTabToPdfBase64).toHaveBeenCalledWith(81, { ...DEFAULT_PRINT_SETTINGS }, expect.any(AbortSignal));
  });
});
