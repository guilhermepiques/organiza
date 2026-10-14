// Datas são guardadas como texto local "AAAA-MM-DD" e horas como "HH:MM".
// Isso evita problemas de fuso horário e facilita comparar (ordem alfabética = ordem cronológica).

export const pad = (n) => String(n).padStart(2, '0');

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayISO = () => toISO(new Date());

export function addDays(iso, n) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Soma meses mantendo o dia (ou o último dia do mês, se não existir). */
export function addMonths(iso, n, keepDay) {
  const d = fromISO(iso);
  const day = keepDay ?? d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())));
  return toISO(d);
}

/** Número de dias de a até b (b - a). */
export function diffDays(a, b) {
  return Math.round((fromISO(b) - fromISO(a)) / 86400000);
}

export const weekday = (iso) => fromISO(iso).getDay();

export function startOfWeek(iso, weekStart = 0) {
  return addDays(iso, -((weekday(iso) - weekStart + 7) % 7));
}

export const startOfMonth = (iso) => iso.slice(0, 8) + '01';

export function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minToTime(min) {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function toDate(iso, time = '00:00') {
  const d = fromISO(iso);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h, m || 0, 0, 0);
  return d;
}

export const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const WEEKDAYS_LETTER = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "Hoje", "Amanhã", "Ontem", "Sexta", "15 out", "15 out 2027". */
export function relativeLabel(iso) {
  const today = todayISO();
  const diff = diffDays(today, iso);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  if (diff === -1) return 'Ontem';
  const d = fromISO(iso);
  if (diff > 1 && diff < 7) {
    const w = WEEKDAYS[d.getDay()];
    return w[0].toUpperCase() + w.slice(1);
  }
  const base = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** "terça-feira, 13 de outubro" */
export function longLabel(iso, withYear = false) {
  const d = fromISO(iso);
  const wd = WEEKDAYS[d.getDay()];
  const wdFull = d.getDay() === 0 || d.getDay() === 6 ? wd : `${wd}-feira`;
  return `${wdFull}, ${d.getDate()} de ${MONTHS[d.getMonth()]}${withYear ? ` de ${d.getFullYear()}` : ''}`;
}

/** "Seg, 13 out" */
export function shortLabel(iso) {
  const d = fromISO(iso);
  const w = WEEKDAYS_SHORT[d.getDay()];
  return `${w[0].toUpperCase()}${w.slice(1)}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "1h30", "45 min", "2h" */
export function durationLabel(min) {
  if (!min) return '';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${pad(m)}` : `${h}h`;
}
