import { CONVERSION_PORT, CONVERSION_TIMEOUT_MS, MAX_FILE_BYTES, base64ByteLength, matchesFileSignature } from '../shared/conversion';
import type { ConversionRequest } from '../shared/conversion';
import type { ConversionFormat } from '../shared/format';
import type { PrintSettings } from '../shared/settings';

export interface ConvertedFile {
  bytes: Uint8Array<ArrayBuffer>;
  title: string;
}

/**
 * Texto das mensagens do cliente, por formato. PDF e PNG diferem no gênero e
 * no termo; os formatos de texto compartilham a mesma redação.
 */
function clientMessages(format: ConversionFormat): { inconsistent: string; tooLarge: string; invalid: string; failed: string } {
  if (format === 'pdf' || format === 'screen-pdf') {
    return {
      inconsistent: 'O PDF recebido do navegador estava inconsistente.',
      tooLarge: 'O PDF excedeu o limite inicial de 32 MB.',
      invalid: 'O Chrome não retornou um PDF válido.',
      failed: 'Não foi possível receber o PDF.',
    };
  }
  if (format === 'png') {
    return {
      inconsistent: 'A imagem recebida do navegador estava inconsistente.',
      tooLarge: 'A imagem excedeu o limite inicial de 32 MB.',
      invalid: 'O Chrome não retornou uma imagem válida.',
      failed: 'Não foi possível receber a imagem.',
    };
  }
  return {
    inconsistent: 'O texto recebido do navegador estava inconsistente.',
    tooLarge: 'O texto excedeu o limite inicial de 32 MB.',
    invalid: 'O Chrome não retornou um texto válido.',
    failed: 'Não foi possível receber o texto.',
  };
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
    const messages = clientMessages(format);
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
            throw new Error(messages.inconsistent);
          }
          total += decoded.length;
          if (total > MAX_FILE_BYTES) throw new Error(messages.tooLarge);
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
            throw new Error(messages.invalid);
          }
          finish(undefined, { bytes, title: message.title });
        }
      } catch (error) {
        finish(error instanceof Error ? error : new Error(messages.failed));
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
