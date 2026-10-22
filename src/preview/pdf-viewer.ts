import { getDocument, GlobalWorkerOptions, TextLayer } from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'pdfjs-dist/web/pdf_viewer.css';

GlobalWorkerOptions.workerSrc = workerUrl;

export class PdfViewer {
  private document: PDFDocumentProxy | null = null;
  private loading: PDFDocumentLoadingTask | null = null;
  private renderTask: RenderTask | null = null;
  private textLayer: TextLayer | null = null;
  private disposed = false;
  /** Serializa as construções de página, para que uma não sobreponha a outra. */
  private queue: Promise<unknown> = Promise.resolve();
  pageNumber = 1;
  zoom = 1;

  constructor(private readonly container: HTMLElement) {}

  get pageCount(): number { return this.document?.numPages ?? 0; }

  async load(bytes: Uint8Array<ArrayBuffer>): Promise<void> {
    const task = getDocument({
      data: bytes.slice(),
      cMapUrl: chrome.runtime.getURL('pdf-assets/cmaps/'),
      cMapPacked: true,
      standardFontDataUrl: chrome.runtime.getURL('pdf-assets/standard_fonts/'),
      useWasm: false,
      enableXfa: false,
    });
    this.loading = task;
    let next: PDFDocumentProxy | undefined;
    try {
      next = await task.promise;
      const stage = await this.buildPage(next, 1);
      if (this.disposed) throw new Error('Visualização encerrada.');
      const previous = this.document;
      this.document = next;
      this.pageNumber = 1;
      this.container.replaceChildren(stage);
      await previous?.loadingTask.destroy();
    } catch (error) {
      await task.destroy();
      throw error;
    } finally {
      this.loading = null;
    }
  }

  async showPage(pageNumber: number): Promise<void> {
    if (!this.document || pageNumber < 1 || pageNumber > this.pageCount || !Number.isInteger(pageNumber)) return;
    const stage = await this.buildPage(this.document, pageNumber);
    if (this.disposed) return;
    this.pageNumber = pageNumber;
    this.container.replaceChildren(stage);
  }

  async destroy(): Promise<void> {
    this.disposed = true;
    this.renderTask?.cancel();
    this.textLayer?.cancel();
    await this.loading?.destroy();
    await this.document?.loadingTask.destroy();
    this.document = null;
    this.container.replaceChildren();
    TextLayer.cleanup();
  }

  /**
   * Executa as construções uma a uma. Uma renderização em andamento é
   * cancelada antes da próxima começar, para não deixar tarefas pendentes
   * segurando memória do documento anterior.
   */
  private async buildPage(document: PDFDocumentProxy, pageNumber: number): Promise<HTMLElement> {
    const run = this.queue.then(() => this.renderPage(document, pageNumber));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async renderPage(document: PDFDocumentProxy, pageNumber: number): Promise<HTMLElement> {
    this.renderTask?.cancel();
    this.textLayer?.cancel();
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: this.zoom * 96 / 72 });
    const stage = window.document.createElement('div');
    stage.className = 'pdf-page';
    stage.style.width = `${viewport.width}px`;
    stage.style.height = `${viewport.height}px`;
    stage.style.setProperty('--scale-factor', String(viewport.scale));
    stage.style.setProperty('--total-scale-factor', String(viewport.scale));
    const canvas = window.document.createElement('canvas');
    canvas.setAttribute('aria-label', `Página ${pageNumber} do PDF`);
    const outputScale = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(16_000_000 / (viewport.width * viewport.height)));
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    stage.append(canvas);
    const renderTask = page.render({ canvas, viewport, transform: [outputScale, 0, 0, outputScale, 0, 0] });
    this.renderTask = renderTask;
    try {
      await renderTask.promise;
    } finally {
      this.renderTask = null;
    }
    const textContainer = window.document.createElement('div');
    textContainer.className = 'textLayer';
    stage.append(textContainer);
    const layer = new TextLayer({ textContentSource: await page.getTextContent(), container: textContainer, viewport });
    this.textLayer = layer;
    try {
      await layer.render();
    } finally {
      this.textLayer = null;
    }

    const links = window.document.createElement('div');
    links.className = 'link-layer';
    const annotations: unknown[] = await page.getAnnotations();
    for (const annotation of annotations) {
      if (typeof annotation !== 'object' || annotation === null || !('url' in annotation) || typeof annotation.url !== 'string'
        || !('rect' in annotation) || !Array.isArray(annotation.rect) || annotation.rect.length !== 4
        || !annotation.rect.every((value: unknown) => typeof value === 'number' && Number.isFinite(value))) continue;
      let url: URL;
      try { url = new URL(annotation.url); } catch { continue; }
      if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
      const rect = [
        ...viewport.convertToViewportPoint(Number(annotation.rect[0]), Number(annotation.rect[1])),
        ...viewport.convertToViewportPoint(Number(annotation.rect[2]), Number(annotation.rect[3])),
      ];
      const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = rect;
      const link = window.document.createElement('a');
      link.href = url.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', `Abrir link: ${url.href}`);
      link.style.left = `${Math.min(x1, x2)}px`;
      link.style.top = `${Math.min(y1, y2)}px`;
      link.style.width = `${Math.abs(x2 - x1)}px`;
      link.style.height = `${Math.abs(y2 - y1)}px`;
      links.append(link);
    }
    stage.append(links);
    return stage;
  }
}
