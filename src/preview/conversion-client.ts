import { CONVERSION_PORT, CONVERSION_TIMEOUT_MS, MAX_PDF_BYTES, base64ByteLength } from '../shared/conversion';
import type { ConversionRequest } from '../shared/conversion';
import type { PrintSettings } from '../shared/settings';

export interface ConvertedPdf {
  bytes: Uint8Array<ArrayBuffer>;
  title: string;
}

const PDF_SIGNATURE = '%PDF-';

function decodeBase64(data: string): Uint8Array<ArrayBuffer> {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function requestConversion(sourceTabId: number, settings: PrintSettings, signal: AbortSignal): Promise<ConvertedPdf> {
  return new Promise((resolve, reject) => {
    const port = chrome.runtime.connect({ name: CONVERSION_PORT });
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let total = 0;
    let settled = false;
    const finish = (error?: Error, result?: ConvertedPdf): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener('abort', cancel);
      port.disconnect();
      if (error) reject(error);
      else if (result) resolve(result);
    };
    const cancel = (): void => finish(new Error('Conversão cancelada.'));
    const timeout = setTimeout(() => finish(new Error('A conversão demorou demais. Tente novamente.')), CONVERSION_TIMEOUT_MS + 5_000);
    signal.addEventListener('abort', cancel, { once: true });
    port.onDisconnect.addListener(() => {
      // Consumir lastError evita aviso não tratado, sem expor detalhes internos.
      void chrome.runtime.lastError;
      finish(new Error('A conexão com a extensão foi interrompida. Recarregue a extensão e tente novamente.'));
    });
    port.onMessage.addListener((message: unknown) => {
      if (settled || typeof message !== 'object' || message === null || !('type' in message)) return;
      try {
        if (message.type === 'error' && 'message' in message && typeof message.message === 'string') {
          finish(new Error(message.message));
        } else if (message.type === 'chunk' && 'data' in message && typeof message.data === 'string') {
          const expected = 'byteLength' in message && typeof message.byteLength === 'number' ? message.byteLength : null;
          const decoded = decodeBase64(message.data);
          // O tamanho declarado precisa bater com o conteúdo, caso contrário o
          // documento montado não corresponde ao que o Chrome entregou.
          if (expected !== null && expected !== decoded.length) {
            throw new Error('O PDF recebido do navegador estava inconsistente.');
          }
          total += decoded.length;
          if (total > MAX_PDF_BYTES) throw new Error('O PDF excedeu o limite inicial de 32 MB.');
          chunks.push(decoded);
        } else if (message.type === 'complete' && 'title' in message && typeof message.title === 'string'
          && 'byteLength' in message && message.byteLength === total && total > 0) {
          const bytes = new Uint8Array(total);
          let offset = 0;
          for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.length;
          }
          if (String.fromCharCode(...bytes.subarray(0, PDF_SIGNATURE.length)) !== PDF_SIGNATURE) {
            throw new Error('O Chrome não retornou um PDF válido.');
          }
          finish(undefined, { bytes, title: message.title });
        }
      } catch (error) {
        finish(error instanceof Error ? error : new Error('Não foi possível receber o PDF.'));
      }
    });
    if (signal.aborted) cancel();
    else {
      const request: ConversionRequest = { type: 'convert', sourceTabId, settings };
      port.postMessage(request);
    }
  });
}

export { base64ByteLength };
