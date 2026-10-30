import { DEFAULT_PRINT_SETTINGS, PAPER_SIZES, parsePrintSettings, resolvePaperSizeOriented } from '../shared/settings';
import type { PaperSize, PrintSettings } from '../shared/settings';
import { DIRECT_CONVERSION_KEY, parseDirectConversion } from '../shared/direct';
import { isIncognitoContext, setStorageIfPersistent } from '../shared/incognito';
import { THEME_KEY, parseTheme } from '../shared/theme';
import type { Theme } from '../shared/theme';
import { createConversionFilename } from '../shared/filename';
import { findFormat, isFormatAvailable } from '../shared/format';
import type { ConversionFormat } from '../shared/format';
import { parseFormatParam, parseSourceTabId } from '../shared/preview-url';
import { requestConversion } from './conversion-client';
import { resolveDownloadFilename, startDownload } from './downloader';
import type { PdfViewer } from './pdf-viewer';
import './styles.css';

function element<T extends HTMLElement>(selector: string): T {
  const value = document.querySelector<T>(selector);
  if (!value) throw new Error(`Elemento obrigatório não encontrado: ${selector}`);
  return value;
}

const status = element<HTMLElement>('#status');
const ocrWarning = element<HTMLElement>('#ocr-warning');
const paperGrid = element<HTMLElement>('#paper-size');
const customFields = element<HTMLElement>('#custom-paper-fields');
const customWidth = element<HTMLInputElement>('#custom-width');
const customHeight = element<HTMLInputElement>('#custom-height');
const paperHint = element<HTMLElement>('#paper-hint');
const orientationButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-orientation]')];
const margin = element<HTMLInputElement>('#margin');
const marginOutput = element<HTMLElement>('#margin-output');
const scale = element<HTMLInputElement>('#scale');
const scaleOutput = element<HTMLElement>('#scale-output');
const fullPageHint = element<HTMLElement>('#full-page-hint');
const backgrounds = element<HTMLInputElement>('#backgrounds');
const headerFooter = element<HTMLInputElement>('#header-footer');
const filename = element<HTMLInputElement>('#filename');
const directToggle = element<HTMLInputElement>('#direct-conversion');
const themeToggle = element<HTMLButtonElement>('#theme-toggle');
const updateButton = element<HTMLButtonElement>('#update-preview');
const downloadButton = element<HTMLButtonElement>('#download-pdf');
const saveAsButton = element<HTMLButtonElement>('#save-as-pdf');
const controls = element<HTMLElement>('.viewer-controls');
const previous = element<HTMLButtonElement>('#previous-page');
const next = element<HTMLButtonElement>('#next-page');
const pageNumber = element<HTMLInputElement>('#page-number');
const pageCount = element<HTMLElement>('#page-count');
const zoom = element<HTMLSelectElement>('#zoom');
const settingsTitle = element<HTMLElement>('#ajustes-title');
const previewTitle = element<HTMLElement>('#preview-title');
const imageContainer = element<HTMLElement>('#image-container');
const previewImage = element<HTMLImageElement>('#preview-image');
const textContainer = element<HTMLElement>('#text-container');
const previewText = element<HTMLElement>('#preview-text');
const printCards = [...document.querySelectorAll<HTMLElement>('.print-card')];

const sourceTabId = parseSourceTabId(location.search);
const format: ConversionFormat = parseFormatParam(location.search);
const definition = findFormat(format) ?? findFormat('pdf')!;
const isPdf = format === 'pdf' || format === 'screen-pdf';
/** Formatos de texto: a prévia mostra o conteúdo extraído em `<pre>`. */
const isText = format === 'txt';
const formatLabel = definition.label;
let ocrFailed = false;

let busy = false;
let controller: AbortController | null = null;
let documentBytes: Uint8Array<ArrayBuffer> | null = null;
let documentTitle = '';
let filenameEdited = false;
let savedSettings: PrintSettings = { ...DEFAULT_PRINT_SETTINGS };
/**
 * O PDF.js só é necessário para o formato PDF; em outros formatos (PNG) a
 * prévia mostra uma imagem nativa e o bundle do PDF.js não chega a carregar.
 */
let viewer: PdfViewer | null = null;
let imageUrl: string | null = null;

const PAPER_SHAPE_HEIGHT = 34;

