// Storage layer. Built-in node:sqlite — no external dependencies, single file DB.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS clients (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    channel      TEXT NOT NULL,              -- telegram | site | avito | manual
    external_id  TEXT,                       -- chat id in the channel
    name         TEXT NOT NULL DEFAULT '',
    username     TEXT NOT NULL DEFAULT '',
    phone        TEXT NOT NULL DEFAULT '',
    note         TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'new', -- new | open | done
    unread       INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    UNIQUE (channel, external_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    direction  TEXT NOT NULL,               -- in | out
    text       TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_client ON messages (client_id, id);

  CREATE TABLE IF NOT EXISTS templates (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    text       TEXT NOT NULL,
    due_at     TEXT NOT NULL,
    done       INTEGER NOT NULL DEFAULT 0,
    notified   INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export const now = () => new Date().toISOString();

export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, String(value));
}

/** Find or create a client by channel + external id. */
export function upsertClient({ channel, externalId, name = '', username = '', phone = '' }) {
  const existing = db
    .prepare('SELECT * FROM clients WHERE channel = ? AND external_id = ?')
    .get(channel, String(externalId ?? ''));

  if (existing) {
    // Keep the freshest profile data the channel gives us, never wipe manual edits.
    db.prepare(
      `UPDATE clients SET name = CASE WHEN ? <> '' THEN ? ELSE name END,
                          username = CASE WHEN ? <> '' THEN ? ELSE username END,
                          phone = CASE WHEN phone = '' THEN ? ELSE phone END,
                          updated_at = ?
       WHERE id = ?`,
    ).run(name, name, username, username, phone, now(), existing.id);
    return db.prepare('SELECT * FROM clients WHERE id = ?').get(existing.id);
  }

  const ts = now();
  const info = db
    .prepare(
      `INSERT INTO clients (channel, external_id, name, username, phone, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(channel, String(externalId ?? ''), name, username, phone, ts, ts);
  return db.prepare('SELECT * FROM clients WHERE id = ?').get(info.lastInsertRowid);
}

export function addMessage(clientId, direction, text) {
  const ts = now();
  db.prepare('INSERT INTO messages (client_id, direction, text, created_at) VALUES (?, ?, ?, ?)').run(
    clientId,
    direction,
    text,
    ts,
  );
  if (direction === 'in') {
    db.prepare('UPDATE clients SET unread = unread + 1, updated_at = ? WHERE id = ?').run(ts, clientId);
  } else {
    db.prepare(
      `UPDATE clients SET unread = 0, updated_at = ?,
                          status = CASE WHEN status = 'new' THEN 'open' ELSE status END
       WHERE id = ?`,
    ).run(ts, clientId);
  }
  return { clientId, direction, text, created_at: ts };
}

export function listClients() {
  return db
    .prepare(
      `SELECT c.*,
              (SELECT text FROM messages m WHERE m.client_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_text,
              (SELECT direction FROM messages m WHERE m.client_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_direction
       FROM clients c
       ORDER BY c.updated_at DESC`,
    )
    .all();
}

export function getClient(id) {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!client) return null;
  client.messages = db
    .prepare('SELECT id, direction, text, created_at FROM messages WHERE client_id = ? ORDER BY id')
    .all(id);
  client.reminders = db
    .prepare('SELECT id, text, due_at, done FROM reminders WHERE client_id = ? ORDER BY due_at')
    .all(id);
  return client;
}

export function updateClient(id, fields) {
  const allowed = ['name', 'phone', 'note', 'status'];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (!keys.length) return getClient(id);
  const sql = `UPDATE clients SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`;
  db.prepare(sql).run(...keys.map((k) => String(fields[k] ?? '')), now(), id);
  return getClient(id);
}

export function markRead(id) {
  db.prepare('UPDATE clients SET unread = 0 WHERE id = ?').run(id);
}

export function listTemplates() {
  return db.prepare('SELECT * FROM templates ORDER BY id').all();
}

export function addTemplate(title, body) {
  const info = db.prepare('INSERT INTO templates (title, body) VALUES (?, ?)').run(title, body);
  return db.prepare('SELECT * FROM templates WHERE id = ?').get(info.lastInsertRowid);
}

export function deleteTemplate(id) {
  db.prepare('DELETE FROM templates WHERE id = ?').run(id);
}

export function addReminder(clientId, text, dueAt) {
  const info = db
    .prepare('INSERT INTO reminders (client_id, text, due_at) VALUES (?, ?, ?)')
    .run(clientId, text, dueAt);
  return db.prepare('SELECT * FROM reminders WHERE id = ?').get(info.lastInsertRowid);
}

export function completeReminder(id) {
  db.prepare('UPDATE reminders SET done = 1 WHERE id = ?').run(id);
}

export function dueReminders() {
  return db
    .prepare(
      `SELECT r.*, c.name AS client_name FROM reminders r
       JOIN clients c ON c.id = r.client_id
       WHERE r.done = 0 AND r.notified = 0 AND r.due_at <= ?`,
    )
    .all(now());
}

export function markReminderNotified(id) {
  db.prepare('UPDATE reminders SET notified = 1 WHERE id = ?').run(id);
}

/** Numbers for the daily digest: what came in, what is still hanging. */
export function digestStats(sinceIso) {
  const incoming = db
    .prepare("SELECT COUNT(*) AS n FROM messages WHERE direction = 'in' AND created_at >= ?")
    .get(sinceIso).n;
  const answered = db
    .prepare("SELECT COUNT(*) AS n FROM messages WHERE direction = 'out' AND created_at >= ?")
    .get(sinceIso).n;
  const newClients = db.prepare('SELECT COUNT(*) AS n FROM clients WHERE created_at >= ?').get(sinceIso).n;
  const waiting = db.prepare('SELECT COUNT(*) AS n FROM clients WHERE unread > 0').get().n;
  const openDeals = db.prepare("SELECT COUNT(*) AS n FROM clients WHERE status IN ('new','open')").get().n;
  const unanswered = db
    .prepare(
      `SELECT c.id, c.name, c.channel FROM clients c
       WHERE c.unread > 0 ORDER BY c.updated_at LIMIT 10`,
    )
    .all();
  return { incoming, answered, newClients, waiting, openDeals, unanswered };
}
