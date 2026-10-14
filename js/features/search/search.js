// Busca em tudo: tarefas, eventos e itens de compra. Abre num painel (não fica fixa na tela).

import { h, render } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { openSheet } from '../../ui/sheet.js';
import * as store from '../../core/store.js';
import { navigate } from '../../core/router.js';
import { normalize, normalizeAligned, debounce } from '../../core/util.js';
import { relativeLabel } from '../../core/date.js';
import { openEditor } from '../editor/editor.js';
import { qtyLabel } from '../shopping/shopping-service.js';

const LIMIT = 30;

function matches(fields, words) {
  const hay = normalize(fields.filter(Boolean).join(' '));
  return words.every((w) => hay.includes(w));
}

/** Destaca no texto as palavras buscadas (ignorando acentos e maiúsculas). */
function highlight(text, words) {
  const norm = normalizeAligned(text);
  const ranges = [];
  for (const w of words) {
    let i = norm.indexOf(w);
    while (i >= 0) {
      ranges.push([i, i + w.length]);
      i = norm.indexOf(w, i + w.length);
    }
  }
  if (!ranges.length) return text;
  ranges.sort((a, b) => a[0] - b[0]);
  const out = [];
  let pos = 0;
  for (const [a, b] of ranges) {
    if (a < pos) continue;
    out.push(text.slice(pos, a), h('mark', null, text.slice(a, b)));
    pos = b;
  }
  out.push(text.slice(pos));
  return out;
}

function searchAll(query) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return null;

  const projects = new Map(store.all('projects').map((p) => [p.id, p]));
  const lists = new Map(store.all('lists').map((l) => [l.id, l]));

  const tasks = store.all('tasks')
    .filter((t) => matches([t.title, t.notes, ...(t.labels || []), ...(t.subtasks || []).map((s) => s.title), projects.get(t.projectId)?.name], words))
    .sort((a, b) => a.done - b.done || (a.date || '9999').localeCompare(b.date || '9999'));

  const events = store.all('events')
    .filter((e) => matches([e.title, e.notes], words))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const items = store.all('items')
    .filter((i) => lists.has(i.listId) && matches([i.name, i.note, lists.get(i.listId)?.name], words))
    .sort((a, b) => a.bought - b.bought || a.name.localeCompare(b.name, 'pt-BR'));

  return { words, tasks, events, items, projects, lists };
}

export function openSearch() {
  const input = h('input', {
    class: 'search-input', type: 'search', placeholder: 'Buscar tarefas, eventos e compras', autofocus: true,
    enterkeyhint: 'search', autocomplete: 'off', 'aria-label': 'Buscar',
  });
  const results = h('div', { class: 'search-results' });
  const body = h('div', { class: 'search-panel' },
    h('div', { class: 'search-bar' }, icon('search', 18), input,
      h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Limpar busca', onclick: () => { input.value = ''; update(); input.focus(); } }, icon('x', 16))),
    results);

  const s = openSheet({ title: 'Buscar', body, size: 'large', className: 'search-sheet' });

  async function go(action) {
    await s.close();
    action();
  }

  const row = (iconName, title, meta, onClick, extraClass = '') =>
    h('button', { type: 'button', class: `search-row ${extraClass}`, onclick: onClick },
      h('span', { class: 'search-icon' }, icon(iconName, 18)),
      h('span', { class: 'search-text' },
        h('span', { class: 'search-title' }, title),
        meta ? h('span', { class: 'search-meta' }, meta) : null));

  const group = (label, list, make) => (list.length
    ? h('section', { class: 'search-group' },
        h('div', { class: 'search-group-head' }, label, h('span', { class: 'group-count' }, String(list.length))),
        list.slice(0, LIMIT).map(make),
        list.length > LIMIT ? h('p', { class: 'muted small' }, `+${list.length - LIMIT} resultados. Refine a busca.`) : null)
    : null);

  function update() {
    const r = searchAll(input.value);
    if (!r) {
      render(results, h('div', { class: 'search-hint' },
        icon('search', 28),
        h('p', null, 'Busque em tudo: tarefas (inclusive concluídas), eventos do calendário e itens das listas de compras.')));
      return;
    }
    const { words, tasks, events, items, projects, lists } = r;
    if (!tasks.length && !events.length && !items.length) {
      render(results, h('div', { class: 'search-hint' }, icon('search', 28), h('p', null, 'Nada encontrado.')));
      return;
    }
    render(results,
      group('Tarefas', tasks, (t) => row(
        t.done ? 'checkCircle' : 'circle',
        highlight(t.title, words),
        [t.done ? 'Concluída' : null, t.date ? relativeLabel(t.date) + (t.time ? ' ' + t.time : '') : null, projects.get(t.projectId)?.name].filter(Boolean).join(' · '),
        () => go(() => openEditor({ id: t.id, type: 'task' })),
        t.done ? 'is-done' : '')),
      group('Eventos', events, (e) => row(
        'calendar',
        highlight(e.title, words),
        [relativeLabel(e.date) + (e.allDay || !e.time ? ' · dia todo' : ' ' + e.time), e.recurrence ? 'repete' : null].filter(Boolean).join(' · '),
        () => go(() => openEditor({ id: e.id, type: 'event' })))),
      group('Compras', items, (i) => row(
        'cart',
        highlight(i.name, words),
        [lists.get(i.listId)?.name, qtyLabel(i) || null, i.bought ? 'no carrinho' : null].filter(Boolean).join(' · '),
        () => go(() => navigate(`compras/${i.listId}/${i.id}`)),
        i.bought ? 'is-done' : '')));
  }

  input.addEventListener('input', debounce(update, 120));
  update();
  return s;
}
