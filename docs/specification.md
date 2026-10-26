# Especificação aprovada — WEBtoPDF v1

Aprovada explicitamente pelo responsável pelo projeto nesta conversa. Esta versão substitui o fluxo anterior de salvamento automático em pasta autorizada.

## Produto

- Chrome/Chromium no Windows, inicialmente com instalação manual em modo desenvolvedor.
- Clicar no ícone abre um menu de formatos; escolher um formato disponível abre uma nova aba com processamento e prévia da aba HTTP/HTTPS original.
- O menu é movido por um registro de formatos. Cada formato é habilitado em sua própria versão; esta versão oferece **PDF**, **PNG** e **Texto**, e o próximo formato aparece desabilitado como "Em breve".
- **Conversão direta (opcional, padrão desligado)**: um interruptor no menu liga uma preferência local que faz o clique no ícone abrir a prévia do PDF já convertida, sem exibir o menu. Páginas incompatíveis abrem a prévia com o aviso, já que não há menu para exibir o erro. A mesma opção na barra lateral da prévia desliga o modo — o menu nunca fica inalcançável. O comportamento padrão do produto não muda.
- **Tema claro/escuro (prévia)**: botão no cabeçalho alterna o tema da interface, salvo em `chrome.storage.local` (padrão claro). O tema atinge somente os elementos da extensão; o documento pré-visualizado mantém fundo branco por ser a simulação da folha impressa. Popup e menu não mudam.
- **Geometria da barra lateral**: a classe da sidebar da prévia é `preview-sidebar`, não `.sidebar` — o CSS do PDF.js exporta uma `.sidebar` própria (239px, `position: relative`) que, vindo depois no bundle, espremia a coluna inteira. A grade do cartão Papel usa alturas uniformes para as oito caixas.
- O formato escolhido viaja na URL da prévia e é validado de novo no service worker antes de converter; páginas internas (`chrome://` etc.) são recusadas antes de abrir a prévia quando a URL da aba é legível.
- A própria tela contém tamanho do papel, orientação, margens, escala, fundos, cabeçalho/rodapé e nome do arquivo.
- **PNG**: captura a página inteira com a aparência da tela. Os ajustes de impressão não se aplicam — o único ajuste antes de baixar é o nome do arquivo. Páginas com mais de 16.384 pixels em qualquer dimensão são recusadas com mensagem clara, porque o compositor do Chromium não captura além desse teto.
- **Texto (`.txt`)**: extrai o texto visível da página (`innerText`, na ordem da tela), sem cabeçalho nem reestruturação, em UTF-8 com BOM para o Bloco do Windows. Os ajustes de impressão não se aplicam; a prévia mostra o texto em bloco monoespaçado e o download segue as mesmas regras de nome dos demais formatos. Página sem nenhum texto visível é recusada com mensagem clara, sem gerar arquivo vazio. Texto fora da viewport renderizada, atributos e iframes inacessíveis ficam fora da extração.
- **Tamanhos de papel**: A4, A3, A5, Carta, Legal, Tabloid, personalizado (largura e altura em milímetros) e **página inteira**.
- **Página inteira** gera uma única folha contínua cuja altura acompanha o conteúdo da página, medida pelo layout real. Margens, escala e orientação ficam fixas nesse modo. Acima de 200 polegadas, o conteúdo é paginado normalmente, o que preserva a leitura.
- **Personalizado** aceita de 20 mm a 2000 mm em cada dimensão.
- A primeira conversão é automática; ajustes só regeneram ao clicar em **Atualizar prévia**.
- PDF paginado, texto selecionável e links quando preservados pelo motor de impressão. Layout de impressão do site, não captura de tela.
- Padrões: A4, retrato, fundos habilitados e cabeçalho/rodapé desabilitado. Margens e escala usarão valores seguros documentados e validados.
- **Baixar PDF** usa o destino configurado no navegador; **Salvar como…** abre diálogo para nome e destino. Não sobrescrever automaticamente.
- Nome padrão: título sanitizado + `AAAA-MM-DD_HH-mm-ss.pdf`; resolver colisões sem sobrescrever.
- Não executar conversões concorrentes da mesma aba.
- Original deve permanecer aberta para regenerar. Se mudar, a regeneração reflete seu estado atual. Uma prévia pronta continua disponível para download se a original for fechada.
- Preferências ficam locais. PDFs ficam temporariamente em memória, sem histórico; fechar ou recarregar a prévia descarta o documento.
- Interface em português. Sem conta, backend, CDN em runtime ou telemetria.

## Fora do escopo

Edição de texto/imagens, anotações, OCR, rolagem automática, conversão em lote, aplicativo externo, publicação na loja, outros sistemas operacionais, arquivos locais e páginas internas (`chrome://`).

## Aceitação

1. A escolha do formato no menu abre prévia real utilizável sem diálogo de impressão.
2. Ajustes atualizam o documento apenas ao solicitar; download corresponde à versão exibida.
3. Download comum e Salvar como funcionam sem sobrescrita automática.
4. Preferências persistem após reabrir o navegador.
5. Tratar falhas de conversão, abas inválidas/fechadas, cliques repetidos e downloads interrompidos.
6. Liberar debugger em sucesso/falha e recursos PDF ao substituir/fechar a prévia.
7. Validar artigo longo, página com imagens e relatório com tabela, usando exemplos não confidenciais.
8. A extensão não envia conteúdo a serviços externos.
9. Cada tamanho de papel produz a proporção correspondente, e a orientação troca largura e altura.
10. Página inteira produz uma única folha contínua com a altura do conteúdo.

## Pendências técnicas (não requisitos presumidos)

- Demonstrar `Page.printToPDF` em Chrome estável Windows, sem flags especiais.
- Verificar preservação de texto/links e fidelidade nos três cenários.
- Definir limites de memória/tamanho e timeout com base em testes.
- Se a viabilidade não for demonstrada, interromper e pedir aprovação; não introduzir aplicativo auxiliar, serviço externo ou mudar o fluxo silenciosamente.
