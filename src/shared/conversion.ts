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
  | { type: 'chunk'; data: string }
  | { type: 'complete'; title: string; byteLength: number }
  | { type: 'error'; message: string };

export class ConversionError extends Error {}