function buildPaperOptions(): void {
  const entries: { id: PaperSize; label: string; short: string; widthMm: number; heightMm: number }[] = [
    ...PAPER_SIZES.map((paper) => ({ id: paper.id, label: paper.label, short: paper.label, widthMm: paper.widthMm, heightMm: paper.heightMm })),
    { id: 'Custom', label: 'Personalizado', short: 'Sob medida', widthMm: 210, heightMm: 297 },
    { id: 'FullPage', label: 'Página inteira', short: 'Inteira', widthMm: 210, heightMm: 297 },
  ];

  for (const entry of entries) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'paper-option';
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', 'false');
    button.setAttribute('aria-label', entry.label);
    button.dataset.paper = entry.id;
    button.title = entry.label;

    const shape = document.createElement('span');
    shape.className = 'paper-shape';
    // Altura igual para todos: as duas linhas da grade têm de ficar com a
    // mesma medida, senão as caixinhas ficam desalinhadas.
    const ratio = entry.id === 'FullPage' ? 0.28 : entry.widthMm / entry.heightMm;
    const height = PAPER_SHAPE_HEIGHT;
    const width = Math.max(10, Math.round(height * ratio));
    shape.style.width = `${width}px`;
    shape.style.height = `${height}px`;

    const label = document.createElement('span');
    label.className = 'paper-label';
    label.textContent = entry.short;

    button.append(shape, label);
    button.addEventListener('click', () => {
      updateSetting({ paperSize: entry.id });
    });
    paperGrid.append(button);
  }
}

function renderPaperState(): void {
  for (const button of paperGrid.querySelectorAll<HTMLButtonElement>('[data-paper]')) {
    button.setAttribute('aria-checked', String(button.dataset.paper === savedSettings.paperSize));
  }
  for (const button of orientationButtons) {
    button.setAttribute('aria-checked', String(button.dataset.orientation === savedSettings.orientation));
  }
  customFields.hidden = savedSettings.paperSize !== 'Custom';
  customWidth.value = String(savedSettings.customWidthMm);
  customHeight.value = String(savedSettings.customHeightMm);

  const isFullPage = savedSettings.paperSize === 'FullPage';
  margin.disabled = isFullPage || busy;
  scale.disabled = isFullPage || busy;
  for (const button of orientationButtons) button.disabled = isFullPage || busy;
  fullPageHint.hidden = !isFullPage;

  const dimensions = resolvePaperSizeOriented(savedSettings);
  const orientationLabel = savedSettings.orientation === 'landscape' ? 'paisagem' : 'retrato';
  paperHint.textContent = isFullPage
    ? 'Uma única folha contínua, com a altura do conteúdo.'
    : `${dimensions.widthMm.toFixed(0).replace('.', ',')} × ${dimensions.heightMm.toFixed(0).replace('.', ',')} mm, ${orientationLabel}.`;

  marginOutput.textContent = `${savedSettings.marginMm} mm`;
  scaleOutput.textContent = `${Math.round(savedSettings.scale * 100)}%`;
}

function readSettings(): PrintSettings | null {
  return parsePrintSettings({
    paperSize: savedSettings.paperSize,
    customWidthMm: customWidth.valueAsNumber,
    customHeightMm: customHeight.valueAsNumber,
    orientation: savedSettings.orientation,
    marginMm: margin.valueAsNumber,
    scale: scale.valueAsNumber / 100,
    printBackground: backgrounds.checked,
    displayHeaderFooter: headerFooter.checked,
  });
}

function updateControls(): void {
  // Só o PDF tem navegação de páginas; os demais formatos ficam sem controles.
  const totalPages = viewer?.pageCount ?? 0;
  controls.hidden = totalPages === 0;
  previous.disabled = busy || (viewer?.pageNumber ?? 1) <= 1;
  next.disabled = busy || (viewer?.pageNumber ?? 1) >= totalPages;
  pageNumber.disabled = busy;
  zoom.disabled = busy;
  const hasDocument = documentBytes !== null;
  downloadButton.disabled = busy || !hasDocument;
  saveAsButton.disabled = busy || !hasDocument;
  updateButton.disabled = busy || sourceTabId === null;
  pageNumber.value = String(viewer?.pageNumber ?? 1);
  pageNumber.max = String(totalPages);
  pageCount.textContent = `de ${totalPages}`;
  renderPaperState();
}

function markPendingChanges(): void {
  if (documentBytes && !busy) {
    status.textContent = 'Há ajustes pendentes. Clique em Atualizar prévia para aplicá-los ao PDF.';
  }
}

function updateSetting(patch: Partial<PrintSettings>): void {
  savedSettings = { ...savedSettings, ...patch };
  renderPaperState();
  void persistSettings();
  markPendingChanges();
}

/** Exibe a imagem convertida no container próprio, sem PDF.js. */
function showImage(bytes: Uint8Array<ArrayBuffer>): void {
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  previewImage.src = imageUrl;
  textContainer.hidden = true;
  imageContainer.hidden = false;
}

/**
 * Exibe o texto extraído sem passar por HTML: `textContent` em `<pre>` mantém
 * a marcação da página como texto puro, sem interpretar.
 */
