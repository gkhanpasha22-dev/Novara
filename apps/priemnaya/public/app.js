// Панель оператора: без сборки и без зависимостей — открывается в любом браузере.

const $ = (sel) => document.querySelector(sel);

const state = {
  clients: [],
  templates: [],
  current: null,
  filter: 'all',
  query: '',
};

// ---------- сеть ----------

function password() {
  return localStorage.getItem('priemnaya_password') || '';
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      'x-panel-password': password(),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    const entered = prompt('Пароль панели:');
    if (entered) {
      localStorage.setItem('priemnaya_password', entered);
      return api(path, options);
    }
    throw new Error('Нет доступа');
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка запроса');
  return res.json();
}

// ---------- утилиты ----------

const CHANNEL_LABEL = { telegram: 'Telegram', site: 'Сайт', avito: 'Авито', manual: 'Вручную' };

function timeLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

// ---------- отрисовка ----------

function renderStats(digest) {
  const waiting = state.clients.filter((c) => c.unread > 0).length;
  const fresh = state.clients.filter((c) => c.status === 'new').length;
  $('#stats').innerHTML = `
    <span>Без ответа: <b>${waiting}</b></span>
    <span>Новых: <b>${fresh}</b></span>
    <span>Сегодня обращений: <b>${digest?.incoming ?? 0}</b></span>`;
}

function visibleClients() {
  const q = state.query.trim().toLowerCase();
  return state.clients.filter((c) => {
    if (state.filter !== 'all' && c.status !== state.filter) return false;
    if (!q) return true;
    return [c.name, c.phone, c.last_text, c.username].filter(Boolean).join(' ').toLowerCase().includes(q);
  });
}

