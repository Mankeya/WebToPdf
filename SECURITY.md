# Política de segurança

## Escopo

O WEBtoPDF converte a aba atual do Chrome em PDF. O processamento é **inteiramente local**: nenhuma página, URL, título ou PDF é enviado a servidores. Não há conta, telemetria nem analytics.

O inventário de permissões, a Content Security Policy aplicada e as mitigações de cada risco estão em [docs/security.md](docs/security.md).

## Permissões em uso

| Permissão | Por quê |
|---|---|
| `activeTab` | Ler URL e título da aba que o usuário está convertendo |
| `debugger` | Usar o motor de impressão do Chrome (`Page.printToPDF`) |
| `storage` | Lembrar as preferências de impressão no perfil local |
| `downloads` | Gravar o PDF e evitar sobrescrita de arquivos existentes |

A extensão não injeta scripts nas páginas, não pede acesso a todos os sites e não expõe recursos a páginas web.

## Reportando uma vulnerabilidade

Abra uma issue privada de segurança no repositório ou entre em contato direto com o responsável pelo projeto. Inclua:

- passos para reproduzir;
- versão do Chrome, Windows e da extensão;
- impacto observado (por exemplo, vazamento de dados ou execução de código em contexto da extensão).

Evite publicar detalhes em issue pública antes de uma correção estar disponível.

## Limitações conhecidas

- A permissão `debugger` permite inspecionar qualquer aba; a extensão só a usa durante a conversão da aba escolhida e libera a conexão ao terminar.
- A detecção de colisão de nomes de arquivo usa o histórico de downloads do Chrome. Arquivos baixados por outros meios podem ser sobrescritos; use **Salvar como…** quando precisar de garantia.
- Políticas corporativas podem bloquear a extensão ou a impressão em PDF.
