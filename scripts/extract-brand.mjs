import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const sheetPath = process.argv[2] ?? 'store/brand/folha-de-marca.png';
const outputDir = process.argv[3] ?? 'store/brand';
await mkdir(outputDir, { recursive: true });

const sheet = (await readFile(sheetPath)).toString('base64');

// Regiões medidas na folha 2172x724 com grade de 100 px.
const regions = [
  { name: 'logo-horizontal-claro', x: 55, y: 5, width: 960, height: 215 },
  { name: 'logo-horizontal-escuro', x: 1040, y: 5, width: 1070, height: 215 },
  { name: 'logo-vertical-claro', x: 100, y: 295, width: 280, height: 215 },
  { name: 'logo-vertical-escuro', x: 545, y: 295, width: 300, height: 215 },
  { name: 'icone-512', x: 970, y: 300, width: 205, height: 180 },
  { name: 'icone-256', x: 1250, y: 305, width: 140, height: 160 },
  { name: 'icone-128', x: 1510, y: 335, width: 135, height: 125 },
  { name: 'favicon-32', x: 1770, y: 355, width: 90, height: 85 },
  { name: 'favicon-16', x: 2010, y: 380, width: 65, height: 60 },
  { name: 'wordmark-claro', x: 60, y: 575, width: 300, height: 85 },
  { name: 'wordmark-escuro', x: 470, y: 575, width: 285, height: 85 },
  { name: 'wordmark-monocromatico', x: 835, y: 575, width: 330, height: 85 },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent('<canvas id="c"></canvas>');
  const results = await page.evaluate(async ({ data, regions }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.getElementById('c');
    const context = canvas.getContext('2d');
    const output = [];

    for (const region of regions) {
      const width = Math.min(region.width, image.width - region.x);
      const height = Math.min(region.height, image.height - region.y);
      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      context.drawImage(image, region.x, region.y, width, height, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;

      // O fundo da folha tem gradientes e bordas de painel. O conteudo da marca
      // e identificado pela saturacao (vermelho e azul) e, nos paineis escuros,
      // pelo brilho do texto branco.
      const sample = (x, y) => {
        const offset = (y * width + x) * 4;
        return { r: pixels[offset], g: pixels[offset + 1], b: pixels[offset + 2] };
      };
      const corners = [sample(1, 1), sample(width - 2, 1), sample(1, height - 2), sample(width - 2, height - 2)];
      const backgroundLuma = corners.reduce((total, corner) => total + (0.299 * corner.r + 0.587 * corner.g + 0.114 * corner.b), 0) / corners.length;
      const darkPanel = backgroundLuma < 128;

      const isContent = (offset) => {
        const r = pixels[offset];
        const g = pixels[offset + 1];
        const b = pixels[offset + 2];
        if (pixels[offset + 3] < 8) return false;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (max - min > 35) return true;
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        return darkPanel ? luma > 185 : luma < 95;
      };

      let top = 0;
      let bottom = height - 1;
      let left = 0;
      let right = width - 1;
      const rowEmpty = (y) => {
        for (let x = 0; x < width; x += 1) if (isContent((y * width + x) * 4)) return false;
        return true;
      };
      const columnEmpty = (x) => {
        for (let y = 0; y < height; y += 1) if (isContent((y * width + x) * 4)) return false;
        return true;
      };
      while (top <= bottom && rowEmpty(top)) top += 1;
      while (bottom >= top && rowEmpty(bottom)) bottom -= 1;
      while (left <= right && columnEmpty(left)) left += 1;
      while (right >= left && columnEmpty(right)) right -= 1;

      const cropped = { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
      canvas.width = cropped.width;
      canvas.height = cropped.height;
      context.clearRect(0, 0, cropped.width, cropped.height);
      context.drawImage(image, region.x + left, region.y + top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
      output.push({ name: region.name, data: canvas.toDataURL('image/png'), width: cropped.width, height: cropped.height });
    }
    return output;
  }, { data: sheet, regions });

  for (const result of results) {
    const buffer = Buffer.from(result.data.split(',')[1], 'base64');
    await writeFile(`${outputDir}/${result.name}.png`, buffer);
    console.log(`${result.name}: ${result.width}x${result.height}`);
  }
} finally {
  await browser.close();
}
