# Validação e próximos passos

## Gate antes da conversão completa

Em Chrome estável no Windows, sem flags especiais:

1. Registrar versão do navegador e sistema.
2. Anexar debugger a uma página HTTP/HTTPS de teste e executar `Page.printToPDF`.
3. Confirmar PDF válido, texto selecionável e links; desconectar debugger em sucesso e erro.
4. Testar aviso/cancelamento pelo usuário, DevTools aberto, navegação e fechamento da aba original.
5. Verificar permissões/políticas corporativas sem tentar contorná-las.

Não considerar o gate aprovado por mocks ou somente pelo build. Se inviável, solicitar decisão ao responsável.

## Scaffold

- `npm run check`: tipos, regras puras e geração de `dist/`.
- `npx playwright install chromium` e `npm run test:e2e`: extensão carregada em perfil temporário, worker registrado e tela inicial acessível. Não valida conversão.
- Inspecionar `dist/manifest.json` e as referências a assets empacotados.
- Instalar `dist/` no Chrome e conferir abertura da prévia ao clicar no ícone.

## Produto completo (pendente)

- Artigo longo, imagens e tabela com fixtures locais, sem dados corporativos.
- Comparar visualização e PDF baixado após cada ajuste aplicado.
- Preferências após reinício; download normal e Salvar como; colisões de nome.
- Original fechada antes/depois da geração; preview recarregado; cliques repetidos.
- Documento extenso, limites de memória e limpeza de recursos.

Diálogos nativos, avisos de debugger, políticas e Chrome Windows exigem validação manual. Playwright/Chromium não substitui esses testes.

## Resultado desta etapa — estrutura inicial

- Ambiente executado: Windows, Node.js 26.10.0 e npm 11.19.1.
- `npm install`: concluído; auditoria automática reportou zero vulnerabilidades naquele momento.
- `npm run check`: aprovado (checagem de tipos, 35 testes unitários e build Vite).
- `npm run test:e2e`: aprovado (1 smoke test em Chromium 156 / Playwright 1.64.1, headless).
- Manifesto e assets gerados em `dist/` conferidos; service worker MV3 carregado no smoke test.
- O smoke test abre a página da extensão e verifica listener da ação, padrões, estado desabilitado e mensagem de página incompatível. Não simula clique real na barra do Chrome.
- Instalação manual no Chrome estável, conversão real e gate de debugger ainda **não executados**.
- CI remoto, branch principal e regras de proteção não foram configurados nesta etapa.
