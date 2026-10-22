export type PaperSize = 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | 'Tabloid' | 'Custom' | 'FullPage';
export type Orientation = 'portrait' | 'landscape';

export interface PaperDefinition {
  id: PaperSize;
  label: string;
  /** Largura e altura em milímetros, na orientação retrato. */
  widthMm: number;
  heightMm: number;
}

export const PAPER_SIZES: readonly PaperDefinition[] = Object.freeze([
  { id: 'A4', label: 'A4', widthMm: 210, heightMm: 297 },
  { id: 'A3', label: 'A3', widthMm: 297, heightMm: 420 },
  { id: 'A5', label: 'A5', widthMm: 148, heightMm: 210 },
  { id: 'Letter', label: 'Carta', widthMm: 215.9, heightMm: 279.4 },
  { id: 'Legal', label: 'Legal', widthMm: 215.9, heightMm: 355.6 },
  { id: 'Tabloid', label: 'Tabloid', widthMm: 279.4, heightMm: 431.8 },
]);

export const CUSTOM_PAPER: PaperDefinition = { id: 'Custom', label: 'Personalizado', widthMm: 210, heightMm: 297 };
export const FULL_PAGE_PAPER: PaperDefinition = { id: 'FullPage', label: 'Página inteira', widthMm: 210, heightMm: 297 };

export const PAPER_SIZE_IDS: readonly PaperSize[] = Object.freeze([
  ...PAPER_SIZES.map((paper) => paper.id),
  'Custom',
  'FullPage',
]);

export interface PrintSettings {
  paperSize: PaperSize;
  customWidthMm: number;
  customHeightMm: number;
  orientation: Orientation;
  marginMm: number;
  scale: number;
  printBackground: boolean;
  displayHeaderFooter: boolean;
}

export const DEFAULT_PRINT_SETTINGS: Readonly<PrintSettings> = Object.freeze({
  paperSize: 'A4',
  customWidthMm: 210,
  customHeightMm: 297,
  orientation: 'portrait',
  marginMm: 10,
  scale: 1,
  printBackground: true,
  displayHeaderFooter: false,
});

export const LIMITS = Object.freeze({
  minMarginMm: 0,
  maxMarginMm: 50,
  minScale: 0.1,
  maxScale: 2,
  minCustomMm: 20,
  maxCustomMm: 2000,
});

export function findPaper(id: PaperSize): PaperDefinition | undefined {
  if (id === 'Custom') return CUSTOM_PAPER;
  if (id === 'FullPage') return FULL_PAGE_PAPER;
  return PAPER_SIZES.find((paper) => paper.id === id);
}

/**
 * Dimensões do papel em milímetros, na orientação retrato.
 * A troca para paisagem é feita pelo Chrome no momento da impressão, pelo
 * parâmetro `landscape` do comando de impressão.
 */
export function resolvePaperSize(settings: Readonly<PrintSettings>): { widthMm: number; heightMm: number } {
  const paper = findPaper(settings.paperSize) ?? findPaper('A4')!;
  const widthMm = settings.paperSize === 'Custom' ? settings.customWidthMm : paper.widthMm;
  const heightMm = settings.paperSize === 'Custom' ? settings.customHeightMm : paper.heightMm;
  return { widthMm, heightMm };
}

/** Dimensões finais em milímetros, já com a orientação aplicada. */
export function resolvePaperSizeOriented(settings: Readonly<PrintSettings>): { widthMm: number; heightMm: number } {
  const { widthMm, heightMm } = resolvePaperSize(settings);
  return settings.orientation === 'landscape'
    ? { widthMm: heightMm, heightMm: widthMm }
    : { widthMm, heightMm };
}

export function isPaperSize(value: unknown): value is PaperSize {
  return typeof value === 'string' && (PAPER_SIZE_IDS as readonly string[]).includes(value);
}

export function parsePrintSettings(value: unknown): PrintSettings | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;

  if (!isPaperSize(candidate.paperSize)) return null;
  if (candidate.orientation !== 'portrait' && candidate.orientation !== 'landscape') return null;

  const customWidthMm = candidate.customWidthMm;
  const customHeightMm = candidate.customHeightMm;
  if (typeof customWidthMm !== 'number' || !Number.isFinite(customWidthMm)
    || customWidthMm < LIMITS.minCustomMm || customWidthMm > LIMITS.maxCustomMm) return null;
  if (typeof customHeightMm !== 'number' || !Number.isFinite(customHeightMm)
    || customHeightMm < LIMITS.minCustomMm || customHeightMm > LIMITS.maxCustomMm) return null;

  const marginMm = candidate.marginMm;
  if (typeof marginMm !== 'number' || !Number.isFinite(marginMm)
    || marginMm < LIMITS.minMarginMm || marginMm > LIMITS.maxMarginMm) return null;

  const scale = candidate.scale;
  if (typeof scale !== 'number' || !Number.isFinite(scale)
    || scale < LIMITS.minScale || scale > LIMITS.maxScale) return null;

  if (typeof candidate.printBackground !== 'boolean') return null;
  if (typeof candidate.displayHeaderFooter !== 'boolean') return null;

  return {
    paperSize: candidate.paperSize,
    customWidthMm,
    customHeightMm,
    orientation: candidate.orientation,
    marginMm,
    scale,
    printBackground: candidate.printBackground,
    displayHeaderFooter: candidate.displayHeaderFooter,
  };
}
