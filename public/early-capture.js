/* Clássico e bloqueante: dispara a captura antes de carregar o menu e seu CSS.
 * É uma tentativa antecipada, não uma garantia de precedência sobre o blur. */
var webtopdfEarlyCapture = (async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !Number.isInteger(tab.id) || !/^https?:\/\//.test(tab.url || '')) return null;
    const data = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 92 });
    const result = await chrome.runtime.sendMessage({
      type: 'store-snapshot', tabId: tab.id, url: tab.url, data,
    });
    return result && typeof result.token === 'string' ? { token: result.token, tabId: tab.id } : null;
  } catch {
    // Falha de captura nunca bloqueia PDF normal, PNG, TXT ou o menu.
    return null;
  }
})();
