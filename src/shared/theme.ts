/**
 * Tema da interface da prévia: claro ou escuro.
 *
 * O padrão é `light` — é o design atual do produto e ninguém é obrigado a
 * mudar. O valor só é interpretado como escuro quando é estritamente a string
 * `'dark'`; qualquer lixo vindo do storage vira claro, nunca uma tela ilegível.
 *
 * O tema atinge somente a interface da extensão (cabeçalho, sidebar, cartões).
 * O documento pré-visualizado permanece com fundo branco: é a simulação da
 * folha impressa.
 */
export type Theme = 'light' | 'dark';

export const THEME_KEY = 'theme';

export function parseTheme(value: unknown): Theme {
  return value === 'dark' ? 'dark' : 'light';
}
