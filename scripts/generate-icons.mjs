import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const SIZES = [16, 32, 48, 128];
const source = resolve('public/icons/icon.svg');
const svg = await readFile(source, 'utf8');

const browser = await chromium.launch();
try {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:transparent">
       <div style="width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div>
       </body></html>`,
      { waitUntil: 'load' },
    );
    const buffer = await page.locator('svg').screenshot({ omitBackground: true });
    await writeFile(resolve(`public/icons/icon-${size}.png`), buffer);
    await page.close();
  }
} finally {
  await browser.close();
}
