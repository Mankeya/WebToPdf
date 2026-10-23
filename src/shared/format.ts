export type ConversionFormat = 'pdf' | 'png' | 'txt' | 'md';

export interface FormatDefinition {
  id: ConversionFormat;
  label: string;
  description: string;
  /** Extensão do arquivo baixado, sem o ponto. */
  extension: string;
  /**
   * Nem todo formato listado no menu já tem conversor. Mostrar o formato com
   * "Em breve" mantém o menu estável entre versões e permite habilitar cada
   * um em sua própria release.
   */
  available: boolean;
}

export const CONVERSION_FORMATS: readonly FormatDefinition[] = Object.freeze([
  { id: 'pdf', label: 'PDF', description: 'Documento pronto para ler e imprimir', extension: 'pdf', available: true },
  { id: 'png', label: 'PNG', description: 'Imagem da página inteira', extension: 'png', available: false },
  { id: 'txt', label: 'Texto', description: 'Só o texto da página, em .txt', extension: 'txt', available: false },
  { id: 'md', label: 'Markdown', description: 'Texto estruturado, em .md', extension: 'md', available: false },
]);

export const FORMAT_IDS: readonly ConversionFormat[] = Object.freeze(CONVERSION_FORMATS.map((format) => format.id));

const FORMATS_BY_ID = new Map<ConversionFormat, FormatDefinition>(CONVERSION_FORMATS.map((format) => [format.id, format]));

/** Valida um valor vindo de fora; valores desconhecidos viram `null`. */
export function parseFormat(value: unknown): ConversionFormat | null {
  return typeof value === 'string' && (FORMAT_IDS as readonly string[]).includes(value) ? value as ConversionFormat : null;
}

export function findFormat(id: ConversionFormat): FormatDefinition | undefined {
  return FORMATS_BY_ID.get(id);
}

export function isFormatAvailable(id: ConversionFormat): boolean {
  return FORMATS_BY_ID.get(id)?.available === true;
}
