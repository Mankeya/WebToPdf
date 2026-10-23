import { describe, expect, it } from 'vitest';
import { createConversionFilename, sanitizeTitle } from '../../src/shared/filename';

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

  it('impede que o nome vire um caminho relativo', () => {
    expect(sanitizeTitle('../../etc/passwd')).toBe('etc passwd');
    expect(sanitizeTitle('..')).toBe('pagina');
    expect(sanitizeTitle('../..')).toBe('pagina');
    expect(sanitizeTitle('relatorio..final')).toBe('relatorio final');
    expect(sanitizeTitle('...')).toBe('pagina');
  });

  it('mantém um ponto simples no meio do nome', () => {
    expect(sanitizeTitle('relatorio.final.pdf')).toBe('relatorio.final.pdf');
  });
});

describe('createConversionFilename', () => {
  it('usa data e horário locais sem caracteres inválidos do Windows', () => {
    const date = new Date(2026, 9, 21, 9, 4, 2);
    expect(createConversionFilename('Meu relatório', 'pdf', date)).toBe('Meu relatório - 2026-10-21_09-04-02.pdf');
  });

  it('aplica a extensão do formato escolhido', () => {
    const date = new Date(2026, 9, 21, 9, 4, 2);
    expect(createConversionFilename('Meu relatório', 'png', date)).toBe('Meu relatório - 2026-10-21_09-04-02.png');
  });

  it('rejeita datas inválidas em qualquer formato', () => {
    expect(() => createConversionFilename('Teste', 'pdf', new Date('invalid'))).toThrow(RangeError);
    expect(() => createConversionFilename('Teste', 'png', new Date('invalid'))).toThrow(RangeError);
  });
});
