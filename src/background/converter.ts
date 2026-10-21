import { ConversionError, MAX_PDF_BYTES } from '../shared/conversion';
import { isSupportedPage } from '../shared/preview-url';
import type { PrintSettings } from '../shared/settings';

export async function convertTabToPdf(
  tabId: number,
  settings: PrintSettings,
  onChunk: (base64: string) => void,
  signal: AbortSignal,
): Promise<{ title: string; byteLength: number }> {
  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    throw new ConversionError('A página original foi fechada ou não está disponível. Abra a extensão novamente na página desejada.');
  }
  if (tab.url && !isSupportedPage(tab.url)) throw new ConversionError('Página não compatível. Use uma aba HTTP ou HTTPS.');
  if (tab.status === 'loading') throw new ConversionError('Aguarde a página original terminar de carregar e tente atualizar a prévia.');

  const target = { tabId };
  let attached = false;
  let stream: string | undefined;
  const cancel = (): void => {
    if (attached) void chrome.debugger.detach(target).catch(() => undefined);
  };
  signal.addEventListener('abort', cancel);

  try {
    signal.throwIfAborted();
    try {
      await chrome.debugger.attach(target, '1.3');
      attached = true;
    } catch {
      throw new ConversionError('O Chrome não permitiu iniciar a impressão. Feche o DevTools da página e verifique as permissões ou políticas do navegador.');
    }
    signal.throwIfAborted();
    // activeTab não cobre regenerações após navegar para outra origem. Consultar
    // somente a entrada atual via a sessão já autorizada evita pedir "tabs".
    const history: unknown = await chrome.debugger.sendCommand(target, 'Page.getNavigationHistory');
    if (typeof history !== 'object' || history === null || !('entries' in history) || !Array.isArray(history.entries)
      || !('currentIndex' in history) || typeof history.currentIndex !== 'number') {
      throw new ConversionError('Não foi possível identificar a página original.');
    }
    const current: unknown = history.entries[history.currentIndex];
    if (typeof current !== 'object' || current === null || !('url' in current) || typeof current.url !== 'string' || !isSupportedPage(current.url)) {
      throw new ConversionError('Página não compatível. Use uma aba HTTP ou HTTPS.');
    }
    const title = 'title' in current && typeof current.title === 'string' ? current.title : 'pagina';
    const mmPerInch = 25.4;
    const paper = settings.paperSize === 'A4' ? { width: 210, height: 297 } : { width: 215.9, height: 279.4 };
    const margin = settings.marginMm / mmPerInch;
    const response: unknown = await chrome.debugger.sendCommand(target, 'Page.printToPDF', {
      landscape: settings.orientation === 'landscape',
      paperWidth: paper.width / mmPerInch,
      paperHeight: paper.height / mmPerInch,
      marginTop: margin,
      marginBottom: margin,
      marginLeft: margin,
      marginRight: margin,
      scale: settings.scale,
      printBackground: settings.printBackground,
      displayHeaderFooter: settings.displayHeaderFooter,
      preferCSSPageSize: false,
      transferMode: 'ReturnAsStream',
    });
    if (typeof response !== 'object' || response === null || !('stream' in response) || typeof response.stream !== 'string') {
      throw new ConversionError('O Chrome não retornou um PDF válido.');
    }
    stream = response.stream;
    let byteLength = 0;
    let eof = false;
    while (!eof) {
      signal.throwIfAborted();
      const chunk: unknown = await chrome.debugger.sendCommand(target, 'IO.read', { handle: stream, size: 256 * 1024 });
      if (typeof chunk !== 'object' || chunk === null || !('data' in chunk) || typeof chunk.data !== 'string') {
        throw new ConversionError('Não foi possível ler o PDF gerado.');
      }
      const base64 = 'base64Encoded' in chunk && chunk.base64Encoded === true ? chunk.data : btoa(chunk.data);
      byteLength += atob(base64).length;
      if (byteLength > MAX_PDF_BYTES) throw new ConversionError('O PDF excedeu o limite inicial de 32 MB. Tente uma página menor.');
      signal.throwIfAborted();
      if (base64) onChunk(base64);
      eof = 'eof' in chunk && chunk.eof === true;
    }
    if (byteLength === 0) throw new ConversionError('O PDF gerado está vazio.');
    return { title: title || 'pagina', byteLength };
  } finally {
    signal.removeEventListener('abort', cancel);
    if (stream) await chrome.debugger.sendCommand(target, 'IO.close', { handle: stream }).catch(() => undefined);
    if (attached) await chrome.debugger.detach(target).catch(() => undefined);
  }
}
