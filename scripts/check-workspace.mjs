import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve('.');
const allowed = new Set([
  '.git', '.github', '.agents', 'docs', 'public', 'scripts', 'src', 'store', 'tests',
  'node_modules', 'dist', 'coverage', 'playwright-report', 'test-results',
  '.gitignore', '.gitattributes', 'AGENTS.md', 'CHANGELOG.md', 'README.md', 'SECURITY.md',
  'opencode.json', 'skills-lock.json', 'package.json', 'package-lock.json',
  'playwright.config.ts', 'popup.html', 'preview.html', 'tsconfig.json', 'vite.config.ts', 'vitest.config.ts',
]);

const unexpected = [];
for (const entry of await readdir(root)) {
  if (allowed.has(entry)) continue;
  if (entry.startsWith('webtopdf-') && entry.endsWith('.zip')) continue;
  if (entry.startsWith('.')) continue;
  const info = await stat(join(root, entry));
  unexpected.push(`${entry}${info.isDirectory() ? '/' : ''}`);
}

if (unexpected.length > 0) {
  console.error('Artefatos de build na raiz do repositorio:');
  for (const entry of unexpected) console.error(` - ${entry}`);
  console.error('Adicione o caminho ao .gitignore ou corrija a ferramenta que o gerou.');
  process.exit(1);
}
console.log('Raiz do repositorio limpa.');
