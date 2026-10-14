// Junta eventos e tarefas com data num formato único para o calendário.

import * as store from '../../core/store.js';
import { addDays, timeToMin } from '../../core/date.js';
import { occurrencesInRange } from '../../core/recurrence.js';

/**
 * @returns {Map<string, { allDay: Item[], timed: Item[] }>} por data "AAAA-MM-DD"
 * Item: { kind: 'event'|'task', id, title, date, start, end, color, done, priority, block, recurring }
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

  for (const e of store.all('events')) {
    if (!e.date) continue;
    const dates = e.recurrence ? occurrencesInRange(e.date, e.recurrence, from, to) : e.date >= from && e.date <= to ? [e.date] : [];
    for (const date of dates) {
      const start = e.allDay || !e.time ? null : timeToMin(e.time);
      put({
        kind: 'event', id: e.id, title: e.title, date, start,
        end: start == null ? null : Math.min(24 * 60, start + (e.duration || 60)),
        color: e.color, recurring: !!e.recurrence, notes: e.notes,
      });
    }
  }

  for (const t of store.all('tasks')) {
    if (!t.date || t.date < from || t.date > to) continue;
    if (t.done && !settings.showDoneInCalendar) continue;
    const start = t.time ? timeToMin(t.time) : null;
    const dur = t.block ? t.duration || 60 : 30;
    put({
      kind: 'task', id: t.id, title: t.title, date: t.date, start,
      end: start == null ? null : Math.min(24 * 60, start + dur),
      color: t.block ? t.color : null, done: t.done, priority: t.priority, block: t.block, recurring: !!t.recurrence,
    });
  }

  for (const day of out.values()) {
    day.allDay.sort((a, b) => (a.kind === b.kind ? a.title.localeCompare(b.title) : a.kind === 'event' ? -1 : 1));
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
      cols[c] = Math.max(it.end, it.start + 20);
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
    const end = Math.max(it.end, it.start + 20);
    if (cluster.length && it.start >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (cluster.length) flush();
  return placed;
}
