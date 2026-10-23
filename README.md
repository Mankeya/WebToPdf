<p align="center">
  <img src="public/icons/icon-128.png" alt="WEBtoPDF" width="96" height="96">
</p>

<h1 align="center">WEBtoPDF</h1>

<p align="center">
  Converte a aba que você está vendo em PDF ou PNG, com prévia antes de salvar.<br>
  Tudo acontece no seu computador — nada é enviado para servidores.
</p>

<p align="center">
  <sub>Versão 1.4.0 · <a href="CHANGELOG.md">novidades</a> · <a href="https://github.com/Mankeya/WebToPdf/releases/tag/v1.4.0">download</a></sub>
</p>

<p align="center">
  <a href="#instalação">Instalar</a> •
  <a href="#como-usar">Como usar</a> •
  <a href="#recursos">Recursos</a> •
  <a href="#novidades">Novidades</a> •
  <a href="#privacidade">Privacidade</a> •
  <a href="#desenvolvimento">Desenvolvimento</a>
</p>

<p align="center">
  <img src="store/screenshots/01-previa.png" alt="Prévia do PDF no WEBtoPDF" width="840">
</p>

---

## O que é

Clicar no ícone do WEBtoPDF abre um **menu de formatos**. Escolher **PDF** ou **PNG** abre a prévia da página atual, **já convertida**. Você revisa o resultado e só então salva o arquivo — no PDF dá para ajustar a impressão antes. Texto e Markdown chegam nas próximas versões — um formato por versão, cada um testado antes de entrar.

O PDF usa o motor de impressão do próprio Chrome: sai **paginado**, com **texto selecionável** e **links clicáveis**, respeitando o layout de impressão do site.

## Recursos

| Recurso | Detalhe |
|---|---|
| **Menu de formatos** | Um clique no ícone abre o menu; PDF e PNG já estão disponíveis e os próximos formatos chegam um por versão |
| **PDF paginado** | Motor de impressão do Chrome, com texto selecionável e links clicáveis |
| **PNG da página inteira** | Captura a página toda com a aparência da tela, em uma única imagem |
| **Prévia imediata** | A aba atual já aparece convertida ao abrir a tela |
| **Página por página** | Navegação, campo de página e zoom de 50% a 200% |
| **Texto e links** | Camada de texto selecionável e links clicáveis |
| **Tamanhos de papel** | A4, A3, A5, Carta, Legal, Tabloid, sob medida e **página inteira** |
| **Página inteira** | Uma única folha contínua com a altura do conteúdo, sem paginação |
| **Ajustes de impressão** | Orientação, margens, escala, fundos e cabeçalho/rodapé |
| **Atualização sob demanda** | As alterações só entram no PDF ao clicar em **Atualizar prévia** |
| **Nome automático** | `Título da página - AAAA-MM-DD_HH-mm-ss.pdf` (ou `.png`), sanitizado para o Windows |
| **Nunca sobrescreve** | Nomes repetidos recebem sufixo, como `relatório (1).pdf` |
| **Duas formas de salvar** | **Baixar** na pasta do navegador e **Salvar como…** com o diálogo nativo |
| **Preferências lembradas** | Suas últimas opções de impressão sobrevivem ao reinício do navegador |
| **Interface em português** | Toda a extensão, do botão ao mensaje de erro |

<!-- novidades -->

### v1.4.0 — 23/10/2026

- PNG no menu de formatos: salve a página inteira como imagem, com a aparência exata da tela.
- O nome do arquivo acompanha o formato escolhido, com `.png` para imagens.

### v1.3.0 — 23/10/2026

- Menu de formatos ao clicar no ícone: escolha o formato da conversão — o PDF já está disponível e os próximos formatos chegam versão a versão.

### v1.2.0 — 22/10/2026

- Páginas em modo escuro agora saem no PDF exatamente como aparecem na tela.
- Cada atualização já vira release no GitHub, com o pacote para baixar e as novidades no README.
- Mais tamanhos de papel, página inteira contínua e visual renovado na prévia.

<!-- /novidades -->

## Instalação

> Requisito: **Chrome 116 ou superior**, no Windows.

