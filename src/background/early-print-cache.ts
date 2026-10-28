import { MAX_FILE_BYTES, base64ByteLength } from '../shared/conversion';
import type { PrintSettings } from '../shared/settings';

/** Validade curta: o PDF antecipado existe só para a primeira conversão. */
export const EARLY_PRINT_TTL_MS = 60_000;

export interface CachedPrint {
  /** PDF completo em Base64. */
  data: string;
  title: string;
  byteLength: number;
}

interface Entry extends CachedPrint {
  url: string;
  /** `JSON.stringify` das configurações: `parsePrintSettings` fixa a ordem das chaves. */
  settingsJson: string;
  expiresAt: number;
}

/**
 * PDF da impressão antecipada do menu, guardado em RAM até a primeira
 * conversão. Regras:
 *
 * - Uso único: `take` consome a entrada, válida ou não — "Atualizar prévia"
 *   sempre reimprime ao vivo, nunca reaproveita um PDF velho.
 * - Uma entrada por aba: reimprimir substitui a anterior.
 * - Amarrada à URL vigente no momento da impressão e às configurações usadas;
 *   qualquer divergência na leitura descarta o PDF e manda reimprimir ao vivo.
 * - Expira em `EARLY_PRINT_TTL_MS`; navegação e fechamento chegam via
 *   `removeTab`.
 * - Teto de memória total (32 MB por padrão); para caber, as entradas mais
 *   antigas saem primeiro. Nada disso persiste em disco ou storage.
 */
export class EarlyPrintCache {
  private readonly entries = new Map<number, Entry>();

  constructor(
    private readonly now = () => Date.now(),
    private readonly maxBytes = MAX_FILE_BYTES,
  ) {}

  put(tabId: number, url: string | null, settings: PrintSettings, print: CachedPrint): boolean {
    this.entries.delete(tabId);
    if (!url || print.byteLength <= 0) return false;
    if (print.byteLength > this.maxBytes) return false;
    // O tamanho declarado precisa bater com o Base64 guardado: a prévia vai
    // contabilizar exatamente esses bytes ao montar o arquivo.
    if (base64ByteLength(print.data) !== print.byteLength) return false;
    while (this.entries.size > 0 && this.totalBytes() + print.byteLength > this.maxBytes) {
      this.removeOldest();
    }
    if (this.totalBytes() + print.byteLength > this.maxBytes) return false;
    this.entries.set(tabId, {
      data: print.data,
      title: print.title,
      byteLength: print.byteLength,
      url,
      settingsJson: JSON.stringify(settings),
      expiresAt: this.now() + EARLY_PRINT_TTL_MS,
    });
    return true;
  }

  take(tabId: number, url: string | null, settings: PrintSettings): CachedPrint | null {
    const entry = this.entries.get(tabId);
    if (!entry) return null;
    // Uso único, válida ou não: consumir é descartar.
    this.entries.delete(tabId);
    if (!url) return null;
    if (entry.expiresAt <= this.now()) return null;
    if (entry.url !== url) return null;
    if (entry.settingsJson !== JSON.stringify(settings)) return null;
    return { data: entry.data, title: entry.title, byteLength: entry.byteLength };
  }

  removeTab(tabId: number): void {
    this.entries.delete(tabId);
  }

  private totalBytes(): number {
    let total = 0;
    for (const entry of this.entries.values()) total += entry.byteLength;
    return total;
  }

  private removeOldest(): void {
    let oldestTabId: number | undefined;
    let oldestExpiry = Infinity;
    for (const [tabId, entry] of this.entries) {
      if (entry.expiresAt < oldestExpiry) {
        oldestExpiry = entry.expiresAt;
        oldestTabId = tabId;
      }
    }
    if (oldestTabId !== undefined) this.entries.delete(oldestTabId);
  }
}
