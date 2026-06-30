import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env');
const tokenUrl = 'https://www.onemap.gov.sg/api/auth/post/getToken';

const parseEnvValue = (value = '') => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const readEnvFile = async () => {
  if (!existsSync(envPath)) {
    return { text: '', entries: {} };
  }

  const text = await readFile(envPath, 'utf8');
  const entries = {};

  text.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([^#=\s]+)\s*=(.*)$/);
    if (!match) {
      return;
    }
    entries[match[1]] = parseEnvValue(match[2]);
  });

  return { text, entries };
};

const upsertEnvValue = (text, key, value) => {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(text)) {
    return text.replace(pattern, line);
  }

  const separator = text && !text.endsWith('\n') ? '\n' : '';
  return `${text}${separator}${line}\n`;
};

const main = async () => {
  const { text, entries } = await readEnvFile();
  const email = entries.ONEMAP_EMAIL;
  const password = entries.ONEMAP_EMAIL_PASSWORD;

  if (!email || !password) {
    console.error(
      'Missing ONEMAP_EMAIL or ONEMAP_EMAIL_PASSWORD in .env. Add them, then run npm run onemap:token again.'
    );
    process.exit(1);
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    console.error(`OneMap token request failed with HTTP ${response.status}.`);
    process.exit(1);
  }

  const data = await response.json();
  if (!data?.access_token) {
    console.error('OneMap token response did not include access_token.');
    process.exit(1);
  }

  let nextText = upsertEnvValue(text, 'ONEMAP_API_TOKEN', data.access_token);
  if (data.expiry_timestamp) {
    nextText = upsertEnvValue(nextText, 'ONEMAP_TOKEN_EXPIRY', String(data.expiry_timestamp));
  }

  await writeFile(envPath, nextText);
  const expiry = data.expiry_timestamp
    ? new Date(Number(data.expiry_timestamp) * 1000).toLocaleString()
    : 'unknown';
  console.log(`Updated ONEMAP_API_TOKEN in .env. Token expiry: ${expiry}`);
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
