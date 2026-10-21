export type PaperSize = 'A4' | 'Letter';
export type Orientation = 'portrait' | 'landscape';

export interface PrintSettings {
  paperSize: PaperSize;
  orientation: Orientation;
  marginMm: number;
  scale: number;
  printBackground: boolean;
  displayHeaderFooter: boolean;
}

// Margem de 10 mm e escala de 100% são valores iniciais de engenharia;
// devem ser verificados com as fixtures no gate de conversão real.
export const DEFAULT_PRINT_SETTINGS: Readonly<PrintSettings> = Object.freeze({
  paperSize: 'A4',
  orientation: 'portrait',
  marginMm: 10,
  scale: 1,
  printBackground: true,
  displayHeaderFooter: false,
});

export function parsePrintSettings(value: unknown): PrintSettings | null {
  if (typeof value !== 'object' || value === null) return null;
  if (!('paperSize' in value) || (value.paperSize !== 'A4' && value.paperSize !== 'Letter')) return null;
  if (!('orientation' in value) || (value.orientation !== 'portrait' && value.orientation !== 'landscape')) return null;
  if (!('marginMm' in value) || typeof value.marginMm !== 'number' || !Number.isFinite(value.marginMm) || value.marginMm < 0 || value.marginMm > 50) return null;
  if (!('scale' in value) || typeof value.scale !== 'number' || !Number.isFinite(value.scale) || value.scale < 0.1 || value.scale > 2) return null;
  if (!('printBackground' in value) || typeof value.printBackground !== 'boolean') return null;
  if (!('displayHeaderFooter' in value) || typeof value.displayHeaderFooter !== 'boolean') return null;

  return {
    paperSize: value.paperSize,
    orientation: value.orientation,
    marginMm: value.marginMm,
    scale: value.scale,
    printBackground: value.printBackground,
    displayHeaderFooter: value.displayHeaderFooter,
  };
}
