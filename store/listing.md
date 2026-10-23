# Listagem da Chrome Web Store

Textos prontos para o painel do desenvolvedor. Os campos do painel têm limite de tamanho; o material abaixo já respeita.

## Nome

```
WEBtoPDF — Converter página em PDF
```

Até 45 caracteres. O sufixo explica a função sem repetir a marca.

## Descrição curta

Até 132 caracteres:

```
Converte a página atual em PDF, PNG ou .txt, com prévia. Ajustes de impressão. Processamento local, sem envio de dados a servidores.
```

(132 caracteres)

## Descrição detalhada

```markdown
WEBtoPDF transforma a aba que você está vendo em um PDF, em uma imagem da
página inteira ou em um arquivo de texto, com prévia antes de salvar.

Clicar no ícone abre o menu de formatos. Escolhendo PDF, PNG ou Texto, a prévia
da página atual abre já convertida. Você revisa o resultado e só então baixa o
arquivo. Novos formatos de conversão serão adicionados versão a versão.

**No PDF, você pode ajustar**

- Tamanho do papel (A4 ou Carta)
- Orientação (retrato ou paisagem)
- Margens
- Escala
- Impressão de fundos
- Cabeçalho e rodapé

As alterações só entram no PDF quando você clica em **Atualizar prévia**, então
você sempre vê exatamente o que vai ser salvo. O PNG é sempre a página inteira,
com a aparência da tela. O Texto é o que está visível na página, gravado em
UTF-8 com BOM para abrir com a acentuação certa no Bloco do Windows.

**Destaques**

- Prévia paginada do PDF com navegação e zoom
- Texto selecionável e links clicáveis, como em qualquer PDF
- PNG da página inteira em uma única imagem
- Texto da página em um arquivo `.txt`, pronto para editar
- Nome de arquivo automático com data e hora, sanitizado para o Windows
- Nunca sobrescreve um arquivo existente
- Botão **Salvar como…** para escolher o destino
- Lembra suas preferências de impressão entre sessões

**Privacidade**

Todo o processamento acontece no seu computador. A extensão não envia páginas,
URLs, títulos ou arquivos convertidos para servidores. Não há conta, telemetria,
publicidade nem análise de uso. As únicas informações guardadas são as suas
preferências de impressão, no perfil local do navegador.

**Requisitos**

- Chrome ou Chromium 116 ou superior, no Windows
- Ao converter, o Chrome pode exibir um aviso temporário de que a extensão
  iniciou a depuração do navegador. É o mecanismo nativo de impressão do
  Chrome e o aviso desaparece quando a conversão termina.

**Limitações conhecidas**

- A conversão usa o layout de impressão do site, que pode diferir do que você
  vê na tela.
- Conteúdo que ainda não carregou por rolagem pode não aparecer.
- Documentos acima de 32 MB ou conversões acima de 60 segundos são recusados
  com uma mensagem clara.
- Inicialmente validado apenas no Windows.
```

## Categoria

```
Productivity
```

Ferramentas de productividad são a categoria mais adequada para conversão de
documentos. Alternativas: `Workflow & Planning`, `Office Suite`.

## Idioma

```
Português (Brasil)
```
Habilitar "English" também, se a descrição em inglês for preenchida.

## Palavras-chave

```
pdf, converter página em pdf, salvar página como pdf, imprimir pdf, pdf de
web, extrator de pdf, preview de pdf, web to pdf
```

## Imagens

| Item | Formato | Tamanho | Situação |
|---|---|---|---|
| Ícone do item | PNG | 128×128 | `public/icons/icon-128.png` |
| Captura 1 | PNG/JPEG | 1280×800 | `store/screenshots/01-previa.png` |
| Captura 2 | PNG/JPEG | 1280×800 | `store/screenshots/02-ajustes.png` |
| Captura 3 | PNG/JPEG | 1280×800 | `store/screenshots/03-paginas.png` |
| Captura 4 | PNG/JPEG | 1280×800 | `store/screenshots/04-nome-arquivo.png` |

Geradas por `npm run store:screenshots`. O painel aceita até 5 capturas.

Peça opcional:

| Item | Tamanho |
|---|---|
| Bloco pequeno de promoção | 440×280 |
| Bloco grande de promoção | 920×460 |
