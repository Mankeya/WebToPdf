/**
 * Checagem de release usada pelo CI.
 *
 * Uso: node scripts/release-check.mjs [--base <ref>]
 *
 * Sem --base, confere a consistência interna: package.json, manifesto,
 * CHANGELOG e README precisam falar da mesma versão.
 *
 * Com --base, confere ainda que a versão é maior que a da base (ex.: a main),
 * que o CHANGELOG da base tinha mudanças publicáveis e que a seção de
 * novidades do README menciona a versão nova. É o portão que impede um merge
 * sem release preparada.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { changelogDate, compareVersions, parseVersion } from './version.mjs';

const args = process.argv.slice(2);
const baseIndex = args.indexOf('--base');
const base = baseIndex === -1 ? null : args[baseIndex + 1];

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(resolve(raiz, caminho), 'utf8');

const erros = [];
const versao = JSON.parse(ler('package.json')).version;
const manifesto = JSON.parse(ler('public/manifest.json')).version;
const changelog = ler('CHANGELOG.md');
const readme = ler('README.md');

if (!parseVersion(versao)) erros.push(`Versão do package.json inválida: ${versao}`);
if (manifesto !== versao) erros.push(`Manifesto (${manifesto}) não bate com package.json (${versao}).`);

// A seção da versão atual precisa existir no CHANGELOG, estar datada hoje ou
// antes e ter ao menos uma nota: uma release sem nada a dizer não é release.
const secao = new RegExp(`^## \\[${versao.replace(/\./g, '\\.')}\\] — (\\d{4}-\\d{2}-\\d{2})$`, 'm').exec(changelog);
if (!secao) {
  erros.push(`O CHANGELOG não tem a seção [${versao}]. Rode npm run release:prepare.`);
} else if (secao[1] > changelogDate()) {
  erros.push(`A data do CHANGELOG (${secao[1]}) é no futuro.`);
} else {
  const inicio = secao.index + secao[0].length;
  const proxima = changelog.indexOf('\n## ', inicio);
  const corpo = changelog.slice(inicio, proxima === -1 ? undefined : proxima);
  if (!/^- /m.test(corpo)) erros.push(`A seção [${versao}] do CHANGELOG está vazia.`);
}

// O README precisa anunciar a versão e listá-la entre as novidades.
if (!readme.includes(`Versão ${versao}`)) erros.push(`O README não anuncia a Versão ${versao}.`);
if (!readme.includes(`### v${versao} — `)) erros.push(`O README não lista v${versao} na seção de novidades.`);

if (base) {
  let baseVersion;
  try {
    baseVersion = JSON.parse(execSync(`git show ${base}:package.json`, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })).version;
  } catch {
    erros.push(`Não foi possível ler package.json em ${base}.`);
  }
  if (baseVersion) {
    if (compareVersions(versao, baseVersion) !== 1) {
      erros.push(`A versão ${versao} não é maior que a da base ${baseVersion}. Todo merge precisa de uma release maior.`);
    }
  }
}

if (erros.length > 0) {
  console.error('Release não preparada:');
  for (const erro of erros) console.error(` - ${erro}`);
  process.exit(1);
}
console.log(`Release consistente: v${versao}.`);
