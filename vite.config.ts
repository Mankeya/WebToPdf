import { fileURLToPath } from 'node:url';
import { cpSync } from 'node:fs';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [{
    name: 'local-pdf-resources',
    closeBundle() {
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
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
