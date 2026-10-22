# Segurança

Revisão aplicada à extensão WEBtoPDF. O objetivo é reduzir a superfície de ataque sem comprometer a conversão de páginas.

## Permissões e seu uso

| Permissão | Necessidade | Justificativa |
|---|---|---|
| `activeTab` | Ler URL e título da aba quando o usuário clica no ícone | Evita `tabs` e `host_permissions`; só vale na aba acionada |
| `debugger` | Executar `Page.printToPDF` na aba original | Exige o motor de impressão do Chrome; nenhuma alternativa local existe |
| `storage` | Persistir preferências de impressão | `chrome.storage.local`, sem sincronização em nuvem |
| `downloads` | Salvar o PDF e detectar colisões de nome | Necessário para rastrear a conclusão do download |

Não há `host_permissions`, `content_scripts`, `web_accessible_resources`, `externally_connectable`, `<all_urls>` nem acesso a cookies. A extensão **não injeta scripts nas páginas** e **não lê o conteúdo do DOM** da aba original: a conversão usa o motor de impressão do navegador.

## Content Security Policy

```text
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self' data:;
connect-src 'self';
worker-src 'self';
object-src 'none';
base-uri 'none';
form-action 'none';
frame-ancestors 'none'
```

- `script-src 'self'`: nenhum script remoto, nenhum `eval`. O Chrome rejeita a instalação se isso for afrouxado.
- `style-src 'unsafe-inline'` é necessário porque o PDF.js posiciona a camada de texto com atributos `style` inline.
- `connect-src 'self'`: a extensão não fala com servidores externos.
- `object-src 'none'` e `base-uri 'none'` bloqueiam plugins e sequestro de URL base.
- `form-action 'none'`: a página não pode enviar formulários para fora.

O PDF.js foi verificado: as versões empacotadas (`pdf.mjs` e `pdf.worker.min.mjs`) não contêm `eval(` nem `new Function(`. Toda a biblioteca, cmaps e fontes são empacotados localmente — nenhum CDN em tempo de execução.

## Proteções de código

| Risco | Mitigação |
|---|---|
| Página maliciosa enviar comandos à extensão | A porta só aceita conexões da própria página `preview.html`; `sourceTabId` e configurações são validados no service worker |
| Conversão de aba arbitrária | A porta rejeita `sourceTabId` ausente, inválido ou igual à própria aba da prévia |
| Nome de arquivo malicioso | `sanitizeTitle` remove caracteres inválidos do Windows, caracteres de controle, sequências de pontos e nomes reservados (`CON`, `NUL`, `COM1`…) |
| Nome virando caminho relativo | Um nome como `../../etc/passwd` perde as barras e os pontos duplos, virando `etc passwd` |
| Sobrescrita de arquivo | O nome livre é escolhido consultando o histórico de downloads antes de gravar |
| Vazamento de dados | Nenhum log de URL, título, conteúdo ou PDF; PDFs ficam apenas em memória na aba da prévia |
| Uso da debugger fora do escopo | A conexão é anexada apenas durante a impressão e liberada em `finally`, inclusive em erro ou cancelamento |
| Injeção via página original | O conteúdo da página nunca é interpretado pela extensão; o DOM é construído sem `innerHTML` e a URL exibida em links do PDF é validada para `http`/`https` |
| Downloads interrompidos | O resultado distingue `complete`, `interrupted` e `cancelled`, com mensagem ao usuário |
| PDF adulterado no caminho | Cada trecho declara o tamanho e o cliente confere o tamanho real, além de validar a assinatura `%PDF-` |
| Nome reservado em excesso | A reserva de nome do download é limitada a 20 entradas e só aceita requisição da própria tela de prévia |

## Geração de arquivos

O arquivo é montado inteiramente no navegador e entregue ao gerenciador de
downloads do Chrome. Nenhum byte do PDF sai do perfil do navegador.

- **Nome**: vem do campo de texto ou do título da página, passa por
  `sanitizeTitle` e recebe a extensão `.pdf`. Nomes repetidos recebem sufixo
  numérico, calculado a partir do histórico de downloads.
- **Conteúdo**: o PDF gerado pelo motor de impressão é lido em trechos de
  256 KB, conferido e montado em memória. Nada é gravado em disco além do
  arquivo final escolhido pelo usuário.
- **Blob**: a URL temporária que entrega o PDF ao Chrome é revogada assim que
  o download termina, e não antes, para não truncar o arquivo.
- **Link do PDF**: apenas `http` e `https`, com `rel="noopener noreferrer"`.
- **Memória**: o limite de 32 MB por PDF significa, no pico, o documento em
  memória, a cópia usada pela visualização e o blob do download. Documentos
  maiores devem ser divididos pelo usuário.

## Dados sensíveis

- O PDF existe apenas como `Blob` na aba da prévia e é descartado ao fechar ou recarregar a aba.
- As preferências salvas são apenas papel, orientação, margens, escala, fundos e cabeçalho/rodapé.
- Nada é enviado a servidores, não há conta, telemetria ou analytics.

## Riscos residuais

1. **`debugger` é uma permissão ampla.** Ela permite inspecionar qualquer aba, mas a extensão só anexa a aba que o usuário está convertendo e libera a conexão ao terminar. O Chrome exibe um aviso temporário ("começou a depurar este navegador") que o usuário pode cancelar.
2. **Conteúdo da página é renderizado pelo Chrome.** Se a página for maliciosa, o PDF pode conter conteúdo enganoso. Isso é inherent ao motor de impressão.
3. **Colisão de nome baseada em histórico.** A verificação de nomes existentes usa o histórico de downloads do Chrome. Um arquivo baixado fora do Chrome com o mesmo nome não é detectado e pode ser sobrescrito. Use **Salvar como…** quando precisar de garantia.
4. **Políticas corporativas** podem bloquear a extensão, a permissão `debugger` ou a impressão em PDF.
5. **O DevTools aberto na aba** pode desconectar a extensão durante a conversão; a mensagem de erro orienta o usuário a fechá-lo.

## Verificações automatizadas

- `npm test` cobre as regras puras: sanitização de nomes, resolução de nome final, seleção de nome livre, validação de preferências e de URLs.
- `npm run test:e2e` cobre o fluxo real em Chromium: impressão, prévia, navegação de páginas, ajustes, persistência e download com verificação do arquivo e da ausência de sobrescrita.
- `npm run verify:manifest` bloqueia permissões fora da lista aprovada, chaves proibidas no manifesto (`host_permissions`, `content_scripts`, `web_accessible_resources`, `externally_connectable`) e uma CSP afrouxada. O script roda no CI, no build local e pode ser usado como gate de pull request.
- A branch `main` exige os três checks do CI antes de aceitar um merge.
