/** Declarações dos transforms puros de release, usados pelos testes unitários. */

export function parseVersion(value: string): [number, number, number] | null;
export function compareVersions(left: string, right: string): -1 | 0 | 1;
export function bumpVersion(current: string, type: 'major' | 'minor' | 'patch'): string;
export function changelogDate(date?: Date): string;
export function readmeDate(date?: Date): string;
export function closeChangelog(changelog: string, version: string, date?: Date | string): string;
export function parseReadmeVersions(content: string): Array<{ version: string; text: string }>;
export function buildReadmeVersions(version: string, destaques: string[], existingContent: string, date?: Date | string): string;
export function updateReadme(readme: string, version: string, destaques: string[], date?: Date | string): string;

export const README_NOVIDADES_OPEN: string;
export const README_NOVIDADES_CLOSE: string;
