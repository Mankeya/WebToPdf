# Changelog

Todas as mudanças relevantes do WEBtoPDF. O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento segue [SemVer](https://semver.org/lang/pt-BR/).

## [1.0.0] — 2026-10-21

### Adicionado

- Conversão da aba atual em PDF com um clique no ícone, usando o motor de impressão do Chrome.
- Prévia paginada com texto selecionável, links clicáveis, navegação entre páginas e zoom.
- Ajustes de papel (A4 e Carta), orientação, margens, escala, fundos e cabeçalho/rodapé, aplicados ao clicar em **Atualizar prévia**.
- Preferências de impressão lembradas entre sessões, guardadas apenas no perfil local.
- Download com **Baixar PDF** (pasta de downloads do navegador) e **Salvar como…** (diálogo nativo).
- Nome de arquivo padrão `Título - AAAA-MM-DD_HH-mm-ss.pdf`, sanitizado para o Windows e sem sobrescrever arquivos existentes.
- Ícones da extensão em 16, 32, 48 e 128 pixels.
- Integração contínua com três checks obrigatórios e portão de segurança do manifesto.
- Empacotamento automatizado e publicação de release por tag.

### Corrigido

- O Chrome ignorava o nome de arquivo na API de downloads para URLs `blob:` e substituía pelo UUID. O download passou a usar um link com o atributo `download`, que respeita o nome escolhido.
- A URL do blob era revogada antes da conclusão do download, o que podia truncar o arquivo.
- Downloads duplicados sobrescreviam o arquivo anterior; agora recebem sufixo numérico.
- O servidor de fixtures mantinha conexões abertas e travava o teardown dos testes no CI.

### Segurança

- Permissões limitadas a `activeTab`, `debugger`, `storage` e `downloads`, sem `host_permissions` nem scripts injetados nas páginas.
- CSP restrita, sem código remoto e sem `eval` na biblioteca PDF empacotada.
- `scripts/verify-manifest.mjs` bloqueia permissões não aprovadas, chaves proibidas e CSP afrouxada.
- Branch principal protegida, sem push direto, force-push ou exclusão.

### Limitações conhecidas

- A conversão usa a permissão `debugger` e pode gerar um aviso temporário do Chrome.
- DevTools aberto na aba original pode interromper a conversão.
- A detecção de colisão de nome usa o histórico de downloads do Chrome; arquivos baixados por outros meios não são detectados.
- Limite de 32 MB por PDF e 60 segundos por conversão.
- O layout de impressão do site pode diferir do exibido na tela.
- Validado apenas no Windows; outros sistemas operacionais não têm suporte.
