import { DEFAULT_PRINT_SETTINGS, PAPER_SIZES, parsePrintSettings, resolvePaperSizeOriented } from '../shared/settings';
import type { PaperSize, PrintSettings } from '../shared/settings';
import { createPdfFilename } from '../shared/filename';
import { isFormatAvailable } from '../shared/format';
import type { ConversionFormat } from '../shared/format';
import { parseFormatParam, parseSourceTabId } from '../shared/preview-url';
import { requestConversion } from './conversion-client';
import { resolveDownloadFilename, startDownload } from './downloader';
import { PdfViewer } from './pdf-viewer';
import './styles.css';

function element<T extends HTMLElement>(selector: string): T {
  const value = document.querySelector<T>(selector);
  if (!value) throw new Error(`Elemento obrigatório não encontrado: ${selector}`);
  return value;
}

const status = element<HTMLElement>('#status');
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
const updateButton = element<HTMLButtonElement>('#update-preview');
const downloadButton = element<HTMLButtonElement>('#download-pdf');
const saveAsButton = element<HTMLButtonElement>('#save-as-pdf');
const controls = element<HTMLElement>('.viewer-controls');
const previous = element<HTMLButtonElement>('#previous-page');
const next = element<HTMLButtonElement>('#next-page');
const pageNumber = element<HTMLInputElement>('#page-number');
const pageCount = element<HTMLElement>('#page-count');
const zoom = element<HTMLSelectElement>('#zoom');
const viewer = new PdfViewer(element('#pdf-container'));

const sourceTabId = parseSourceTabId(location.search);
const format: ConversionFormat = parseFormatParam(location.search);
let busy = false;
let controller: AbortController | null = null;
let documentBytes: Uint8Array<ArrayBuffer> | null = null;
let documentTitle = '';
let filenameEdited = false;
let savedSettings: PrintSettings = { ...DEFAULT_PRINT_SETTINGS };

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
    const ratio = entry.id === 'FullPage' ? 0.28 : entry.widthMm / entry.heightMm;
    const height = entry.id === 'FullPage' ? 40 : PAPER_SHAPE_HEIGHT;
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
  controls.hidden = viewer.pageCount === 0;
  previous.disabled = busy || viewer.pageNumber <= 1;
  next.disabled = busy || viewer.pageNumber >= viewer.pageCount;
  pageNumber.disabled = busy;
  zoom.disabled = busy;
  const hasPdf = documentBytes !== null;
  downloadButton.disabled = busy || !hasPdf;
  saveAsButton.disabled = busy || !hasPdf;
  updateButton.disabled = busy || sourceTabId === null;
  pageNumber.value = String(viewer.pageNumber);
  pageNumber.max = String(viewer.pageCount);
  pageCount.textContent = `de ${viewer.pageCount}`;
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
  status.textContent = 'Convertendo a página e preparando a prévia…';
  controller = new AbortController();
  try {
    const result = await requestConversion(sourceTabId, format, settings, controller.signal);
    await viewer.load(result.bytes);
    documentBytes = result.bytes;
    documentTitle = result.title;
    if (!filenameEdited) filename.value = createPdfFilename(result.title);
    const pages = viewer.pageCount;
    status.textContent = `PDF pronto — ${pages} ${pages === 1 ? 'página' : 'páginas'}.`;
  } catch (error) {
    status.textContent = `${error instanceof Error ? error.message : 'Não foi possível gerar a prévia.'}${documentBytes ? ' A prévia anterior foi mantida.' : ''}`;
  } finally {
    controller = null;
    busy = false;
    updateControls();
  }
}

async function navigate(page: number): Promise<void> {
  if (busy || !documentBytes) return;
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

async function downloadPdf(saveAs: boolean): Promise<void> {
  if (busy || !documentBytes) return;
  const name = filename.value.trim() || createPdfFilename(documentTitle);
  const safeName = resolveDownloadFilename(name, documentTitle);
  try {
    busy = true;
    updateControls();
    status.textContent = saveAs ? 'Abrindo diálogo de salvamento…' : 'Baixando PDF…';
    const outcome = await startDownload({ bytes: documentBytes, filename: safeName, saveAs });
    if (outcome.status === 'complete') status.textContent = 'PDF salvo com sucesso.';
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

async function persistSettings(): Promise<void> {
  try {
    await chrome.storage.local.set({ printSettings: savedSettings });
  } catch {
    // Ignora falhas de armazenamento.
  }
}

buildPaperOptions();

filename.addEventListener('input', () => { filenameEdited = true; });
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
previous.addEventListener('click', () => void navigate(viewer.pageNumber - 1));
next.addEventListener('click', () => void navigate(viewer.pageNumber + 1));
pageNumber.addEventListener('change', () => void navigate(pageNumber.valueAsNumber));
zoom.addEventListener('change', () => { viewer.zoom = Number(zoom.value); void navigate(viewer.pageNumber); });
downloadButton.addEventListener('click', () => void downloadPdf(false));
saveAsButton.addEventListener('click', () => void downloadPdf(true));
window.addEventListener('pagehide', () => {
  controller?.abort();
  documentBytes = null;
  void viewer.destroy().catch(() => undefined);
}, { once: true });

await loadSavedSettings();
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
