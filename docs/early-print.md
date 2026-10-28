# Especificação — Impressão antecipada do menu (v1.8.0)

## Objetivo

O PDF gerado a partir do menu (formato "PDF") precisa conter a página como o usuário a está vendo — incluindo menus e painéis abertos — para serviços como o Tareffa aceitarem o arquivo. O caminho escolhido é gerar o PDF com `Page.printToPDF` (candidato técnico: a análise estrutural da referência é compatível com Chrome print + cabeçalho/rodapé, mas o método exato da referência não foi comprovado). Screenshot + OCR foi descartado: num teste real com o portal, o OCR de uma captura de 1920×1080 levou ~63 s contra o timeout de 15 s do serviço, e o fallback virava PDF só de imagem.

## F1 — Impressão antecipada com cache de uso único

Quando o popup abre, a página de origem ainda tem foco. Nesse instante:

1. `public/early-print.js` (script clássico bloqueante no `<head>` do popup, antes do bundle — mesmo padrão do `early-capture.js`) pede ao service worker, por mensagem `early-print`, que imprima a aba ativa.
2. O worker imprime com as **configurações salvas** (`printSettings` do storage — as mesmas que a prévia carrega) via `printTabToPdfBase64`, os mesmos parâmetros de papel do fluxo normal (`buildPrintCommand`), mídia emulada `screen`.
3. O PDF fica em RAM (`EarlyPrintCache`), com as regras:
   - **Uso único**: a primeira conversão consome a entrada; "Atualizar prévia" sempre reimprime ao vivo.
   - **Uma entrada por aba**; reimprimir substitui a anterior.
   - **Amarrada à URL** lida no momento da impressão e **às configurações** usadas (igualdade estrutural). Qualquer divergência descarta e a conversão reimprime ao vivo.
   - **Expira em 60 s**; navegação ou fechamento da aba descarta na hora (`tabs.onUpdated`/`onRemoved`).
   - **Teto de memória** de 32 MB no total; para caber, as entradas mais antigas saem primeiro. Nada persiste em disco ou storage.
   - **Falha nunca bloqueia**: sem cache, o menu e a conversão seguem exatamente como antes.
4. A conversão do formato PDF (`convertTabToPdfWithEarlyPrint`) espera uma impressão em voo, tenta consumir o cache e, se não casar, reimprime ao vivo pelo fluxo normal. PNG e TXT abortam e aguardam a impressão em voo (`settleEarlyPrint`) — para eles o PDF antecipado não serve e a sessão do debugger precisa ficar livre.

**Limite honesto**: F1 vence menus de fechamento atrasado (evidência: a captura antecipada do "PDF da tela" já registrava o menu aberto no portal real). Para um fechamento estritamente síncrono no `blur`, a corrida só é mensurável no portal real — o harness de automação desta máquina não entrega perda de foco de janela (verificado com `bringToFront`, minimização via `windows.update` e roubo de foreground via Win32: `document.hasFocus()` permanece `true`). Para esse caso existe o F4.

## F2 — Guarda de blur: removida (decisão)

Uma guarda instalada no `document_start` do popup só poderia ser registrada **depois** do popup já ter roubado o foco — tarde demais para um fechamento síncrono (o estado sumiu antes da instalação) e inútil nos demais casos, que já sobrevivem sem ela. Reabrir menus ou bloquear eventos da página foi descartado por princípio: sem necessidade demonstrada, sem restauração segura.

## F3 — A4 + cabeçalho/rodapé pelos controles existentes

A referência é A4 retrato com rodapé (data, título, URL, paginação). Isso já é atingido pelo caminho normal: `Page.printToPDF` com `displayHeaderFooter: true` e papel A4 nas configurações de impressão da prévia. Nada de novo foi implementado além de manter o fluxo.

## F4 — Atalho "PDF agora" (Ctrl+Shift+P)

Novo comando `print-pdf-now` no manifesto (nenhuma permissão nova): dispara a impressão antecipada **com a página em foco** (sem popup, sem corrida) e abre a prévia em seguida, pronta, consumindo o PDF guardado. É o caminho determinístico para menus que fecham síncrono no blur.

## PoC e evidências

- PoC com popup real (`chrome.windows.create` focused) e menu que fecha dentro do próprio handler de `blur`: o caminho F1 produziu PDF com o texto do menu em ~250 ms; o caminho do atalho (B) preserva o menu por construção, sem popup.
- Experimento com `blur` disparado: `Page.printToPDF` reflete o DOM no instante do comando — menu presente com ele aberto, ausente depois do `blur`, presente com preparação antecipada.

## Aceitação final

1. Comparação estrutural do PDF gerado com o arquivo de referência (pdf.js: fontes, camadas de texto, rodapé).
2. Teste manual no Tareffa com o portal real.

## Diferenças conhecidas da referência

- O formato da data do rodapé segue o locale da máquina (`10/26/2026, 04:59 PM` na referência).
- As margens exatas da referência são desconhecidas; usamos as configurações da prévia (A4, margem 10 mm por padrão).
- A corrida do F1 só é mensurável no portal real; para fechamento síncrono, usar Ctrl+Shift+P.
