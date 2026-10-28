import { describe, expect, it } from 'vitest';
import { EARLY_PRINT_TTL_MS, EarlyPrintCache } from '../../src/background/early-print-cache';
import { base64ByteLength } from '../../src/shared/conversion';
import { DEFAULT_PRINT_SETTINGS } from '../../src/shared/settings';
import type { PrintSettings } from '../../src/shared/settings';

const settings = { ...DEFAULT_PRINT_SETTINGS };

function makePrint(byteLength = 300): { data: string; title: string; byteLength: number } {
  const data = Buffer.from('x'.repeat(byteLength)).toString('base64');
  return { data, title: 'Página de teste', byteLength: base64ByteLength(data) };
}

describe('EarlyPrintCache', () => {
  it('devolve o PDF guardado com a mesma URL e as mesmas configurações', () => {
    const cache = new EarlyPrintCache();
    const print = makePrint();
    expect(cache.put(7, 'http://exemplo.teste/painel', settings, print)).toBe(true);
    expect(cache.take(7, 'http://exemplo.teste/painel', settings)).toEqual(print);
  });

  it('é de uso único: a segunda leitura não devolve nada', () => {
    const cache = new EarlyPrintCache();
    cache.put(8, 'http://exemplo.teste/painel', settings, makePrint());
    expect(cache.take(8, 'http://exemplo.teste/painel', settings)).not.toBeNull();
    expect(cache.take(8, 'http://exemplo.teste/painel', settings)).toBeNull();
  });

  it(`expira ${EARLY_PRINT_TTL_MS / 1000} s depois de guardado`, () => {
    let clock = 1_000;
    const cache = new EarlyPrintCache(() => clock);
    const print = makePrint();
    cache.put(9, 'http://exemplo.teste/painel', settings, print);
    clock += EARLY_PRINT_TTL_MS;
    expect(cache.take(9, 'http://exemplo.teste/painel', settings)).toBeNull();
  });

  it('descarta quando a URL da aba mudou (navegação)', () => {
    const cache = new EarlyPrintCache();
    cache.put(10, 'http://exemplo.teste/painel', settings, makePrint());
    expect(cache.take(10, 'http://exemplo.teste/outra-pagina', settings)).toBeNull();
  });

  it('descarta quando as configurações de impressão divergem (ajuste na prévia)', () => {
    const cache = new EarlyPrintCache();
    cache.put(11, 'http://exemplo.teste/painel', settings, makePrint());
    const altered: PrintSettings = { ...settings, orientation: 'landscape' };
    expect(cache.take(11, 'http://exemplo.teste/painel', altered)).toBeNull();
  });

  it('não devolve quando a URL atual é desconhecida', () => {
    const cache = new EarlyPrintCache();
    cache.put(12, 'http://exemplo.teste/painel', settings, makePrint());
    expect(cache.take(12, null, settings)).toBeNull();
  });

  it('removeTab invalida a entrada (fechamento ou navegação da aba)', () => {
    const cache = new EarlyPrintCache();
    cache.put(13, 'http://exemplo.teste/painel', settings, makePrint());
    cache.removeTab(13);
    expect(cache.take(13, 'http://exemplo.teste/painel', settings)).toBeNull();
  });

  it('uma nova impressão da mesma aba substitui a anterior', () => {
    const cache = new EarlyPrintCache();
    cache.put(14, 'http://exemplo.teste/painel', settings, makePrint(100));
    const second = makePrint(200);
    cache.put(14, 'http://exemplo.teste/painel', settings, second);
    expect(cache.take(14, 'http://exemplo.teste/painel', settings)).toEqual(second);
  });

  it('rejeita PDF acima do teto de memória, sem guardar nada', () => {
    const cache = new EarlyPrintCache(() => Date.now(), 1_000);
    const print = makePrint(1_001);
    expect(cache.put(15, 'http://exemplo.teste/painel', settings, print)).toBe(false);
    expect(cache.take(15, 'http://exemplo.teste/painel', settings)).toBeNull();
  });

  it('rejeita tamanho declarado que não bate com o Base64 guardado', () => {
    const cache = new EarlyPrintCache(() => Date.now(), 1_000);
    const print = makePrint(100);
    expect(cache.put(16, 'http://exemplo.teste/painel', settings, { ...print, byteLength: 900 })).toBe(false);
    expect(cache.take(16, 'http://exemplo.teste/painel', settings)).toBeNull();
  });

  it('rejeita impressão vazia', () => {
    const cache = new EarlyPrintCache();
    expect(cache.put(17, 'http://exemplo.teste/painel', settings, { data: '', title: 'x', byteLength: 0 })).toBe(false);
    expect(cache.take(17, 'http://exemplo.teste/painel', settings)).toBeNull();
  });

  it('descarta as entradas mais antigas para o total caber no teto', () => {
    const cache = new EarlyPrintCache(() => Date.now(), 1_000);
    const first = makePrint(600);
    const second = makePrint(600);
    cache.put(18, 'http://exemplo.teste/primeira', settings, first);
    cache.put(19, 'http://exemplo.teste/segunda', settings, second);
    // As duas não cabem juntas: a mais antiga sai para a nova entrar.
    expect(cache.take(18, 'http://exemplo.teste/primeira', settings)).toBeNull();
    expect(cache.take(19, 'http://exemplo.teste/segunda', settings)).toEqual(second);
  });

  it('sem URL na hora de guardar, não aceita a entrada', () => {
    const cache = new EarlyPrintCache();
    expect(cache.put(20, null, settings, makePrint())).toBe(false);
  });
});
