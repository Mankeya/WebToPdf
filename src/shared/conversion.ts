import type { ConversionFormat } from './format';
import type { PrintSettings } from './settings';

export const CONVERSION_PORT = 'webtopdf-convert';
/** Teto aplicado ao arquivo gerado, seja PDF, PNG ou texto. */
export const MAX_FILE_BYTES = 32 * 1024 * 1024;
export const CONVERSION_TIMEOUT_MS = 60_000;

export interface ConversionRequest {
  type: 'convert';
  sourceTabId: number;
  /** Formato escolhido no menu; precisa ser o mesmo declarado na URL da prévia. */
  format: ConversionFormat;
  settings: PrintSettings;
}

export type ConversionEvent =
  | { type: 'chunk'; data: string; byteLength: number }
  | { type: 'complete'; title: string; byteLength: number }
  | { type: 'error'; message: string };

export class ConversionError extends Error {}

/** Assinatura inicial do PDF: os cinco bytes `%PDF-`. */
const PDF_SIGNATURE = '%PDF-';
/** Assinatura inicial do PNG: 89 50 4E 47 0D 0A 1A 0A. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Confere os bytes iniciais contra a assinatura esperada do formato. PDF e
 * PNG têm assinatura binária; formatos de texto não têm, então valem como
 * verdadeiros e o tamanho é o único limite externo deles.
 */
export function matchesFileSignature(format: ConversionFormat, bytes: Uint8Array): boolean {
  if (format === 'pdf' || format === 'screen-pdf') {
    return PDF_SIGNATURE.split('').every((char, index) => bytes[index] === char.charCodeAt(0));
  }
  if (format === 'png') {
    return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
  }
  return true;
}

/**
 * Divide um Base64 em fatias de `size` caracteres para trafegar pela porta.
 * O limite fica múltiplo de 4 para cada fatia, menos a última, decodificar
 * sozinha com `atob`, sem desenhar trechos quebrados na decodificação.
 */
export function chunkBase64(data: string, size = 256 * 1024): string[] {
  const step = Math.max(4, Math.floor(size / 4) * 4);
  const chunks: string[] = [];
  for (let offset = 0; offset < data.length; offset += step) {
    chunks.push(data.slice(offset, offset + step));
  }
  return chunks;
}

/**
 * Tamanho em bytes de um texto Base64, calculado sem decodificar.
 * O Chrome devolve os trechos da impressão já em Base64; decodificar aqui
 * apenas para contar desperdiçaria memória e tempo.
 */
export function base64ByteLength(data: string): number {
  if (data.length === 0) return 0;
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  const whole = Math.floor(data.length / 4) * 3;
  const remainder = data.length % 4;
  const extra = remainder === 2 ? 1 : remainder === 3 ? 2 : 0;
  return whole + extra - padding;
}
