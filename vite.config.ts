import { fileURLToPath } from 'node:url';
import { cpSync, mkdirSync } from 'node:fs';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [{
    name: 'local-pdf-resources',
    closeBundle() {
      const ocrDirectory = fileURLToPath(new URL('./dist/ocr', import.meta.url));
      mkdirSync(ocrDirectory, { recursive: true });
      for (const [source, name] of [
        ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
        ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
        ['tesseract.js-core/tesseract-core-lstm.wasm', 'tesseract-core-lstm.wasm'],
        ['@tesseract.js-data/por/4.0.0/por.traineddata.gz', 'por.traineddata.gz'],
        ['@tesseract.js-data/eng/4.0.0/eng.traineddata.gz', 'eng.traineddata.gz'],
      ]) cpSync(fileURLToPath(new URL(`./node_modules/${source}`, import.meta.url)), `${ocrDirectory}/${name}`);
      for (const directory of ['cmaps', 'standard_fonts']) {
        cpSync(
          fileURLToPath(new URL(`./node_modules/pdfjs-dist/${directory}`, import.meta.url)),
          fileURLToPath(new URL(`./dist/pdf-assets/${directory}`, import.meta.url)),
          { recursive: true },
        );
      }
    },
  }],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        preview: fileURLToPath(new URL('./preview.html', import.meta.url)),
        popup: fileURLToPath(new URL('./popup.html', import.meta.url)),
        background: fileURLToPath(new URL('./src/background/index.ts', import.meta.url)),
        offscreen: fileURLToPath(new URL('./src/offscreen/index.ts', import.meta.url)),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
