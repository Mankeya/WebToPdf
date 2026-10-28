# Evidências — OCR local

Origem: entrevista e `docs/ocr-spec.md`, aprovadas na conversa.

## RED → GREEN — v1.7.0

- `npm test -- tests/unit/ocr-pdf.test.ts`: RED, overlay usava `1 Tr` (texto visível). Corrigido para `3 Tr`.
- `npx playwright test tests/e2e/screen-pdf.spec.ts --grep "OCR local"`: RED com OCR real offline, `Razão` extraído como `RazÃ£o`. Corrigido com codificação hexadecimal WinAnsi; execução E2E posterior aprovada.
- `npm run check`: 171 testes unitários aprovados, tipos e build aprovados.
- `npm run test:e2e`: 39 testes aprovados na execução inicial com OCR, incluindo reconhecimento offline real de CNPJ e acentos. Teste integrado adicional de captura até prévia aprovado isoladamente.

> Descoberta na revisão de v1.7.1: o teste `OCR local reconhece captura offline...`
> foi perdido em um `stash`/`stash pop` durante a recuperação da branch e o PR #23
> foi entregue sem ele, embora `docs/ocr-tdd.md` o citasse. Restaurado do commit
> `a627f7a` e coberto por asserções de empacotamento (ver abaixo).

## RED → GREEN — v1.7.1 (fix CSP + hardening)

- `npx playwright test tests/e2e/screen-pdf.spec.ts --grep "OCR local"`: RED — `dist/ocr` ainda continha a build SINGLE_FILE `tesseract-core-lstm.wasm.js` (fetch de data URL viola `connect-src 'self'`, origem dos erros de política no console). Corrigido com a build separada (glue `.js` + `.wasm`); GREEN com OCR real offline completo (CNPJ + acentos) e asserções `dist/ocr`.
- `npx vitest run tests/unit/snapshots.test.ts tests/unit/ocr-pdf.test.ts`: RED nos dois hardening — (a) pedido único de OCR morria com `Receiving end does not exist` (1 chamada, `ocrFailed: true`); (b) caractere `ﬁ` fora de WinAnsi lançava exceção e anulava o OCR inteiro. GREEN após a nova tentativa única (300 ms) e a descarte por palavra.
- `npm run check`: 174 testes unitários aprovados, tipos e build aprovados.
- `npx playwright test`: 40 testes aprovados (39 + offline restaurado).
- `npm run verify:manifest`: 5 permissões, CSP restrita.

## Garantias e lacunas

| Garantia | Evidência |
|---|---|
| Texto OCR invisível | `tests/unit/ocr-pdf.test.ts` |
| Palavra com caractere raro não anula as demais; total sem palavras aciona fallback | mesmo arquivo |
| Resultado, fallback, retry de inicialização e liberação do documento | `tests/unit/snapshots.test.ts` |
| Reconhecimento real offline e acentos extraíveis | `tests/e2e/screen-pdf.spec.ts` (offline) |
| Empacotamento do core sem data URL (CSP) | mesmo arquivo, asserções `dist/ocr` |
| Captura até prévia com OCR real | mesmo arquivo, teste `captura guardada` |

Sem medição de cobertura nesta execução. Atalho físico e aceitação pelo Tareffa continuam manuais. Testes não provam precisão para todo documento nem preservação da ordem de tabelas complexas.
