import { DEFAULT_PRINT_SETTINGS, parsePrintSettings } from '../shared/settings';
import type { PrintSettings } from '../shared/settings';
import { createPdfFilename, sanitizeTitle } from '../shared/filename';
import { parseSourceTabId } from '../shared/preview-url';
import { requestConversion } from './conversion-client';
import { PdfViewer } from './pdf-viewer';
import './styles.css';

function element<T extends HTMLElement>(selector: string): T {
  const value = document.querySelector<T>(selector);
  if (!value) throw new Error(`Elemento obrigatório não encontrado: ${selector}`);
  return value;
}

const status = element<HTMLElement>('#status');
const form = element<HTMLFormElement>('#print-form');
const fieldset = element<HTMLFieldSetElement>('fieldset');
const filename = element<HTMLInputElement>('#filename');
const paperSize = element<HTMLSelectElement>('#paper-size');
const orientation = element<HTMLSelectElement>('#orientation');
const margin = element<HTMLInputElement>('#margin');
const scale = element<HTMLInputElement>('#scale');
const backgrounds = element<HTMLInputElement>('#backgrounds');
const headerFooter = element<HTMLInputElement>('#header-footer');
const controls = element<HTMLElement>('.viewer-controls');
const previous = element<HTMLButtonElement>('#previous-page');
const next = element<HTMLButtonElement>('#next-page');
const pageNumber = element<HTMLInputElement>('#page-number');
const pageCount = element<HTMLElement>('#page-count');
const zoom = element<HTMLSelectElement>('#zoom');
const downloadBtn = element<HTMLButtonElement>('#download-pdf');
const saveAsBtn = element<HTMLButtonElement>('#save-as-pdf');
const viewer = new PdfViewer(element('#pdf-container'));
const sourceTabId = parseSourceTabId(location.search);
let busy = false;
let controller: AbortController | null = null;
let documentBytes: Uint8Array<ArrayBuffer> | null = null;
let documentTitle = '';
let filenameEdited = false;
let savedSettings: PrintSettings = DEFAULT_PRINT_SETTINGS;

async function loadSavedSettings(): Promise<void> {
  try {
    const result = await chrome.storage.local.get('printSettings');
    const parsed = parsePrintSettings(result.printSettings);
    if (parsed) {
      savedSettings = parsed;
      applySettings(savedSettings);
    } else {
      applySettings(DEFAULT_PRINT_SETTINGS);
    }
  } catch {
    applySettings(DEFAULT_PRINT_SETTINGS);
  }
}

async function saveSettings(settings: Readonly<PrintSettings>): Promise<void> {
  try {
    await chrome.storage.local.set({ printSettings: settings });
    savedSettings = { ...settings };
  } catch {
    // Silenciosamente ignora falhas de armazenamento.
  }
}

function applySettings(settings: Readonly<PrintSettings>): void {
  paperSize.value = settings.paperSize;
  orientation.value = settings.orientation;
  margin.value = String(settings.marginMm);
  scale.value = String(settings.scale * 100);
  backgrounds.checked = settings.printBackground;
  headerFooter.checked = settings.displayHeaderFooter;
}

function readSettings(): PrintSettings | null {
  return parsePrintSettings({
    paperSize: paperSize.value,
    orientation: orientation.value,
    marginMm: margin.valueAsNumber,
    scale: scale.valueAsNumber / 100,
    printBackground: backgrounds.checked,
    displayHeaderFooter: headerFooter.checked,
  });
}

function updateControls(): void {
  fieldset.disabled = busy || sourceTabId === null;
  controls.hidden = viewer.pageCount === 0;
  previous.disabled = busy || viewer.pageNumber <= 1;
  next.disabled = busy || viewer.pageNumber >= viewer.pageCount;
  pageNumber.disabled = busy;
  zoom.disabled = busy;
  const hasPdf = documentBytes !== null;
  downloadBtn.disabled = busy || !hasPdf;
  saveAsBtn.disabled = busy || !hasPdf;
  pageNumber.value = String(viewer.pageNumber);
  pageNumber.max = String(viewer.pageCount);
  pageCount.textContent = `de ${viewer.pageCount}`;
}

async function convert(): Promise<void> {
  if (busy || sourceTabId === null) return;
  const settings = readSettings();
  if (!settings || !form.reportValidity()) {
    status.textContent = 'Confira as opções de impressão antes de atualizar.';
    return;
  }
  await saveSettings(settings);
  busy = true;
  updateControls();
  status.textContent = 'Convertendo a página e preparando a prévia…';
  controller = new AbortController();
  try {
    const result = await requestConversion(sourceTabId, settings, controller.signal);
    await viewer.load(result.bytes);
    documentBytes = result.bytes;
    documentTitle = result.title;
    if (!filenameEdited) filename.value = createPdfFilename(result.title);
    status.textContent = `PDF pronto — ${viewer.pageCount} ${viewer.pageCount === 1 ? 'página' : 'páginas'}.`;
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
  const safeName = sanitizeTitle(name.replace(/\.pdf$/i, '')) + '.pdf';
  try {
    busy = true;
    updateControls();
    status.textContent = saveAs ? 'Abrindo diálogo de salvamento…' : 'Baixando PDF…';
    const blob = new Blob([documentBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    try {
      const downloadId = await chrome.downloads.download({
        url,
        filename: safeName,
        saveAs,
        conflictAction: 'uniquify',
      });
      if (downloadId === undefined) {
        status.textContent = 'O download foi cancelado ou bloqueado.';
      } else {
        status.textContent = saveAs ? 'Salvo com sucesso.' : 'Download iniciado.';
      }
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    status.textContent = `Falha no download: ${error instanceof Error ? error.message : 'Erro desconhecido.'}`;
  } finally {
    busy = false;
    updateControls();
  }
}

filename.addEventListener('input', () => { filenameEdited = true; });
form.addEventListener('submit', (event) => { event.preventDefault(); void convert(); });
form.addEventListener('change', () => {
  if (documentBytes && !busy) status.textContent = 'Há ajustes pendentes. Clique em Atualizar prévia para aplicá-los ao PDF.';
});
previous.addEventListener('click', () => void navigate(viewer.pageNumber - 1));
next.addEventListener('click', () => void navigate(viewer.pageNumber + 1));
pageNumber.addEventListener('change', () => void navigate(pageNumber.valueAsNumber));
zoom.addEventListener('change', () => { viewer.zoom = Number(zoom.value); void navigate(viewer.pageNumber); });
downloadBtn.addEventListener('click', () => void downloadPdf(false));
saveAsBtn.addEventListener('click', () => void downloadPdf(true));
window.addEventListener('pagehide', () => {
  controller?.abort();
  documentBytes = null;
  void viewer.destroy().catch(() => undefined);
}, { once: true });

await loadSavedSettings();

if (new URLSearchParams(location.search).get('error') || sourceTabId === null) {
  status.textContent = 'Página não compatível. Abra a extensão pelo ícone em uma aba HTTP ou HTTPS.';
  fieldset.disabled = true;
} else {
  void convert();
}
