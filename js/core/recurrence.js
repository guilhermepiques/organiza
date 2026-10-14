// Regras de repetição, usadas por tarefas e eventos.
// Formato: { freq: 'daily'|'weekly'|'monthly'|'yearly', interval: 1, days?: [0..6], anchor?: 'AAAA-MM-DD' }
// `anchor` é a data de referência da série (para "a cada 2 semanas", por exemplo).

import { addDays, diffDays, fromISO, startOfWeek, weekday, WEEKDAYS_SHORT, daysInMonth } from './date.js';

function monthsBetween(a, b) {
  const da = fromISO(a);
  const db = fromISO(b);
  return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
}

/** A data `iso` faz parte da série que começa em `start`? */
export function matches(start, rule, iso) {
  if (iso < start) return false;
  if (rule.until && iso > rule.until) return false;
  const anchor = rule.anchor && rule.anchor <= start ? rule.anchor : start;
  const interval = Math.max(1, rule.interval || 1);
  const d = fromISO(iso);
  switch (rule.freq) {
    case 'daily':
      return diffDays(anchor, iso) % interval === 0;
    case 'weekly': {
      const days = rule.days?.length ? rule.days : [weekday(anchor)];
      if (!days.includes(d.getDay())) return false;
      const weeks = Math.round(diffDays(startOfWeek(anchor), startOfWeek(iso)) / 7);
      return weeks % interval === 0;
    }
    case 'monthly': {
      const a = fromISO(anchor);
      if (monthsBetween(anchor, iso) % interval !== 0) return false;
      const target = Math.min(a.getDate(), daysInMonth(d.getFullYear(), d.getMonth()));
      return d.getDate() === target;
    }
    case 'yearly': {
      const a = fromISO(anchor);
      if ((d.getFullYear() - a.getFullYear()) % interval !== 0) return false;
      return d.getMonth() === a.getMonth() && d.getDate() === Math.min(a.getDate(), daysInMonth(d.getFullYear(), d.getMonth()));
    }
    default:
      return false;
  }
}

/** Próxima ocorrência estritamente depois de `after`. */
export function nextOccurrence(start, rule, after = start) {
  let d = addDays(after < start ? addDays(start, -1) : after, 1);
  const limit = 366 * Math.max(1, rule.interval || 1) + 31;
  for (let i = 0; i < limit; i++) {
    if (matches(start, rule, d)) return d;
    d = addDays(d, 1);
  }
  return null;
}

/** Todas as ocorrências entre `from` e `to` (inclusive). */
export function occurrencesInRange(start, rule, from, to) {
  const out = [];
  let d = from > start ? from : start;
  while (d <= to) {
    if (matches(start, rule, d)) out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

const UNIT = {
  daily: ['dia', 'dias'],
  weekly: ['semana', 'semanas'],
  monthly: ['mês', 'meses'],
  yearly: ['ano', 'anos'],
};

/** Descrição curta em português: "Todo dia", "Dias úteis", "A cada 2 semanas (seg, qua)". */
export function describe(rule, startDate) {
  if (!rule) return '';
  const n = Math.max(1, rule.interval || 1);
  const days = rule.days?.length ? [...rule.days].sort() : null;
  if (rule.freq === 'weekly' && n === 1 && days?.join() === '1,2,3,4,5') return 'Dias úteis';
  if (rule.freq === 'weekly' && days) {
    const names = days.map((d) => WEEKDAYS_SHORT[d]).join(', ');
    return n === 1 ? `Toda semana (${names})` : `A cada ${n} semanas (${names})`;
  }
  if (rule.freq === 'monthly' && startDate) {
    const day = fromISO(rule.anchor || startDate).getDate();
    return n === 1 ? `Todo mês (dia ${day})` : `A cada ${n} meses (dia ${day})`;
  }
  const [one, many] = UNIT[rule.freq] || ['', ''];
  if (n === 1) {
    return { daily: 'Todo dia', weekly: 'Toda semana', monthly: 'Todo mês', yearly: 'Todo ano' }[rule.freq] || '';
  }
  return `A cada ${n} ${n === 1 ? one : many}`;
}

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Converte para RRULE (iCalendar), usado na exportação .ics. */
export function toRRule(rule) {
  const parts = [`FREQ=${rule.freq.toUpperCase()}`];
  if ((rule.interval || 1) > 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.freq === 'weekly' && rule.days?.length) parts.push(`BYDAY=${rule.days.map((d) => BYDAY[d]).join(',')}`);
  if (rule.until) parts.push(`UNTIL=${rule.until.replace(/-/g, '')}T235959`);
  return parts.join(';');
}
