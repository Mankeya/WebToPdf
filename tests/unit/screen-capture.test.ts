import { describe, expect, it } from 'vitest';
import { SnapshotCache } from '../../src/background/snapshot-cache';
import { jpegToPdf } from '../../src/shared/image-pdf';

describe('cache temporário de capturas', () => {
  it('isola aba, URL e token e expira após 30 segundos', () => {
    let now = 0;
    const cache = new SnapshotCache(() => now);
    const id = cache.put(4, 'https://example.com/', 'imagem');
    expect(cache.get(id, 5, 'https://example.com/')).toBeNull();
    expect(cache.get(id, 4, 'https://outro.com/')).toBeNull();
    expect(cache.get('outro', 4, 'https://example.com/')).toBeNull();
    expect(cache.get(id, 4, 'https://example.com/')).toBe('imagem');
    now = 30_000;
    expect(cache.get(id, 4, 'https://example.com/')).toBeNull();
  });

  it('limita o cache e remove capturas ao sair da aba', () => {
    const cache = new SnapshotCache();
    const oldest = cache.put(1, 'https://example.com/', 'antiga');
    for (let i = 2; i <= 5; i++) cache.put(i, 'https://example.com/', 'nova');
    expect(cache.get(oldest, 1, 'https://example.com/')).toBeNull();
    const id = cache.put(8, 'https://example.com/', 'nova');
    cache.removeTab(8);
    expect(cache.get(id, 8, 'https://example.com/')).toBeNull();
  });
});

describe('PDF de imagem', () => {
  // Segmento SOF0 RGB de 2 × 3 pixels; suficiente para testar o contêiner.
  const jpeg = new Uint8Array([255, 216, 255, 192, 0, 17, 8, 0, 3, 0, 2, 3, 1, 17, 0, 2, 17, 0, 3, 17, 0, 255, 217]);
  it('embute os bytes sem reinterpretá-los e gera offsets xref corretos', () => {
    const bytes = jpegToPdf(jpeg);
    const pdf = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
    expect(pdf).toMatch(/^%PDF-1.4/);
    expect(pdf).toContain('/Filter /DCTDecode');
    expect(pdf).toContain('/Width 2 /Height 3');
    expect(pdf).toContain('/MediaBox [0 0 1.5 2.25]');
    expect(pdf).not.toContain('/Font');
    const offset = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);
    expect(pdf.slice(offset, offset + 4)).toBe('xref');
    const entries = pdf.slice(offset).split('\n').slice(4, 9);
    entries.forEach((entry, index) => {
      expect(pdf.slice(Number(entry.slice(0, 10)))).toMatch(new RegExp(`^${index + 1} 0 obj`));
    });
  });
  it.each([new Uint8Array(), new Uint8Array([255, 216, 255, 192]), new Uint8Array([1, 2])])('rejeita JPEG inválido', (bytes) => {
    expect(() => jpegToPdf(bytes)).toThrow();
  });
});
