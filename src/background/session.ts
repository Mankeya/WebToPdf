import { ConversionError } from '../shared/conversion';
import { isSupportedPage } from '../shared/preview-url';

export interface TabSession {
  target: { tabId: number };
  /** Título da página atual, consultado pela sessão já autorizada. */
  title: string;
  /** Desliga a sessão; seguro de chamar mais de uma vez. */
  detach: () => Promise<void>;
}

/**
 * Valida a aba, anexa o debugger e confirma a URL atual pela própria sessão
 * (activeTab não cobre regenerações após navegar para outra origem, então a
 * entrada atual é lida via debugger em vez de pedir a permissão "tabs").
 *
 * O cancelamento desliga o debugger na hora, para não esperar o comando em
 * voo; o chamador ainda precisa chamar `detach` no `finally`.
 */
export async function openTabSession(tabId: number, signal: AbortSignal, action: string): Promise<TabSession> {
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
  const cancel = (): void => {
    if (attached) void chrome.debugger.detach(target).catch(() => undefined);
  };
  signal.addEventListener('abort', cancel);
  const detach = async (): Promise<void> => {
    signal.removeEventListener('abort', cancel);
    if (attached) {
      attached = false;
      await chrome.debugger.detach(target).catch(() => undefined);
    }
  };

  try {
    signal.throwIfAborted();
    try {
      await chrome.debugger.attach(target, '1.3');
      attached = true;
    } catch {
      throw new ConversionError(`O Chrome não permitiu iniciar a ${action}. Feche o DevTools da página e verifique as permissões ou políticas do navegador.`);
    }
    signal.throwIfAborted();
    const title = await resolveCurrentTitle(target);
    return { target, title, detach };
  } catch (error) {
    await detach();
    throw error;
  }
}

async function resolveCurrentTitle(target: { tabId: number }): Promise<string> {
  const history: unknown = await chrome.debugger.sendCommand(target, 'Page.getNavigationHistory');
  if (typeof history !== 'object' || history === null || !('entries' in history) || !Array.isArray(history.entries)
    || !('currentIndex' in history) || typeof history.currentIndex !== 'number') {
    throw new ConversionError('Não foi possível identificar a página original.');
  }
  const current: unknown = history.entries[history.currentIndex];
  if (typeof current !== 'object' || current === null || !('url' in current) || typeof current.url !== 'string' || !isSupportedPage(current.url)) {
    throw new ConversionError('Página não compatível. Use uma aba HTTP ou HTTPS.');
  }
  return 'title' in current && typeof current.title === 'string' ? current.title : 'pagina';
}
