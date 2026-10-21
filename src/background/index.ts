import { buildPreviewUrl } from '../shared/preview-url';

chrome.action.onClicked.addListener((tab) => {
  const url = buildPreviewUrl(chrome.runtime.getURL('preview.html'), tab.id, tab.url);
  void chrome.tabs.create({ url }).catch(() => {
    // Sem registrar URL, título ou conteúdo da página.
    void chrome.action.setBadgeText({ text: 'ERR' }).catch(() => undefined);
  });
});
