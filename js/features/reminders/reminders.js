// Lembretes locais. Limitação do navegador: sem servidor de push, os avisos só disparam
// enquanto o app estiver aberto ou em segundo plano recente. Ao abrir o app, lembretes
// atrasados (últimas 6h) também são mostrados.

import * as store from '../../core/store.js';
import { toDate, addDays, todayISO } from '../../core/date.js';
import { occurrencesInRange } from '../../core/recurrence.js';
import { toast } from '../../ui/toast.js';

const FIRED_KEY = 'organiza:reminders-fired';
const WINDOW_MS = 6 * 60 * 60 * 1000;

function loadFired() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}
function saveFired(set) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify([...set].slice(-300)));
  } catch {
    /* ignore */
  }
}

export function notificationStatus() {
  if (!('Notification' in globalThis)) return 'unsupported';
  return Notification.permission; // default | granted | denied
}

export async function ensureNotificationPermission() {
  if (notificationStatus() !== 'default') return notificationStatus();
  try {
    return await Notification.requestPermission();
  } catch {
    return notificationStatus();
  }
}

async function notify(title, body, tag) {
  if (notificationStatus() === 'granted') {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) return reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
      return new Notification(title, { body, tag, icon: 'icons/icon-192.png' });
    } catch {
      /* cai para o toast */
    }
  }
  toast(`🔔 ${title}${body ? ' · ' + body : ''}`, { duration: 8000 });
}

function dueItems() {
  const today = todayISO();
  const from = addDays(today, -1);
  const to = addDays(today, 2);
  const out = [];
  for (const t of store.all('tasks')) {
    if (t.done || t.reminder == null || !t.date) continue;
    out.push({ key: `t:${t.id}:${t.date}`, title: t.title, date: t.date, time: t.time, reminder: t.reminder });
  }
  for (const e of store.all('events')) {
    if (e.reminder == null || !e.date) continue;
    const dates = e.recurrence ? occurrencesInRange(e.date, e.recurrence, from, to) : [e.date];
    for (const d of dates) out.push({ key: `e:${e.id}:${d}`, title: e.title, date: d, time: e.allDay ? null : e.time, reminder: e.reminder });
  }
  return out;
}

function check() {
  const now = Date.now();
  const fired = loadFired();
  let changed = false;
  for (const it of dueItems()) {
    const at = toDate(it.date, it.time || '09:00').getTime() - it.reminder * 60000;
    const key = `${it.key}:${it.reminder}:${it.time || ''}`;
    if (now >= at && now - at < WINDOW_MS && !fired.has(key)) {
      fired.add(key);
      changed = true;
      notify(it.title, it.time ? `às ${it.time}` : 'hoje');
    }
  }
  if (changed) saveFired(fired);
}

export function startReminders() {
  check();
  setInterval(check, 30000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}
