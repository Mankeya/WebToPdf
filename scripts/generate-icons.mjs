import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const brandDir = process.argv[2] ?? 'store/brand';
const iconDir = process.argv[3] ?? 'public/icons';
// As variacoes de 16 e 32 px da folha sao pequenas demais para reamostrar
// sem artefatos; a marca de 512 e redimensionada para todos os tamanhos.
const SOURCES = [
  { size: 16, file: 'icone-512.png' },
  { size: 32, file: 'icone-512.png' },
  { size: 48, file: 'icone-512.png' },
  { size: 128, file: 'icone-512.png' },
];

await mkdir(iconDir, { recursive: true });

const sources = await Promise.all(SOURCES.map(async (source) => ({
  size: source.size,
  data: (await readFile(`${brandDir}/${source.file}`)).toString('base64'),
})));

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent('<canvas id="c"></canvas>');
  const output = await page.evaluate(async ({ sources }) => {
    const results = [];

    for (const source of sources) {
      const image = new Image();
      image.src = `data:image/png;base64,${source.data}`;
      await image.decode();
      const canvas = document.getElementById('c');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const data8 = pixels.data;
      const width = canvas.width;
      const height = canvas.height;

      // Preenchimento a partir das bordas: remove apenas o fundo externo e
      // preserva o branco interno da marca (o documento PDF).
      const visited = new Uint8Array(width * height);
      const stack = [];
      const push = (x, y) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        const index = y * width + x;
        if (visited[index]) return;
        visited[index] = 1;
        stack.push(index);
      };
      for (let x = 0; x < width; x += 1) { push(x, 0); push(x, height - 1); }
      for (let y = 0; y < height; y += 1) { push(0, y); push(width - 1, y); }

      const isLight = (index) => {
        const offset = index * 4;
        if (data8[offset + 3] < 8) return true;
        const max = Math.max(data8[offset], data8[offset + 1], data8[offset + 2]);
        const min = Math.min(data8[offset], data8[offset + 1], data8[offset + 2]);
        const luma = 0.299 * data8[offset] + 0.587 * data8[offset + 1] + 0.114 * data8[offset + 2];
        return max - min < 22 && luma > 196;
      };

      while (stack.length > 0) {
        const index = stack.pop();
        if (!isLight(index)) continue;
        const x = index % width;
        const y = Math.floor(index / width);
        data8[index * 4 + 3] = 0;
        push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
      }
      context.putImageData(pixels, 0, 0);

      let top = height;
      let bottom = -1;
      let left = width;
      let right = -1;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (data8[(y * width + x) * 4 + 3] > 16) {
            if (y < top) top = y;
            if (y > bottom) bottom = y;
            if (x < left) left = x;
            if (x > right) right = x;
          }
        }
      }
      if (bottom < 0) throw new Error(`Sem conteudo em ${source.size}.`);

      const crop = { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
      const size = source.size;
      const padding = Math.round(size * 0.06);
      const inner = size - padding * 2;
      const scale = Math.min(inner / crop.width, inner / crop.height);
      const target = document.createElement('canvas');
      target.width = size;
      target.height = size;
      const targetContext = target.getContext('2d');
      targetContext.imageSmoothingEnabled = true;
      targetContext.imageSmoothingQuality = 'high';
      targetContext.drawImage(
        canvas,
        crop.x, crop.y, crop.width, crop.height,
        Math.round((size - crop.width * scale) / 2), Math.round((size - crop.height * scale) / 2),
        Math.round(crop.width * scale), Math.round(crop.height * scale),
      );
      results.push({ size, data: target.toDataURL('image/png'), crop });
    }
    return results;
  }, { sources });

  for (const result of output) {
    const buffer = Buffer.from(result.data.split(',')[1], 'base64');
    await writeFile(`${iconDir}/icon-${result.size}.png`, buffer);
    console.log(`icon-${result.size}.png (recorte ${result.crop.width}x${result.crop.height})`);
  }
} finally {
  await browser.close();
}
