import { CONVERSION_FORMATS, findFormat } from '../shared/format';
import type { ConversionFormat } from '../shared/format';
import { DIRECT_CONVERSION_KEY, parseDirectConversion } from '../shared/direct';
import { buildPreviewUrl, isSupportedPage } from '../shared/preview-url';
import './styles.css';

declare global {
  var webtopdfEarlyCapture: Promise<{ token: string; tabId: number } | null> | undefined;
}

function element<T extends HTMLElement>(selector: string): T {
  const value = document.querySelector<T>(selector);
  if (!value) throw new Error(`Elemento obrigatório não encontrado: ${selector}`);
  return value;
}

const list = element<HTMLUListElement>('#format-list');
const status = element<HTMLElement>('#popup-status');
const directToggle = element<HTMLInputElement>('#direct-conversion');

// Anexado de forma síncrona, antes de qualquer `await`: um clique no
// interruptor nunca pode chegar antes do listener estar vivo.
directToggle.addEventListener('change', () => {
  void persistDirectConversion(directToggle.checked);
  if (directToggle.checked) status.textContent = 'Pronto: o próximo clique no ícone abre o PDF direto. Para voltar ao menu, desligue na prévia.';
  else status.textContent = '';
});

const ICON_PATHS: Record<ConversionFormat, string[]> = {
  pdf: ['M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M14 3v5h5', 'M9 13h6', 'M9 17h4'],
  'screen-pdf': ['M4 5h16v14H4z', 'M5 17l5-5 4 4 3-3 2 4'],
  png: ['M4 5h16v14H4z', 'M8.5 10a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z', 'M5 17l4.5-5 3.5 3.5 2.5-2.5L19 17'],
  txt: ['M5 4h14v16H5z', 'M8 8h8', 'M8 12h8', 'M8 16h5'],
  md: ['M4 5h16v14H4z', 'M7 15V9l3 4 3-4v6', 'M16 9v6m0 0-2-2m2 2 2-2'],
};

function buildIcon(format: ConversionFormat): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ICON_PATHS[format]) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

function renderFormats(): void {
  for (const definition of CONVERSION_FORMATS) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'format-option';
    button.dataset.format = definition.id;
    button.disabled = !definition.available;
    if (!definition.available) button.setAttribute('aria-describedby', `${definition.id}-badge`);

    button.append(buildIcon(definition.id));

    const text = document.createElement('span');
    text.className = 'format-text';
    const label = document.createElement('span');
    label.className = 'format-label';
    label.textContent = definition.label;
    const description = document.createElement('span');
    description.className = 'format-description';
    description.textContent = definition.description;
    text.append(label, description);
    button.append(text);

    if (definition.available) {
      button.addEventListener('click', () => void openPreview(definition.id));
    } else {
      const badge = document.createElement('span');
      badge.id = `${definition.id}-badge`;
      badge.className = 'format-badge';
      badge.textContent = 'Em breve';
      button.append(badge);
    }

    item.append(button);
    list.append(item);
  }
}

async function openPreview(format: ConversionFormat): Promise<void> {
  if (!findFormat(format)?.available) return;
  status.textContent = '';
  let tabId: number | undefined;
  let tabUrl: string | undefined;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
    tabUrl = tab?.url;
  } catch {
    status.textContent = 'Não foi possível identificar a aba atual. Tente novamente.';
    return;
  }
  if (tabId === undefined) {
    status.textContent = 'Não foi possível identificar a aba atual. Tente novamente.';
    return;
  }
  // Sem a permissão ativa a URL pode vir oculta; nesse caso a prévia e o
  // service worker revalidam a aba antes de converter.
  if (tabUrl !== undefined && !isSupportedPage(tabUrl)) {
    status.textContent = 'Esta página não pode ser convertida. Abra uma aba HTTP ou HTTPS.';
    return;
  }
  try {
    const url = new URL(buildPreviewUrl(chrome.runtime.getURL('preview.html'), tabId, format));
    if (format === 'screen-pdf') {
      const snapshot = await globalThis.webtopdfEarlyCapture;
      if (!snapshot || snapshot.tabId !== tabId) {
        status.textContent = 'Não foi possível guardar a tela nesta abertura. Tente novamente ou use o PDF normal.';
        return;
      }
      url.searchParams.set('snapshot', snapshot.token);
    }
    await chrome.tabs.create({ url: url.href });
    window.close();
  } catch {
    status.textContent = 'Não foi possível abrir a prévia. Tente novamente.';
  }
}

/**
 * Modo conversão direta: um clique no ícone leva à prévia do PDF já
 * convertendo, sem desenhar o menu. As validações são as mesmas do menu — a
 * única diferença é que página incompatível vira a prévia com o aviso, já que
 * não há tela de menu para exibir o erro.
 */
async function openDirectPreview(): Promise<void> {
  status.textContent = 'Abrindo a prévia do PDF…';
  let tabId: number | undefined;
  let tabUrl: string | undefined;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
    tabUrl = tab?.url;
  } catch {
    status.textContent = 'Não foi possível identificar a aba atual. Tente novamente.';
    return;
  }
  if (tabId === undefined) {
    status.textContent = 'Não foi possível identificar a aba atual. Tente novamente.';
    return;
  }
  const supported = tabUrl === undefined || isSupportedPage(tabUrl);
  try {
    // Sem URL legível o `tabId` viaja mesmo assim: a prévia e o service
    // worker revalidam antes de converter, como no fluxo do menu.
    const previewTabId = supported ? tabId : undefined;
    await chrome.tabs.create({ url: buildPreviewUrl(chrome.runtime.getURL('preview.html'), previewTabId, 'pdf') });
    window.close();
  } catch {
    status.textContent = 'Não foi possível abrir a prévia. Tente novamente.';
  }
}

/**
 * Lê a preferência de conversão direta. Falha de leitura conta como
 * desligado: o usuário sempre volta ao menu, nunca fica sem saída.
 */
async function readDirectConversion(): Promise<boolean> {
  try {
    const stored = await chrome.storage.local.get(DIRECT_CONVERSION_KEY);
    return parseDirectConversion(stored[DIRECT_CONVERSION_KEY]);
  } catch {
    return false;
  }
}

async function persistDirectConversion(enabled: boolean): Promise<void> {
  try {
    await chrome.storage.local.set({ [DIRECT_CONVERSION_KEY]: enabled });
  } catch {
    // Sem persistência a escolha vale só nesta abertura do menu.
  }
}

async function boot(): Promise<void> {
  if (await readDirectConversion()) {
    await openDirectPreview();
    return;
  }
  renderFormats();
}

void boot();
