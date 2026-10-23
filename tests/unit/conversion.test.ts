import { describe, expect, it } from 'vitest';
import { base64ByteLength, chunkBase64, matchesFileSignature } from '../../src/shared/conversion';

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

describe('matchesFileSignature', () => {
  const bytesOf = (text: string): Uint8Array => Uint8Array.from(text, (char) => char.charCodeAt(0));

  it('aceita um PDF com a assinatura correta', () => {
    expect(matchesFileSignature('pdf', bytesOf('%PDF-1.7\n'))).toBe(true);
  });

  it('rejeita conteúdo que não começa como PDF', () => {
    expect(matchesFileSignature('pdf', bytesOf('<html>'))).toBe(false);
    expect(matchesFileSignature('pdf', new Uint8Array())).toBe(false);
  });

  it('confere os oito bytes do PNG', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(matchesFileSignature('png', png)).toBe(true);
  });

  it('rejeita bytes que não são PNG', () => {
    expect(matchesFileSignature('png', bytesOf('%PDF-1.7'))).toBe(false);
    expect(matchesFileSignature('png', new Uint8Array([0x89, 0x50]))).toBe(false);
  });

  it('formatos de texto não têm assinatura binária', () => {
    expect(matchesFileSignature('txt', bytesOf('qualquer coisa'))).toBe(true);
    expect(matchesFileSignature('md', new Uint8Array())).toBe(true);
  });
});

describe('chunkBase64', () => {
  it('devolve lista vazia para entrada vazia', () => {
    expect(chunkBase64('')).toEqual([]);
  });

  it('divide em múltiplos de 4 e mantém a concatenação igual ao original', () => {
    const data = btoa('x'.repeat(1000));
    const chunks = chunkBase64(data, 16);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks.slice(0, -1)) expect(chunk.length % 4).toBe(0);
    expect(chunks.join('')).toBe(data);
  });

  it('respeita o tamanho pedido e nunca parte um pedaço no meio de um grupo de 4', () => {
    const data = 'QUJDREVG'.repeat(50);
    const chunks = chunkBase64(data, 8);
    expect(chunks.every((chunk) => chunk.length <= 8)).toBe(true);
    expect(chunks.join('')).toBe(data);
    // Cada pedaço precisa decodificar sozinho com atob.
    for (const chunk of chunks) expect(() => atob(chunk)).not.toThrow();
  });

  it('garante pedaço mínimo de 4 caracteres', () => {
    expect(chunkBase64('QUJDREVG', 1)).toEqual(['QUJD', 'REVG']);
  });
});
