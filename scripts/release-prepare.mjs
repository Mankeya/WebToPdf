/**
 * Prepara uma release antes do PR.
 *
 * Uso: node scripts/release-prepare.mjs <major|minor|patch> -- "destaque 1" "destaque 2"
 *
 * Faz quatro coisas, sempre juntas:
 *   1. Sobe a versão em package.json e public/manifest.json.
 *   2. Fecha a seção [Não publicado] do CHANGELOG na versão de hoje.
 *   3. Reescreve a seção de novidades do README com as três versões mais
 *      recentes, usando só os destaques informados (lado do usuário final).
 *   4. Confere que o versionamento semântico foi respeitado.
 *
 * O restante do caminho é automático: o CI bloqueia o merge se a preparação
 * não tiver sido feita, e o merge na main publica a tag e a release.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bumpVersion, changelogDate, closeChangelog, compareVersions, parseVersion, updateReadme } from './version.mjs';

const BUMPS = ['major', 'minor', 'patch'];
const [incremento, ...resto] = process.argv.slice(2);
const separador = resto.indexOf('--');
const destaques = (separador === -1 ? resto : resto.slice(separador + 1)).filter(Boolean);

if (!BUMPS.includes(incremento)) {
  console.error('Uso: node scripts/release-prepare.mjs <major|minor|patch> -- "destaque 1" "destaque 2"');
  process.exit(1);
}
if (destaques.length === 0) {
  console.error('Informe ao menos um destaque para o README, entre aspas.');
  process.exit(1);
}

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(resolve(raiz, caminho), 'utf8');

const pacote = JSON.parse(ler('package.json'));
const manifesto = JSON.parse(ler('public/manifest.json'));
const changelog = ler('CHANGELOG.md');
const readme = ler('README.md');

const atual = pacote.version;
if (!parseVersion(atual)) {
  console.error(`Versão atual inválida: ${atual}`);
  process.exit(1);
}
if (manifesto.version !== atual) {
  console.error(`A versão do manifesto (${manifesto.version}) não bate com a do package.json (${atual}).`);
  process.exit(1);
}

const nova = bumpVersion(atual, incremento);
if (compareVersions(nova, atual) !== 1) {
  console.error('A nova versão não é maior que a atual.');
  process.exit(1);
}

let changelogNovo;
let readmeNovo;
try {
  changelogNovo = closeChangelog(changelog, nova, changelogDate());
  readmeNovo = updateReadme(readme, nova, destaques);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

pacote.version = nova;
manifesto.version = nova;

writeFileSync(resolve(raiz, 'package.json'), `${JSON.stringify(pacote, null, 2)}\n`);
writeFileSync(resolve(raiz, 'public/manifest.json'), `${JSON.stringify(manifesto, null, 2)}\n`);
writeFileSync(resolve(raiz, 'CHANGELOG.md'), changelogNovo);
writeFileSync(resolve(raiz, 'README.md'), readmeNovo);

console.log(`Release ${nova} preparada (era ${atual}).`);
console.log(`Destaques no README: ${destaques.length}`);
