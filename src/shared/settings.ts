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
