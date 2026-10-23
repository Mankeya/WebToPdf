import { describe, expect, it } from 'vitest';
import { CONVERSION_FORMATS, FORMAT_IDS, findFormat, isFormatAvailable, parseFormat } from '../../src/shared/format';

describe('parseFormat', () => {
  it.each(['pdf', 'png', 'txt', 'md'])('aceita o formato conhecido %s', (value) => {
    expect(parseFormat(value)).toBe(value);
  });

  it.each([undefined, null, 42, {}, true, '', 'docx', 'PDF', 'pdf ', 'javascript'])('rejeita valor desconhecido: %s', (value) => {
    expect(parseFormat(value)).toBeNull();
  });
});

describe('registro de formatos', () => {
  it('mantém IDs únicos e extensões sem ponto', () => {
    expect(new Set(FORMAT_IDS).size).toBe(FORMAT_IDS.length);
    for (const format of CONVERSION_FORMATS) {
      expect(format.extension).not.toMatch(/^\./);
      expect(format.label.length).toBeGreaterThan(0);
      expect(format.description.length).toBeGreaterThan(0);
    }
  });

  it('publica somente o PDF como disponível nesta versão', () => {
    expect(FORMAT_IDS.filter(isFormatAvailable)).toEqual(['pdf']);
  });

  it('findFormat devolve a definição conhecida e undefined para ID forjado', () => {
    expect(findFormat('pdf')?.extension).toBe('pdf');
    expect(findFormat('png')?.available).toBe(false);
  });
});
