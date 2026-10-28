# Changelog

Todas as mudanças relevantes do WEBtoPDF. O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento segue [SemVer](https://semver.org/lang/pt-BR/).

## [Não publicado]

## [1.7.0] — 2026-10-28

### Adicionado

- OCR local no PDF da tela: reconhecimento de texto Tesseract.js 5 (português + inglês) em PDF de imagem com camada invisível selecionável, processamento 100% local, nova permissão `offscreen` e distribuição de recursos em `dist/ocr`. Em caso de falha ou timeout, PDF de imagem com aviso persistente.

## [1.6.2] — 2026-10-26

### Adicionado

- **PDF da tela**: novo formato no menu que transforma a área visível da página em PDF de imagem — uma folha fiel ao que está na tela, sem texto selecionável. A captura é feita automaticamente no instante em que o menu abre, para páginas com menus que se fecham sozinhos ao perder o foco (a captura tenta registrar o menu antes que o site o feche; sites que fecham instantaneamente no blur continuam saindo sem o menu — nesse caso o PDF normal com texto segue disponível).
- **Atalho Ctrl+Shift+S**: captura a tela com a página ainda em foco e abre a prévia do PDF da tela, sem passar pelo menu — a forma garantida para menus que fecham no primeiro `blur`.

### Técnico

- Captura antecipada em `public/early-capture.js` (script clássico bloqueante no `<head>` do popup, antes do bundle do menu), que grava os pixels no service worker por mensagem `store-snapshot`.
- Cache de capturas apenas em RAM (`src/background/snapshot-cache.ts`): no máximo 4 entradas, expiram em 30 s, tokens UUID de uso único, invalidados ao navegar/fechar a aba ou se a URL mudar — nenhuma captura persiste em disco ou storage.
- Writer mínimo `src/shared/image-pdf.ts` embute o JPEG da captura num PDF (`/Filter /DCTDecode`), sem dependência nova.
- Comando `capture-screen-pdf` no manifest; nenhuma permissão nova (a captura usa `activeTab`, já concedido).

## [1.6.1] — 2026-10-26

### Corrigido

- **Design da prévia**: a barra lateral estava espremida para 239px em vez de 360px — o CSS do visualizador de PDF (biblioteca de terceiros) exportava uma classe `.sidebar` que colidia com a nossa e era aplicada por cima. Com isso os cartões ficavam apertados, o retângulo de "Página inteira" deixava a caixinha mais alta que as vizinhas e rótulos como "Tabloid" e "Sob medida" vazavam para fora das caixas do cartão Papel. A classe foi renomeada (`preview-sidebar`) e a grade uniformizada: as oito caixinhas agora têm a mesma altura e nenhum texto vaza.

### Adicionado

- **Modo claro/escuro na prévia**: botão (sol/lua) no cabeçalho, ao lado de "Processamento local". O tema escuro atinge somente a interface da extensão — o documento pré-visualizado permanece com fundo branco, como a simulação da folha impressa. A escolha fica salva e a prévia já abre no tema escolhido; o padrão continua sendo o claro.

### Técnico

- `src/shared/theme.ts` com `parseTheme` (só `'dark'` estrito vira escuro, o resto é claro) e a chave `theme` em `chrome.storage.local`.
- Tema aplicado por `html[data-theme="dark"]` — o seletor com elemento vence o `:root { color-scheme }` do CSS do PDF.js, que tem a mesma especificidade e chega depois no bundle.
- Novo teste E2E cobre tema (padrão, alternância, persistência, papel branco) e a geometria da grade de papel (sidebar 360px, alturas iguais, zero overflow).

## [1.6.0] — 2026-10-26

### Adicionado

- **Conversão direta em 1 clique (opcional)**: um interruptor no menu de formatos faz o próximo clique no ícone abrir a prévia do PDF já convertida, sem passar pela escolha de formato. O padrão continua sendo o menu — quem nunca ligou a opção não vê nenhuma diferença.
- Com o modo direto ligado, uma página incompatível (`chrome://` etc.) abre a prévia com o aviso de que a página não pode ser convertida, já que não há menu na frente para exibir o erro.
- A barra lateral da prévia ganhou o cartão **Conversão direta**, que liga e desliga o modo de qualquer formato — é por ali que se volta ao menu.

### Técnico

- A preferência mora em `chrome.storage.local` (`directConversion`, `true` estrito, padrão desligado) e é compartilhada entre menu e prévia pelo módulo `src/shared/direct.ts`.
- O modo direto reutiliza as mesmas validações de aba e URL do menu (`isSupportedPage` + `buildPreviewUrl`); nenhuma permissão nova e nenhuma mudança de CSP.

## [1.5.0] — 2026-10-23

### Adicionado

- **Texto no menu de formatos**: escolher **Texto** na prévia extrai só o texto visível da página, na ordem em que ele aparece na tela, e o salva em `.txt`. A prévia mostra o conteúdo em bloco monoespaçado; os ajustes de impressão continuam valendo só para o PDF.
- O arquivo de texto é gravado em UTF-8 com BOM, para o Bloco do Windows abrir acentuação correta sem configuração.
- Páginas sem nenhum texto visível são recusadas com mensagem clara, sem gerar arquivo vazio.

### Técnico

- Extração via `Runtime.evaluate` sobre `innerText` na sessão do debugger já autorizada, sem injeção de script na página; `docs/security.md` agora descreve com precisão o que é lido da aba por formato.
- A prévia ganhou modo de texto (`<pre>` com `textContent`), e as mensagens da porta de conversão passaram a ser nomeadas por formato.

## [1.4.0] — 2026-10-23

### Adicionado

- **PNG no menu de formatos**: escolher **PNG** na prévia salva a página inteira como imagem, com a aparência exata da tela. O único ajuste antes de baixar é o nome do arquivo — os ajustes de impressão continuam valendo só para o PDF.
- O nome do arquivo agora acompanha o formato escolhido, com `.png` para imagens.
- Páginas com mais de 16.384 pixels em qualquer dimensão são recusadas na captura PNG com mensagem clara, sugerindo o PDF.

### Técnico

- Sessão do debugger extraída para um módulo compartilhado, reutilizado pela impressão e pela captura de imagem.
- O visualizador do PDF.js só é carregado quando o formato é PDF; a prévia de imagens abre mais leve.

## [1.3.0] — 2026-10-23

### Adicionado

- **Menu de formatos**: clicar no ícone agora abre um menu com as opções de conversão. O PDF continua disponível na mesma — e o fluxo de prévia, ajustes e download não muda. PNG, Texto e Markdown aparecem no menu como "Em breve" e serão habilitados um por versão, cada um com seus próprios testes e release.
- O formato escolhido viaja na URL da prévia e é validado no service worker antes de converter; páginas internas (`chrome://` etc.) são recusadas já no menu, sem abrir a prévia.

## [1.2.0] — 2026-10-22

### Adicionado

- **Release por merge**: cada integração na `main` prepara e publica automaticamente uma nova versão. O bump segue o commit convencional (`feat` → minor, `fix` → patch, mudança incompatível → major), o CI ganhou a checagem obrigatória **Release preparada** e o merge dispara a criação da tag e a publicação da release com o `.zip`.
- Seção **Novidades** no README com as três versões mais recentes, escrita para o usuário final.

### Corrigido

- **Páginas em modo escuro saíam em branco**: a impressão do Chromium força a mídia `print`, o que aplica as folhas de estilo de impressão do próprio site — e sites escuros costumam pintar tudo de branco nessa mídia. A conversão agora emula a mídia `screen`, preservando exatamente o que está na tela, sem tocar no DOM da página. A emulação é restaurada logo após a impressão, inclusive em erro ou cancelamento.
- O esquema de cor do sistema (`prefers-color-scheme`) também é preservado, para páginas que escurecem por preferência e não por cor fixa.

## [1.1.0] — 2026-10-22

### Adicionado

- **Página inteira**: uma única folha contínua com a altura medida do conteúdo real da página.
- **Tamanhos de papel**: A3, A5, Legal, Tabloid e papel personalizado com largura e altura em milímetros, além de A4 e Carta.
- **Redesenho da interface** com a identidade oficial: cabeçalho navy com a marca, vermelho da marca nos elementos de ação, seletor de papel com a proporção real de cada formato, orientação em controle segmentado, margens e escala em sliders e interruptores para fundos e cabeçalho/rodapé.
- O nome do arquivo é reservado no service worker, para que o diálogo **Salvar como…** receba o nome escolhido em vez do UUID interno.

### Corrigido

- A orientação era aplicada duas vezes: as dimensões do papel já vinham trocadas e o Chrome também trocava por conta do parâmetro `landscape`. O resultado em paisagem saía em retrato.
- A barra lateral de ajustes não ocupava a coluna reservada, porque o Chrome não estica automaticamente um item de grade com `position: sticky`. Os controles ficavam fora das caixas.
- O tamanho dos trechos do PDF era calculado decodificando Base64 e jogando o resultado fora. Agora é calculado por aritmética, e o PDF é decodificado uma única vez.
- Cada trecho recebido é conferido contra o tamanho declarado, e a montagem do documento serializa as renderizações para não deixar tarefas pendentes segurando memória.

### Segurança

- Sequências de pontos no nome do arquivo viram espaço, para que um nome como `../../etc/passwd` nunca seja lido como caminho relativo.
- A reserva de nome do download é limitada a 20 entradas e só aceita requisição da própria tela de prévia.

## [1.0.0] — 2026-10-21

### Adicionado

- Conversão da aba atual em PDF com um clique no ícone, usando o motor de impressão do Chrome.
- Prévia paginada com texto selecionável, links clicáveis, navegação entre páginas e zoom.
- Ajustes de papel (A4 e Carta), orientação, margens, escala, fundos e cabeçalho/rodapé, aplicados ao clicar em **Atualizar prévia**.
- Preferências de impressão lembradas entre sessões, guardadas apenas no perfil local.
- Download com **Baixar PDF** (pasta de downloads do navegador) e **Salvar como…** (diálogo nativo).
- Nome de arquivo padrão `Título - AAAA-MM-DD_HH-mm-ss.pdf`, sanitizado para o Windows e sem sobrescrever arquivos existentes.
- Ícones da extensão em 16, 32, 48 e 128 pixels.
- Integração contínua com três checks obrigatórios e portão de segurança do manifesto.
- Empacotamento automatizado e publicação de release por tag.

### Corrigido

- O Chrome ignorava o nome de arquivo na API de downloads para URLs `blob:` e substituía pelo UUID. O download passou a usar um link com o atributo `download`, que respeita o nome escolhido.
- A URL do blob era revogada antes da conclusão do download, o que podia truncar o arquivo.
- Downloads duplicados sobrescreviam o arquivo anterior; agora recebem sufixo numérico.
- O servidor de fixtures mantinha conexões abertas e travava o teardown dos testes no CI.

### Segurança

- Permissões limitadas a `activeTab`, `debugger`, `storage` e `downloads`, sem `host_permissions` nem scripts injetados nas páginas.
- CSP restrita, sem código remoto e sem `eval` na biblioteca PDF empacotada.
- `scripts/verify-manifest.mjs` bloqueia permissões não aprovadas, chaves proibidas e CSP afrouxada.
- Branch principal protegida, sem push direto, force-push ou exclusão.

### Limitações conhecidas

- A conversão usa a permissão `debugger` e pode gerar um aviso temporário do Chrome.
- DevTools aberto na aba original pode interromper a conversão.
- A detecção de colisão de nome usa o histórico de downloads do Chrome; arquivos baixados por outros meios não são detectados.
- Limite de 32 MB por PDF e 60 segundos por conversão.
- O layout de impressão do site pode diferir do exibido na tela.
- Validado apenas no Windows; outros sistemas operacionais não têm suporte.
