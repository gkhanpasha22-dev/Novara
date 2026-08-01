// Daily digest + reminder watcher. The owner gets one message in the evening,
// not a stream of notifications — that is the whole point of the product.
import { config } from './config.js';
import { digestStats, getSetting, setSetting, dueReminders, markReminderNotified } from './db.js';
import { sendMessage } from './telegram.js';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

export function buildDigest() {
  const stats = digestStats(startOfToday());
  const lines = [
    '📊 Итог дня',
    '',
    `Обращений: ${stats.incoming}`,
    `Ответов отправлено: ${stats.answered}`,
    `Новых клиентов: ${stats.newClients}`,
    `Без ответа сейчас: ${stats.waiting}`,
    `В работе: ${stats.openDeals}`,
  ];
  if (stats.unanswered.length) {
    lines.push('', 'Ждут ответа:');
    for (const c of stats.unanswered) lines.push(`• ${c.name || 'Без имени'} (${c.channel})`);
  }
  return { text: lines.join('\n'), stats };
}

/** Runs every five minutes: sends the digest once a day and fires due reminders. */
export function startScheduler() {
  const tick = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const hour = new Date().getHours();

      if (config.ownerChatId && hour >= config.digestHour && getSetting('digest_sent_on') !== today) {
        const { text } = buildDigest();
        await sendMessage(config.ownerChatId, text);
        setSetting('digest_sent_on', today);
      }

      if (config.ownerChatId) {
        for (const r of dueReminders()) {
          await sendMessage(config.ownerChatId, `⏰ Напоминание: ${r.text}\nКлиент: ${r.client_name || '—'}`);
          markReminderNotified(r.id);
        }
      }
    } catch (err) {
      console.error('[scheduler]', err.message);
    }
  };

  tick();
  return setInterval(tick, 5 * 60 * 1000);
}
