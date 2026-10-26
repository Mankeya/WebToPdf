import { describe, expect, it } from 'vitest';
import { THEME_KEY, parseTheme } from '../../src/shared/theme';

describe('parseTheme', () => {
  it('aceita dark como escuro', () => {
    expect(parseTheme('dark')).toBe('dark');
  });

  it.each([undefined, null, '', 'light', 'DARK', 'Dark', 'escuro', 0, 1, true, false, {}, []])(
    'trata %o como claro',
    (value) => {
      expect(parseTheme(value)).toBe('light');
    },
  );
});

describe('chave de armazenamento', () => {
  it('é um nome simples, sem caracteres especiais', () => {
    expect(THEME_KEY).toBe('theme');
    expect(THEME_KEY).toMatch(/^[A-Za-z][A-Za-z0-9]*$/);
  });
});
