// Junta eventos e tarefas com data num formato único para o calendário.

import * as store from '../../core/store.js';
import { addDays, timeToMin } from '../../core/date.js';
import { occurrencesInRange } from '../../core/recurrence.js';
import { holidaysBetween, DEFAULT_HOLIDAY_SETTINGS } from './holidays.js';

/**
 * @returns {Map<string, { allDay: Item[], timed: Item[] }>} por data "AAAA-MM-DD"
 * Item: { kind: 'event'|'task'|'holiday', id, title, date, start, end, color, done, priority, block, recurring, detail }
 */
export function occurrencesForRange(from, to) {
  const settings = store.getSettings();
  const out = new Map();
  for (let d = from; d <= to; d = addDays(d, 1)) out.set(d, { allDay: [], timed: [] });

  const put = (item) => {
    const day = out.get(item.date);
    if (!day) return;
    (item.start == null ? day.allDay : day.timed).push(item);
  };

  // feriados primeiro (aparecem no topo do dia)
  for (const [date, list] of holidaysBetween(from, to, { ...DEFAULT_HOLIDAY_SETTINGS, ...(settings.holidays || {}) })) {
    for (const hol of list) {
      put({ kind: 'holiday', id: hol.id, title: hol.label, name: hol.name, detail: hol.detail, holidayKind: hol.kind, date, start: null });
    }
  }

  for (const e of store.all('events')) {
    if (!e.date) continue;
    const dates = e.recurrence ? occurrencesInRange(e.date, e.recurrence, from, to) : e.date >= from && e.date <= to ? [e.date] : [];
    for (const date of dates) {
      const start = e.allDay || !e.time ? null : timeToMin(e.time);
      put({
        kind: 'event', id: e.id, title: e.title, date, start,
        end: start == null ? null : Math.min(24 * 60, start + (e.duration ?? 60)),
        point: e.duration === 0,
        color: e.color, recurring: !!e.recurrence, notes: e.notes,
      });
    }
  }

  // Só entram no calendário as tarefas marcadas com "Adicionar ao calendário" (campo block)
  for (const t of store.all('tasks')) {
    if (!t.block || !t.date || t.date < from || t.date > to) continue;
    if (t.done && !settings.showDoneInCalendar) continue;
    const start = t.time ? timeToMin(t.time) : null;
    const dur = t.duration ?? 60;
    put({
      kind: 'task', id: t.id, title: t.title, date: t.date, start,
      end: start == null ? null : Math.min(24 * 60, start + dur),
      point: dur === 0,
      color: t.color, done: t.done, priority: t.priority, block: true, recurring: !!t.recurrence,
    });
  }

  for (const day of out.values()) {
    const rank = { holiday: 0, event: 1, task: 2 };
    day.allDay.sort((a, b) => rank[a.kind] - rank[b.kind] || a.title.localeCompare(b.title));
    day.timed.sort((a, b) => a.start - b.start || b.end - a.end);
  }
  return out;
}

/** Distribui itens sobrepostos em colunas (como Google Agenda). */
export function layoutColumns(items) {
  const placed = [];
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = [];
    for (const it of cluster) {
      let c = cols.findIndex((end) => end <= it.start);
      if (c === -1) {
        c = cols.length;
        cols.push(0);
      }
      cols[c] = Math.max(it.end, it.start + 25);
      it._col = c;
    }
    for (const it of cluster) {
      it._cols = cols.length;
      placed.push(it);
    }
    cluster = [];
    clusterEnd = -1;
  };
  for (const it of items) {
    const end = Math.max(it.end, it.start + 25); // itens curtos / sem duração ocupam ~25 min na tela
    if (cluster.length && it.start >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (cluster.length) flush();
  return placed;
}
