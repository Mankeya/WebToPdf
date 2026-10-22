# Marca

Assets de marca extraídos da folha oficial (`folha-de-marca.png`) e usados pelo produto.

## Origem

| Arquivo | Descrição |
|---|---|
| `folha-de-marca.png` | Folha de marca original, recebida do designer. É a fonte de verdade: não edite os arquivos extraídos à mão, regenere com `npm run brand:extract`. |

## Extração

```bash
npm run brand:extract
```

O script recorta a folha nas coordenadas de cada peça e descarta o fundo pelo
saturacão da marca (vermelho e azul) e, nos painéis escuros, pelo brilho do
texto branco. As coordenadas estão em `scripts/extract-brand.mjs`.

## Peças extraídas

| Arquivo | Uso |
|---|---|
| `logo-horizontal-claro.png` | Cabeçalho da tela de prévia e README |
| `logo-horizontal-escuro.png` | Fundo escuro, para peças institucionais |
| `logo-vertical-claro.png` / `logo-vertical-escuro.png` | Lockup vertical |
| `wordmark-claro.png` / `wordmark-escuro.png` / `wordmark-monocromatico.png` | Wordmarks |
| `icone-512.png` | Ícone de origem para a extensão e a loja |
| `icone-256.png` / `icone-128.png` | Variantes do ícone |
| `favicon-32.png` / `favicon-16.png` | Variantes de tela pequena |

## Ícones da extensão

```bash
npm run icons
```

Gera `public/icons/icon-16.png`, `icon-32.png`, `icon-48.png` e `icon-128.png` a
partir de `icone-512.png`. O fundo da folha é removido por preenchimento a
partir das bordas, o que preserva o branco interno do documento PDF.

As peças de 16 e 32 px da folha são pequenas demais para reamostrar sem
artefatos; por isso todos os tamanhos vêm da marca de 512 px.
