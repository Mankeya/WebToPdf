# Arquitetura

## Decisões

1. **Manifest V3 + TypeScript + Vite**: build local, sem framework de interface ou backend.
2. **Service worker**: recebe o clique e fixa o ID da aba original antes de abrir a prévia. Não depender de memória do worker como armazenamento durável de jobs.
3. **Página de prévia**: mantém o PDF em memória, controles de impressão e ciclo de vida dos recursos. DOM construído sem HTML de sites externos.
4. **Conversor (próxima etapa)**: `chrome.debugger` / `Page.printToPDF`. Anexar somente durante a operação, liberar em `finally`, tratar cancelamento e conflito com DevTools.
5. **PDF.js (próxima etapa)**: empacotar biblioteca e worker localmente, sem CDN. Renderizar com zoom/navegação e camadas de texto/links quando possível. Nunca apresentar ajuste pendente como se já estivesse aplicado ao arquivo.
6. **Preferências (próxima etapa)**: `chrome.storage.local`. Não persistir PDFs, histórico de URLs ou conteúdo das páginas.
7. **Download (próxima etapa)**: `chrome.downloads`, `saveAs` conforme a ação e resolução de conflito sem sobrescrever.

## Estrutura inicial versus produto final

O scaffold implementa somente abertura da tela inicial, controles desabilitados, contratos de configurações, sanitização de nomes e testes. Não inclui conversor, renderer PDF, armazenamento de preferências ou download. Bibliotecas PDF serão instaladas ao integrar o renderer, evitando dependências não utilizadas nesta etapa.

O manifesto inicial usa apenas `activeTab`, necessário para consultar a URL da aba acionada. As permissões `debugger`, `downloads` e `storage` serão adicionadas quando seus consumidores existirem. Não pedir acesso permanente a todos os sites.

## Segurança

- Código e assets locais; CSP sem scripts remotos ou inline.
- Validar mensagens e IDs de abas antes de comandos privilegiados.
- Não registrar conteúdo, URLs ou PDFs em logs de produção.
- Validar nomes e limites das opções de impressão. Nunca usar título como caminho de arquivo.
- Prévia sem documento persistente; liberar blobs/renderer ao atualizar e fechar.
- Cabeçalhos/rodapés podem incluir informações da página quando habilitados; documentar o comportamento do motor na integração.

## Referências técnicas

- https://developer.chrome.com/docs/extensions/reference/api/debugger
- https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-printToPDF
- https://developer.chrome.com/docs/extensions/reference/api/downloads
- https://mozilla.github.io/pdf.js/
