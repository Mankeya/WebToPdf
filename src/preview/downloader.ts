import { sanitizeTitle } from '../shared/filename';

export type DownloadOutcome =
  | { status: 'complete' }
  | { status: 'interrupted'; reason: string }
  | { status: 'cancelled' }
  | { status: 'blocked'; reason: string };

export interface DownloadRequest {
  bytes: Uint8Array<ArrayBuffer>;
  filename: string;
  saveAs: boolean;
}

export function resolveDownloadFilename(requested: string, fallbackTitle: string): string {
  const trimmed = requested.trim().replace(/\.pdf$/i, '');
  const base = trimmed.length > 0 ? trimmed : sanitizeTitle(fallbackTitle);
  return `${sanitizeTitle(base)}.pdf`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * O histórico de downloads do Chrome é a única fonte disponível para a
 * extensão saber quais nomes já existem. A busca usa o diretório do download
 * mais recente quando possível, para não confundir arquivos de pastas
 * diferentes com o mesmo nome.
 */
async function inferDownloadDirectory(): Promise<string | null> {
  const recent = await chrome.downloads.search({ state: 'complete', orderBy: ['-endTime'], limit: 1 });
  const path = recent[0]?.filename;
  if (!path) return null;
  const separator = path.lastIndexOf('\\');
  if (separator <= 0) return null;
  return path.slice(0, separator);
}

export async function pickAvailableFilename(desired: string): Promise<string> {
  const base = desired.replace(/\.pdf$/i, '');
  const directory = await inferDownloadDirectory();
  for (let index = 0; index < 100; index += 1) {
    const candidate = index === 0 ? `${base}.pdf` : `${base} (${index}).pdf`;
    const pattern = directory
      ? `^${escapeRegExp(directory)}\\\\${escapeRegExp(candidate)}$`
      : `${escapeRegExp(candidate)}$`;
    const existing = await chrome.downloads.search({ filenameRegex: pattern });
    if (existing.length === 0) return candidate;
  }
  return `${base} (${Date.now()}).pdf`;
}

/**
 * Chrome ignora a opção `filename` da API de downloads para URLs blob: e
 * substitui pelo UUID da origem. A única forma de preservar o nome escolhido
 * sem servidor externo é o atributo `download` de um link, que o Chrome
 * respeita para URLs blob: da própria extensão.
 */
function triggerAnchorDownload(url: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

async function waitForDownload(url: string, timeoutMs: number): Promise<DownloadOutcome> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const items = await chrome.downloads.search({ url });
    const item = items[0];
    if (item) {
      if (item.state === 'complete') return { status: 'complete' };
      if (item.state === 'interrupted') return { status: 'interrupted', reason: item.error ?? 'interrompido' };
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return { status: 'cancelled' };
}

/**
 * Reserva o nome do arquivo no service worker.
 *
 * Para URLs blob: o Chrome substitui o nome informado pelo UUID da origem.
 * O evento `onDeterminingFilename` é o mecanismo previsto para restaurar o
 * nome escolhido, e só o service worker pode registrá-lo.
 */
async function reserveFilename(url: string, filename: string): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: 'reserve-filename', url, filename });
  } catch {
    // Sem reserva, o Chrome usa o nome gerado. O download continua válido.
  }
}

export async function startDownload(request: DownloadRequest): Promise<DownloadOutcome> {
  const blob = new Blob([request.bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  if (request.saveAs) {
    await reserveFilename(url, request.filename);
    try {
      // Com saveAs, o Chrome abre o diálogo nativo já preenchido com `filename`.
      const downloadId = await chrome.downloads.download({
        url,
        filename: request.filename,
        saveAs: true,
        conflictAction: 'uniquify',
      });
      if (downloadId === undefined) {
        URL.revokeObjectURL(url);
        return { status: 'cancelled' };
      }
      return await new Promise<DownloadOutcome>((resolve) => {
        const settle = (outcome: DownloadOutcome): void => {
          chrome.downloads.onChanged.removeListener(listener);
          URL.revokeObjectURL(url);
          resolve(outcome);
        };
        const listener = (delta: chrome.downloads.DownloadDelta): void => {
          if (delta.id !== downloadId) return;
          if (delta.state?.current === 'complete') settle({ status: 'complete' });
          else if (delta.state?.current === 'interrupted') settle({ status: 'interrupted', reason: delta.error?.current ?? 'interrompido' });
        };
        chrome.downloads.onChanged.addListener(listener);
        setTimeout(() => settle({ status: 'cancelled' }), 120_000);
      });
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }

  try {
    // O atributo download respeita o nome, mas sobrescreve arquivos existentes.
    // Por isso escolhemos um nome livre antes de disparar o download.
    const available = await pickAvailableFilename(request.filename);
    await reserveFilename(url, available);
    triggerAnchorDownload(url, available);
    return await waitForDownload(url, 60_000);
  } finally {
    URL.revokeObjectURL(url);
  }
}
