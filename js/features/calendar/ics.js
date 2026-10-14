// Exporta eventos e tarefas com data para .ics (Google Agenda, Apple, Outlook).

import * as store from '../../core/store.js';
import { addDays, timeToMin, minToTime } from '../../core/date.js';
import { toRRule } from '../../core/recurrence.js';
import { downloadFile } from '../../core/util.js';

const esc = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const dt = (date, time) => date.replace(/-/g, '') + (time ? 'T' + time.replace(':', '') + '00' : '');

function fold(line) {
  const out = [];
  while (line.length > 74) {
    out.push(line.slice(0, 74));
    line = ' ' + line.slice(74);
  }
  out.push(line);
  return out.join('\r\n');
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function vevent({ uid, title, notes, date, time, duration, recurrence }) {
  const lines = ['BEGIN:VEVENT', `UID:${uid}@organiza`, `DTSTAMP:${stamp()}`];
  if (time) {
    const endMin = timeToMin(time) + (duration || 60);
    const endDate = endMin >= 1440 ? addDays(date, Math.floor(endMin / 1440)) : date;
    lines.push(`DTSTART:${dt(date, time)}`, `DTEND:${dt(endDate, minToTime(endMin % 1440))}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${dt(date)}`, `DTEND;VALUE=DATE:${dt(addDays(date, 1))}`);
  }
  lines.push(`SUMMARY:${esc(title)}`);
  if (notes) lines.push(`DESCRIPTION:${esc(notes)}`);
  if (recurrence) lines.push(`RRULE:${toRRule(recurrence)}`);
  lines.push('END:VEVENT');
  return lines;
}

export function buildICS({ events = true, tasks = true } = {}) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Organiza//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Organiza'];
  let count = 0;
  if (events) {
    for (const e of store.all('events')) {
      if (!e.date) continue;
      lines.push(...vevent({ uid: e.id, title: e.title, notes: e.notes, date: e.date, time: e.allDay ? null : e.time, duration: e.duration, recurrence: e.recurrence }));
      count++;
    }
  }
  if (tasks) {
    for (const t of store.all('tasks')) {
      if (!t.block || !t.date || t.done) continue;
      lines.push(...vevent({ uid: t.id, title: '☐ ' + t.title, notes: t.notes, date: t.date, time: t.time, duration: t.duration || 60, recurrence: t.recurrence }));
      count++;
    }
  }
  lines.push('END:VCALENDAR');
  return { text: lines.map(fold).join('\r\n') + '\r\n', count };
}

export async function exportICS(opts) {
  const { text, count } = buildICS(opts);
  const name = 'organiza-agenda.ics';
  const file = typeof File !== 'undefined' ? new File([text], name, { type: 'text/calendar' }) : null;
  if (file && navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ files: [file], title: 'Agenda do Organiza' });
      return count;
    } catch (e) {
      if (e.name === 'AbortError') return count;
    }
  }
  downloadFile(name, text, 'text/calendar');
  return count;
}
