// Pequeno resumo de produtividade.

import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { openSheet } from '../../ui/sheet.js';
import * as store from '../../core/store.js';
import { WEEKDAYS_LETTER, weekday } from '../../core/date.js';
import { stats } from './task-service.js';

export function statsCard({ compact = false } = {}) {
  const s = stats(store.getSettings().weekStart);
  const max = Math.max(1, ...s.last7.map((d) => d.count));
  const bars = h('div', { class: 'stats-bars', 'aria-hidden': 'true' },
    s.last7.map((d, i) => h('div', { class: `bar ${i === 6 ? 'today' : ''}` },
      h('div', { class: 'bar-fill', style: { height: `${Math.max(6, (d.count / max) * 100)}%`, opacity: d.count ? 1 : 0.25 } }),
      h('span', { class: 'bar-label' }, WEEKDAYS_LETTER[weekday(d.date)]))));
  return h('div', { class: `stats-card ${compact ? 'compact' : ''}` },
    h('div', { class: 'stats-nums' },
      h('div', { class: 'stat' }, h('strong', null, String(s.today)), h('span', null, 'hoje')),
      h('div', { class: 'stat' }, h('strong', null, String(s.week)), h('span', null, 'na semana')),
      h('div', { class: 'stat' }, h('strong', null, icon('flame', 16), String(s.streak)), h('span', null, s.streak === 1 ? 'dia seguido' : 'dias seguidos'))),
    bars);
}

export function statsLine(onClick) {
  const s = stats(store.getSettings().weekStart);
  if (!s.total) return null;
  return h('button', { type: 'button', class: 'stats-line', onclick: onClick },
    h('span', null, `${s.today} hoje`), h('span', { class: 'sep' }, '·'),
    h('span', null, `${s.week} na semana`),
    s.streak ? [h('span', { class: 'sep' }, '·'), h('span', { class: 'streak' }, icon('flame', 14), `${s.streak} ${s.streak === 1 ? 'dia' : 'dias'}`)] : null);
}

export function openStats() {
  const s = stats(store.getSettings().weekStart);
  openSheet({
    title: 'Produtividade',
    size: 'small',
    body: h('div', { class: 'stack' },
      statsCard(),
      h('p', { class: 'muted small' }, `${s.total} tarefa${s.total === 1 ? '' : 's'} concluída${s.total === 1 ? '' : 's'} no total. A sequência conta dias seguidos com pelo menos uma tarefa concluída.`)),
  });
}