function showText(bytes: Uint8Array<ArrayBuffer>): void {
  const text = new TextDecoder('utf-8').decode(bytes);
  previewText.textContent = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  imageContainer.hidden = true;
  textContainer.hidden = false;
}

async function loadPdfViewer(bytes: Uint8Array<ArrayBuffer>): Promise<number> {
  if (!viewer) {
    const container = element('#pdf-container');
    const module = await import('./pdf-viewer');
    viewer = new module.PdfViewer(container);
  }
  await viewer.load(bytes);
  return viewer.pageCount;
}

async function convert(): Promise<void> {
  if (busy || sourceTabId === null) return;
  const settings = readSettings();
  if (!settings) {
    status.textContent = 'Confira as opções de impressão antes de atualizar.';
    return;
  }
  savedSettings = settings;
  busy = true;
  updateControls();
  status.textContent = isText ? 'Extraindo texto…' : 'Convertendo a página e preparando a prévia…';
  controller = new AbortController();
  try {
    const result = await requestConversion(sourceTabId, format, settings, controller.signal);
    documentBytes = result.bytes;
    documentTitle = result.title;
    ocrFailed = result.ocrFailed ?? false;
    ocrWarning.hidden = format !== 'screen-pdf' || !ocrFailed;
    if (!filenameEdited) filename.value = createConversionFilename(result.title, definition.extension);
    if (isPdf) {
      const pages = await loadPdfViewer(result.bytes);
      if (format === 'screen-pdf') {
        let msg = 'PDF da tela pronto — área visível como imagem';
        if (ocrFailed) msg += ' (OCR falhou: texto não reconhecido)';
        else msg += ', com texto reconhecido. Confira nomes e números antes de enviar.';
        status.textContent = msg;
      } else {
        status.textContent = `PDF pronto — ${pages} ${pages === 1 ? 'página' : 'páginas'}.`;
      }
    } else if (isText) {
      showText(result.bytes);
      status.textContent = `${formatLabel} pronto.`;
    } else {
      showImage(result.bytes);
      status.textContent = `${formatLabel} pronto.`;
    }
  } catch (error) {
    status.textContent = `${error instanceof Error ? error.message : 'Não foi possível gerar a prévia.'}${documentBytes ? ' A prévia anterior foi mantida.' : ''}`;
  } finally {
    controller = null;
    busy = false;
    updateControls();
  }
}

async function navigate(page: number): Promise<void> {
  if (busy || !documentBytes || !viewer) return;
  busy = true;
  updateControls();
  try {
    await viewer.showPage(page);
  } catch {
    status.textContent = 'Não foi possível exibir esta página do PDF.';
  } finally {
    busy = false;
    updateControls();
  }
}

async function downloadFile(saveAs: boolean): Promise<void> {
  if (busy || !documentBytes) return;
  const name = filename.value.trim() || createConversionFilename(documentTitle, definition.extension);
  const safeName = resolveDownloadFilename(name, documentTitle, definition.extension);
  // Em janela anônima o downloader força o "Salvar como…"; a mensagem segue o
  // que de fato vai acontecer, não o que o botão pediu.
  const willSaveAs = saveAs || isIncognitoContext();
  try {
    busy = true;
    updateControls();
    status.textContent = willSaveAs ? 'Abrindo diálogo de salvamento…' : `Baixando ${formatLabel}…`;
    const outcome = await startDownload({ bytes: documentBytes, filename: safeName, saveAs, extension: definition.extension });
    if (outcome.status === 'complete') status.textContent = `${formatLabel} salvo com sucesso.`;
    else if (outcome.status === 'cancelled') status.textContent = 'O download foi cancelado.';
    else status.textContent = `O download foi interrompido: ${outcome.reason}.`;
  } catch (error) {
    status.textContent = `Falha no download: ${error instanceof Error ? error.message : 'Erro desconhecido.'}`;
  } finally {
    busy = false;
    updateControls();
  }
}

async function loadSavedSettings(): Promise<void> {
  try {
    const result = await chrome.storage.local.get('printSettings');
    const parsed = parsePrintSettings(result.printSettings);
    if (parsed) savedSettings = parsed;
  } catch {
    // Mantém os padrões.
  }
  backgrounds.checked = savedSettings.printBackground;
  headerFooter.checked = savedSettings.displayHeaderFooter;
  margin.value = String(savedSettings.marginMm);
  scale.value = String(savedSettings.scale * 100);
}

/**
 * A conversão direta é a única preferência que também pode ser desligada da
 * prévia: com o modo ativo o menu não abre mais, então esta caixa é a saída
 * que garante que o usuário nunca fique sem caminho de volta.
 */
