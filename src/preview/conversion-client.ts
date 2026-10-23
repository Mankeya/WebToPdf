import { CONVERSION_PORT, CONVERSION_TIMEOUT_MS, MAX_FILE_BYTES, base64ByteLength, matchesFileSignature } from '../shared/conversion';
import type { ConversionRequest } from '../shared/conversion';
import type { ConversionFormat } from '../shared/format';
import type { PrintSettings } from '../shared/settings';

export interface ConvertedFile {
  bytes: Uint8Array<ArrayBuffer>;
  title: string;
}

function decodeBase64(data: string): Uint8Array<ArrayBuffer> {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function requestConversion(
  sourceTabId: number,
  format: ConversionFormat,
  settings: PrintSettings,
  signal: AbortSignal,
): Promise<ConvertedFile> {
  return new Promise((resolve, reject) => {
    const port = chrome.runtime.connect({ name: CONVERSION_PORT });
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let total = 0;
    let settled = false;
    const finish = (error?: Error, result?: ConvertedFile): void => {
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
          // arquivo montado não corresponde ao que o Chrome entregou.
          if (expected !== null && expected !== decoded.length) {
            throw new Error(format === 'pdf' ? 'O PDF recebido do navegador estava inconsistente.' : 'A imagem recebida do navegador estava inconsistente.');
          }
          total += decoded.length;
          if (total > MAX_FILE_BYTES) throw new Error(format === 'pdf' ? 'O PDF excedeu o limite inicial de 32 MB.' : 'A imagem excedeu o limite inicial de 32 MB.');
          chunks.push(decoded);
        } else if (message.type === 'complete' && 'title' in message && typeof message.title === 'string'
          && 'byteLength' in message && message.byteLength === total && total > 0) {
          const bytes = new Uint8Array(total);
          let offset = 0;
          for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.length;
          }
          // A assinatura confirma que o Chrome devolveu o tipo combinado com o
          // menu, em vez de outro arquivo ou uma resposta de erro em HTML.
          if (!matchesFileSignature(format, bytes)) {
            throw new Error(format === 'pdf' ? 'O Chrome não retornou um PDF válido.' : 'O Chrome não retornou uma imagem válida.');
          }
          finish(undefined, { bytes, title: message.title });
        }
      } catch (error) {
        finish(error instanceof Error ? error : new Error(format === 'pdf' ? 'Não foi possível receber o PDF.' : 'Não foi possível receber a imagem.'));
      }
    });
    if (signal.aborted) cancel();
    else {
      const request: ConversionRequest = { type: 'convert', sourceTabId, format, settings };
      port.postMessage(request);
    }
  });
}

export { base64ByteLength };
