# Validação

## Gate de conversão

1. Anexar `chrome.debugger` a uma página HTTP/HTTPS e executar `Page.printToPDF`.
2. Confirmar PDF válido, texto selecionável e links.
3. Desconectar o debugger em sucesso e em erro.
4. Testar cancelamento pelo usuário, DevTools aberto, navegação e fechamento da aba original.
5. Verificar permissões e políticas corporativas sem tentar contorná-las.

**Status: aprovado.** O gate roda em `tests/e2e/print-gate.spec.ts` (Chromium 156) e a conversão real foi exercitada no Chrome 155 estável pelo responsável, com a extensão carregada manualmente.

## Automatizado

- `npm run check`: tipos, 64 testes unitários e build Vite.
- `npm run test:e2e`: 10 testes em Chromium 156 (Playwright 1.64.1, headless) com perfil temporário.
  - impressão via debugger e liberação da conexão;
  - prévia real com texto selecionável, links e navegação de páginas;
  - ajustes aplicados somente ao pedir atualização e preferências lembradas;
  - botões de download habilitados e nome padrão;
  - download real com arquivo válido, nome preservado e sem sobrescrita;
  - tamanhos de papel, orientação, página inteira e papel personalizado;
  - página incompatível e extensão carregando corretamente.
- `npm run package`: gera `webtopdf-<versão>.zip` com manifesto, ícones, worker do PDF.js, cmaps e fontes.

## Manual obrigatório

O Chrome 155 não aceita mais `--load-extension` na linha de comando; a extensão precisa ser carregada por `chrome://extensions` → **Carregar sem compactação**. Por isso os itens abaixo são verificados manualmente: [checklist de produção](production-checklist.md).

- Aviso de depuração do Chrome durante a conversão e seu cancelamento.
- Diálogo nativo **Salvar como…** com o nome pré-preenchido.
- Política corporativa que bloqueie a extensão, a permissão `debugger` ou a impressão em PDF.
- Comportamento com a pasta de downloads redirecionada (OneDrive) ou com permissões do Windows.
- Fidelidade visual em artigo longo, página com imagens e relatório com tabela.

## Limites definidos por implementação

- 32 MB por PDF e 60 segundos por conversão, ambos com mensagem explícita.
- Conversões concorrentes da mesma aba são recusadas.
- Colisão de nome detectada pelo histórico de downloads do Chrome; arquivos baixados fora dele não são detectados.

## Ainda não configurado

- Publicação na Chrome Web Store.
- Aprovação humana obrigatória no PR: hoje o repositório tem um único responsável e o GitHub não permite que o autor aprove o próprio PR. A regra fica pronta para ser ativada quando houver um segundo revisor.
