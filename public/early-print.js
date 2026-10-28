/* Clássico e bloqueante: pede a impressão antecipada antes de o menu desenhar.
 * Com a página ainda em foco, o service worker imprime a aba e guarda o PDF
 * em RAM; falha nenhuma aqui bloqueia o menu ou a conversão normal. */
var webtopdfEarlyPrint = (async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !Number.isInteger(tab.id) || !/^https?:\/\//.test(tab.url || '')) return null;
    const result = await chrome.runtime.sendMessage({ type: 'early-print', tabId: tab.id });
    return result && result.ok === true ? { tabId: tab.id } : null;
  } catch {
    // Falha de impressão nunca bloqueia PDF normal, PNG, TXT ou o menu.
    return null;
  }
})();
