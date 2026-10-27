# OCR local no PDF da tela

## Escopo aprovado

- OCR automático na área visível capturada pelo menu ou por `Ctrl+Shift+S`.
- Preservar o JPEG original e acrescentar texto invisível selecionável.
- Processamento local; nenhuma requisição externa em tempo de execução.
- Em falha, ausência de texto ou limite de 15 segundos, manter o PDF de imagem e apresentar aviso persistente. PDF normal inalterado.
- Compatibilidade com o Tareffa depende de validação manual; não é garantida pelo texto selecionável.

## Implementação

1. `snapshots.ts` serializa trabalhos de OCR e cria `offscreen.html` sob demanda, com a permissão `offscreen` aprovada.
2. O documento valida origem do service worker e usa mensagens internas com resposta assíncrona (`runtime.onMessage`), não mensagens externas.
3. Tesseract.js 5 reconhece português e inglês. Worker, motor WASM e modelos estão incluídos no ZIP. Não há downloads na primeira conversão nem cache de imagens/modelos em IndexedDB (`cacheMethod: none`).
4. `image-pdf.ts` preserva os bytes JPEG e insere palavras em renderização invisível (`3 Tr`), com coordenadas convertidas para pontos PDF e texto WinAnsi hexadecimal. Acentos portugueses e pontuação CP1252 são preservados. Caracteres fora dessa codificação acionam o fallback; suporte Unicode completo é uma limitação conhecida.
5. O resultado transporta `ocrFailed` pela porta de conversão até a prévia. O aviso permanece visível mesmo após baixar.
6. O documento isolado é fechado ao concluir, falhar, cancelar ou expirar o trabalho, liberando worker, imagem e texto. Trabalhos concorrentes são serializados.

## Ajustes técnicos à proposta inicial

- Modelos e código precisam estar empacotados para cumprir processamento offline e regras MV3; `import()` não substitui essa distribuição. Recursos OCR somam aproximadamente 24,6 MB descompactados, além dos recursos existentes.
- WASM requer `script-src 'self' 'wasm-unsafe-eval'`. Isso não habilita `eval` JavaScript. Workers usam arquivos locais com `workerBlobURL: false`, dispensando a ampliação proposta de `worker-src` para `blob:`. `connect-src` permanece `'self'`.
- Liberação imediata do documento após cada trabalho, em vez de mantê-lo por 30 segundos, reduz retenção de dados sensíveis.
- Tempos e precisão variam por máquina e imagem; não há promessa de percentual fixo de crescimento do PDF nem aceitação pelo Tareffa.

## Plano de validação

- Unitários: texto invisível, conversão OCR, fallback sinalizado e liberação do documento.
- E2E offline: OCR real de razão social e CNPJ e extração no PDF.js com acentos preservados.
- Integração no Chromium: captura guardada → service worker → documento OCR → PDF → prévia selecionável. O teste simula apenas metadados liberados por `activeTab`, pois Playwright não aciona o ícone real.
- Manuais: atalho com menu aberto no Portal do Empregador; conferir nomes/CNPJ; enviar ao Tareffa. Não acessar o portal corporativo pela automação.

## Riscos

OCR pode errar ou omitir palavras, números e ordem de leitura. O usuário deve revisar os dados, principalmente CNPJ. O reconhecimento cobre somente a captura visível, não conteúdo fora da tela. Limites gerais de 32 MB e 60 segundos permanecem.
