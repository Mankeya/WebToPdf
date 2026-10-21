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

Desde o Chrome 137, o comando `--load-extension` é ignorado pelo navegador instalado, e extensões distribuídas fora da loja exigem modo desenvolvedor. A Chrome Web Store passou a ser o caminho suportado para instalar sem modo desenvolvedor.

**Requisitos:**

1. Conta de desenvolvedor da Chrome Web Store, com taxa de registro única de US$ 5.
2. O `.zip` assinado pela loja, com todos os recursos embutidos.
3. Preenchimento do painel: listagem, imagens, práticas de privacidade e justificativa das permissões.

**O que a revisão vai olhar.** A permissão `debugger` é sensível e a extensão será revisada manualmente. A justificativa completa, a declaração de privacidade e as instruções de teste para o revisor estão em [store/review-notes.md](../store/review-notes.md). Sem essa justificativa pronta, a chance de rejeição aumenta bastante.

**Riscos específicos desta extensão:**

- O revisor precisa instalar e usar a extensão. As instruções de teste com URLs públicas estão prontas.
- O build enviado é minificado, o que dificulta a leitura do código. Para facilitar a revisão, vale enviar um build sem minificação. O Vite permite isso com `build.minify: false` em um perfil de release.
- Novas extensões e extensões com permissões sensíveis demoram mais. A documentação oficial fala de alguns dias, podendo chegar a semanas.

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
2. Preencher o painel do painel do desenvolvedor com o material acima.
3. Enviar o `.zip` e responder à revisão.
4. Decidir entre publicar a extensão inteira ou uma versão apenas para a loja com permissões reduzidas.
