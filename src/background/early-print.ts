import { base64ByteLength, chunkBase64, CONVERSION_TIMEOUT_MS } from '../shared/conversion';
import { DEFAULT_PRINT_SETTINGS, parsePrintSettings } from '../shared/settings';
import type { PrintSettings } from '../shared/settings';
import { convertTabToPdf, printTabToPdfBase64 } from './converter';
import { EarlyPrintCache } from './early-print-cache';
import type { CachedPrint } from './early-print-cache';

/**
 * Impressão antecipada do menu: quando o popup abre, a página ainda tem foco,
 * então o service worker imprime a aba com as configurações salvas e guarda o
 * PDF em RAM. A primeira conversão (formato PDF) consome esse arquivo; ajustes
 * na prévia, navegação, fechamento ou expiração descartam-no e a conversão
 * reimprime ao vivo, pelo fluxo normal.
 *
 * A falha nunca bloqueia: sem impressão antecipada o menu e a conversão
 * continuam exatamente como antes.
 */
const cache = new EarlyPrintCache();

/** Impressão em voo por aba; usa o debugger da aba e precisa ser aguardada. */
const pendingPrints = new Map<number, Promise<boolean>>();
const controllers = new Map<number, AbortController>();

async function readTabUrl(tabId: number): Promise<string | null> {
  try {
    const url = (await chrome.tabs.get(tabId)).url;
    return typeof url === 'string' && url.length > 0 ? url : null;
  } catch {
    return null;
  }
}

/**
 * Configurações salvas pela prévia são a base da impressão antecipada: o
 * popup não tem os ajustes na mão, e a primeira conversão precisa casar com
 * o que a prévia vai pedir. Sem leitura válida, seguem os padrões.
 */
async function loadSavedSettings(): Promise<PrintSettings> {
  try {
    const stored = await chrome.storage.local.get('printSettings');
    const parsed = parsePrintSettings(stored.printSettings);
    if (parsed) return parsed;
  } catch {
    // Mantém os padrões.
  }
  return { ...DEFAULT_PRINT_SETTINGS };
}

async function runEarlyPrint(tabId: number, controller: AbortController): Promise<boolean> {
  const timeout = setTimeout(() => controller.abort(), CONVERSION_TIMEOUT_MS);
  try {
    const settings = await loadSavedSettings();
    if (controller.signal.aborted) return false;
    const print = await printTabToPdfBase64(tabId, settings, controller.signal);
    const url = await readTabUrl(tabId);
    return cache.put(tabId, url, settings, print);
  } catch {
    // Falha de impressão antecipada nunca bloqueia o fluxo normal.
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/** Imprime a aba agora e guarda o PDF; resolve `true` só se ficou guardado. */
export function startEarlyPrint(tabId: number): Promise<boolean> {
  if (!Number.isInteger(tabId)) return Promise.resolve(false);
  // Uma nova tentativa substitui a anterior da mesma aba.
  cancelEarlyPrint(tabId);
  const controller = new AbortController();
  controllers.set(tabId, controller);
  const task = runEarlyPrint(tabId, controller);
  pendingPrints.set(tabId, task);
  void task.finally(() => {
    // Limpa só se esta ainda for a tentativa vigente da aba: uma tentativa
    // substituída não pode apagar o registro daquela que a sucedeu.
    if (pendingPrints.get(tabId) === task) pendingPrints.delete(tabId);
    if (controllers.get(tabId) === controller) controllers.delete(tabId);
  });
  return task;
}

/** Aborta a impressão em voo da aba e descarta qualquer PDF guardado dela. */
export function cancelEarlyPrint(tabId: number): void {
  const controller = controllers.get(tabId);
  if (controller) controller.abort();
  cache.removeTab(tabId);
}

/**
 * Aborta e espera a impressão em voo liberar o debugger da aba — usado pelos
 * formatos que não consomem o PDF antecipado (PNG e TXT), onde a impressão só
 * atrapalharia a sessão do debugger.
 */
export async function settleEarlyPrint(tabId: number): Promise<void> {
  const pending = pendingPrints.get(tabId);
  cancelEarlyPrint(tabId);
  if (pending) await pending.catch(() => undefined);
}

/**
 * Caminho de conversão do formato PDF: se a impressão antecipada casar com a
 * URL atual e com as configurações pedidas, o PDF guardado é consumido; senão
 * a conversão segue ao vivo pelo fluxo normal.
 */
export async function convertTabToPdfWithEarlyPrint(
  tabId: number,
  settings: PrintSettings,
  onChunk: (base64: string, byteLength: number) => void,
  signal: AbortSignal,
): Promise<{ title: string; byteLength: number }> {
  const inFlight = pendingPrints.get(tabId);
  if (inFlight) {
    // A impressão em voo segura o debugger da aba: esperá-la (ou o próprio
    // cancelamento via sinal) evita duas sessões disputando o mesmo alvo.
    await Promise.race([inFlight, new Promise<void>((resolve) => {
      if (signal.aborted) resolve();
      else signal.addEventListener('abort', () => resolve(), { once: true });
    })]);
    signal.throwIfAborted();
  }
  const url = await readTabUrl(tabId);
  const cached: CachedPrint | null = url ? cache.take(tabId, url, settings) : null;
  if (!cached) return convertTabToPdf(tabId, settings, onChunk, signal);
  for (const chunk of chunkBase64(cached.data)) {
    signal.throwIfAborted();
    onChunk(chunk, base64ByteLength(chunk));
  }
  return { title: cached.title, byteLength: cached.byteLength };
}