function renderDialogs() {
  const list = visibleClients();
  const html = list
    .map(
      (c) => `
      <li class="dialog ${state.current?.id === c.id ? 'is-active' : ''}" data-id="${c.id}">
        <span class="dialog__name">${escapeHtml(c.name || 'Без имени')}</span>
        <span class="dialog__meta">
          ${c.unread > 0 ? '<span class="dot" title="Новое сообщение"></span>' : ''}
          <span class="src">${CHANNEL_LABEL[c.channel] || c.channel}</span>
          ${timeLabel(c.updated_at)}
        </span>
        <span class="dialog__preview">${c.last_direction === 'out' ? 'Вы: ' : ''}${escapeHtml(c.last_text || '—')}</span>
      </li>`,
    )
    .join('');
  $('#dialogs').innerHTML = html || '<li class="empty" style="padding:20px">Ничего не найдено</li>';
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function renderThread(client) {
  $('#thread-title').textContent = client.name || 'Без имени';
  const contacts = [client.username, client.phone].filter(Boolean).join(' · ');
  $('#thread-sub').textContent = `${CHANNEL_LABEL[client.channel] || client.channel}${contacts ? ' · ' + contacts : ''}`;

  $('#thread').innerHTML = client.messages
    .map(
      (m) => `<div class="msg ${m.direction === 'out' ? 'msg--out' : ''}">${escapeHtml(m.text)}
        <span class="msg__time">${timeLabel(m.created_at)}</span></div>`,
    )
    .join('');
  $('#thread').scrollTop = $('#thread').scrollHeight;

  $('#composer').hidden = false;
  $('#card').hidden = false;
  $('#c-name').value = client.name || '';
  $('#c-phone').value = client.phone || '';
  $('#c-note').value = client.note || '';
  $('#c-status').value = client.status;

  const hint = $('#send-hint');
  if (client.channel === 'telegram') {
    hint.hidden = true;
  } else {
    hint.hidden = false;
    hint.textContent = 'Это заявка с сайта или Авито: ответ сохранится в переписке, но не уйдёт клиенту — позвоните по телефону из карточки.';
  }

  renderReminders(client.reminders || []);
}

function renderReminders(reminders) {
  $('#reminders').innerHTML = reminders.length
    ? reminders
        .map(
          (r) => `<li>
            <span>${r.done ? '✅ ' : '⏰ '}${escapeHtml(r.text)} — ${new Date(r.due_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
            ${r.done ? '' : `<button class="btn btn--ghost" data-done="${r.id}">готово</button>`}
          </li>`,
        )
        .join('')
    : '<li class="empty" style="font-size:13px">Пока нет напоминаний</li>';
}

function renderTemplates() {
  $('#templates').innerHTML = state.templates
    .map((t) => `<button class="chip" type="button" data-template="${t.id}">${escapeHtml(t.title)}</button>`)
    .join('');
}

// ---------- действия ----------

async function loadState() {
  const data = await api('/api/state');
  state.clients = data.clients;
  state.templates = data.templates;
  $('#demo-badge').hidden = !data.demo;
  renderStats(data.digest);
  renderDialogs();
  renderTemplates();
}

async function openClient(id) {
  state.current = await api(`/api/clients/${id}`);
  renderThread(state.current);
  renderDialogs();
  $('#layout').dataset.view = 'thread';
  await loadState();
}

async function sendReply(text) {
  if (!state.current) return;
  const result = await api(`/api/clients/${state.current.id}/reply`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  if (result.error && result.delivered === false) {
    $('#send-hint').hidden = false;
    $('#send-hint').textContent = `Не отправлено: ${result.error}`;
  }
  await openClient(state.current.id);
}

let saveTimer;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!state.current) return;
    await api(`/api/clients/${state.current.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: $('#c-name').value,
        phone: $('#c-phone').value,
        note: $('#c-note').value,
        status: $('#c-status').value,
      }),
    });
    const saved = $('#saved');
    saved.hidden = false;
    setTimeout(() => (saved.hidden = true), 1500);
    await loadState();
  }, 600);
}

// ---------- события ----------

$('#dialogs').addEventListener('click', (e) => {
  const li = e.target.closest('.dialog');
  if (li) openClient(Number(li.dataset.id));
});

$('.filters').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('.filters .chip').forEach((c) => c.classList.remove('is-active'));
  chip.classList.add('is-active');
  state.filter = chip.dataset.filter;
  renderDialogs();
});

$('#search').addEventListener('input', (e) => {
  state.query = e.target.value;
  renderDialogs();
});

$('#composer').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('#reply').value.trim();
  if (!text) return;
  $('#reply').value = '';
  await sendReply(text);
});

$('#reply').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    $('#composer').requestSubmit();
  }
});

$('#templates').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-template]');
  if (!btn) return;
  const tpl = state.templates.find((t) => t.id === Number(btn.dataset.template));
  if (!tpl) return;
  const field = $('#reply');
  field.value = field.value ? `${field.value}\n${tpl.body}` : tpl.body;
  field.focus();
});

for (const id of ['#c-name', '#c-phone', '#c-note', '#c-status']) {
  $(id).addEventListener('input', scheduleSave);
  $(id).addEventListener('change', scheduleSave);
}

$('.reminder-quick').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-in]');
  if (!btn || !state.current) return;
  const due = new Date(Date.now() + Number(btn.dataset.in) * 60000).toISOString();
  await api(`/api/clients/${state.current.id}/reminders`, {
    method: 'POST',
    body: JSON.stringify({ text: `Связаться: ${state.current.name || 'клиент'}`, due_at: due }),
  });
  await openClient(state.current.id);
});

$('#reminders').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-done]');
  if (!btn) return;
  await api(`/api/reminders/${btn.dataset.done}/done`, { method: 'POST' });
  await openClient(state.current.id);
});

$('#back-btn').addEventListener('click', () => {
  $('#layout').dataset.view = 'list';
});

$('#digest-btn').addEventListener('click', async () => {
  const { text } = await api('/api/digest');
  $('#digest-text').textContent = text;
  $('#digest-dialog').showModal();
});

// ---------- живое обновление ----------

function connectEvents() {
  const source = new EventSource('/api/events');
  source.onmessage = async (e) => {
    const event = JSON.parse(e.data);
    await loadState();
    if (state.current && event.clientId === state.current.id) {
      state.current = await api(`/api/clients/${state.current.id}`);
      renderThread(state.current);
    }
  };
  source.onerror = () => {
    // EventSource переподключится сам; логируем, чтобы было видно в консоли на демо.
    console.warn('Соединение с сервером потеряно, переподключаемся…');
  };
}

loadState().then(connectEvents).catch((err) => {
  document.body.insertAdjacentHTML('afterbegin', `<p style="padding:16px;color:#b91c1c">${escapeHtml(err.message)}</p>`);
});
