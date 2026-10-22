# Arquitetura

## Decisões

1. **Manifest V3 + TypeScript + Vite**: build local, sem framework de interface ou backend.
2. **Service worker**: recebe o clique e fixa o ID da aba original antes de abrir a prévia. Não depende da memória do worker como armazenamento durável de jobs; o estado de conversão vive na aba da prévia.
3. **Página de prévia**: mantém o PDF em memória, os controles de impressão e o ciclo de vida dos recursos. DOM construído sem HTML de sites externos.
4. **Conversor**: `chrome.debugger` / `Emulation.setEmulatedMedia` com mídia `screen` (para aplicar o CSS da tela em vez do CSS de impressão do site, preservando temas escuros) / `Page.printToPDF` com `transferMode: ReturnAsStream`, lendo por `IO.read` e fechando com `IO.close`. Anexa somente durante a operação, restaura a mídia e libera em `finally`, inclusive em erro ou cancelamento.
5. **PDF.js**: biblioteca, worker, cmaps e fontes empacotados localmente, sem CDN. Renderiza com zoom, navegação, camada de texto e camada de links. Ajustes pendentes nunca são apresentados como já aplicados.
6. **Preferências**: `chrome.storage.local`. Não persistir PDFs, histórico de URLs ou conteúdo das páginas.
7. **Download**: nome resolvido por `sanitizeTitle`, com extensão `.pdf` garantida e nome livre escolhido antes de gravar.

## Tamanho do papel e orientação

O Chrome troca largura e altura do papel quando o parâmetro `landscape` da
impressão é verdadeiro. Por isso as dimensões sempre seguem o padrão retrato e
a troca acontece uma única vez, no motor de impressão. Trocar as dimensões no
aplicativo e passar `landscape` ao mesmo tempo faria a orientação ser
aplicada duas vezes e o resultado voltaria a retrato.

## Página inteira

`Page.getLayoutMetrics` devolve o tamanho real do conteúdo (`cssContentSize`).
A folha contínua usa esse tamanho como papel, com margens zeradas e escala 1.
O teto de 200 polegadas é o limite de leitura do formato PDF; acima disso o
conteúdo é paginado normalmente, o que preserva a leitura em vez de gerar um
arquivo que poucos visualizadores abrem.

Como a folha acompanha o conteúdo, margens, escala e orientação ficam fixas
nesse modo.

Quebras de página explícitas no CSS de impressão do site (`break-after: page`)
continuam valendo: o Chrome respeita a intenção do autor e divide o
documento, mesmo em folha contínua.

## Download: por que o atributo `download`

O Chrome **ignora a opção `filename` de `chrome.downloads.download` para URLs `blob:`** e substitui pelo UUID da origem. O evento `onDeterminingFilename`, que permitiria sugerir o nome, não é disparado para esse caminho.

Por isso o fluxo é:

- **Baixar PDF**: link com atributo `download`, que o Chrome respeita para `blob:` da própria extensão. Antes de disparar, o nome livre é escolhido consultando o histórico de downloads, evitando sobrescrita.
- **Salvar como…**: `chrome.downloads.download` com `saveAs: true`, que abre o diálogo nativo já preenchido com o nome escolhido.

A URL do blob permanece válida até a conclusão do download e só então é revogada. Revogar antes truncaria o arquivo.

## Permissões

`activeTab` (ler URL e título da aba acionada), `debugger` (motor de impressão), `storage` (preferências) e `downloads` (gravar e rastrear). Sem `host_permissions`, sem `content_scripts` e sem `web_accessible_resources`. A URL da aba original é lida por `Page.getNavigationHistory` na sessão já autorizada, evitando a permissão `tabs`.

## Segurança

- Código e assets locais; CSP sem scripts remotos ou inline.
- Validar mensagens e IDs de abas antes de comandos privilegiados.
- Não registrar conteúdo, URLs ou PDFs em logs de produção.
- Validar nomes e limites das opções de impressão. Nunca usar título como caminho de arquivo.
- Prévia sem documento persistente; liberar blobs e renderer ao atualizar e fechar.
- Cabeçalhos e rodapés podem incluir informações da página quando habilitados.

O inventário detalhado está em [security.md](security.md).

## Referências técnicas

- https://developer.chrome.com/docs/extensions/reference/api/debugger
- https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-printToPDF
- https://developer.chrome.com/docs/extensions/reference/api/downloads
- https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy
- https://mozilla.github.io/pdf.js/
