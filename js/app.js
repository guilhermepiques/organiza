// Ponto de entrada: carrega dados, monta as abas e liga o roteamento.

import * as store from './core/store.js';
import { applyTheme } from './core/theme.js';
import { onRoute, currentRoute, navigate } from './core/router.js';
import { h, render } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { createTasksView } from './features/tasks/tasks-view.js';
import { createCalendarView } from './features/calendar/calendar-view.js';
import { createShoppingView } from './features/shopping/shopping-view.js';
import { openSettings } from './features/settings/settings-view.js';
import { openSearch } from './features/search/search.js';
import { startReminders } from './features/reminders/reminders.js';
import { registerServiceWorker } from './pwa.js';

const TABS = [
  { id: 'tarefas', label: 'Tarefas', icon: 'tasks', create: createTasksView },
  { id: 'calendario', label: 'Calendário', icon: 'calendar', create: createCalendarView },
  { id: 'compras', label: 'Compras', icon: 'cart', create: createShoppingView },
];

async function main() {
  await store.init();
  applyTheme(store.getSettings());

  const main = document.getElementById('main');
  const tabbar = document.getElementById('tabbar');
  const views = {};
  for (const t of TABS) views[t.id] = t.create();
  render(main, Object.values(views).map((v) => v.el));

  const tabButtons = TABS.map((t) => h('a', {
    class: 'tab', href: `#/${t.id}`, dataset: { tab: t.id },
    onclick: (e) => {
      e.preventDefault();
      if (active === t.id && t.id === 'tarefas') views.tarefas.focusAdd?.();
      navigate(t.id);
    },
  }, h('span', { class: 'tab-icon' }, icon(t.icon, 22)), h('span', { class: 'tab-label' }, t.label)));
  render(tabbar,
    h('div', { class: 'brand' }, h('img', { src: 'icons/icon.svg', alt: '', width: 28, height: 28 }), h('span', null, 'Organiza')),
    tabButtons,
    h('button', { type: 'button', class: 'tab tab-search', onclick: openSearch, 'aria-label': 'Buscar', title: 'Buscar (Ctrl+K)' },
      h('span', { class: 'tab-icon' }, icon('search', 22)), h('span', { class: 'tab-label' }, 'Buscar')),
    h('button', { type: 'button', class: 'tab tab-settings', onclick: openSettings, 'aria-label': 'Ajustes' },
      h('span', { class: 'tab-icon' }, icon('settings', 22)), h('span', { class: 'tab-label' }, 'Ajustes')));

  let active = null;

  onRoute(({ tab, parts }) => {
    if (!views[tab]) tab = 'tarefas';
    if (active !== tab) {
      for (const [id, v] of Object.entries(views)) v.el.hidden = id !== tab;
      for (const btn of tabButtons) {
        if (btn.dataset.tab === tab) btn.setAttribute('aria-current', 'page');
        else btn.removeAttribute('aria-current');
      }
      active = tab;
    }
    views[tab].activate(parts);
    document.title = `${TABS.find((t) => t.id === tab).label} · Organiza`;
  });

  // Só a aba visível é redesenhada; as outras se atualizam ao serem abertas (activate).
  store.on((cols) => {
    if (cols.has('settings')) applyTheme(store.getSettings());
    views[active]?.refresh();
  });

  const r = currentRoute();
  navigate(location.hash ? [r.tab, ...r.parts].join('/') : 'tarefas/entrada');

  // ao voltar para o app num novo dia, atualiza "Hoje"
  let lastDay = new Date().toDateString();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && new Date().toDateString() !== lastDay) {
      lastDay = new Date().toDateString();
      views[active]?.refresh();
    }
  });

  // Ctrl+K (ou Cmd+K) abre a busca no PC
  addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (!document.querySelector('.search-sheet')) openSearch();
    }
  });

  startReminders();
  registerServiceWorker();
}

main().catch((e) => {
  console.error(e);
  document.getElementById('main').innerHTML = `<div class="boot">Erro ao iniciar: ${e.message}</div>`;
});
