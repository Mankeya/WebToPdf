# Checklist de validação em produção

Testes automatizados usam o Chromium empacotado do Playwright. O Chrome instalado (155.0.8059.85) **não aceita mais `--load-extension` na linha de comando**, então a extensão precisa ser carregada manualmente e este checklist cobre o que a automação não alcança.

## Preparação

```powershell
npm ci
npm run build
npm run package
```

1. Abra `chrome://extensions`.
2. Ative o **Modo do desenvolvedor**.
3. **Carregar sem compactação** → selecione a pasta `dist` (não o `.zip`).
4. Fixe o ícone na barra.

> Para validar exatamente o que será publicado, descompacte `webtopdf-1.6.0.zip` e carregue a pasta `webtopdf` extraída. A pasta `dist` serve para iteração rápida durante o desenvolvimento.

## Resultado esperado por etapa

| # | Ação | Resultado esperado |
|---|---|---|
| 1 | Abra `https://example.com`, clique no ícone e escolha **PDF** no menu | O menu lista os formatos (PDF, PNG e Texto ativos; Markdown com **"Em breve"**) e abre nova aba com a prévia; status **"PDF pronto"** |
| 2 | Observe a barra superior durante a conversão | Chrome pode mostrar aviso temporário de depuração; some ao terminar |
| 3 | Verifique o texto | Clique e arraste sobre o PDF: o texto é selecionável |
| 4 | Verifique os links | O link do rodapé abre em nova aba |
| 5 | Navegue entre páginas | Os controles **Anterior**/**Próxima** e o campo de página funcionam |
| 6 | Altere a orientação para Paisagem e clique em **Atualizar prévia** | Status mostra ajustes pendentes antes; o PDF muda de proporção depois |
| 7 | Altere margens e escala | As alterações só entram no PDF após **Atualizar prévia** |
| 8 | Marque **Cabeçalho e rodapé** e atualize | O PDF passa a exibir data e URL do cabeçalho/rodapé |
| 9 | Clique em **Baixar PDF** | Arquivo salvo na pasta de downloads com o nome exibido e PDF válido |
| 10 | Clique em **Baixar PDF** de novo | Não sobrescreve: cria `nome (1).pdf` |
| 11 | Edite **Nome do arquivo** e clique em **Baixar PDF** | Usa o nome informado, com extensão `.pdf` |
| 12 | Clique em **Salvar como…** | Abre o diálogo nativo; confirme o nome pré-preenchido e o destino |
| 13 | Feche a aba original e tente **Atualizar prévia** | Mensagem de que a página original não está disponível; o PDF anterior continua baixável |
| 14 | Feche e reabra a prévia | Preferências de impressão preservadas; PDF descartado |
| 15 | Abra `chrome://extensions` e clique no ícone | Mensagem de página não compatível no próprio menu, sem abrir a prévia |
| 16 | Com o menu aberto, tente clicar em **Markdown** | Botão desabilitado com selo **"Em breve"**; nenhuma aba é aberta |
| 17 | Repita a conversão na mesma aba rapidamente | Sem conversões concorrentes; aviso de que a página já está sendo convertida |
| 18 | Abra o DevTools na aba original e converta | Mensagem Orientando a fechar o DevTools |
| 19 | Converta uma página com mais de 20 MB de conteúdo | Limite de 32 MB com mensagem clara |
| 20 | Escolha **PNG** no menu | Prévia mostra a imagem da página inteira; os cards de ajustes de impressão não aparecem, só o nome do arquivo |
| 21 | Clique em **Baixar PNG** de novo após o primeiro download | Não sobrescreve: cria `nome (1).png`; o arquivo baixado abre como imagem válida |
| 22 | Converta uma página com mais de 16.384 px de altura em **PNG** | Recusa com mensagem de que a página é grande demais para virar uma imagem, sugerindo PDF |
| 23 | Escolha **Texto** no menu | Prévia mostra o texto da página em bloco monoespaçado; os cards de ajustes de impressão não aparecem, só o nome do arquivo |
| 24 | Clique em **Baixar Texto** | Arquivo `.txt` salvo com o nome exibido; abrir no Bloco do Windows mostra a acentuação correta (UTF-8 com BOM) |
| 25 | Converta uma página só de imagens em **Texto** | Recusa com "Nenhum texto visível para extrair nesta página"; nenhum download é criado |
| 26 | No fim do menu, ative **Conversão direta em 1 clique** | Interruptor liga, status avisa que o próximo clique abre o PDF direto |
| 27 | Clique no ícone de novo na mesma aba | Menu não aparece; abre a prévia já com **"PDF pronto"** |
| 28 | Na prévia, desligue **Conversão direta** (cartão na barra lateral) e clique no ícone | O menu de formatos volta a abrir; a opção continua desligada ao reabrir o navegador |

## Verificações de privacidade

- Nenhuma requisição de rede para domínios externos durante a conversão (verificar em `chrome://net-export` ou pela aba Network do DevTools da própria extensão).
- O arquivo convertido não aparece no histórico de downloads com URL externa.
- Nenhum arquivo é criado no disco além do PDF, PNG ou TXT baixado.

## Verificações de segurança

- `chrome://extensions` → **Detalhes** → **Inspecionar extensão**: a CSP listada deve coincidir com `docs/security.md`.
- A extensão não deve listar "Ler e alterar seus dados em todos os sites" nem "Acesso ao histórico de downloads" além do necessário.
- `chrome://policy` da sua organização: confirmar que nenhuma política bloqueia a impressão em PDF ou a extensão sem compactação.

## Registro

Anote no README ou na issue: versão do Chrome, versão do Windows, data e o resultado de cada linha. Falhas de política ou aviso de depuração devem ser registradas como limitação conhecida, não como defeito da extensão.
