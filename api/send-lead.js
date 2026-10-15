// Vercel Serverless Function: POST /api/send-lead
// Принимает заявку с лендинга и отправляет её в Telegram.
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

const LANDING_TYPE = 'Spółka z o.o.';
const MAX_BODY_BYTES = 10 * 1024;

const LABELS = {
  form_id: { hero: 'Форма на первом экране', quiz: 'Калькулятор' },
  company_status: {
    active: 'Активная / действующая',
    new_or_dormant: 'Новая / без деятельности',
    dormant: '«Спящая», без операций',
    registering: 'В процессе регистрации',
  },
  extras: { vat: 'VAT / VAT-UE', staff: 'Сотрудники', office: 'Виртуальный офис' },
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clean(value, max = 200) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

// Та же логика, что и на клиенте: номер (PL или международный) либо Telegram @username
function parseContact(raw) {
  const v = clean(raw, 64);
  if (/^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(v)) {
    return { valid: true, type: 'telegram', value: '@' + v.replace(/^@/, '') };
  }
  let d = v.replace(/\D/g, '');
  if (!v.startsWith('+') && d.length === 9) d = '48' + d;
  if (d.startsWith('48')) return { valid: d.length === 11, type: 'phone', value: '+' + d };
  return { valid: d.length >= 8 && d.length <= 15, type: 'phone', value: '+' + d };
}

function parseBody(req) {
  const body = req.body;
  if (body && typeof body === 'object') return body;
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) return null;
    try { return JSON.parse(body); } catch { return null; }
  }
  return null;
}

function buildMessage(lead, contact) {
  const label = (group, key) => LABELS[group][key] || key;
  const lines = [`<b>🆕 Новая заявка — ${escapeHtml(LANDING_TYPE)}</b>`, ''];

  if (lead.name) lines.push(`<b>Имя:</b> ${escapeHtml(lead.name)}`);
  if (contact.type === 'telegram') {
    const handle = contact.value.slice(1);
    lines.push(`<b>Telegram:</b> <a href="https://t.me/${handle}">${escapeHtml(contact.value)}</a>`);
  } else {
    lines.push(`<b>Телефон:</b> ${escapeHtml(contact.value)}`);
  }
  if (lead.company_status) lines.push(`<b>Статус компании:</b> ${escapeHtml(label('company_status', lead.company_status))}`);
  lines.push(`<b>Источник:</b> ${escapeHtml(label('form_id', lead.form_id))}`);

  if (lead.form_id === 'quiz') {
    lines.push('', '<b>Расчёт из калькулятора</b>');
    if (lead.invoices) lines.push(`Фактур в месяц: ${escapeHtml(lead.invoices)}`);
    if (lead.extras.length) lines.push(`Дополнительно: ${escapeHtml(lead.extras.map((x) => label('extras', x)).join(', '))}`);
    if (lead.estimate_monthly) lines.push(`Ежемесячно: от ${lead.estimate_monthly} zł`);
    if (lead.estimate_one_time) lines.push(`Разово: ${lead.estimate_one_time} zł`);
  }

  lines.push('');
  if (lead.page) lines.push(`<b>Страница:</b> ${escapeHtml(lead.page)}`);
  lines.push(`<b>Время:</b> ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Warsaw' })} (Варшава)`);
  return lines.join('\n');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('send-lead: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set');
    return res.status(500).json({ ok: false, error: 'not_configured' });
  }

  const body = parseBody(req);
  if (!body) return res.status(400).json({ ok: false, error: 'invalid_json' });

  const contact = parseContact(body.contact);
  if (!contact.valid) return res.status(422).json({ ok: false, error: 'invalid_contact' });

  const toNumber = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : 0);
  const lead = {
    name: clean(body.name, 100),
    form_id: clean(body.form_id, 20) || 'unknown',
    company_status: clean(body.company_status, 30),
    invoices: clean(body.invoices, 20),
    extras: Array.isArray(body.extras) ? body.extras.slice(0, 10).map((x) => clean(x, 20)).filter(Boolean) : [],
    estimate_monthly: toNumber(body.estimate_monthly),
    estimate_one_time: toNumber(body.estimate_one_time),
    page: clean(body.page, 300),
  };
  if (lead.form_id === 'hero' && lead.name.length < 2) {
    return res.status(422).json({ ok: false, error: 'invalid_name' });
  }

  try {
    const tg = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: buildMessage(lead, contact),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!tg.ok) {
      console.error('send-lead: Telegram API error', tg.status, await tg.text());
      return res.status(502).json({ ok: false, error: 'delivery_failed' });
    }
  } catch (err) {
    console.error('send-lead: Telegram request failed', err);
    return res.status(502).json({ ok: false, error: 'delivery_failed' });
  }

  return res.status(200).json({ ok: true, landing_type: LANDING_TYPE });
};
