// Aba Tarefas.

import { h, render, isDesktop } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { openSheet } from '../../ui/sheet.js';
import { undoToast } from '../../ui/toast.js';
import * as store from '../../core/store.js';
import { navigate } from '../../core/router.js';
import { todayISO, relativeLabel, longLabel } from '../../core/date.js';
import { groupsFor, viewTitle, VIEWS, SORT_OPTIONS, PRIORITIES, rescheduleOverdueToToday } from './task-service.js';
import { taskRow } from './task-row.js';
import { taskNav, viewKey } from './task-nav.js';
import { createQuickAdd } from './quick-add.js';
import { statsLine, openStats } from './stats.js';
import { openSettings } from '../settings/settings-view.js';
import { openSearch } from '../search/search.js';

const EMPTY = {
  hoje: ['sun', 'Tudo em dia!', 'Nenhuma tarefa para hoje. Adicione abaixo ou aproveite o dia.'],
  entrada: ['inbox', 'Nenhuma tarefa pendente', 'Todas as suas tarefas, de todos os projetos, aparecem aqui.'],
  concluidas: ['checkCircle', 'Nada concluído ainda', 'As tarefas concluídas ficam guardadas aqui.'],
  projeto: ['folder', 'Projeto vazio', 'Adicione a primeira tarefa deste projeto abaixo.'],
  etiqueta: ['tag', 'Nenhuma tarefa', 'Nenhuma tarefa pendente com esta etiqueta.'],
};

