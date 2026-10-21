# Justificativa e instruções para a revisão

Material para a equipe de revisão da Chrome Web Store. Extensões com permissões
sensíveis passam por revisão manual, então a justificativa precisa responder
as perguntas antes de elas serem feitas.

## Justificativa da permissão `debugger`

> A extensão usa a permissão `debugger` exclusivamente para invocar
> `Page.printToPDF` do protocolo DevTools na aba que o usuário está convertendo.
> Esse é o único mecanismo do Chrome que produz um PDF paginado com texto
> selecionável, links e o layout de impressão do próprio site.
>
> A extensão **não injeta scripts na página**, **não lê o DOM**, **não acessa
> cookies** e **não acessa o histórico de navegação**. Ela não pede
> `host_permissions` nem `<all_urls>`, portanto não tem acesso permanente a
> nenhum site. O acesso ocorre apenas na aba que o usuário aciona, apenas
> durante a conversão, e a sessão é encerrada logo em seguida, inclusive em
> caso de erro ou cancelamento.
>
> A alternativa seria reimplementar a paginação e o motor de impressão, o que
> reduziria a qualidade do resultado e exigiria ler o conteúdo da página.

## Justificativa das demais permissões

| Permissão | Uso |
|---|---|
| `activeTab` | Ler o título da aba para nomear o arquivo e confirmar que a URL é HTTP ou HTTPS. Concedida somente quando o usuário clica no ícone. |
| `storage` | Guardar as preferências de impressão (papel, orientação, margens, escala, fundos, cabeçalho/rodapé) em `chrome.storage.local`. Nenhum dado de página é armazenado. |
| `downloads` | Gravar o PDF em disco, abrir o diálogo "Salvar como…" e verificar se já existe um arquivo com o mesmo nome para não sobrescrevê-lo. |

A extensão **não** pede: `tabs`, `host_permissions`, `content_scripts`,
`cookies`, `history`, `webRequest`, `webNavigation`, `nativeMessaging`,
`management`, `proxy`, `<all_urls>` ou `web_accessible_resources`.

## Declaração de privacidade

| Campo do painel | Resposta |
|---|---|
| Coleta de dados do usuário | Não |
| Dados compartilhados com terceiros | Não |
| Dados vendidos | Não |
| Uso para publicidade ou marketing | Não |
| Uso para fins de análise | Não |
| Uso para decisões de crédito, cuidados ou segurança | Não |
| Práticas de segurança | O código roda no ambiente isolado da extensão, sem acesso a dados além do necessário para converter a aba escolhida. |
| Declaração de todos os dados do usuário | Nenhum dado de usuário é coletado, compartilhado ou vendido. |

Justificativa da linha "Declaração de todos os dados do usuário": a extensão não coleta nenhum dado pessoal ou sensível. Ela lê o título e a URL da aba **apenas no momento da conversão**, e apenas para nomear o arquivo e validar o protocolo; nada disso é transmitido, gravado em disco ou enviado para fora do navegador.

## Declaração de prática de dados — justificativa por item

| Pergunta | Resposta |
|---|---|
| Os dados do usuário são transmitidos? | Não. Não há servidor, API ou telemetria. |
| Os dados são compartilhados com terceiros? | Não. |
| Os dados são usados para fins publicitários? | Não. |
| Os dados são usados para finalidades além do serviço? | Não. O PDF gerado existe apenas na memória da aba da prévia. |
| Os dados são criptografados em trânsito? | Não aplicável: não há transmissão. |

## Código remoto

A extensão **não** executa código remoto.

- A Content Security Policy declara `script-src 'self'`, sem `'unsafe-eval'` e sem `'unsafe-inline'` em scripts.
- Toda a biblioteca PDF (PDF.js, worker, cmaps e fontes) está empacotada dentro do `.zip` enviado à loja. Não há CDN nem chamada de rede em tempo de execução.
- O código-fonte completo, com histórico e instruções de build, está em https://github.com/Mankeya/WebToPdf

## Instruções para o revisor

1. Instale a extensão a partir do painel ou arraste o `.zip` para `chrome://extensions`.
2. Abra qualquer página HTTP ou HTTPS. Sugestões que não exigem login:
   - `https://example.com` (simples)
   - `https://en.wikipedia.org/wiki/PDF` (artigo longo, com imagens, tabelas e links)
   - `https://www.w3.org/WAI/ARIA/apg/` (tabela de referência, densa)
3. Clique no ícone **WEBtoPDF** na barra de extensões.
4. Uma nova aba abre com a prévia do PDF já gerada. Navegue entre as páginas, use o zoom e clique em um link para conferir que ele abre.
5. Ajuste a orientação para **Paisagem** e clique em **Atualizar prévia**: a proporção do PDF muda.
6. Clique em **Baixar PDF**: o arquivo é salvo na pasta de downloads com o nome `Título - data_hora.pdf`, e o PDF abre corretamente em um visualizador.
7. Clique em **Baixar PDF** de novo: um segundo arquivo é criado com o sufixo `(1)`, sem sobrescrever o primeiro.
8. Clique em **Salvar como…**: o diálogo nativo do Chrome abre, com o nome já preenchido.

Durante a conversão, o Chrome exibe o aviso temporário de que a extensão iniciou a
depuração do navegador. Isso é esperado: é o aviso padrão do Chrome para a
permissão `debugger` e desaparece quando a conversão termina.

## Perguntas que o revisor pode fazer

**"Por que a extensão precisa da permissão `debugger` e não pode usar
`window.print()`?"**
Porque `window.print()` abre o diálogo de impressão do sistema, que não pode
ser automatizado nem devolvido à extensão. `Page.printToPDF` devolve o arquivo
pronto, sem interface, e é a mesma base de código usada pelo próprio
"Imprimir em PDF" do Chrome.

**"A extensão acessa o conteúdo das páginas?"**
Não. Ela não injeta scripts, não lê o DOM e não pede acesso a hosts. O
conteúdo é renderizado pelo motor de impressão do próprio Chrome, que já trata
a página como conteúdo confiável do ponto de vista do usuário.

**"Os dados ficam armazenados?"**
Somente as preferências de impressão, em `chrome.storage.local`. O PDF fica na
memória da aba da prévia e é descartado quando a aba é fechada ou recarregada.
