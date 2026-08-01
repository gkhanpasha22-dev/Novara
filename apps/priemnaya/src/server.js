// HTTP layer: static panel + JSON API + live updates over SSE.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { config, ROOT } from './config.js';
import {
  listClients,
  getClient,
  updateClient,
  markRead,
  addMessage,
  upsertClient,
  listTemplates,
  addTemplate,
  deleteTemplate,
  addReminder,
  completeReminder,
  db,
} from './db.js';
import { startPolling, sendMessage } from './telegram.js';
import { startScheduler, buildDigest } from './digest.js';
import { seedIfEmpty } from './seed.js';

const PUBLIC_DIR = join(ROOT, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ---------- live updates ----------

const sseClients = new Set();

function broadcast(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of sseClients) res.write(payload);
}

// ---------- helpers ----------

const json = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  const type = req.headers['content-type'] || '';

  if (type.includes('application/json')) {
    try {
      return JSON.parse(raw || '{}');
    } catch {
      return {};
    }
  }
  if (type.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  if (type.includes('multipart/form-data')) {
    // Minimal text-field parser so the existing site form (FormData) works as is.
    const boundary = type.split('boundary=')[1];
    if (!boundary) return {};
    const out = {};
    for (const part of raw.split(`--${boundary}`)) {
      const match = part.match(/name="([^"]+)"/);
      if (!match) continue;
      const value = part.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '');
      out[match[1]] = value;
    }
    return out;
  }
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function authorized(req) {
  if (!config.panelPassword) return true;
  const header = req.headers['x-panel-password'];
  return header === config.panelPassword;
}

// ---------- routes ----------

async function handleApi(req, res, url) {
  const path = url.pathname;
  const method = req.method;

  // Public intake webhook: site forms, Avito exports, anything that can POST.
  if (path === '/api/intake' && method === 'POST') {
    const body = await readBody(req);
    if (body.company) return json(res, 200, { ok: true }); // honeypot from the site form
    const name = body.name || 'Заявка с сайта';
    const text =
      body.message || body.text || body.comment || 'Заявка без текста';
    const client = upsertClient({
      channel: body.source || 'site',
      externalId: body.external_id || `${body.phone || body.email || name}-${Date.now()}`,
      name,
      phone: body.phone || '',
    });
    const contact = [body.phone, body.email].filter(Boolean).join(' · ');
    addMessage(client.id, 'in', contact ? `${text}\n\nКонтакт: ${contact}` : text);
    broadcast({ type: 'message', clientId: client.id });
    if (config.ownerChatId) {
      sendMessage(config.ownerChatId, `🆕 Новая заявка: ${name}\n${text}\n${contact}`).catch(() => {});
    }
    return json(res, 200, { ok: true });
  }

  if (!authorized(req)) return json(res, 401, { error: 'Требуется пароль панели' });

  if (path === '/api/state' && method === 'GET') {
    return json(res, 200, {
      clients: listClients(),
      templates: listTemplates(),
      digest: buildDigest().stats,
      demo: config.demo,
      channels: { telegram: Boolean(config.botToken) },
    });
  }

  const clientMatch = path.match(/^\/api\/clients\/(\d+)$/);
  if (clientMatch && method === 'GET') {
    const client = getClient(Number(clientMatch[1]));
    if (!client) return json(res, 404, { error: 'Клиент не найден' });
    markRead(client.id);
    broadcast({ type: 'read', clientId: client.id });
    return json(res, 200, client);
  }

  if (clientMatch && method === 'PATCH') {
    const body = await readBody(req);
    const client = updateClient(Number(clientMatch[1]), body);
    broadcast({ type: 'client', clientId: client.id });
    return json(res, 200, client);
  }

  const replyMatch = path.match(/^\/api\/clients\/(\d+)\/reply$/);
  if (replyMatch && method === 'POST') {
    const id = Number(replyMatch[1]);
    const { text } = await readBody(req);
    if (!text?.trim()) return json(res, 400, { error: 'Пустое сообщение' });

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    if (!client) return json(res, 404, { error: 'Клиент не найден' });

    let delivered = true;
    let error = null;
    if (client.channel === 'telegram' && config.botToken) {
      const result = await sendMessage(client.external_id, text);
      delivered = result.ok === true;
      if (!delivered) error = result.description || 'Telegram отклонил сообщение';
    } else {
      // Site and Avito leads have no return channel yet — the reply is a note for the owner.
      delivered = false;
      error = config.demo ? 'демо-режим: сообщение сохранено, но не отправлено' : 'канал только для чтения';
    }

    addMessage(id, 'out', text);
    broadcast({ type: 'message', clientId: id });
    return json(res, 200, { ok: true, delivered, error });
  }

  const reminderMatch = path.match(/^\/api\/clients\/(\d+)\/reminders$/);
  if (reminderMatch && method === 'POST') {
    const { text, due_at } = await readBody(req);
    const reminder = addReminder(Number(reminderMatch[1]), text || 'Перезвонить', due_at || new Date().toISOString());
    return json(res, 200, reminder);
  }

  const reminderDone = path.match(/^\/api\/reminders\/(\d+)\/done$/);
  if (reminderDone && method === 'POST') {
    completeReminder(Number(reminderDone[1]));
    return json(res, 200, { ok: true });
  }

  if (path === '/api/templates' && method === 'POST') {
    const { title, body } = await readBody(req);
    if (!title?.trim() || !body?.trim()) return json(res, 400, { error: 'Нужны название и текст' });
    return json(res, 200, addTemplate(title.trim(), body.trim()));
  }

  const templateMatch = path.match(/^\/api\/templates\/(\d+)$/);
  if (templateMatch && method === 'DELETE') {
    deleteTemplate(Number(templateMatch[1]));
    return json(res, 200, { ok: true });
  }

  if (path === '/api/digest' && method === 'GET') {
    return json(res, 200, buildDigest());
  }

  // Helper for setup: shows chat ids that already wrote to the bot, to fill OWNER_CHAT_ID.
  if (path === '/api/whoami' && method === 'GET') {
    return json(res, 200, {
      chats: db
        .prepare("SELECT name, username, external_id FROM clients WHERE channel = 'telegram' ORDER BY id DESC LIMIT 10")
        .all(),
    });
  }

  if (path === '/api/events' && method === 'GET') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write('retry: 3000\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  return json(res, 404, { error: 'Неизвестный метод API' });
}

async function serveStatic(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : normalize(pathname).replace(/^(\.\.[/\\])+/, '').slice(1);
  const file = join(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const content = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Не найдено');
  }
}

// ---------- boot ----------

seedIfEmpty();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, x-panel-password',
      'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    });
    return res.end();
  }
  res.setHeader('access-control-allow-origin', '*');

  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return await serveStatic(res, url.pathname);
  } catch (err) {
    console.error('[server]', err);
    if (!res.headersSent) json(res, 500, { error: 'Внутренняя ошибка' });
  }
});

server.listen(config.port, () => {
  console.log(`\n  Приёмная → http://localhost:${config.port}`);
  console.log(`  Режим: ${config.demo ? 'демо (без отправки в Telegram)' : 'боевой'}`);
  if (config.panelPassword) console.log('  Панель под паролем (PANEL_PASSWORD)');
  console.log('');
});

startPolling(broadcast);
startScheduler();
