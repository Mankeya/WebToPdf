import { mkdtemp, rm, cp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const version = JSON.parse(await readFile(resolve('package.json'), 'utf8')).version;
const staging = await mkdtemp(join(tmpdir(), 'webtopdf-package-'));
const target = join(staging, 'webtopdf');

try {
  await cp(resolve('dist'), target, { recursive: true });
  const manifest = JSON.parse(await readFile(join(target, 'manifest.json'), 'utf8'));
  manifest.version = version;
  manifest.name = 'WEBtoPDF';
  manifest.description = 'Converte a página atual em PDF, com prévia e ajustes de impressão, totalmente no seu computador.';
  await writeFile(join(target, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const output = resolve(`webtopdf-${version}.zip`);
  try {
    await run('powershell', [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path '${target}' -DestinationPath '${output}' -Force`,
    ]);
  } catch (error) {
    // Alternativa sem PowerShell quando o comando nativo não estiver disponível.
    await run('tar', ['-a', '-c', '-f', output, '-C', staging, 'webtopdf']);
  }
  console.log(`Pacote gerado: ${output}`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
