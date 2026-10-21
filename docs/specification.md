# Especificação aprovada — WEBtoPDF v1

Aprovada explicitamente pelo responsável pelo projeto nesta conversa. Esta versão substitui o fluxo anterior de salvamento automático em pasta autorizada.

## Produto

- Chrome/Chromium no Windows, inicialmente com instalação manual em modo desenvolvedor.
- Um clique no ícone abre uma nova aba com processamento e prévia da aba HTTP/HTTPS original.
- A própria tela contém tamanho do papel, orientação, margens, escala, fundos, cabeçalho/rodapé e nome do arquivo.
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

1. Clique abre prévia real utilizável sem diálogo de impressão.
2. Ajustes atualizam o documento apenas ao solicitar; download corresponde à versão exibida.
3. Download comum e Salvar como funcionam sem sobrescrita automática.
4. Preferências persistem após reabrir o navegador.
5. Tratar falhas de conversão, abas inválidas/fechadas, cliques repetidos e downloads interrompidos.
6. Liberar debugger em sucesso/falha e recursos PDF ao substituir/fechar a prévia.
7. Validar artigo longo, página com imagens e relatório com tabela, usando exemplos não confidenciais.
8. A extensão não envia conteúdo a serviços externos.

## Pendências técnicas (não requisitos presumidos)

- Demonstrar `Page.printToPDF` em Chrome estável Windows, sem flags especiais.
- Verificar preservação de texto/links e fidelidade nos três cenários.
- Definir limites de memória/tamanho e timeout com base em testes.
- Se a viabilidade não for demonstrada, interromper e pedir aprovação; não introduzir aplicativo auxiliar, serviço externo ou mudar o fluxo silenciosamente.
