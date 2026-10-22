import type { PrintSettings } from './settings';

export const CONVERSION_PORT = 'webtopdf-convert';
export const MAX_PDF_BYTES = 32 * 1024 * 1024;
export const CONVERSION_TIMEOUT_MS = 60_000;

export interface ConversionRequest {
  type: 'convert';
  sourceTabId: number;
  settings: PrintSettings;
}

export type ConversionEvent =
  | { type: 'chunk'; data: string; byteLength: number }
  | { type: 'complete'; title: string; byteLength: number }
  | { type: 'error'; message: string };

export class ConversionError extends Error {}

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
