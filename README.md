# WEBtoPDF

Extensão Chrome/Chromium para Windows: converter a aba atual em PDF, revisar a prévia em uma nova aba, ajustar a impressão e baixar o documento. Processamento local, sem backend, sem telemetria e sem acesso a servidores.

Versão 1.0.0. Últimas mudanças em [CHANGELOG.md](CHANGELOG.md).

## Funcionalidades

- Um clique no ícone abre a prévia da aba atual, já convertida.
- Prévia paginada com texto selecionável, links clicáveis, navegação e zoom.
- Ajustes de papel, orientação, margens, escala, fundos e cabeçalho/rodapé aplicados ao clicar em **Atualizar prévia**.
- **Baixar PDF** na pasta de downloads do navegador e **Salvar como…** com o diálogo nativo.
- Nome padrão `Título - AAAA-MM-DD_HH-mm-ss.pdf`, sanitizado e sem sobrescrever arquivos existentes.
- Preferências de impressão lembradas entre sessões.

## Ambiente de desenvolvimento

- Node.js 22.12+, 24.x ou 26+ (conforme `engines` do pacote), npm e Chrome estável no Windows.
- `npm ci`: instalar as dependências fixadas no lockfile.
- `npm run dev`: gerar a extensão continuamente em `dist/`.
- `npm run typecheck`: verificar tipos.
- `npm test`: executar testes unitários.
- `npm run test:e2e`: validar a extensão em Chromium com Playwright (requer `npx playwright install chromium`).
- `npm run build`: gerar a extensão em `dist/`.
- `npm run package`: gerar `webtopdf-<versão>.zip` distribuível.
- `npm run icons`: regerar os PNG a partir de `public/icons/icon.svg`.
- `npm run verify:manifest`: conferir permissões, CSP e versão do manifesto.
- `npm run check`: executar tipos, testes unitários e build.

## Instalação

**Usando a release:** baixe `webtopdf-<versão>.zip`, descompacte e carregue a pasta `webtopdf` em `chrome://extensions` → modo desenvolvedor → **Carregar sem compactação**.

**Desenvolvimento local:**

1. `npm ci && npm run build`.
2. Em `chrome://extensions`, habilite o modo desenvolvedor.
3. **Carregar sem compactação** e selecione a pasta `dist` (não o `.zip`).
4. Após rebuilds, use **Recarregar** na página de extensões.

O Chrome 155 não aceita mais `--load-extension` na linha de comando, então testes automatizados usam o Chromium empacotado do Playwright. A validação no Chrome instalado é manual: veja [o checklist de produção](docs/production-checklist.md).

## Estrutura

```text
src/background/     Orquestração da ação e conversão via chrome.debugger
src/preview/        Prévia, ajustes, download e visualização com PDF.js
src/shared/         Configurações, nomes de arquivo e contratos
public/             Manifesto MV3 e ícones
scripts/            Geração de ícones e empacotamento
tests/unit/         Testes de regras puras
tests/e2e/          Testes de fluxo real em Chromium
docs/               Especificação, arquitetura, segurança e validação
```

## Segurança e limitações

A extensão não injeta scripts nas páginas, não usa `host_permissions` e não expõe recursos a sites. Toda a biblioteca PDF é empacotada localmente, sem CDN em tempo de execução. Detalhes em [docs/security.md](docs/security.md).

Limitações conhecidas:

- A permissão `debugger` pode gerar um aviso temporário do Chrome e é bloqueada por algumas políticas corporativas.
- DevTools aberto na aba original pode interromper a conversão.
- A verificação de colisão de nome usa o histórico de downloads do Chrome; arquivos baixados por fora dele não são detectados. Use **Salvar como…** quando precisar de garantia.
- O layout de impressão do site pode diferir do exibido na tela. Conteúdo ainda não carregado por rolagem pode faltar.
- Limite inicial de 32 MB por PDF e 60 segundos por conversão.

Consulte [a especificação](docs/specification.md), [a arquitetura](docs/architecture.md), [a segurança](docs/security.md), [a validação](docs/validation.md) e [o checklist de produção](docs/production-checklist.md).

## Git e integração contínua

- `main` é a branch principal e está **protegida**: push direto é recusado e toda mudança entra por PR.
- Checks obrigatórios em `main`: `Tipos, testes unitários e build`, `Testes de fluxo em Chromium` e `Auditoria de dependências e manifesto`. O PR só pode ser integrado com os três verdes e a branch atualizada.
- Force-push, exclusão de branch, histórico não linear e conversas não resolvidas são bloqueados.
- `npm run package` gera o `.zip` distribuível; tags `v*` publicam a release com o pacote anexado.
- Trabalho em branches curtas e commits convencionais. Dados de autoria são configuração local do Git, não arquivos do produto.
