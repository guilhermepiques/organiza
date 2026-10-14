// Entende frases como "pagar conta amanhã 18h #casa @urgente p1 toda segunda".
// Retorna os campos encontrados e o título limpo.

import { normalizeAligned } from '../../core/util.js';
import { todayISO, addDays, addMonths, toISO, fromISO, weekday, daysInMonth, pad } from '../../core/date.js';

const WD = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
const MONTHS = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const WD_RE = '(domingo|segunda|terca|quarta|quinta|sexta|sabado)';

function nextWeekday(target, today, strictlyAfter = false) {
  let diff = (target - weekday(today) + 7) % 7;
  if (diff === 0 && strictlyAfter) diff = 7;
  return addDays(today, diff);
}

/**
 * @returns {{ title, date, time, priority, labels, project, recurrence, tokens }}
 */
export function parseTask(text, { today = todayISO() } = {}) {
  const norm = normalizeAligned(text);
  const ranges = [];
  const tokens = [];
  const r = { date: null, time: null, priority: null, labels: [], project: null, recurrence: null };

  // Procura no texto normalizado; registra o trecho para removê-lo do título.
  const take = (re, fn) => {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = g.exec(norm))) {
      const start = m.index, end = m.index + m[0].length;
      if (ranges.some(([a, b]) => start < b && end > a)) continue;
      if (fn(m, start, end) !== false) ranges.push([start, end]);
      if (!g.global) break;
    }
  };

  // ----- repetição -----
  take(/\b(todo dia|todos os dias|diariamente)\b/, () => { r.recurrence = { freq: 'daily', interval: 1 }; });
  take(/\b(dias uteis|todo dia util)\b/, () => { r.recurrence = { freq: 'weekly', interval: 1, days: [1, 2, 3, 4, 5] }; });
  // "toda segunda", "toda segunda e quarta", "todas as terças, quintas e sábados"
  const WD_ITEM = `${WD_RE}s?(?:-feiras?)?`;
  take(new RegExp(`\\b(?:toda|todo|todas as|todos os)\\s+${WD_ITEM}(?:\\s*(?:,|e)\\s*${WD_ITEM})*\\b`), (m) => {
    const days = [...m[0].matchAll(new RegExp(WD_RE, 'g'))].map((x) => WD[x[1]]);
    r.recurrence = { freq: 'weekly', interval: 1, days: [...new Set(days)].sort() };
  });
  take(/\b(toda semana|semanalmente|todas as semanas)\b/, () => { r.recurrence = { freq: 'weekly', interval: 1 }; });
  take(/\b(todo mes|mensalmente|todos os meses)\b/, () => { r.recurrence = { freq: 'monthly', interval: 1 }; });
  take(/\b(todo ano|anualmente|todos os anos)\b/, () => { r.recurrence = { freq: 'yearly', interval: 1 }; });
  take(/\ba cada (\d+) (dias?|semanas?|mes|meses|anos?)\b/, (m) => {
    const unit = m[2].startsWith('dia') ? 'daily' : m[2].startsWith('semana') ? 'weekly' : m[2].startsWith('mes') ? 'monthly' : 'yearly';
    r.recurrence = { freq: unit, interval: Math.max(1, +m[1]) };
  });

  // ----- data -----
  const setDate = (d) => { if (!r.date) r.date = d; };
  take(/\bdepois de amanha\b/, () => setDate(addDays(today, 2)));
  take(/\bamanha\b/, () => setDate(addDays(today, 1)));
  take(/\bhoje\b/, () => setDate(today));
  take(/\b(?:em|daqui a)\s+(\d+)\s+(dias?|semanas?|mes|meses)\b/, (m) => {
    const n = +m[1];
    setDate(m[2].startsWith('dia') ? addDays(today, n) : m[2].startsWith('semana') ? addDays(today, n * 7) : addMonths(today, n));
  });
  take(/\b(?:proxima semana|semana que vem)\b/, () => setDate(nextWeekday(1, today, true)));
  take(new RegExp(`\\b(?:(na|no|nesta|neste|proxima|proximo)\\s+)?${WD_RE}(?:-feira)?(?:\\s+que vem)?\\b`), (m) => {
    const strict = /^proxim/.test(m[1] || '') || /que vem$/.test(m[0]);
    setDate(nextWeekday(WD[m[2]], today, strict));
  });
  take(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, (m) => {
    const day = +m[1], month = +m[2] - 1;
    if (month < 0 || month > 11 || day < 1) return false;
    let year = m[3] ? +m[3] : fromISO(today).getFullYear();
    if (year < 100) year += 2000;
    if (day > daysInMonth(year, month)) return false;
    let iso = `${year}-${pad(month + 1)}-${pad(day)}`;
    if (!m[3] && iso < today) iso = `${year + 1}-${pad(month + 1)}-${pad(day)}`;
    setDate(iso);
  });
  take(new RegExp(`\\b(?:dia\\s+)?(\\d{1,2})\\s+de\\s+(${MONTHS.join('|')})\\b`), (m) => {
    const month = MONTHS.indexOf(m[2]);
    let year = fromISO(today).getFullYear();
    const day = +m[1];
    if (day < 1 || day > daysInMonth(year, month)) return false;
    let iso = `${year}-${pad(month + 1)}-${pad(day)}`;
    if (iso < today) iso = `${year + 1}-${pad(month + 1)}-${pad(day)}`;
    setDate(iso);
  });
  take(/\b(?:no\s+)?dia\s+(\d{1,2})\b(?!\/)/, (m) => {
    const day = +m[1];
    if (day < 1 || day > 31) return false;
    const t = fromISO(today);
    let d = new Date(t.getFullYear(), t.getMonth(), Math.min(day, daysInMonth(t.getFullYear(), t.getMonth())));
    if (toISO(d) < today) {
      const nm = new Date(t.getFullYear(), t.getMonth() + 1, 1);
      d = new Date(nm.getFullYear(), nm.getMonth(), Math.min(day, daysInMonth(nm.getFullYear(), nm.getMonth())));
    }
    setDate(toISO(d));
  });

  // ----- hora -----
  const setTime = (h, m = 0) => {
    if (r.time || h > 23 || m > 59) return false;
    r.time = `${pad(h)}:${pad(m)}`;
  };
  take(/(?:\b(?:as|a)\s+)?\b(\d{1,2})(?:h(\d{2})?|:(\d{2}))(?:min)?(?![\w/])/, (m) => setTime(+m[1], +(m[2] || m[3] || 0)));
  // "às 9" sem "h": só aceita quando o usuário escreveu "às" com acento (evita confundir com "as 3 caixas")
  take(/\bas\s+(\d{1,2})\b(?![\w/:.,])/, (m, start) => (text[start] === 'à' || text[start] === 'À' ? setTime(+m[1]) : false));
  take(/\bmeio[- ]dia\b/, () => setTime(12));
  take(/\b(?:de|pela|a)\s+manha\b/, () => setTime(9));
  take(/\b(?:de|pela|a)\s+tarde\b/, () => setTime(15));
  take(/\b(?:de|pela|a)\s+noite\b/, () => setTime(20));

  // ----- prioridade -----
  take(/(?:^|\s)(?:!|p)([1-4])\b/, (m) => { r.priority = +m[1]; });
  take(/(?:^|\s)(urgente)\b/, () => { if (!r.priority) r.priority = 1; return false; });

  // ----- etiquetas e projeto (no texto original, para manter acentos) -----
  for (const m of text.matchAll(/(^|\s)@([\p{L}\p{N}_-]+)/gu)) {
    ranges.push([m.index + m[1].length, m.index + m[0].length]);
    if (!r.labels.includes(m[2])) r.labels.push(m[2]);
  }
  for (const m of text.matchAll(/(^|\s)#([\p{L}\p{N}_-]+)/gu)) {
    ranges.push([m.index + m[1].length, m.index + m[0].length]);
    r.project = m[2];
  }

  // Data padrão quando só há hora ou repetição
  if (!r.date && (r.time || r.recurrence)) {
    if (r.recurrence?.freq === 'weekly' && r.recurrence.days?.length) {
      r.date = r.recurrence.days.map((d) => nextWeekday(d, today)).sort()[0];
    } else r.date = today;
  }
  if (r.recurrence && r.date) r.recurrence.anchor = r.date;

  // Título = texto sem os trechos reconhecidos
  ranges.sort((a, b) => b[0] - a[0]);
  let title = text;
  for (const [a, b] of ranges) title = title.slice(0, a) + ' ' + title.slice(b);
  title = title.replace(/\s{2,}/g, ' ').replace(/\s+([,.;!?])/g, '$1').trim().replace(/^[,;\-–]+|[,;\-–]+$/g, '').trim();

  if (r.date) tokens.push({ type: 'date', value: r.date });
  if (r.time) tokens.push({ type: 'time', value: r.time });
  if (r.recurrence) tokens.push({ type: 'recurrence', value: r.recurrence });
  if (r.priority) tokens.push({ type: 'priority', value: r.priority });
  if (r.project) tokens.push({ type: 'project', value: r.project });
  for (const l of r.labels) tokens.push({ type: 'label', value: l });

  return { title, ...r, tokens };
}