1. Baixe o pacote da [página de releases](https://github.com/Mankeya/WebToPdf/releases).
2. Descompacte o `.zip`.
3. Abra `chrome://extensions`, ative o **Modo do desenvolvedor** e escolha **Carregar sem compactação**.
4. Selecione a pasta `webtopdf` extraída e fixe o ícone na barra de extensões.

Para instalar sem modo desenvolvedor, é preciso publicar na Chrome Web Store. O material da publicação está em [`store/`](store/listing.md) e o guia de distribuição em [`docs/distribution.md`](docs/distribution.md).

## Como usar

1. Abra qualquer página HTTP ou HTTPS.
2. Clique no ícone **WEBtoPDF**.
3. No menu de formatos, escolha **PDF** ou **PNG**. Os próximos formatos aparecem desabilitados, com o selo **Em breve**.
4. Uma nova aba abre com a prévia.
5. Em **PDF**, ajuste as opções de impressão e clique em **Atualizar prévia**, se quiser. Em **página inteira**, o PDF vira uma única folha contínua com a altura do conteúdo; sites que definem quebras de página no CSS de impressão continuam sendo divididos — o Chrome respeita a intenção do autor. Em **PNG**, a captura é sempre a página inteira e o único ajuste é o nome do arquivo.
6. Clique em **Baixar PDF** (ou **Baixar PNG**) ou **Salvar como…**.

A aba original precisa continuar aberta enquanto você ajusta e regenera o documento. Se ela for fechada, a prévia já pronta continua disponível para download.

## Privacidade

O WEBtoPDF **não envia nada para fora do seu computador**.

- Sem servidores, sem conta, sem telemetria, sem publicidade, sem análise de uso.
- A extensão **não injeta scripts** nas páginas e **não lê o conteúdo** dos sites: a conversão usa o motor de impressão do Chrome, que já trata a página como conteúdo confiável.
- Sem acesso a cookies, histórico de navegação ou lista de permissões de sites.
- Os únicos dados guardados são as suas **preferências de impressão**, no perfil local do navegador.
- O PDF fica **apenas na memória** da aba da prévia e é descartado ao fechar ou recarregar a aba.

A extensão pede quatro permissões, todas com uso restrito e verificável:

| Permissão | Para quê |
|---|---|
| `activeTab` | Ler URL e título da aba acionada (validação no menu e nome do arquivo) |
| `debugger` | Usar o motor de impressão do Chrome (`Page.printToPDF`) |
| `storage` | Lembrar as preferências de impressão |
| `downloads` | Gravar o PDF e evitar sobrescrita de arquivos |

Detalhes completos em [`docs/security.md`](docs/security.md) e [`SECURITY.md`](SECURITY.md).

## Limitações conhecidas

- O Chrome exibe um aviso temporário ao iniciar a impressão; ele desaparece quando a conversão termina.
- O DevTools aberto na aba original pode interromper a conversão.
- O layout de impressão do site pode diferir do que você vê na tela.
- Conteúdo que ainda não carregou por rolagem pode não aparecer.
- Documentos acima de **32 MB** ou conversões acima de **60 segundos** são recusados com mensagem clara.
- A detecção de nomes repetidos usa o histórico de downloads do Chrome; arquivos baixados por outros meios não são detectados. Use **Salvar como…** quando precisar de garantia.

## Desenvolvimento

```bash
npm ci            # instala as dependências fixadas no lockfile
npm run dev       # gera a extensão continuamente em dist/
npm run check     # tipos, testes unitários e build
npm run test:e2e  # testes de fluxo real em Chromium
```

| Script | O que faz |
|---|---|
| `npm run dev` | Build contínuo em `dist/` |
| `npm run build` | Gera a extensão em `dist/` |
| `npm run package` | Gera `webtopdf-<versão>.zip` |
| `npm run package:store` | Gera o pacote sem minificação, para a Chrome Web Store |
| `npm run publish:store` | Envia o pacote à loja e submete à revisão |
| `npm run test` | Testes unitários (Vitest) |
| `npm run test:e2e` | Testes de ponta a ponta com a extensão real (Playwright) |
| `npm run typecheck` | Verificação de tipos |
| `npm run icons` | Regenera os ícones a partir da marca |
| `npm run brand:extract` | Extrai as peças de marca da folha oficial |
| `npm run store:screenshots` | Gera as capturas para a Chrome Web Store |
| `npm run verify:manifest` | Confere permissões, CSP e versão do manifesto |
| `npm run verify:workspace` | Garante que não há artefatos órfãos na raiz |
| `npm run release:prepare` | Sobe a versão e fecha CHANGELOG e README para o próximo merge |
| `npm run release:check` | Confere se a release está pronta (o CI usa o mesmo script) |

### Estrutura

```text
src/background/     Conversão via chrome.debugger e validação no service worker
src/popup/          Menu de formatos aberto pelo ícone
src/preview/        Prévia, ajustes, download e visualização com PDF.js
src/shared/         Configurações, formatos, nomes de arquivo e contratos
src/styles/         Tokens da marca compartilhados entre telas
public/             Manifesto MV3, ícones e marca
scripts/            Ícones, empacotamento, capturas e verificações
tests/unit/         Testes de regras puras
tests/e2e/          Testes de fluxo real
docs/               Especificação, arquitetura, segurança e validação
```

### Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/specification.md`](docs/specification.md) | Escopo aprovado e critérios de aceitação |
| [`docs/architecture.md`](docs/architecture.md) | Decisões técnicas e Trade-offs |
| [`docs/security.md`](docs/security.md) | Permissões, CSP, riscos residuais |
| [`docs/validation.md`](docs/validation.md) | O que é validado e como |
| [`docs/production-checklist.md`](docs/production-checklist.md) | Checklist manual de aceitação |
| [`docs/distribution.md`](docs/distribution.md) | Caminhos de distribuição |
| [`CHANGELOG.md`](CHANGELOG.md) | Histórico de versões |

## Contribuição

Branches curtas, commits convencionais e integração por PR. A branch principal é protegida: toda mudança passa pelos checks de integração contínua.

**Cada merge publica uma versão.** Antes de abrir o PR, prepare a release:

```bash
npm run release:prepare -- minor -- "o que mudou para o usuário"
```

O incremento segue o commit convencional: `feat` → minor, `fix` → patch, mudança incompatível → major. O CI bloqueia o merge se a versão, o CHANGELOG ou o README não estiverem prontos; ao integrar, a tag e a release são publicadas automaticamente com o `.zip`.

```bash
git switch -c feat/minha-mudanca
# ... código, testes e documentação
npm run release:prepare -- minor -- "destaque da mudança"
git commit -m "feat: descrição da mudança"
git push -u origin feat/minha-mudanca
```

Abra o PR pelo link exibido após o push. O modelo de pull request está em [`.github/pull_request_template.md`](.github/pull_request_template.md).

## Licença

Este repositório ainda não tem uma licença definida. A escolha é do responsável pelo projeto e precisa ser tomada antes de qualquer distribuição pública.

---

<p align="center">
  Feito com o motor de impressão do Chrome. <strong>Processamento 100% local.</strong>
</p>
