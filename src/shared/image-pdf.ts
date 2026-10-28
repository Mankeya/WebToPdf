import { MAX_FILE_BYTES } from './conversion';

export interface OcrWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

export interface OcrResult {
  text: string;
  words: OcrWord[];
}

/** PDF RGB de uma folha, sem JavaScript, fontes ou recursos externos. */
export function jpegToPdf(jpeg: Uint8Array): Uint8Array<ArrayBuffer> {
  if (jpeg.length > MAX_FILE_BYTES - 2048 || jpeg[0] !== 255 || jpeg[1] !== 216) throw new Error('JPEG inválido ou grande demais.');
  let width = 0;
  let height = 0;
  for (let p = 2; p + 4 <= jpeg.length;) {
    if (jpeg[p] !== 255) break;
    const marker = jpeg[p + 1];
    const length = (jpeg[p + 2]! << 8) | jpeg[p + 3]!;
    if (length < 2 || p + 2 + length > jpeg.length) break;
    if (marker === 0xc0 || marker === 0xc2) {
      if (length < 17 || jpeg[p + 4] !== 8 || jpeg[p + 9] !== 3) break;
      height = (jpeg[p + 5]! << 8) | jpeg[p + 6]!;
      width = (jpeg[p + 7]! << 8) | jpeg[p + 8]!;
      break;
    }
    p += length + 2;
  }
  if (!width || !height || width > 16_384 || height > 16_384) throw new Error('Dimensões JPEG inválidas.');
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [0];
  let size = 0;
  const append = (part: string | Uint8Array): void => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    parts.push(bytes);
    size += bytes.length;
  };
  const object = (id: number, body: string): void => {
    offsets[id] = size;
    append(`${id} 0 obj\n${body}\nendobj\n`);
  };
  const w = width * 0.75;
  const h = height * 0.75;
  append('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = size;
  append(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  append(jpeg);
  append('\nendstream\nendobj\n');
  const commands = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q\n`;
  object(5, `<< /Length ${encoder.encode(commands).length} >>\nstream\n${commands}endstream`);
  const xref = size;
  append('xref\n0 6\n0000000000 65535 f \n');
  for (const offset of offsets.slice(1)) append(`${String(offset).padStart(10, '0')} 00000 n \n`);
  append(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const result = new Uint8Array(size);
  let p = 0;
  for (const part of parts) { result.set(part, p); p += part.length; }
  return result;
}

/** Gera PDF com imagem JPEG + camada de texto invisível (render mode 3). */
export function jpegToPdfWithOcr(jpeg: Uint8Array, ocr: OcrResult): Uint8Array<ArrayBuffer> {
  if (jpeg.length > MAX_FILE_BYTES - 2048 || jpeg[0] !== 255 || jpeg[1] !== 216) throw new Error('JPEG inválido ou grande demais.');
  let width = 0;
  let height = 0;
  for (let p = 2; p + 4 <= jpeg.length;) {
    if (jpeg[p] !== 255) break;
    const marker = jpeg[p + 1];
    const length = (jpeg[p + 2]! << 8) | jpeg[p + 3]!;
    if (length < 2 || p + 2 + length > jpeg.length) break;
    if (marker === 0xc0 || marker === 0xc2) {
      if (length < 17 || jpeg[p + 4] !== 8 || jpeg[p + 9] !== 3) break;
      height = (jpeg[p + 5]! << 8) | jpeg[p + 6]!;
      width = (jpeg[p + 7]! << 8) | jpeg[p + 8]!;
      break;
    }
    p += length + 2;
  }
  if (!width || !height || width > 16_384 || height > 16_384) throw new Error('Dimensões JPEG inválidas.');

  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [0];
  let size = 0;
  const append = (part: string | Uint8Array): void => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    parts.push(bytes);
    size += bytes.length;
  };
  const object = (id: number, body: string): void => {
    offsets[id] = size;
    append(`${id} 0 obj\n${body}\nendobj\n`);
  };

  const w = width * 0.75;
  const h = height * 0.75;
  const scaleX = w / width;
  const scaleY = h / height;

  append('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');

  // Font object (Helvetica built-in)
  object(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');

  // Page object references Font and XObject
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << /F1 4 0 R >> /XObject << /Im0 5 0 R >> >> /Contents 6 0 R >>`);

  // Image XObject
  offsets[5] = size;
  append(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  append(jpeg);
  append('\nendstream\nendobj\n');

  // Content stream: draw image + invisible text
  const textCommands: string[] = [];
  for (const word of ocr.words) {
    if (!word.text.trim()) continue;
    // A fonte WinAnsi usa bytes CP1252, nunca UTF-8 (acentos precisam de um byte).
    // Palavra com caractere fora de CP1252 é descartada uma a uma; as demais
    // seguem na camada, para um caractere raro não anular o OCR inteiro.
    const codes: string[] = [];
    let supported = true;
    for (const char of [...word.text]) {
      let code = char.codePointAt(0)!;
      if (code > 255) {
        const windowsCharacters = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';
        const index = windowsCharacters.indexOf(char);
        if (index >= 0) code = 128 + index;
      }
      if (code > 255) { supported = false; break; }
      codes.push(code.toString(16).padStart(2, '0'));
    }
    if (!supported) continue;
    const txt = codes.join('');
    const x = word.bbox.x0 * scaleX;
    const y = h - word.bbox.y1 * scaleY; // PDF coords: origin bottom-left
    const fs = Math.max(1, (word.bbox.y1 - word.bbox.y0) * scaleY);
    textCommands.push(`BT /F1 ${fs} Tf 3 Tr ${x.toFixed(2)} ${y.toFixed(2)} Td <${txt}> Tj ET`);
  }
  const imageCmd = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q\n`;
  if (!textCommands.length) throw new Error('Nenhum texto OCR suportado para a camada invisível.');
  const contentStream = imageCmd + textCommands.join('\n') + '\n';

  object(6, `<< /Length ${encoder.encode(contentStream).length} >>\nstream\n${contentStream}endstream`);

  const xref = size;
  append('xref\n0 7\n0000000000 65535 f \n');
  for (const offset of offsets.slice(1)) append(`${String(offset).padStart(10, '0')} 00000 n \n`);
  append(`trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(size);
  let p = 0;
  for (const part of parts) { out.set(part, p); p += part.length; }
  return out;
}
