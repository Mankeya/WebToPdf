# Distribuição do WEBtoPDF

Como tirar a extensão do modo desenvolvedor do Chrome, com as implicações de cada caminho.

## Panorama

| Caminho | Sai do modo desenvolvedor | Custo | Prazo | Atualizações |
|---|---|---|---|---|
| Chrome Web Store | Sim | Taxa única de US$ 5 | Dias (pode ser semanas) | Automáticas |
| Política corporativa (`ExtensionInstallForcelist`) | Sim, no Chrome gerenciado | Depende do ambiente | Imediato após a política | Automáticas |
| `.zip` distribuído, carregado manualmente | **Não** | Nenhum | Imediato | Manuais |
| Extensão auto-hospedada com URL de atualização | **Não** | Nenhum | Imediato | Automáticas, sem suporte a loja |

## Chrome Web Store — o caminho suportado

Desde o Chrome 137, o comando `--load-extension` é ignorado pelo navegador instalado, e extensões distribuídas fora da loja exigem modo desenvolvedor. A documentação oficial é explícita: **no Windows e no macOS, a instalação externa só é permitida quando a URL de atualização aponta para a Chrome Web Store**. Instalação a partir de um CRX local é bloqueada desde o Chrome 33.

Na prática, para sair do modo desenvolvedor no Windows, **é obrigatório publicar na Chrome Web Store**. O Linux é a única exceção: aceita extensão auto-hospedada ou CRX local.

**Requisitos:**

1. Conta de desenvolvedor da Chrome Web Store, com taxa de registro única de US$ 5.
2. O `.zip` assinado pela loja, com todos os recursos embutidos.
3. Preenchimento do painel: listagem, imagens, práticas de privacidade e justificativa das permissões.

**O que a revisão vai olhar.** A permissão `debugger` é sensível e a extensão será revisada manualmente. A justificativa completa, a declaração de privacidade e as instruções de teste para o revisor estão em [store/review-notes.md](../store/review-notes.md). Sem essa justificativa pronta, a chance de rejeição aumenta bastante.

**Riscos específicos desta extensão:**

- O revisor precisa instalar e usar a extensão. As instruções de teste com URLs públicas estão prontas.
- O build enviado à loja **não é minificado**, para que a revisão manual consiga ler o código. O build das releases no GitHub continua minificado.
- Novas extensões e extensões com permissões sensíveis demoram mais. A documentação oficial fala de alguns dias, podendo chegar a semanas.

## Release automática a cada merge

Cada integração na `main` publica uma versão. O fluxo é este:

1. **Antes do PR**, o autor roda `npm run release:prepare -- <major|minor|patch> -- "destaque"`. O script sobe a versão em `package.json` e no manifesto, fecha a seção `[Não publicado]` do CHANGELOG na data de hoje e reescreve a seção **Novidades** do README com as três versões mais recentes, usando só os destaques informados.
2. **O CI** roda o quarto check obrigatório, **Release preparada** (`scripts/release-check.mjs`), que bloqueia o merge se a versão do PR não for maior que a da `main`, se o CHANGELOG não tiver a seção da versão ou se o README não anunciar a versão nova.
3. **O merge** dispara `.github/workflows/release-on-merge.yml`, que lê a versão do `package.json` integrado, cria a tag `vX.Y.Z` (se ainda não existir) e chama o `release.yml` como workflow reutilizável — que roda testes, empacota o `.zip` e publica a release.
4. **A Chrome Web Store** recebe a mesma tag pelo `publish-store.yml`, que continua ignorado enquanto as credenciais não estiverem configuradas.

O `npm run release:check` usa o mesmo script do CI e pode ser rodado localmente com `--base origin/main` para simular o portão.

## Publicação automatizada

Depois que a conta de desenvolvedor existir e o item for criado no painel, a publicação de novas versões pode ser automatizada pela API v2 da loja.

```bash
npm run package:store      # gera webtopdf-store-<versão>.zip sem minificação
npm run publish:store     # envia o pacote e submete à revisão
```

**Credenciais** (nunca versionadas):

| Segredo do repositório | Variável | Origem |
|---|---|---|
| `CWS_CLIENT_ID` | id do cliente OAuth | Google Cloud Console |
| `CWS_CLIENT_SECRET` | segredo do cliente OAuth | Google Cloud Console |
| `CWS_REFRESH_TOKEN` | token de atualização | OAuth Playground, escopo `https://www.googleapis.com/auth/chromewebstore` |
| `CWS_PUBLISHER_ID` | id do publicador | Painel da loja → Publisher → Settings |
| `CWS_EXTENSION_ID` | id do item | URL do item na loja |

As três primeiras são **segredos** do repositório; as duas últimas são **variáveis** do repositório, porque não são confidenciais. O workflow [`.github/workflows/publish-store.yml`](../.github/workflows/publish-store.yml) roda a cada tag e é ignorado enquanto as variáveis não estiverem configuradas.

O item precisa ter a listagem e as práticas de privacidade preenchidas no painel antes da primeira publicação pela API.

## Política corporativa

Em ambientes com Chrome gerenciado, a extensão pode ser instalada e bloqueada para o usuário por política do sistema operacional, com `ExtensionInstallForcelist`. Isso dispensa o modo desenvolvedor e garante versões consistentes. A lista de políticas aplicáveis é pública e pode ser configurada pela equipe de TI.

Quando a extensão estiver publicada na loja, a política passa a referenciar o ID do item na loja, o que também permite bloquear versões desatualizadas.

## Distribuição interna temporária

Enquanto a publicação na loja não acontece, o caminho para usuários internos é:

1. `npm run package` gera `webtopdf-<versão>.zip`.
2. O usuário descompacta e carrega em `chrome://extensions` → **Carregar sem compactação**.

Isso **mantém o modo desenvolvedor** e exige intervir manualmente a cada atualização. Serve para testagem, não para uso contínuo.

## Materiais prontos

| Arquivo | Conteúdo |
|---|---|
| [store/listing.md](../store/listing.md) | Nome, descrições, categoria, palavras-chave e imagens exigidas |
| [store/review-notes.md](../store/review-notes.md) | Justificativa da permissão `debugger`, declaração de privacidade e instruções de teste para o revisor |
| `store/screenshots/` | Capturas 1280×800 geradas por `npm run store:screenshots` |
| `SECURITY.md` | Política de segurança, servindo de política de privacidade pública |
| `public/icons/icon-128.png` | Ícone do item, 128×128 |

## Ainda falta, para publicar

1. Conta de desenvolvedor da Chrome Web Store (pagamento da taxa).
2. Preencher o painel do desenvolvedor com o material acima e criar o item.
3. Configurar as credenciais no repositório para a publicação automatizada.
4. Enviar a primeira versão e responder à revisão.
