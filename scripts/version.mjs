/**
 * Regras de versão e transforms de texto usados pela preparação de release e
 * pela checagem de CI. Funções puras: leem texto, devolvem texto, sem disco.
 */

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

export const README_NOVIDADES_OPEN = '<!-- novidades -->';
export const README_NOVIDADES_CLOSE = '<!-- /novidades -->';

/** Interpreta "1.2.3" em números, ou devolve null se não for versão válida. */
export function parseVersion(value) {
  const match = VERSION_PATTERN.exec(value);
  if (!match) return null;
  return match.slice(1, 4).map(Number);
}

/** Compara duas versões: -1, 0 ou 1. Lança erro se alguma for inválida. */
export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a) throw new RangeError(`Versão inválida: ${left}`);
  if (!b) throw new RangeError(`Versão inválida: ${right}`);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

/** Aplica o incremento semântico sobre a versão atual. */
export function bumpVersion(current, type) {
  const version = parseVersion(current);
  if (!version) throw new RangeError(`Versão inválida: ${current}`);
  const [major, minor, patch] = version;
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  if (type === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new RangeError(`Tipo de incremento inválido: ${type}`);
}

/** Data no formato do CHANGELOG: 2026-10-22. */
export function changelogDate(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Data no formato do README: 22/10/2026. */
export function readmeDate(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/**
 * Fecha a seção [Não publicado] do CHANGELOG em uma versão datada e abre uma
 * nova seção vazia no lugar, pronto para o próximo ciclo.
 */
export function closeChangelog(changelog, version, date = changelogDate()) {
  const marker = '## [Não publicado]';
  const start = changelog.indexOf(marker);
  if (start === -1) throw new Error('O CHANGELOG não tem a seção [Não publicado].');
  const rest = changelog.slice(start + marker.length);
  const body = rest.split(/\n## /)[0];
  if (!/^- /m.test(body)) throw new Error('A seção [Não publicado] do CHANGELOG está vazia.');
  return changelog.replace(marker, `${marker}\n\n## [${version}] — ${date}`);
}

/**
 * Extrai os blocos "### vX.Y.Z — data" do conteúdo da seção de novidades do
 * README, do mais recente ao mais antigo.
 */
export function parseReadmeVersions(content) {
  const blocks = content.split(/(?=^### v\d+\.\d+\.\d+ — )/m).map((part) => part.trim()).filter(Boolean);
  return blocks.map((text) => ({ version: /^### (v\d+\.\d+\.\d+)/.exec(text)?.[1]?.slice(1), text }))
    .filter((block) => Boolean(block.version));
}

/**
 * Monta o conteúdo da seção de novidades: a versão nova no topo e, no máximo,
 * as três versões mais recentes. Só o que interessa ao usuário final.
 */
export function buildReadmeVersions(version, destaques, existingContent, date = readmeDate()) {
  if (destaques.length === 0) throw new Error('Informe ao menos um destaque para o README.');
  const bullets = destaques.map((item) => `- ${item}`).join('\n');
  const nova = `### v${version} — ${date}\n\n${bullets}`;
  const anteriores = parseReadmeVersions(existingContent);
  return [{ version, text: nova }, ...anteriores].slice(0, 3).map((block) => block.text).join('\n\n');
}

/** Atualiza a linha de versão do cabeçalho e a seção de novidades do README. */
export function updateReadme(readme, version, destaques, date = readmeDate()) {
  const linha = /<sub>Versão \d+\.\d+\.\d+[\s\S]*?<\/sub>/.exec(readme)?.[0];
  if (!linha) throw new Error('O README não tem a linha de versão do cabeçalho.');
  const novaLinha = linha
    .replace(/Versão \d+\.\d+\.\d+/, `Versão ${version}`)
    .replace(/releases\/tag\/v\d+\.\d+\.\d+/, `releases/tag/v${version}`);
  const atualizado = readme.replace(linha, novaLinha);

  const abre = atualizado.indexOf(README_NOVIDADES_OPEN);
  const fecha = atualizado.indexOf(README_NOVIDADES_CLOSE);
  if (abre === -1 || fecha === -1 || fecha < abre) throw new Error('O README não tem os marcadores da seção de novidades.');
  const conteudoAtual = atualizado.slice(abre + README_NOVIDADES_OPEN.length, fecha).trim();
  const conteudo = buildReadmeVersions(version, destaques, conteudoAtual, date);

  const inicio = abre + README_NOVIDADES_OPEN.length;
  const fim = fecha;
  return `${atualizado.slice(0, inicio)}\n\n${conteudo}\n\n${atualizado.slice(fim)}`;
}
