import { expect, it } from 'vitest';
import { jpegToPdfWithOcr } from '../../src/shared/image-pdf';

it('mantém o texto OCR invisível sem alterar a imagem original', () => {
  const jpeg = new Uint8Array([255, 216, 255, 192, 0, 17, 8, 0, 30, 0, 20, 3, 1, 17, 0, 2, 17, 0, 3, 17, 0, 255, 217]);
  const pdf = jpegToPdfWithOcr(jpeg, { text: 'Empresa', words: [{ text: 'Empresa', confidence: 95, bbox: { x0: 1, y0: 2, x1: 19, y1: 12 } }] });
  const source = new TextDecoder().decode(pdf);
  expect(source).toContain('3 Tr');
  expect(source).not.toContain('1 Tr');
});
