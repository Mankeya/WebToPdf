# Arquitetura

## Decisões

1. **Manifest V3 + TypeScript + Vite**: build local, sem framework de interface ou backend.
2. **Menu de formatos + service worker**: o clique no ícone abre um popup (`popup.html`) que lista o registro de formatos (`src/shared/format.ts`, com um flag `available` por formato) e abre a prévia com `sourceTabId` e `format` na URL. O menu só recusa a aba quando a URL está legível e é incompatível; havendo dúvida, abre a prévia e o service worker revalida a porta, o formato pedido e o ID da aba antes de converter — o formato precisa coincidir com o da URL e estar disponível. Não depende da memória do worker como armazenamento durável de jobs; o estado de conversão vive na aba da prévia.
   - **Conversão direta (opcional)**: o popup continua sendo o handler do clique; ao abrir, ele lê `directConversion` de `chrome.storage.local` (`src/shared/direct.ts`, padrão desligado) e, se ligado, dispara o mesmo `openPreview('pdf')` com as mesmas validações de aba/URL e fecha a janela — sem renderizar o menu. Preferência em vez de `action.onClicked` + `setPopup` porque reaproveita uma única via de construção e validação da URL da prévia (sem duplicar lógica no service worker) e mantém o caminho padrão intacto. A saída do modo é o cartão **Conversão direta** na barra lateral da prévia, garantindo que o menu nunca fique inalcançável.
   - **Captura antecipada (PDF da tela)**: sites que fecham menus no `blur` perdem o menu quando o popup rouba o foco — e qualquer script nosso roda *depois* desse `blur`. A mitigação é disparar `captureVisibleTab` no carregamento do popup, antes do bundle do menu: `public/early-capture.js` (script clássico bloqueante, `'self'`, carregado antes do módulo) envia os pixels JPEG ao service worker (`store-snapshot`), que valida origem, formato, aba ativa e URL e guarda em `src/background/snapshot-cache.ts` — RAM apenas, 4 entradas, 30 s de TTL, token UUID de uso único. A escolha **PDF da tela** passa o token na URL da prévia; o conversor só resolve o token se a aba e a URL continuarem as mesmas (navegar invalida), e um token ausente nunca cai para uma captura posterior. O PDF é montado por `src/shared/image-pdf.ts` (contêiner mínimo, `/Filter /DCTDecode`, sem fontes/JS). A captura é uma corrida contra o `blur` do site; o caminho garantido é o comando `capture-screen-pdf` (`Ctrl+Shift+S`, `chrome.commands`), que captura sem popup — a página nunca perde o foco.
3. **Página de prévia**: mantém o documento convertido em memória, os controles de impressão e o ciclo de vida dos recursos. O modo segue o formato escolhido: PDF usa o PDF.js (carregado por import dinâmico, só quando necessário), PNG exibe a imagem em um `<img>` com object URL local e TXT exibe o texto em `<pre>` via `textContent` (sem HTML interpretado); os cards de ajustes de impressão ficam visíveis só no PDF, porque são a única prévia configurável dele. DOM construído sem HTML de sites externos.
4. **Conversor**: `chrome.debugger` com sessão compartilhada (`src/background/session.ts`), que valida a aba, anexa, confirma a URL atual pela própria sessão e libera em `finally`, inclusive em erro ou cancelamento. Três caminhos de conversão a partir dela:
   - **PDF**: `Emulation.setEmulatedMedia` com mídia `screen` (para aplicar o CSS da tela em vez do CSS de impressão do site, preservando temas escuros) / `Page.printToPDF` com `transferMode: ReturnAsStream`, lendo por `IO.read` e fechando com `IO.close`. A mídia é restaurada antes de liberar.
   - **PNG**: `Page.captureScreenshot` com `captureBeyondViewport` e `clip` do tamanho do conteúdo — a captura já registra a mídia da tela, então não há troca de mídia nem injeção de DOM. A resposta chega inteira em Base64 e é dividida em fatias de 256 KB (múltiplo de 4 caracteres) para trafegar pela mesma porta usada pelo PDF. Acima de 16.384 px em qualquer dimensão, a conversão é recusada antes da captura.
   - **TXT**: `Runtime.evaluate` com `returnByValue` sobre `document.body.innerText` — uma avaliação única, sem script persistente na página. O texto vazio é recusado, o resto é serializado em UTF-8 com BOM (EF BB BF) e trafega na mesma porta em fatias Base64 de múltiplos de 3 bytes, para cada fatia decodificar sozinha.
5. **PDF.js**: biblioteca, worker, cmaps e fontes empacotados localmente, sem CDN. Renderiza com zoom, navegação, camada de texto e camada de links. Ajustes pendentes nunca são apresentados como já aplicados. Carregado por import dinâmico: nos modos PNG e TXT o bundle do visualizador não é baixado nem parseado.
   - **Colisão de CSS**: `pdf_viewer.css` exporta uma classe `.sidebar` própria (`width: 239px; position: relative`) que, por chegar depois no bundle, sobrescrevia a nossa e espremia a coluna de ajustes. A decisão é **renomear o nosso seletor** (`preview-sidebar`) em vez de brigar com especificidade (`!important`): nosso CSS não disputa nomes com folhas de terceiros, e o teste E2E de geometria falha se a sidebar voltar a ter menos de 360px.
6. **Preferências**: `chrome.storage.local`. Não persistir documentos convertidos, histórico de URLs ou conteúdo das páginas. Além das impressões, guarda `directConversion` (conversão direta) e `theme` (tema da prévia, `light` por padrão, parse estrito em `src/shared/theme.ts`).
   - **Tema claro/escuro**: aplicado por `html[data-theme="dark"]` com variáveis da paleta substituídas — o seletor qualificado com elemento vence o `:root { color-scheme: light dark }` do CSS do PDF.js, que tem a mesma especificidade e vem depois. O tema atinge só a interface; o documento continua branco por ser a simulação do papel. Implementado apenas na prévia (popup e menu não mudam).
7. **Download**: nome resolvido por `sanitizeTitle`, com a extensão do formato garantida e nome livre escolhido antes de gravar. O MIME do blob segue o formato (PDF, PNG ou `text/plain;charset=UTF-8`).

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

- **Baixar**: link com atributo `download`, que o Chrome respeita para `blob:` da própria extensão. Antes de disparar, o nome livre é escolhido consultando o histórico de downloads, evitando sobrescrita.
- **Salvar como…**: `chrome.downloads.download` com `saveAs: true`, que abre o diálogo nativo já preenchido com o nome escolhido.

A URL do blob permanece válida até a conclusão do download e só então é revogada. Revogar antes truncaria o arquivo.

## Permissões

`activeTab` (ler URL e título da aba acionada), `debugger` (motor de impressão, captura de imagem e leitura do texto visível), `storage` (preferências) e `downloads` (gravar e rastrear). Sem `host_permissions`, sem `content_scripts` e sem `web_accessible_resources`. A URL da aba original é lida por `Page.getNavigationHistory` na sessão já autorizada, evitando a permissão `tabs`.

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
- https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot
- https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#method-evaluate
- https://developer.chrome.com/docs/extensions/reference/api/downloads
- https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy
- https://mozilla.github.io/pdf.js/
