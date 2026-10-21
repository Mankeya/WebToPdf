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
