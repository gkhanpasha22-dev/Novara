// Telegram transport: long polling for incoming messages, sendMessage for replies.
// Long polling is used on purpose — a prototype must run on a laptop without a public URL.
import { config } from './config.js';
import { upsertClient, addMessage, getSetting, setSetting, db } from './db.js';

const API = (method) => `https://api.telegram.org/bot${config.botToken}/${method}`;

export async function callTelegram(method, payload) {
  if (!config.botToken) return { ok: false, description: 'demo mode: no BOT_TOKEN' };
  const res = await fetch(API(method), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function sendMessage(chatId, text) {
  return callTelegram('sendMessage', { chat_id: chatId, text });
}

function displayName(from) {
  return [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || 'Без имени';
}

/**
 * Handle one incoming Telegram update.
 * Returns the affected client id so the caller can push a live update to the panel.
 */
async function handleUpdate(update, onEvent) {
  const msg = update.message ?? update.edited_message;
  if (!msg?.from) return null;

  const text = msg.text ?? (msg.caption || '[вложение]');
  const client = upsertClient({
    channel: 'telegram',
    externalId: msg.chat.id,
    name: displayName(msg.from),
    username: msg.from.username ? `@${msg.from.username}` : '',
    phone: msg.contact?.phone_number ?? '',
  });

  const isFirstMessage =
    db.prepare('SELECT COUNT(*) AS n FROM messages WHERE client_id = ?').get(client.id).n === 0;

  addMessage(client.id, 'in', text);

  // Auto-reply only once per client, so a chat never turns into a bot ping-pong.
  if (isFirstMessage && config.autoreply) {
    const sent = await sendMessage(msg.chat.id, config.autoreply);
    if (sent.ok !== false) addMessage(client.id, 'out', config.autoreply);
  }

  onEvent?.({ type: 'message', clientId: client.id });
  return client.id;
}

/** Long polling loop. Keeps the update offset in settings so restarts do not replay history. */
export function startPolling(onEvent) {
  if (!config.botToken) {
    console.log('[telegram] BOT_TOKEN не задан — работаем в демо-режиме, опрос не запускается');
    return;
  }

  let stopped = false;
  let offset = Number(getSetting('tg_offset', '0'));

  (async function loop() {
    console.log('[telegram] опрос запущен');
    while (!stopped) {
      try {
        const res = await fetch(API('getUpdates') + `?timeout=30&offset=${offset}`);
        const data = await res.json();
        if (!data.ok) {
          console.error('[telegram] ошибка API:', data.description);
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        for (const update of data.result) {
          offset = update.update_id + 1;
          setSetting('tg_offset', offset);
          try {
            await handleUpdate(update, onEvent);
          } catch (err) {
            console.error('[telegram] не смог обработать сообщение:', err.message);
          }
        }
      } catch (err) {
        // Network hiccup: back off and keep going, the loop must survive a dropped Wi-Fi.
        console.error('[telegram] сеть недоступна:', err.message);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  })();

  return () => {
    stopped = true;
  };
}
