import { MAX_FILE_BYTES } from './conversion';

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
