import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const packageVersion = JSON.parse(await readFile(resolve('package.json'), 'utf8')).version;

const ALLOWED_PERMISSIONS = new Set(['activeTab', 'debugger', 'storage', 'downloads']);
const FORBIDDEN_KEYS = ['host_permissions', 'content_scripts', 'web_accessible_resources', 'externally_connectable', 'declarative_net_request', 'proxy', 'management', 'nativeMessaging'];
const REQUIRED_CSP_DIRECTIVES = {
  'script-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'frame-ancestors': ["'none'"],
};
// `data:` é necessário em img-src e font-src para recursos embutidos no PDF.
const DATA_ALLOWED_IN = new Set(['img-src', 'font-src']);
const FORBIDDEN_CSP_SOURCES = ["'unsafe-eval'", "'unsafe-inline'", '*', 'http:', 'https:'];

const target = resolve(process.argv[2] ?? 'dist/manifest.json');
const manifest = JSON.parse(await readFile(target, 'utf8'));
const problems = [];

if (manifest.manifest_version !== 3) problems.push(`manifest_version deve ser 3, encontrado ${manifest.manifest_version}`);

if (manifest.version !== packageVersion) {
  problems.push(`Versão do manifesto (${manifest.version}) diferente da do pacote (${packageVersion})`);
}

const permissions = manifest.permissions ?? [];
for (const permission of permissions) {
  if (!ALLOWED_PERMISSIONS.has(permission)) problems.push(`Permissão não aprovada: ${permission}`);
}
for (const permission of ALLOWED_PERMISSIONS) {
  if (!permissions.includes(permission)) problems.push(`Permissão aprovada ausente: ${permission}`);
}

for (const key of FORBIDDEN_KEYS) {
  if (manifest[key] !== undefined) problems.push(`Chave não permitida no manifesto: ${key}`);
}

const csp = manifest.content_security_policy?.extension_pages;
if (typeof csp !== 'string' || csp.length === 0) {
  problems.push('content_security_policy.extension_pages ausente');
} else {
  const directives = new Map(csp.split(';').map((part) => {
    const [name, ...values] = part.trim().split(/\s+/);
    return [name, values];
  }));
  for (const [directive, required] of Object.entries(REQUIRED_CSP_DIRECTIVES)) {
    const values = directives.get(directive);
    if (!values) {
      problems.push(`CSP sem a diretiva ${directive}`);
      continue;
    }
    for (const source of required) {
      if (!values.includes(source)) problems.push(`CSP ${directive} sem ${source}`);
    }
  }
  for (const [directive, values] of directives) {
    for (const value of values) {
      if (directive === 'style-src') continue;
      if (value === 'data:' && DATA_ALLOWED_IN.has(directive)) continue;
      if (FORBIDDEN_CSP_SOURCES.includes(value) || value === 'data:') problems.push(`CSP ${directive} permite ${value}`);
    }
  }
  const scriptSrc = directives.get('script-src') ?? [];
  if (scriptSrc.some((value) => value.includes('unsafe-eval'))) problems.push('CSP script-src permite unsafe-eval');
}

for (const size of ['16', '32', '48', '128']) {
  if (!manifest.icons?.[size]) problems.push(`Ícone ausente no manifesto: ${size}`);
}

if (problems.length > 0) {
  console.error('Falha na verificação do manifesto:');
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}

console.log(`Manifesto verificado: ${permissions.length} permissões, CSP restrita, ícones completos.`);
