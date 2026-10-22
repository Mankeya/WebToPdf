const MAX_TITLE_LENGTH = 100;

/**
 * Nomes reservados pelo Windows como nome de arquivo.
 * O padrão exige a checagem antes do ponto ou do fim, como em CON.txt.
 */
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

/**
 * Torna um texto seguro para virar nome de arquivo no Windows.
 *
 * Remove caracteres inválidos e de controle, normaliza Unicode, corta
 * sequências de pontos (que o Windows e o Chrome interpretam como caminho
 * relativo) e protege os nomes reservados pelo sistema.
 */
export function sanitizeTitle(title: string): string {
  const normalized = title
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const truncated = Array.from(normalized).slice(0, MAX_TITLE_LENGTH).join('');
  // Pontos no meio do nome viram espaço, para que ".." nunca seja lido como
  // referência a um diretório pai.
  const safeTitle = truncated
    .replace(/\.{2,}/g, ' ')
    .replace(/[. ]+$/g, '')
    .replace(/^\.+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!safeTitle) return 'pagina';
  if (RESERVED_NAMES.test(safeTitle)) {
    return `pagina-${safeTitle}`;
  }
  return safeTitle;
}

export function createPdfFilename(title: string, date: Date = new Date()): string {
  if (Number.isNaN(date.getTime())) throw new RangeError('Data inválida.');

  const pad = (value: number): string => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  return `${sanitizeTitle(title)} - ${day}_${time}.pdf`;
}
