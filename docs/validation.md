# Validação

## Gate de conversão

1. Anexar `chrome.debugger` a uma página HTTP/HTTPS e executar `Page.printToPDF` (PDF), `Page.captureScreenshot` (PNG) ou `Runtime.evaluate` sobre `innerText` (TXT).
2. Confirmar PDF válido com texto selecionável e links, PNG com a assinatura correta e a altura do conteúdo, ou texto em UTF-8 com BOM igual ao exibido na tela.
3. Desconectar o debugger em sucesso e em erro.
4. Testar cancelamento pelo usuário, DevTools aberto, navegação e fechamento da aba original.
5. Verificar permissões e políticas corporativas sem tentar contorná-las.

**Status: aprovado.** O gate roda em `tests/e2e/print-gate.spec.ts` (Chromium 156) e a conversão real foi exercitada no Chrome 155 estável pelo responsável, com a extensão carregada manualmente.

## Automatizado

- `npm run check`: tipos, 135 testes unitários e build Vite.
- `npm run test:e2e`: 30 testes em Chromium 156 (Playwright 1.64.1, headless) com perfil temporário.
  - impressão via debugger e liberação da conexão;
  - prévia real com texto selecionável, links e navegação de páginas;
  - ajustes aplicados somente ao pedir atualização e preferências lembradas;
  - botões de download habilitados e nome padrão;
  - download real com arquivo válido, nome preservado e sem sobrescrita;
  - tamanhos de papel, orientação, página inteira e papel personalizado;
  - preservação do fundo escuro, do CSS da tela e do esquema de cor do sistema;
  - captura PNG da página inteira, assinatura do arquivo, recusa acima de 16.384 px e ajustes de impressão ocultos;
  - extração de texto com prévia em `<pre>`, download UTF-8 com BOM e recusa de página sem texto visível;
  - conversão direta em 1 clique: padrão desligado, ligação persistida, clique leva à prévia PDF sem menu, página interna abre com aviso e a prévia desliga o modo de volta;
  - página incompatível e extensão carregando corretamente.
- `npm run release:check`: confere versão, CHANGELOG e README — o mesmo script que o CI usa no check **Release preparada**.
- `npm run package`: gera `webtopdf-<versão>.zip` com manifesto, ícones, worker do PDF.js, cmaps e fontes.

## Manual obrigatório

O Chrome 155 não aceita mais `--load-extension` na linha de comando; a extensão precisa ser carregada por `chrome://extensions` → **Carregar sem compactação**. Por isso os itens abaixo são verificados manualmente: [checklist de produção](production-checklist.md).

- Aviso de depuração do Chrome durante a conversão e seu cancelamento.
- Diálogo nativo **Salvar como…** com o nome pré-preenchido.
- Política corporativa que bloqueie a extensão, a permissão `debugger` ou a impressão em PDF.
- Comportamento com a pasta de downloads redirecionada (OneDrive) ou com permissões do Windows.
- Fidelidade visual em artigo longo, página com imagens e relatório com tabela.

## Limites definidos por implementação

- 32 MB por arquivo convertido e 60 segundos por conversão, ambos com mensagem explícita.
- PNG: 16.384 pixels por lado (limite do compositor do Chromium), recusado antes da captura.
- TXT: página sem texto visível é recusada; texto acima de 32 MB é recusado antes de montar o arquivo.
- Conversões concorrentes da mesma aba são recusadas.
- Colisão de nome detectada pelo histórico de downloads do Chrome; arquivos baixados fora dele não são detectados.

## Ainda não configurado

- Publicação na Chrome Web Store.
- Aprovação humana obrigatória no PR: hoje o repositório tem um único responsável e o GitHub não permite que o autor aprove o próprio PR. A regra fica pronta para ser ativada quando houver um segundo revisor.
