const MAX_TITLE_LENGTH = 100;

export function sanitizeTitle(title: string): string {
  const normalized = title
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const truncated = Array.from(normalized).slice(0, MAX_TITLE_LENGTH).join('');
  const safeTitle = truncated.replace(/[. ]+$/g, '').replace(/^\.+/, '').trim();

  if (!safeTitle) return 'pagina';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safeTitle)) {
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
