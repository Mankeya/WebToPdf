import { describe, expect, it } from 'vitest';
import { createPdfFilename, sanitizeTitle } from '../../src/shared/filename';

describe('sanitizeTitle', () => {
  it('remove caminhos, caracteres inválidos e controles', () => {
    expect(sanitizeTitle('  Relatório: vendas / outubro\\2026?*\u0000  ')).toBe('Relatório vendas outubro 2026');
  });

  it.each(['', '  ', '...', '<>:"/\\|?*'])('usa fallback para título vazio: %s', (title) => {
    expect(sanitizeTitle(title)).toBe('pagina');
  });

  it.each(['CON', 'nul', 'COM1', 'LPT9.txt'])('protege nomes reservados: %s', (title) => {
    expect(sanitizeTitle(title)).toBe(`pagina-${title}`);
  });

  it('limita títulos sem cortar pares Unicode', () => {
    expect(Array.from(sanitizeTitle('😀'.repeat(120)))).toHaveLength(100);
  });

  it('remove pontos finais e normaliza Unicode', () => {
    expect(sanitizeTitle('Cafe\u0301... ')).toBe('Café');
  });
});

describe('createPdfFilename', () => {
  it('usa data e horário locais sem caracteres inválidos do Windows', () => {
    const date = new Date(2026, 9, 21, 9, 4, 2);
    expect(createPdfFilename('Meu relatório', date)).toBe('Meu relatório - 2026-10-21_09-04-02.pdf');
  });

  it('rejeita datas inválidas', () => {
    expect(() => createPdfFilename('Teste', new Date('invalid'))).toThrow(RangeError);
  });
});