export function createTasksView() {
  let view = { key: 'entrada' }; // visão principal ao abrir o app
  const priorities = new Set();
  const expanded = new Set();
  let navSheet = null;
  let navSheetBody = null;

  // ---------- cabeçalho ----------
  const titleText = h('span', { class: 'view-title' });
  const subtitle = h('div', { class: 'view-subtitle' });
  const titleBtn = h('button', { type: 'button', class: 'view-title-btn', onclick: openNavSheet, 'aria-label': 'Escolher visão' },
    titleText, h('span', { class: 'title-chevron' }, icon('chevronDown', 18)));

  const filterBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Ordenar e filtrar', onclick: openFilters }, icon('sort'));
  const header = h('header', { class: 'view-header' },
    h('div', { class: 'view-heading' }, titleBtn, subtitle),
    h('div', { class: 'header-actions' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Buscar', onclick: openSearch }, icon('search')),
      filterBtn,
      h('button', { type: 'button', class: 'icon-btn hide-desktop', 'aria-label': 'Ajustes', onclick: openSettings }, icon('settings'))));

  const listEl = h('div', { class: 'task-groups' });
  const body = h('div', { class: 'view-body' }, listEl);
  const quick = createQuickAdd({ getDefaults });
  const sidebar = h('aside', { class: 'tasks-sidebar' });
  const el = h('section', { class: 'view view-tasks' },
    sidebar,
    h('div', { class: 'tasks-main' }, header, body, quick.el));

  // ---------- comportamento ----------
  function getDefaults() {
    const d = { view: view.key };
    if (view.key === 'projeto') d.projectId = view.id;
    if (view.key === 'etiqueta') d.labels = [view.id];
    return d;
  }

  function go(v) {
    navigate(`tarefas/${viewKey(v)}`);
  }

  function openNavSheet() {
    if (isDesktop()) return;
    navSheetBody = h('div');
    navSheet = openSheet({ title: 'Tarefas', body: navSheetBody, size: 'large', onClose: () => { navSheet = null; navSheetBody = null; } });
    renderNavInto(navSheetBody, true);
  }

  function renderNavInto(container, inSheet) {
    render(container, taskNav({
      current: view,
      onSelect: async (v) => {
        if (inSheet && navSheet) await navSheet.close();
        go(v);
      },
    }));
  }

  function openFilters() {
    const sortList = h('div', { class: 'menu-list' });
    const prioChips = h('div', { class: 'chips' });
    const renderSheet = () => {
      const cur = store.getSettings().taskSort;
      render(sortList, ...SORT_OPTIONS.map((o) => h('button', {
        type: 'button', class: `menu-item ${o.value === cur ? 'active' : ''}`,
        onclick: () => { store.setSettings({ taskSort: o.value }); renderSheet(); },
      }, h('span', { class: 'menu-label' }, o.label), o.value === cur ? icon('check', 18) : null)));
      render(prioChips, ...PRIORITIES.map((p) => h('button', {
        type: 'button', class: `chip prio-chip prio-${p.value} ${priorities.has(p.value) ? 'active' : ''}`,
        onclick: () => { priorities.has(p.value) ? priorities.delete(p.value) : priorities.add(p.value); renderSheet(); renderList(); },
      }, icon('flag', 14), p.short)));
      filterBtn.classList.toggle('has-dot', priorities.size > 0);
    };
    renderSheet();
    const overdueCount = store.all('tasks').filter((t) => !t.done && t.date && t.date < todayISO()).length;
    openSheet({
      title: 'Ordenar e filtrar',
      size: 'small',
      body: h('div', { class: 'stack' },
        h('div', { class: 'label-sm' }, 'Ordenar por'), sortList,
        h('div', { class: 'label-sm' }, 'Mostrar só prioridades'), prioChips,
        overdueCount ? h('button', { type: 'button', class: 'btn btn-block', onclick: () => {
          rescheduleOverdueToToday();
          undoToast(`${overdueCount} tarefa${overdueCount > 1 ? 's' : ''} movida${overdueCount > 1 ? 's' : ''} para hoje`);
        } }, icon('calendar', 18), `Reagendar ${overdueCount} atrasada${overdueCount > 1 ? 's' : ''} para hoje`) : null),
    });
  }

  function dayHeading(date) {
    const rel = relativeLabel(date);
    const long = longLabel(date);
    return { title: rel, sub: /\d/.test(rel) ? long.split(',')[0] : long.split(', ')[1] };
  }

  function renderHeader() {
    titleText.textContent = viewTitle(view);
    const sub = view.key === 'hoje' ? longLabel(todayISO()) : '';
    subtitle.textContent = sub;
    subtitle.hidden = !sub;
  }

  function renderList() {
    const sort = store.getSettings().taskSort;
    const groups = groupsFor(view, { sort, priorities });
    const out = [];
    if (view.key === 'hoje') {
      const line = statsLine(openStats);
      if (line) out.push(line);
    }
    let total = 0;
    for (const g of groups) {
      if (!g.tasks.length) continue;
      total += g.tasks.length;
      let title = g.title, sub = null;
      if (!title && g.date) ({ title, sub } = dayHeading(g.date));
      const isCollapsed = g.collapsible && !expanded.has(g.id);
      const head = title
        ? h('div', { class: `group-head ${g.tone ? 'tone-' + g.tone : ''}` },
            g.collapsible
              ? h('button', { type: 'button', class: 'group-toggle', onclick: () => { expanded.has(g.id) ? expanded.delete(g.id) : expanded.add(g.id); renderList(); } },
                  h('span', { class: `chev ${isCollapsed ? '' : 'open'}` }, icon('chevronRight', 16)), title)
              : h('span', { class: 'group-title' }, title),
            sub ? h('span', { class: 'group-sub' }, sub) : null,
            h('span', { class: 'group-count' }, g.tasks.length ? String(g.tasks.length) : ''),
            g.overdue ? h('button', { type: 'button', class: 'link-btn', onclick: () => {
              const n = rescheduleOverdueToToday();
              if (n) undoToast(`${n} tarefa${n > 1 ? 's' : ''} movida${n > 1 ? 's' : ''} para hoje`);
            } }, 'Reagendar') : null)
        : null;
      const rows = isCollapsed ? [] : g.tasks.map((t) => taskRow(t, {
        hideDate: !!g.dateGroup && !g.overdue,
        hideProject: view.key === 'projeto',
      }));
      out.push(h('section', { class: `task-group ${g.dateGroup ? 'date-group' : ''}` }, head, h('div', { class: 'task-list' }, rows)));
    }
    if (!total) {
      const [ic, t, d] = EMPTY[view.key] || EMPTY.entrada;
      out.push(h('div', { class: 'empty' }, h('div', { class: 'empty-icon' }, icon(ic, 28)), h('h3', null, t), h('p', null, d)));
    }
    render(listEl, out);
  }

  function refresh() {
    if (view.key === 'projeto' && !store.get('projects', view.id)) view = { key: 'entrada' };
    renderHeader();
    renderList();
    if (isDesktop()) renderNavInto(sidebar, false);
    if (navSheetBody) renderNavInto(navSheetBody, true);
  }

  function activate(parts = []) {
    const [key, ...rest] = parts;
    const id = rest.join('/');
    const before = viewKey(view);
    if (!key) {
      // voltou para a aba Tarefas (sem visão no endereço): continua na visão em que estava
    } else if (VIEWS[key]) view = { key };
    else if (key === 'projeto' && store.get('projects', id)) view = { key, id };
    else if (key === 'etiqueta' && id) view = { key, id };
    else view = { key: 'entrada' };
    if (viewKey(view) !== before) body.scrollTop = 0;
    refresh();
  }

  addEventListener('resize', () => { if (isDesktop()) renderNavInto(sidebar, false); });

  return { el, activate, refresh, focusAdd: () => quick.focus() };
}
