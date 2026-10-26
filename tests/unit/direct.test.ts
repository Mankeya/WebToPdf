import { describe, expect, it } from 'vitest';
import { DIRECT_CONVERSION_KEY, parseDirectConversion } from '../../src/shared/direct';

describe('parseDirectConversion', () => {
  it('só aceita true como ligado', () => {
    expect(parseDirectConversion(true)).toBe(true);
  });

  it.each([false, undefined, null, 0, 1, 'true', 'false', {}, [], 'sim'])(
    'trata %o como desligado',
    (value) => {
      expect(parseDirectConversion(value)).toBe(false);
    },
  );
});

describe('chave de armazenamento', () => {
  it('é um nome simples, sem caracteres especiais', () => {
    expect(DIRECT_CONVERSION_KEY).toBe('directConversion');
    expect(DIRECT_CONVERSION_KEY).toMatch(/^[A-Za-z][A-Za-z0-9]*$/);
  });
});
