/**
 * Detecção do contexto de navegação anônima (modo `split` do manifesto).
 *
 * No modo split o Chrome mantém dois processos da extensão: um normal e um
 * anônimo. Cada processo sabe qual é via `chrome.extension.inIncognitoContext`.
 * Duas regras do produto dependem disso:
 *
 * 1. Nada escrito numa janela anônima pode chegar ao disco do perfil normal
 *    (preferências, tema, ajustes de impressão) — o anônimo descarta tudo ao
 *    fechar e não pode contaminar o perfil.
 * 2. Downloads em janela anômima sempre abrem "Salvar como…" para que o
 *    arquivo caia onde o usuário escolher, nunca no diretório padrão rastreável.
 *
 * Fora do Chrome (testes, ambientes sem a API) a resposta é `false`: o
 * comportamento padrão (não anônimo) é o seguro e o mais comum.
 */
export function isIncognitoContext(): boolean {
  try {
    return chrome.extension?.inIncognitoContext === true;
  } catch {
    return false;
  }
}

/**
 * Grava preferências somente fora do contexto anônimo. Em janela anônima a
 * gravação é um no-op silencioso: a preferência vale só para a sessão anônima
 * (lida em memória) e nada é persistido no perfil.
 *
 * Retorna `true` quando a gravação ocorreu.
 */
export async function setStorageIfPersistent(items: Record<string, unknown>): Promise<boolean> {
  if (isIncognitoContext()) return false;
  await chrome.storage.local.set(items);
  return true;
}
