import { createWorker } from 'tesseract.js';

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('background.js')
    || !message || typeof message !== 'object' || !('type' in message) || message.type !== 'ocr-recognize'
    || !('image' in message) || typeof message.image !== 'string'
    || !message.image.startsWith('data:image/jpeg;base64,')) return false;
  const image = message.image;
  void (async () => {
    let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
    try {
      worker = await createWorker('por+eng', 1, {
        workerPath: chrome.runtime.getURL('ocr/worker.min.js'),
        corePath: chrome.runtime.getURL('ocr/tesseract-core-lstm.js'),
        langPath: chrome.runtime.getURL('ocr'),
        workerBlobURL: false,
        cacheMethod: 'none',
      });
      const { data } = await worker.recognize(image);
      sendResponse({ text: data.text, words: data.words.map(({ text, bbox, confidence }) => ({ text, bbox, confidence })) });
    } catch {
      sendResponse(null);
    } finally {
      await worker?.terminate();
    }
  })();
  return true;
});