async function loadDirectConversion(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(DIRECT_CONVERSION_KEY);
    directToggle.checked = parseDirectConversion(stored[DIRECT_CONVERSION_KEY]);
  } catch {
    directToggle.checked = false;
  }
}

async function persistDirectConversion(): Promise<void> {
  try {
    await setStorageIfPersistent({ [DIRECT_CONVERSION_KEY]: directToggle.checked });
  } catch {
    // Ignora falhas de armazenamento.
  }
}

function applyTheme(theme: Theme): void {
  if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
  themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro');
}

/**
 * Tema claro/escuro da interface. Falha de leitura vira claro: o design atual
 * continua sendo o padrão e a tela nunca fica em um estado indefinido.
 */
async function loadTheme(): Promise<void> {
  let theme: Theme = 'light';
  try {
    const stored = await chrome.storage.local.get(THEME_KEY);
    theme = parseTheme(stored[THEME_KEY]);
  } catch {
    theme = 'light';
  }
  applyTheme(theme);
}

async function toggleTheme(): Promise<void> {
  const next: Theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try {
    await setStorageIfPersistent({ [THEME_KEY]: next });
  } catch {
    // Sem persistência o tema vale só nesta sessão da prévia.
  }
}

async function persistSettings(): Promise<void> {
  try {
    await setStorageIfPersistent({ printSettings: savedSettings });
  } catch {
    // Ignora falhas de armazenamento.
  }
}

buildPaperOptions();

/**
 * Ajustes de impressão só existem no PDF. Em outros formatos a barra lateral
 * fica com o nome do arquivo, que é o único ajuste disponível antes de baixar.
 */
if (!isPdf) {
  for (const card of printCards) card.hidden = true;
  settingsTitle.textContent = 'Ajustes';
  previewTitle.textContent = isText ? 'Prévia do texto' : 'Prévia da imagem';
  downloadButton.textContent = `Baixar ${formatLabel}`;
  filename.value = `pagina.${definition.extension}`;
}

if (format === 'screen-pdf') {
  for (const card of printCards) card.hidden = true;
  settingsTitle.textContent = 'Captura da tela';
  previewTitle.textContent = 'PDF da área visível';
  updateButton.hidden = true;
}

filename.addEventListener('input', () => { filenameEdited = true; });
directToggle.addEventListener('change', () => { void persistDirectConversion(); });
// Listener síncrono na carga do módulo: o clique nunca pode chegar antes dele.
themeToggle.addEventListener('click', () => { void toggleTheme(); });
updateButton.addEventListener('click', () => { void convert(); });
for (const button of orientationButtons) {
  button.addEventListener('click', () => {
    updateSetting({ orientation: button.dataset.orientation === 'landscape' ? 'landscape' : 'portrait' });
  });
}
customWidth.addEventListener('input', () => {
  updateSetting({ customWidthMm: customWidth.valueAsNumber });
});
customHeight.addEventListener('input', () => {
  updateSetting({ customHeightMm: customHeight.valueAsNumber });
});
margin.addEventListener('input', () => {
  updateSetting({ marginMm: margin.valueAsNumber });
});
scale.addEventListener('input', () => {
  updateSetting({ scale: scale.valueAsNumber / 100 });
});
backgrounds.addEventListener('change', () => {
  updateSetting({ printBackground: backgrounds.checked });
});
headerFooter.addEventListener('change', () => {
  updateSetting({ displayHeaderFooter: headerFooter.checked });
});
previous.addEventListener('click', () => void navigate((viewer?.pageNumber ?? 1) - 1));
next.addEventListener('click', () => void navigate((viewer?.pageNumber ?? 1) + 1));
pageNumber.addEventListener('change', () => void navigate(pageNumber.valueAsNumber));
zoom.addEventListener('change', () => {
  if (!viewer) return;
  viewer.zoom = Number(zoom.value);
  void navigate(viewer.pageNumber);
});
downloadButton.addEventListener('click', () => void downloadFile(false));
saveAsButton.addEventListener('click', () => void downloadFile(true));
window.addEventListener('pagehide', () => {
  controller?.abort();
  documentBytes = null;
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  void viewer?.destroy().catch(() => undefined);
}, { once: true });

await loadTheme();
await loadSavedSettings();
await loadDirectConversion();
renderPaperState();

if (new URLSearchParams(location.search).get('error') || sourceTabId === null) {
  status.textContent = 'Página não compatível. Abra a extensão pelo ícone em uma aba HTTP ou HTTPS.';
  updateControls();
} else if (!isFormatAvailable(format)) {
  status.textContent = 'Este formato ainda não está disponível nesta versão.';
  updateControls();
} else {
  void convert();
}
