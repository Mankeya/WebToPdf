import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pickAvailableFilename, resolveDownloadFilename, startDownload } from '../../src/preview/downloader';

interface FakeDownload {
  filename: string;
  state: string;
  endTime?: string;
}

let downloads: FakeDownload[] = [];

beforeEach(() => {
  downloads = [];
  vi.stubGlobal('chrome', {
    downloads: {
      search: vi.fn(async (query: { state?: string; orderBy?: string[]; limit?: number; filenameRegex?: string }) => {
        let result = downloads;
        if (query.state) result = result.filter((item) => item.state === query.state);
        if (query.filenameRegex) {
          const pattern = new RegExp(query.filenameRegex, 'i');
          result = result.filter((item) => pattern.test(item.filename));
        }
        if (query.orderBy?.[0] === '-endTime') {
          result = [...result].sort((a, b) => (b.endTime ?? '').localeCompare(a.endTime ?? ''));
        }
        return result.slice(0, query.limit ?? result.length);
      }),
    },
  });
});

describe('resolveDownloadFilename', () => {
  it('mantém o nome informado e garante a extensão .pdf', () => {
    expect(resolveDownloadFilename('meu-relatorio.pdf', 'Título')).toBe('meu-relatorio.pdf');
    expect(resolveDownloadFilename('meu-relatorio', 'Título')).toBe('meu-relatorio.pdf');
    expect(resolveDownloadFilename('meu-relatorio.PDF', 'Título')).toBe('meu-relatorio.pdf');
  });

  it('usa o título sanitizado quando o campo está vazio', () => {
    expect(resolveDownloadFilename('   ', 'Relatório: 2026')).toBe('Relatório 2026.pdf');
  });

  it('remove caracteres inválidos do Windows e nomes reservados', () => {
    expect(resolveDownloadFilename('a/b:c*d?', 'Título')).toBe('a b c d.pdf');
    expect(resolveDownloadFilename('CON', 'Título')).toBe('pagina-CON.pdf');
  });

  it('preserva acentos e espaços', () => {
    expect(resolveDownloadFilename('Relatório anual', 'Título')).toBe('Relatório anual.pdf');
  });

  it('garante a extensão do formato pedido', () => {
    expect(resolveDownloadFilename('meu-relatorio.png', 'Título', 'png')).toBe('meu-relatorio.png');
    expect(resolveDownloadFilename('meu-relatorio', 'Título', 'png')).toBe('meu-relatorio.png');
    expect(resolveDownloadFilename('meu-relatorio.PNG', 'Título', 'png')).toBe('meu-relatorio.png');
  });
});

describe('pickAvailableFilename', () => {
  it('usa o nome desejado quando não há conflito', async () => {
    expect(await pickAvailableFilename('documento.pdf')).toBe('documento.pdf');
  });

  it('acrescenta sufixo numérico quando o nome já foi baixado', async () => {
    downloads = [{ filename: 'C:\\Users\\teste\\Downloads\\documento.pdf', state: 'complete', endTime: '2026-10-21T10:00:00Z' }];
    expect(await pickAvailableFilename('documento.pdf')).toBe('documento (1).pdf');
  });

  it('incrementa o sufixo até encontrar nome livre', async () => {
    downloads = [
      { filename: 'C:\\Users\\teste\\Downloads\\documento.pdf', state: 'complete', endTime: '2026-10-21T10:00:00Z' },
      { filename: 'C:\\Users\\teste\\Downloads\\documento (1).pdf', state: 'complete', endTime: '2026-10-21T10:00:01Z' },
    ];
    expect(await pickAvailableFilename('documento.pdf')).toBe('documento (2).pdf');
  });

  it('ignora arquivos de mesmo nome em outro diretório', async () => {
    downloads = [
      { filename: 'C:\\Users\\teste\\Downloads\\outro.pdf', state: 'complete', endTime: '2026-10-21T10:00:00Z' },
      { filename: 'C:\\Users\\teste\\Documentos\\documento.pdf', state: 'complete', endTime: '2026-10-21T09:00:00Z' },
    ];
    expect(await pickAvailableFilename('documento.pdf')).toBe('documento.pdf');
  });

  it('respeita a extensão do formato ao deduplicar', async () => {
    downloads = [{ filename: 'C:\\Users\\teste\\Downloads\\foto.png', state: 'complete', endTime: '2026-10-21T10:00:00Z' }];
    expect(await pickAvailableFilename('foto.png', 'png')).toBe('foto (1).png');
  });
});

describe('startDownload em janela anônima', () => {
  const bytes = new Uint8Array([1, 2, 3]);

  function stubChrome(inIncognitoContext: boolean, triggerComplete: boolean) {
    const download = vi.fn(async () => 42);
    const listeners: ((delta: unknown) => void)[] = [];
    const onChanged = {
      addListener: (listener: (delta: unknown) => void) => {
        listeners.push(listener);
        if (triggerComplete) listener({ id: 42, state: { current: 'complete' } });
      },
      removeListener: vi.fn(),
    };
    vi.stubGlobal('chrome', {
      extension: { inIncognitoContext },
      runtime: { sendMessage: vi.fn(async () => undefined) },
      downloads: { search: vi.fn(async () => []), download, onChanged },
    });
    return { download };
  }

  it('força o diálogo "Salvar como…" mesmo quando o botão pediu download direto', async () => {
    const { download } = stubChrome(true, true);
    await startDownload({ bytes, filename: 'pagina.pdf', saveAs: false, extension: 'pdf' });
    expect(download).toHaveBeenCalledWith(expect.objectContaining({ saveAs: true, filename: 'pagina.pdf' }));
  });

  it('no contexto normal o download direto não abre o diálogo nem usa chrome.downloads', async () => {
    const download = vi.fn(async () => 42);
    vi.stubGlobal('chrome', {
      extension: { inIncognitoContext: false },
      runtime: { sendMessage: vi.fn(async () => undefined) },
      downloads: {
        search: vi.fn(async () => [{ state: 'complete' }]),
        download,
        onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    });
    const anchor = { href: '', download: '', rel: '', style: {}, click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('document', { createElement: () => anchor, body: { append: vi.fn() } });
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() });
    const outcome = await startDownload({ bytes, filename: 'pagina.pdf', saveAs: false, extension: 'pdf' });
    expect(download).not.toHaveBeenCalled();
    expect(anchor.click).toHaveBeenCalled();
    expect(outcome).toEqual({ status: 'complete' });
  });
});
