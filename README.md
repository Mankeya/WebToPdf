# WEBtoPDF

Extensão Chrome/Chromium para Windows: converter a aba atual em PDF, revisar a prévia em uma nova aba, ajustar a impressão e baixar o documento. Processamento local, sem backend ou telemetria.

## Estado do projeto

Estrutura inicial em desenvolvimento. A conversão real e a visualização PDF ainda não estão implementadas. A interface inicial identifica explicitamente esse estado; não simula uma conversão concluída.

## Ambiente de desenvolvimento

- Node.js 22.12+, 24.x ou 26+ (conforme `engines` do pacote), npm e Chrome estável no Windows.
- `npm ci`: instalar as dependências fixadas no lockfile.
- `npm run dev`: gerar a extensão continuamente em `dist/`.
- `npm run typecheck`: verificar tipos.
- `npm test`: executar testes unitários.
- `npm run test:e2e`: validar a extensão em Chromium com Playwright (requer `npx playwright install chromium`).
- `npm run build`: gerar o pacote local em `dist/`.
- `npm run check`: executar tipos, testes unitários e build.

Em `chrome://extensions`, habilite o modo desenvolvedor e use **Carregar sem compactação** selecionando `dist/`. Após rebuilds, recarregue a extensão. O clique no ícone abre a tela inicial de visualização; os controles de conversão/download permanecerão desabilitados até a integração real.

## Estrutura

```text
src/background/     Orquestração da ação da extensão
src/preview/        Página e estilos da prévia
src/shared/         Configurações, nomes de arquivo e contratos
public/             Manifesto MV3
tests/unit/         Testes de regras puras
tests/e2e/          Smoke test da extensão empacotada
docs/               Escopo aprovado, arquitetura e validação técnica
```

## Segurança e limitações

Nunca versione PDFs, páginas reais, tokens ou perfis do navegador. A permissão `debugger` será necessária para a conversão e pode apresentar aviso do Chrome; políticas corporativas e DevTools podem impedir o uso. O download seguirá as configurações do navegador ou o diálogo **Salvar como…**. Não há autorização persistente para pastas.

Consulte [a especificação](docs/specification.md), [a arquitetura](docs/architecture.md) e [o roteiro de validação](docs/validation.md).

## Git

Trabalho em branches curtas, commits convencionais e integração por PR. Não fazer push direto na principal ou force-push. Não há CI remoto ou regras de proteção configurados nesta etapa. Dados de autoria são configuração local do Git, não arquivos do produto.
