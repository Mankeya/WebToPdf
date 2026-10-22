import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const sheetPath = process.argv[2] ?? 'store/brand/folha-de-marca.png';
const outputDir = process.argv[3] ?? 'store/brand';
await mkdir(outputDir, { recursive: true });

const sheet = (await readFile(sheetPath)).toString('base64');

// Regiões medidas na folha 2172x724 com grade de 100 px.
// O campo "dark" indica o painel escuro da folha, de onde sai a variante
// transparente.
const regions = [
  { name: 'logo-horizontal-claro', x: 55, y: 5, width: 960, height: 215, dark: false },
  { name: 'logo-horizontal-escuro', x: 1115, y: 5, width: 995, height: 215, dark: true },
  { name: 'logo-vertical-claro', x: 100, y: 295, width: 280, height: 215, dark: false },
  { name: 'logo-vertical-escuro', x: 545, y: 295, width: 300, height: 215, dark: true },
  { name: 'icone-512', x: 970, y: 300, width: 205, height: 180, dark: false },
  { name: 'icone-256', x: 1250, y: 305, width: 140, height: 160, dark: false },
  { name: 'icone-128', x: 1510, y: 335, width: 135, height: 125, dark: false },
  { name: 'favicon-32', x: 1770, y: 355, width: 90, height: 85, dark: false },
  { name: 'favicon-16', x: 2010, y: 380, width: 65, height: 60, dark: false },
  { name: 'wordmark-claro', x: 60, y: 575, width: 300, height: 85, dark: false },
  { name: 'wordmark-escuro', x: 470, y: 575, width: 285, height: 85, dark: true },
  { name: 'wordmark-monocromatico', x: 835, y: 575, width: 330, height: 85, dark: false },
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
      const darkPanel = region.dark === true;
      void corners;

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

      // Peca sobre fundo escuro ganha variante transparente, para uso em
      // cabecalhos nao claros.
      if (darkPanel) {
        const variant = document.createElement('canvas');
        variant.width = cropped.width;
        variant.height = cropped.height;
        const variantContext = variant.getContext('2d');
        variantContext.drawImage(canvas, 0, 0);
        const variantPixels = variantContext.getImageData(0, 0, variant.width, variant.height);
        const data8 = variantPixels.data;
        const visited = new Uint8Array(variant.width * variant.height);
        const stack = [];
        const push = (x, y) => {
          if (x < 0 || y < 0 || x >= variant.width || y >= variant.height) return;
          const index = y * variant.width + x;
          if (visited[index]) return;
          visited[index] = 1;
          stack.push(index);
        };
        for (let x = 0; x < variant.width; x += 1) { push(x, 0); push(x, variant.height - 1); }
        for (let y = 0; y < variant.height; y += 1) { push(0, y); push(variant.width - 1, y); }
        const isBackground = (index) => {
          const offset = index * 4;
          if (data8[offset + 3] < 8) return true;
          const max = Math.max(data8[offset], data8[offset + 1], data8[offset + 2]);
          const min = Math.min(data8[offset], data8[offset + 1], data8[offset + 2]);
          const luma = 0.299 * data8[offset] + 0.587 * data8[offset + 1] + 0.114 * data8[offset + 2];
          return max - min < 30 && luma < 90;
        };
        while (stack.length > 0) {
          const index = stack.pop();
          if (!isBackground(index)) continue;
          const x = index % variant.width;
          const y = Math.floor(index / variant.width);
          data8[index * 4 + 3] = 0;
          push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
        }
        variantContext.putImageData(variantPixels, 0, 0);
        output.push({
          name: `${region.name}-transparente`,
          data: variant.toDataURL('image/png'),
          width: cropped.width,
          height: cropped.height,
        });
      }
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
