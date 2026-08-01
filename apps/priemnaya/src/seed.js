// Demo data: lets you show the product on a laptop with no bot, no clients, no internet.
// Runs only when the database is empty.
import { db, upsertClient, addMessage, addTemplate, listTemplates, updateClient } from './db.js';

const DIALOGS = [
  {
    channel: 'telegram',
    externalId: 'demo-1',
    name: 'Патимат Алиева',
    username: '@patimat',
    phone: '+7 928 000-11-22',
    note: 'Приезжает с семьёй, 4 человека, нужен трансфер из аэропорта.',
    status: 'open',
    messages: [
      ['in', 'Здравствуйте! Свободен ли дом с 12 по 15 августа?'],
      ['out', 'Здравствуйте! Да, свободен. Дом на 6 гостей, 4500 ₽ за ночь.'],
      ['in', 'А трансфер от аэропорта организуете?'],
    ],
  },
  {
    channel: 'site',
    externalId: 'demo-2',
    name: 'Магомед',
    phone: '+7 963 555-44-33',
    note: 'Заявка с сайта, форма «Забронировать».',
    status: 'new',
    messages: [['in', 'Заявка с сайта: нужен номер на двоих на выходные, перезвоните.']],
  },
  {
    channel: 'avito',
    externalId: 'demo-3',
    name: 'Елена',
    note: 'Спрашивала про парковку и Wi-Fi.',
    status: 'done',
    messages: [
      ['in', 'Добрый день, парковка есть?'],
      ['out', 'Да, во дворе, бесплатно. Wi-Fi тоже есть.'],
      ['in', 'Спасибо, забронировала!'],
    ],
  },
];

const TEMPLATES = [
  ['Цены', 'Стоимость проживания — 4500 ₽ за ночь, завтрак включён. Заезд с 14:00, выезд до 12:00.'],
  ['Как добраться', 'Мы находимся по адресу: ___. Пришлю точку на карте, от трассы 10 минут.'],
  ['Свободно', 'Да, на эти даты свободно. Чтобы закрепить, нужна предоплата 30%.'],
  ['Занято', 'К сожалению, на эти даты всё занято. Могу предложить соседние — подойдут?'],
  ['Реквизиты', 'Оплата по СБП на номер ___. После перевода пришлите скриншот, я подтвержу бронь.'],
];

export function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM clients').get().n;
  if (count > 0) return false;

  for (const d of DIALOGS) {
    const client = upsertClient(d);
    for (const [direction, text] of d.messages) addMessage(client.id, direction, text);
    updateClient(client.id, { note: d.note ?? '', status: d.status });
  }

  if (listTemplates().length === 0) {
    for (const [title, body] of TEMPLATES) addTemplate(title, body);
  }

  console.log('[seed] загружены демо-диалоги — панель можно показывать без бота');
  return true;
}
