// Feriados do Brasil (nacionais), de São Paulo (estadual) e municipais de Jundiaí e Limeira.
// Calculados para qualquer ano, offline. Datas móveis (Carnaval, Paixão, Corpus Christi) vêm da Páscoa.
//
// Fontes (out/2026):
// - Jundiaí: Prefeitura (feriados municipais: Paixão do Senhor, Corpus Christi, Padroeira em 15/08)
// - Limeira: Aniversário da cidade (15/09); Corpus Christi pela Lei Municipal nº 1.038/1968 (alt. Lei 1.242/1970),
//   citada em calendário da Unicamp — algumas fontes tratam como ponto facultativo.
// - 20/11 (Consciência Negra) é feriado nacional desde a Lei 14.759/2023.

import { addDays, pad } from '../../core/date.js';

/** Regiões que o usuário pode ligar/desligar em Ajustes. */
export const HOLIDAY_REGIONS = [
  { id: 'br', name: 'Nacionais e de São Paulo' },
  { id: 'jundiai', name: 'Jundiaí' },
  { id: 'limeira', name: 'Limeira' },
  { id: 'facultativos', name: 'Pontos facultativos (Carnaval, Cinzas…)' },
];

export const DEFAULT_HOLIDAY_SETTINGS = { br: true, jundiai: true, limeira: true, facultativos: true };

const CITY = { jundiai: 'Jundiaí', limeira: 'Limeira' };

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function easter(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

// kind: 'feriado' | 'facultativo' | 'data' (data comemorativa) · scope: 'br' | 'sp' | 'jundiai' | 'limeira'
function rawHolidays(year) {
  const d = (m, day) => `${year}-${pad(m)}-${pad(day)}`;
  const e = easter(year);
  return [
    { date: d(1, 1), name: 'Confraternização Universal', kind: 'feriado', scope: 'br' },
    { date: addDays(e, -48), name: 'Carnaval', kind: 'facultativo', scope: 'br' },
    { date: addDays(e, -47), name: 'Carnaval', kind: 'facultativo', scope: 'br' },
    { date: addDays(e, -46), name: 'Quarta-feira de Cinzas', kind: 'facultativo', scope: 'br', note: 'ponto facultativo até as 14h' },
    { date: addDays(e, -2), name: 'Paixão de Cristo', kind: 'feriado', scope: 'br' },
    { date: e, name: 'Páscoa', kind: 'data', scope: 'br' },
    { date: d(4, 21), name: 'Tiradentes', kind: 'feriado', scope: 'br' },
    { date: d(5, 1), name: 'Dia do Trabalho', kind: 'feriado', scope: 'br' },
    { date: addDays(e, 60), name: 'Corpus Christi', kind: 'facultativo', scope: 'br' },
    { date: addDays(e, 60), name: 'Corpus Christi', kind: 'feriado', scope: 'jundiai' },
    { date: addDays(e, 60), name: 'Corpus Christi', kind: 'feriado', scope: 'limeira' },
    { date: d(7, 9), name: 'Revolução Constitucionalista', kind: 'feriado', scope: 'sp' },
    { date: d(8, 15), name: 'Dia da Padroeira', kind: 'feriado', scope: 'jundiai' },
    { date: d(9, 7), name: 'Independência do Brasil', kind: 'feriado', scope: 'br' },
    { date: d(9, 15), name: 'Aniversário da cidade', kind: 'feriado', scope: 'limeira' },
    { date: d(10, 12), name: 'Nossa Senhora Aparecida', kind: 'feriado', scope: 'br' },
    { date: d(11, 2), name: 'Finados', kind: 'feriado', scope: 'br' },
    { date: d(11, 15), name: 'Proclamação da República', kind: 'feriado', scope: 'br' },
    { date: d(11, 20), name: 'Dia da Consciência Negra', kind: 'feriado', scope: 'br' },
    { date: d(12, 25), name: 'Natal', kind: 'feriado', scope: 'br' },
  ];
}

function enabled(scope, opts) {
  if (scope === 'br' || scope === 'sp') return opts.br;
  return !!opts[scope];
}

/**
 * Feriados entre `from` e `to`, já juntando o mesmo feriado de várias regiões.
 * @returns {Map<string, Array<{ id, name, label, detail, kind }>>}
 */
export function holidaysBetween(from, to, opts = DEFAULT_HOLIDAY_SETTINGS) {
  const out = new Map();
  const y1 = +from.slice(0, 4), y2 = +to.slice(0, 4);
  const merged = new Map();
  for (let y = y1; y <= y2; y++) {
    for (const h of rawHolidays(y)) {
      if (h.date < from || h.date > to || !enabled(h.scope, opts)) continue;
      const key = `${h.date}|${h.name}`;
      if (!merged.has(key)) merged.set(key, { date: h.date, name: h.name, note: h.note, parts: [] });
      merged.get(key).parts.push(h);
    }
  }
  for (const m of merged.values()) {
    const feriado = m.parts.filter((p) => p.kind === 'feriado');
    const kind = feriado.length ? 'feriado' : m.parts[0].kind;
    if (kind === 'facultativo' && !opts.facultativos) continue;
    const cities = feriado.filter((p) => CITY[p.scope]).map((p) => CITY[p.scope]);
    const national = feriado.some((p) => p.scope === 'br');
    const state = feriado.some((p) => p.scope === 'sp');

    let label = m.name;
    let detail;
    if (kind === 'feriado') {
      if (national) detail = 'Feriado nacional';
      else if (state) { label += ' (SP)'; detail = 'Feriado estadual de São Paulo'; }
      else {
        label += ` (${cities.join(', ')})`;
        detail = `Feriado municipal em ${cities.join(' e ')}`;
        if (m.parts.some((p) => p.scope === 'br' && p.kind === 'facultativo')) detail += ' · ponto facultativo no restante do país';
      }
    } else if (kind === 'facultativo') {
      label += ' (facultativo)';
      detail = 'Ponto facultativo' + (m.note ? ` (${m.note.replace(/^ponto facultativo /, '')})` : '');
    } else {
      detail = 'Data comemorativa';
    }
    if (!out.has(m.date)) out.set(m.date, []);
    out.get(m.date).push({ id: `${m.date}|${m.name}`, name: m.name, label, detail, kind });
  }
  return out;
}
