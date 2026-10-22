import { mkdtemp, rm, cp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { build } from 'vite';

const run = promisify(execFile);
const store = process.argv.includes('--store');
const version = JSON.parse(await readFile(resolve('package.json'), 'utf8')).version;

// O build enviado a loja nao e minificado: a revisao manual do Chrome Web
// Store precisa conseguir ler o codigo da extensao.
await build({ logLevel: 'warn', build: { minify: !store } });

const staging = await mkdtemp(join(tmpdir(), 'webtopdf-package-'));
const target = join(staging, 'webtopdf');

try {
  await cp(resolve('dist'), target, { recursive: true });
  const manifest = JSON.parse(await readFile(join(target, 'manifest.json'), 'utf8'));
  if (manifest.version !== version) {
    throw new Error(`Versão do manifesto (${manifest.version}) diferente da do pacote (${version}).`);
  }

  const name = store ? `webtopdf-store-${version}.zip` : `webtopdf-${version}.zip`;
  const output = resolve(name);
  try {
    await run('powershell', [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path '${target}' -DestinationPath '${output}' -Force`,
    ]);
  } catch {
    // Alternativa sem PowerShell quando o comando nativo não estiver disponível.
    // O caminho de saída precisa ser absoluto: o tar troca o diretório de trabalho
    // antes de abrir o arquivo e um caminho relativo cairia dentro do staging.
    await run('tar', ['-a', '-c', '-f', output, '-C', staging, 'webtopdf']);
  }
  console.log(`Pacote gerado: ${output}`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
