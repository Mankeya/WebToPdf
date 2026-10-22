import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Publica a extensao na Chrome Web Store pela API v2.
 *
 * Credenciais (nunca versionadas):
 *   CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN,
 *   CWS_PUBLISHER_ID, CWS_EXTENSION_ID
 */
const required = ['CWS_CLIENT_ID', 'CWS_CLIENT_SECRET', 'CWS_REFRESH_TOKEN', 'CWS_PUBLISHER_ID', 'CWS_EXTENSION_ID'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Credenciais ausentes: ${missing.join(', ')}`);
  process.exit(1);
}

const { CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN, CWS_PUBLISHER_ID, CWS_EXTENSION_ID } = process.env;
const packagePath = resolve(process.argv[2] ?? 'webtopdf-store.zip');
const scope = 'https://www.googleapis.com/auth/chromewebstore';
const base = `https://chromewebstore.googleapis.com/v2/publishers/${CWS_PUBLISHER_ID}/items/${CWS_EXTENSION_ID}`;

const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: CWS_CLIENT_ID,
    client_secret: CWS_CLIENT_SECRET,
    refresh_token: CWS_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  }),
});
if (!tokenResponse.ok) {
  console.error('Falha ao renovar o token:', tokenResponse.status, await tokenResponse.text());
  process.exit(1);
}
const { access_token: accessToken } = await tokenResponse.json();
const auth = { Authorization: `Bearer ${accessToken}` };

const archive = await readFile(packagePath);
console.log(`Enviando ${packagePath} (${archive.length} bytes)`);

const uploadResponse = await fetch(
  `https://chromewebstore.googleapis.com/upload/v2/publishers/${CWS_PUBLISHER_ID}/items/${CWS_EXTENSION_ID}:upload`,
  {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/zip' },
    body: archive,
  },
);
if (!uploadResponse.ok) {
  console.error('Falha no envio:', uploadResponse.status, await uploadResponse.text());
  process.exit(1);
}
const upload = await uploadResponse.json();
console.log('estado do envio:', upload.uploadState);

if (upload.uploadState === 'REJECTED') {
  console.error('O pacote foi recusado:', JSON.stringify(upload.uploadError, null, 2));
  process.exit(1);
}

let state = upload;
for (let attempt = 0; attempt < 40 && state.uploadState === 'UPLOAD_IN_PROGRESS'; attempt += 1) {
  await new Promise((done) => setTimeout(done, 3000));
  const status = await fetch(`${base}:fetchStatus`, { headers: auth });
  state = await status.json();
  console.log('estado do envio:', state.uploadState);
}

if (state.uploadState !== 'ACCEPTED') {
  console.error('Envio não aceito:', JSON.stringify(state, null, 2));
  process.exit(1);
}

const publishResponse = await fetch(`${base}:publish`, { method: 'POST', headers: auth });
if (!publishResponse.ok) {
  console.error('Falha ao publicar:', publishResponse.status, await publishResponse.text());
  process.exit(1);
}
console.log('Enviado para revisao. Acompanhe em https://chrome.google.com/webstore/devconsole');
console.log('Escopo utilizado:', scope);
