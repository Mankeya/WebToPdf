import { describe, expect, it } from 'vitest';
import { base64ByteLength } from '../../src/shared/conversion';

describe('base64ByteLength', () => {
  it('devolve zero para entrada vazia', () => {
    expect(base64ByteLength('')).toBe(0);
  });

  it('calcula o tamanho de um bloco completo', () => {
    expect(base64ByteLength('JVBERi0=')).toBe(5);
    expect(base64ByteLength('JVBERi0xLjcK')).toBe(9);
  });

  it('desconta o preenchimento', () => {
    expect(base64ByteLength('QQ==')).toBe(1);
    expect(base64ByteLength('QUI=')).toBe(2);
    expect(base64ByteLength('QUJD')).toBe(3);
  });

  it('conta restos de bloco', () => {
    expect(base64ByteLength('QUJDREU')).toBe(5);
    expect(base64ByteLength('QUJDREVG')).toBe(6);
  });

  it('bate com o tamanho real dos bytes decodificados', () => {
    const samples = ['', 'a', 'ab', 'abc', 'abcd', 'abcde', 'P', 'PDF-1.4', '%PDF-1.7\n'];
    for (const sample of samples) {
      const binary = atob(btoa(sample));
      expect(base64ByteLength(btoa(sample))).toBe(binary.length);
    }
  });
});
