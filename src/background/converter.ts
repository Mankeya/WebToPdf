import { ConversionError, MAX_FILE_BYTES, base64ByteLength, chunkBase64 } from '../shared/conversion';
import { resolvePaperSize } from '../shared/settings';
import type { PrintSettings } from '../shared/settings';
import { openTabSession } from './session';

const MM_PER_INCH = 25.4;
const CSS_PX_PER_INCH = 96;
/** Teto de 200 polegadas, o limite de leitura do formato PDF. */
const MAX_FULL_PAGE_PX = 200 * CSS_PX_PER_INCH;
/**
 * Maior lado aceito numa captura de imagem. O compositor do Chromium falha
 * acima de ~16.384 px por dimensão (limite de textura portátil), então o
 * recuso vem antes do comando, com mensagem clara, em vez de um erro vago
 * do debugger.
 */
const MAX_CAPTURE_PX = 16_384;

interface PaperRequest {
  widthInches: number;
  heightInches: number;
  marginInches: number;
  scale: number;
}

interface ContentSize {
  width: number;
  height: number;
}

/**
 * Para "página inteira", a folha acompanha o tamanho do conteúdo da página.
 * A medida vem do layout real, então uma página de 3 000 px de altura vira um
 * PDF de uma única folha alta.
 *
 * O teto de 200 polegadas é o limite de leitura do formato PDF. Acima disso o
 * conteúdo é paginado normalmente, o que preserva a leitura.
 */
async function resolveFullPageSize(target: { tabId: number }): Promise<PaperRequest> {
  const { width, height } = await readContentSize(target);
  return {
    widthInches: width / CSS_PX_PER_INCH,
    heightInches: Math.min(height, MAX_FULL_PAGE_PX) / CSS_PX_PER_INCH,
    marginInches: 0,
    scale: 1,
  };
}

/** Mede o tamanho do conteúdo via layout real, em pixels CSS. */
async function readContentSize(target: { tabId: number }): Promise<ContentSize> {
  const metrics: unknown = await chrome.debugger.sendCommand(target, 'Page.getLayoutMetrics');
  if (typeof metrics !== 'object' || metrics === null || !('cssContentSize' in metrics)) {
    throw new ConversionError('Não foi possível medir o tamanho do conteúdo da página.');
  }
  const size: unknown = metrics.cssContentSize;
  if (typeof size !== 'object' || size === null || !('width' in size) || !('height' in size)
    || typeof size.width !== 'number' || typeof size.height !== 'number'
    || !Number.isFinite(size.width) || !Number.isFinite(size.height)) {
    throw new ConversionError('Não foi possível medir o tamanho do conteúdo da página.');
  }
  return { width: Math.max(size.width, 1), height: Math.max(size.height, 1) };
}

export async function convertTabToPdf(
  tabId: number,
  settings: PrintSettings,
  onChunk: (base64: string, byteLength: number) => void,
  signal: AbortSignal,
): Promise<{ title: string; byteLength: number }> {
  const { target, title, detach } = await openTabSession(tabId, signal, 'impressão');
  let emulated = false;
  let stream: string | undefined;
  try {
    // A impressão usa a mídia "print" por padrão, o que aplica as folhas de
    // estilo de impressão do próprio site — frequentemente um fundo branco que
    // apaga temas escuros. Emular "screen" mantém a aparência que o usuário
    // está vendo, sem alterar o DOM da página.
    await chrome.debugger.sendCommand(target, 'Emulation.setEmulatedMedia', { media: 'screen' });
    emulated = true;
    signal.throwIfAborted();

    let paper: PaperRequest;
    let landscape: boolean;
    if (settings.paperSize === 'FullPage') {
      // A folha contínua acompanha o conteúdo: as medidas vêm do layout real e
      // a orientação do papel não se aplica.
      paper = await resolveFullPageSize(target);
      landscape = false;
    } else {
      const dimensions = resolvePaperSize(settings);
      paper = {
        widthInches: dimensions.widthMm / MM_PER_INCH,
        heightInches: dimensions.heightMm / MM_PER_INCH,
        marginInches: settings.marginMm / MM_PER_INCH,
        scale: settings.scale,
      };
      // O Chrome troca largura e altura do papel quando landscape é verdadeiro.
      landscape = settings.orientation === 'landscape';
    }

    const response: unknown = await chrome.debugger.sendCommand(target, 'Page.printToPDF', {
      landscape,
      paperWidth: paper.widthInches,
      paperHeight: paper.heightInches,
      marginTop: paper.marginInches,
      marginBottom: paper.marginInches,
      marginLeft: paper.marginInches,
      marginRight: paper.marginInches,
      scale: paper.scale,
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
      const chunkBytes = base64ByteLength(base64);
      byteLength += chunkBytes;
      if (byteLength > MAX_FILE_BYTES) throw new ConversionError('O PDF excedeu o limite inicial de 32 MB. Tente uma página menor.');
      signal.throwIfAborted();
      if (base64) onChunk(base64, chunkBytes);
      eof = 'eof' in chunk && chunk.eof === true;
    }
    if (byteLength === 0) throw new ConversionError('O PDF gerado está vazio.');
    return { title: title || 'pagina', byteLength };
  } finally {
    if (stream) await chrome.debugger.sendCommand(target, 'IO.close', { handle: stream }).catch(() => undefined);
    if (emulated) await chrome.debugger.sendCommand(target, 'Emulation.setEmulatedMedia', { media: '' }).catch(() => undefined);
    await detach();
  }
}

/**
 * Captura a página inteira como PNG, com a aparência da tela.
 *
 * A screenshot do Chromium já registra a página como está na tela (midia
 * "screen"), então não há injeção de DOM nem troca de mídia aqui — o clip
 * apenas estende a captura além da janela para cobrir o conteúdo todo.
 */
export async function convertTabToPng(
  tabId: number,
  onChunk: (base64: string, byteLength: number) => void,
  signal: AbortSignal,
): Promise<{ title: string; byteLength: number }> {
  const { target, title, detach } = await openTabSession(tabId, signal, 'captura');
  try {
    const size = await readContentSize(target);
    if (size.width > MAX_CAPTURE_PX || size.height > MAX_CAPTURE_PX) {
      throw new ConversionError('Esta página é grande demais para virar uma imagem (limite de 16.384 pixels por lado). Converta em PDF.');
    }
    signal.throwIfAborted();
    const response: unknown = await chrome.debugger.sendCommand(target, 'Page.captureScreenshot', {
      format: 'png',
      // `captureBeyondViewport` no nível do comando vale do Chrome 105 em
      // diante; o campo homônimo dentro de `clip` só existe em versões mais
      // novas e quebraria o mínimo suportado (116).
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 },
    });
    if (typeof response !== 'object' || response === null || !('data' in response) || typeof response.data !== 'string') {
      throw new ConversionError('O Chrome não retornou uma imagem válida.');
    }
    const byteLength = base64ByteLength(response.data);
    if (byteLength === 0) throw new ConversionError('A imagem capturada está vazia.');
    if (byteLength > MAX_FILE_BYTES) throw new ConversionError('A imagem excedeu o limite inicial de 32 MB. Converta em PDF.');
    // A porta recebe Base64 em fatias de 256 KB (múltiplo de 4 caracteres),
    // para cada fatia decodificar sozinha no lado da prévia.
    for (const chunk of chunkBase64(response.data)) {
      signal.throwIfAborted();
      onChunk(chunk, base64ByteLength(chunk));
    }
    return { title: title || 'pagina', byteLength };
  } finally {
    await detach();
  }
}
