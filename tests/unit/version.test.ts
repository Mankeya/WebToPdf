import { describe, expect, it } from 'vitest';
import {
  bumpVersion,
  buildReadmeVersions,
  changelogDate,
  closeChangelog,
  compareVersions,
  parseReadmeVersions,
  parseVersion,
  readmeDate,
  updateReadme,
} from '../../scripts/version.mjs';

describe('parseVersion', () => {
  it('interpreta uma versão válida', () => {
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
  });

  it('rejeita textos que não são versão', () => {
    expect(parseVersion('1.2')).toBeNull();
    expect(parseVersion('v1.2.3')).toBeNull();
    expect(parseVersion('')).toBeNull();
  });
});

describe('compareVersions', () => {
  it('ordena por major, minor e patch', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    expect(compareVersions('1.2.0', '1.1.9')).toBe(1);
    expect(compareVersions('1.1.1', '1.1.1')).toBe(0);
  });
});

describe('bumpVersion', () => {
  it('aplica os incrementos semânticos', () => {
    expect(bumpVersion('1.1.0', 'patch')).toBe('1.1.1');
    expect(bumpVersion('1.1.0', 'minor')).toBe('1.2.0');
    expect(bumpVersion('1.1.5', 'major')).toBe('2.0.0');
  });

  it('recusa incremento desconhecido', () => {
    expect(() => bumpVersion('1.0.0', 'build' as 'patch')).toThrow();
  });
});

describe('datas', () => {
  it('formata para CHANGELOG e README', () => {
    const date = new Date(2026, 9, 5);
    expect(changelogDate(date)).toBe('2026-10-05');
    expect(readmeDate(date)).toBe('05/10/2026');
  });
});

describe('closeChangelog', () => {
  const base = '# Changelog\n\n## [Não publicado]\n\n### Corrigido\n\n- Algo feito.\n\n## [1.0.0] — 2026-10-21\n\n### Adicionado\n\n- Primeira.\n';

  it('fecha a seção e abre outra vazia', () => {
    const result = closeChangelog(base, '1.1.0', '2026-10-22');
    expect(result).toContain('## [Não publicado]\n\n## [1.1.0] — 2026-10-22');
    expect(result).toContain('## [1.0.0] — 2026-10-21');
  });

  it('recusa fechar sem itens publicáveis', () => {
    expect(() => closeChangelog('# Changelog\n\n## [Não publicado]\n\n## [1.0.0] — 2026-10-21\n', '1.1.0')).toThrow();
  });

  it('recusa CHANGELOG sem a seção', () => {
    expect(() => closeChangelog('# Changelog\n', '1.1.0')).toThrow();
  });
});

describe('novidades do README', () => {
  const exemplo = '### v1.1.0 — 22/10/2026\n\n- Destaque 1.\n\n### v1.0.0 — 21/10/2026\n\n- Primeira.';

  it('lê os blocos existentes', () => {
    expect(parseReadmeVersions(exemplo).map((block) => block.version)).toEqual(['1.1.0', '1.0.0']);
  });

  it('coloca a nova versão no topo e mantém três', () => {
    const conteudo = buildReadmeVersions('1.2.0', ['Novidade forte.'], exemplo, '22/10/2026');
    expect(conteudo.startsWith('### v1.2.0 — 22/10/2026')).toBe(true);
    expect(conteudo).toContain('- Novidade forte.');
    expect(conteudo).toContain('### v1.1.0');
    expect(conteudo).toContain('### v1.0.0');
    expect(parseReadmeVersions(conteudo)).toHaveLength(3);
  });

  it('descarta a quarta versão mais antiga', () => {
    const cheia = '### v1.2.0 — 22/10/2026\n\n- B.\n\n### v1.1.0 — 22/10/2026\n\n- A1.\n\n### v1.0.1 — 21/10/2026\n\n- A2.\n\n### v1.0.0 — 21/10/2026\n\n- Primeira.';
    const conteudo = buildReadmeVersions('1.3.0', ['Nova.'], cheia, '23/10/2026');
    expect(conteudo).toContain('### v1.2.0');
    expect(conteudo).not.toContain('### v1.0.0');
  });

  it('exige ao menos um destaque', () => {
    expect(() => buildReadmeVersions('1.2.0', [], exemplo)).toThrow();
  });
});

describe('updateReadme', () => {
  const readme = '<p><sub>Versão 1.1.0 · <a href="CHANGELOG.md">novidades</a> · <a href="https://github.com/Mankeya/WebToPdf/releases/tag/v1.1.0">download</a></sub></p>\n\n<!-- novidades -->\n\n### v1.1.0 — 22/10/2026\n\n- Destaque.\n\n<!-- /novidades -->\n\n## Instalação\n';

  it('atualiza linha de versão, link e seção de novidades', () => {
    const result = updateReadme(readme, '1.2.0', ['Outra novidade.'], '22/10/2026');
    expect(result).toContain('Versão 1.2.0');
    expect(result).toContain('releases/tag/v1.2.0');
    expect(result).toContain('### v1.2.0 — 22/10/2026');
    expect(result).toContain('- Outra novidade.');
    expect(result).toContain('<!-- /novidades -->');
    expect(result).toContain('## Instalação');
  });

  it('recusa README sem os marcadores', () => {
    expect(() => updateReadme(readme.replace('<!-- novidades -->', ''), '1.2.0', ['X.'])).toThrow();
  });
});
