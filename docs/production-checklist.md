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

> Para validar exatamente o que será publicado, descompacte `webtopdf-1.0.0.zip` e carregue a pasta `webtopdf` extraída. A pasta `dist` serve para iteração rápida durante o desenvolvimento.

## Resultado esperado por etapa

| # | Ação | Resultado esperado |
|---|---|---|
| 1 | Abra `https://example.com` e clique no ícone | Abre nova aba com a prévia; status **"PDF pronto"** |
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
| 15 | Abra `chrome://extensions` e clique no ícone em `chrome://extensions` | Mensagem de página não compatível, sem conversão |
| 16 | Repita a conversão na mesma aba rapidamente | Sem conversões concorrentes; aviso de que a página já está sendo convertida |
| 17 | Abra o DevTools na aba original e converta | Mensagem Orientando a fechar o DevTools |
| 18 | Converta uma página com mais de 20 MB de conteúdo | Limite de 32 MB com mensagem clara |

## Verificações de privacidade

- Nenhuma requisição de rede para domínios externos durante a conversão (verificar em `chrome://net-export` ou pela aba Network do DevTools da própria extensão).
- O PDF não aparece no histórico de downloads com URL externa.
- Nenhum arquivo é criado no disco além do PDF baixado.

## Verificações de segurança

- `chrome://extensions` → **Detalhes** → **Inspecionar extensão**: a CSP listada deve coincidir com `docs/security.md`.
- A extensão não deve listar "Ler e alterar seus dados em todos os sites" nem "Acesso ao histórico de downloads" além do necessário.
- `chrome://policy` da sua organização: confirmar que nenhuma política bloqueia a impressão em PDF ou a extensão sem compactação.

## Registro

Anote no README ou na issue: versão do Chrome, versão do Windows, data e o resultado de cada linha. Falhas de política ou aviso de depuração devem ser registradas como limitação conhecida, não como defeito da extensão.
