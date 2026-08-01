// Config loader. Reads .env next to the app root without any dependency.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const fileEnv = readEnvFile(join(ROOT, '.env'));
const env = { ...fileEnv, ...process.env };

export const config = {
  botToken: env.BOT_TOKEN || '',
  ownerChatId: env.OWNER_CHAT_ID || '',
  digestHour: Number(env.DIGEST_HOUR ?? 20),
  panelPassword: env.PANEL_PASSWORD || '',
  port: Number(env.PORT || 8787),
  autoreply: env.AUTOREPLY ?? '',
  dbPath: env.DB_PATH || join(ROOT, 'data', 'priemnaya.db'),
  // Demo mode: no bot token (or forced) → seed sample dialogs, nothing is sent outside.
  demo: env.PRIEMNAYA_DEMO === '1' || !env.BOT_TOKEN,
};
