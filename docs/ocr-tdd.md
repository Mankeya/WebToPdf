# Evidências — OCR local

Origem: entrevista e `docs/ocr-spec.md`, aprovadas na conversa.

## RED → GREEN

- `npm test -- tests/unit/ocr-pdf.test.ts`: RED, overlay usava `1 Tr` (texto visível). Corrigido para `3 Tr`.
- `npx playwright test tests/e2e/screen-pdf.spec.ts --grep "OCR local"`: RED com OCR real offline, `Razão` extraído como `RazÃ£o`. Corrigido com codificação hexadecimal WinAnsi; execução E2E posterior aprovada.
- `npm run check`: 171 testes unitários aprovados, tipos e build aprovados.
- `npm run test:e2e`: 39 testes aprovados na execução inicial com OCR, incluindo reconhecimento offline real de CNPJ e acentos. Teste integrado adicional de captura até prévia aprovado isoladamente; suíte final será executada antes da entrega.

## Garantias e lacunas

| Garantia | Evidência |
|---|---|
| Texto OCR invisível | `tests/unit/ocr-pdf.test.ts` |
| Resultado e fallback transportados, documento liberado | `tests/unit/snapshots.test.ts` |
| Reconhecimento real offline e acentos extraíveis | `tests/e2e/screen-pdf.spec.ts` |
| Captura até prévia com OCR real | mesmo arquivo, teste `captura guardada` |

Sem medição de cobertura nesta execução. Atalho físico e aceitação pelo Tareffa continuam manuais. Testes não provam precisão para todo documento nem preservação da ordem de tabelas complexas.
