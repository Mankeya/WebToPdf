## Descrição

<!-- O que muda e por quê. -->

## Tipo de mudança

- [ ] Correção de defeito
- [ ] Funcionalidade nova
- [ ] Documentação
- [ ] Manutenção

## Escopo aprovado

<!-- Confirme que a mudança está dentro da especificação em docs/specification.md. -->
- [ ] A mudança está coberta pela especificação aprovada
- [ ] A mudança exige decisão nova do responsável (descreva abaixo)

## Testes

- [ ] `npm run check` aprovado
- [ ] `npm run test:e2e` aprovado
- [ ] Validação manual relevante executada (descreva abaixo)

## Segurança

- [ ] Nenhuma permissão nova no manifesto, ou a nova permissão foi justificada e aprovada
- [ ] A CSP não foi afrouxada
- [ ] Nenhum dado de página, PDF ou credencial é registrado ou versionado
- [ ] `node scripts/verify-manifest.mjs` aprovado

## Release

<!-- Todo merge publica uma nova versão. Prepare antes de abrir o PR. -->

- [ ] `npm run release:prepare -- <major|minor|patch> -- "destaque"` executado
- [ ] O incremento segue o tipo do commit (`feat` → minor, `fix` → patch, incompatível → major)
- [ ] Os destaques no README descrevem a mudança para o usuário final, sem jargão técnico
- [ ] `npm run release:check -- --base origin/main` aprovado

## Revisão

- [ ] Revisei o próprio diff antes de abrir o PR
- [ ] Atualizei a documentação quando o comportamento mudou

## Observações

<!-- Riscos conhecidos, limitações ou itens que exigem validação manual. -->
