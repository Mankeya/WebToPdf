/** Somente RAM: no máximo quatro capturas, por até 30 s, sem histórico. */
export class SnapshotCache {
  private readonly entries = new Map<string, { tabId: number; url: string; data: string; expires: number }>();
  constructor(private readonly now = Date.now) {}

  prune(): void {
    for (const [id, entry] of this.entries) {
      if (entry.expires <= this.now()) this.entries.delete(id);
    }
  }

  put(tabId: number, url: string, data: string): string {
    this.prune();
    this.removeTab(tabId);
    while (this.entries.size >= 4) this.entries.delete(this.entries.keys().next().value!);
    const id = crypto.randomUUID();
    this.entries.set(id, { tabId, url, data, expires: this.now() + 30_000 });
    return id;
  }

  get(id: string, tabId: number, url: string): string | null {
    this.prune();
    const entry = this.entries.get(id);
    return entry?.tabId === tabId && entry.url === url ? entry.data : null;
  }

  removeTab(tabId: number): void {
    for (const [id, entry] of this.entries) if (entry.tabId === tabId) this.entries.delete(id);
  }
}
