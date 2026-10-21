import { describe, expect, it } from 'vitest';
import { DEFAULT_PRINT_SETTINGS } from '../../src/shared/settings';

describe('configurações iniciais', () => {
  it('respeita os padrões aprovados', () => {
    expect(DEFAULT_PRINT_SETTINGS).toEqual({
      paperSize: 'A4',
      orientation: 'portrait',
      marginMm: 10,
      scale: 1,
      printBackground: true,
      displayHeaderFooter: false,
    });
  });

  it('impede alteração acidental dos padrões', () => {
    expect(Object.isFrozen(DEFAULT_PRINT_SETTINGS)).toBe(true);
  });
});
