/**
 * Preferência de conversão direta: com ela ligada, clicar no ícone do
 * WEBtoPDF abre a prévia do PDF já convertendo, sem passar pelo menu de
 * formatos. O padrão é desligado — o comportamento do produto não muda para
 * quem nunca tocou na opção.
 *
 * O estado vive em `chrome.storage.local`, como as demais preferências, e só
 * é interpretado como ligado quando o valor é estritamente `true`.
 */
export const DIRECT_CONVERSION_KEY = 'directConversion';

export function parseDirectConversion(value: unknown): boolean {
  return value === true;
}
