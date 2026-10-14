// Aba Calendário: visões Dia, Semana e Mês. Mostra eventos e tarefas com data.

import { h, render, segmented } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { openSheet, openMenu } from '../../ui/sheet.js';
import { toast } from '../../ui/toast.js';
import * as store from '../../core/store.js';
import {
  todayISO, addDays, addMonths, startOfWeek, startOfMonth, fromISO, weekday, diffDays,
  MONTHS, MONTHS_SHORT, WEEKDAYS_SHORT, minToTime, nowMinutes,
} from '../../core/date.js';
import { capitalize } from '../../core/util.js';
import { occurrencesForRange, layoutColumns } from './occurrences.js';
import { exportICS } from './ics.js';
import { openEditor, openNewEvent } from '../editor/editor.js';
import { completeWithFeedback } from '../tasks/task-row.js';
import { openSettings } from '../settings/settings-view.js';

const HOUR_H = 52; // altura de 1 hora em px
const MODES = [
  { value: 'day', label: 'Dia' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
];

export function createCalendarView() {
  let mode = store.getSettings().calendarView || 'week';
  let anchor = todayISO();
  let lastRangeKey = '';
  let scrollEl = null;
  let nowTimer = null;

  const titleEl = h('h1', { class: 'view-title' });
  const modeSwitch = segmented(MODES, mode, (m) => setMode(m), { className: 'cal-modes' });

  function setMode(m, date) {
    mode = m;
    if (date) anchor = date;
    modeSwitch.setValue(m);
    refresh();
    if (store.getSettings().calendarView !== m) store.setSettings({ calendarView: m });
  }

  const header = h('header', { class: 'view-header cal-header' },
    h('div', { class: 'view-heading' }, titleEl),
    h('div', { class: 'header-actions' },
      h('button', { type: 'button', class: 'btn btn-sm', onclick: () => { anchor = todayISO(); lastRangeKey = ''; refresh(); } }, 'Hoje'),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Anterior', onclick: () => step(-1) }, icon('chevronLeft')),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Próximo', onclick: () => step(1) }, icon('chevronRight')),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Mais opções', onclick: openMore }, icon('more')),
      h('button', { type: 'button', class: 'icon-btn hide-mobile', 'aria-label': 'Ajustes', onclick: openSettings }, icon('settings'))));

  const toolbar = h('div', { class: 'cal-toolbar' }, modeSwitch);
  const body = h('div', { class: 'cal-body' });
  const fab = h('button', { type: 'button', class: 'fab', 'aria-label': 'Novo evento', onclick: () => {
    const base = mode === 'month' || anchor !== todayISO() ? anchor : todayISO();
    const t = Math.ceil((nowMinutes() + 1) / 30) * 30;
    openNewEvent(base, minToTime(Math.min(t, 23 * 60)));
  } }, icon('plus', 24));

  const el = h('section', { class: 'view view-calendar' }, header, toolbar, body, fab);

  // gesto de deslizar para trocar de período
  let touch = null;
  body.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touch = { x: t.clientX, y: t.clientY, time: Date.now() };
  }, { passive: true });
  body.addEventListener('touchend', (e) => {
    if (!touch) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.x;
    const dy = t.clientY - touch.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8 && Date.now() - touch.time < 600) step(dx < 0 ? 1 : -1);
    touch = null;
  }, { passive: true });

  function step(dir) {
    if (mode === 'day') anchor = addDays(anchor, dir);
    else if (mode === 'week') anchor = addDays(anchor, 7 * dir);
    else anchor = addMonths(startOfMonth(anchor), dir);
    refresh();
  }

  function openMore() {
    openMenu({
      title: 'Calendário',
      items: [
        { label: 'Novo evento', icon: 'plus', onClick: () => openNewEvent(anchor, '09:00') },
        { label: 'Nova tarefa no calendário', icon: 'tasks', onClick: () => openEditor({ type: 'task', defaults: { date: anchor, block: true } }) },
        { separator: true },
        { label: 'Exportar para Google Agenda (.ics)', icon: 'download', onClick: openExport },
        {
          label: store.getSettings().showDoneInCalendar ? 'Ocultar tarefas concluídas' : 'Mostrar tarefas concluídas',
          icon: 'checkCircle',
          onClick: () => store.setSettings({ showDoneInCalendar: !store.getSettings().showDoneInCalendar }),
        },
      ],
    });
  }

  function openExport() {
    const evCheck = h('input', { type: 'checkbox', checked: true });
    const tkCheck = h('input', { type: 'checkbox', checked: true });
    const s = openSheet({
      title: 'Exportar agenda',
      size: 'small',
      body: h('div', { class: 'stack' },
        h('label', { class: 'check-label' }, evCheck, 'Eventos'),
        h('label', { class: 'check-label' }, tkCheck, 'Tarefas do calendário (pendentes)'),
        h('div', { class: 'note' },
          h('strong', null, 'Como importar no Google Agenda: '),
          'abra calendar.google.com no computador → Configurações (engrenagem) → Importar e exportar → selecione o arquivo .ics. No celular, abrir o arquivo também oferece adicionar à agenda.')),
      footer: [
        h('button', { class: 'btn', type: 'button', onclick: () => s.close() }, 'Cancelar'),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
          const n = await exportICS({ events: evCheck.checked, tasks: tkCheck.checked });
          s.close();
          toast(`${n} ite${n === 1 ? 'm exportado' : 'ns exportados'}`);
        } }, icon('download', 18), 'Baixar .ics'),
      ],
    });
  }

  // ---------- itens ----------
  function openItem(it) {
    if (it.kind === 'event') openEditor({ id: it.id, type: 'event' });
    else openEditor({ id: it.id, type: 'task' });
  }

  function checkFor(it) {
    if (it.kind !== 'task') return null;
    return h('button', {
      type: 'button', class: `check tiny prio-${it.priority || 4} ${it.done ? 'is-done' : ''}`, 'aria-label': it.done ? 'Reabrir' : 'Concluir',
      onclick: (e) => {
        e.stopPropagation();
        const task = store.get('tasks', it.id);
        if (task) completeWithFeedback(task);
      },
    }, icon('check', 10));
  }

  const colorOf = (it) => (it.kind === 'task' && !it.block ? `var(--p${it.priority || 4}-c)` : it.color || 'var(--accent)');

  function chip(it) {
    return h('div', {
      class: `cal-chip kind-${it.kind} ${it.done ? 'done' : ''}`, style: { '--c': colorOf(it) }, role: 'button', tabindex: '0',
      onclick: (e) => { e.stopPropagation(); openItem(it); },
    }, checkFor(it), h('span', { class: 'cal-chip-title' }, it.title));
  }

  function timedItem(it, showTime) {
    const top = (it.start / 60) * HOUR_H;
    if (it.point) return pointItem(it, top);
    const height = Math.max(18, ((it.end - it.start) / 60) * HOUR_H - 2);
    const short = height < 34;
    return h('div', {
      class: `cal-item kind-${it.kind} ${it.block ? 'block' : ''} ${it.done ? 'done' : ''} ${short ? 'short' : ''}`,
      style: {
        '--c': colorOf(it), top: `${top}px`, height: `${height}px`,
        left: `calc(${(it._col / it._cols) * 100}% + 1px)`, width: `calc(${100 / it._cols}% - 3px)`,
      },
      role: 'button', tabindex: '0',
      onclick: (e) => { e.stopPropagation(); openItem(it); },
    },
    h('div', { class: 'cal-item-row' }, checkFor(it), h('span', { class: 'cal-item-title' }, it.title)),
    showTime && !short ? h('div', { class: 'cal-item-time' }, `${minToTime(it.start)} – ${minToTime(it.end)}`, it.recurring ? icon('repeat', 11) : null) : null);
  }

  // "Sem duração": marcação fina só no horário (ex.: entrega de trabalho)
  function pointItem(it, top) {
    return h('div', {
      class: `cal-item cal-point kind-${it.kind} ${it.done ? 'done' : ''}`,
      style: {
        '--c': colorOf(it), top: `${top}px`,
        left: `calc(${(it._col / it._cols) * 100}% + 1px)`, width: `calc(${100 / it._cols}% - 3px)`,
      },
      role: 'button', tabindex: '0', title: `${minToTime(it.start)} ${it.title}`,
      onclick: (e) => { e.stopPropagation(); openItem(it); },
    },
    checkFor(it),
    h('span', { class: 'cal-point-time' }, minToTime(it.start)),
    h('span', { class: 'cal-item-title' }, it.title));
  }

  // ---------- visões ----------
  function renderTimeGrid(days) {
    const today = todayISO();
    const occ = occurrencesForRange(days[0], days[days.length - 1]);
    const cols = `var(--cal-gutter) repeat(${days.length}, minmax(0, 1fr))`;
    const single = days.length === 1;

    const head = h('div', { class: 'cal-head', style: { gridTemplateColumns: cols } },
      h('div'),
      days.map((d) => h('button', {
        type: 'button', class: `cal-dayhead ${d === today ? 'today' : ''} ${weekday(d) === 0 || weekday(d) === 6 ? 'weekend' : ''}`,
        onclick: () => { if (!single) setMode('day', d); },
      }, h('span', { class: 'wd' }, WEEKDAYS_SHORT[weekday(d)]), h('span', { class: 'dn' }, String(fromISO(d).getDate())))));

    const hasAllDay = days.some((d) => occ.get(d).allDay.length);
    const allDay = h('div', { class: `cal-allday ${hasAllDay ? '' : 'no-items'}`, style: { gridTemplateColumns: cols } },
      h('div', { class: 'cal-allday-label' }, 'dia'),
      days.map((d) => h('div', {
        class: 'cal-allday-cell',
        onclick: () => openEditor({ type: 'task', defaults: { date: d, block: true } }),
      }, occ.get(d).allDay.map(chip))));

    const gutter = h('div', { class: 'cal-gutter' },
      Array.from({ length: 24 }, (_, i) => h('div', { class: 'cal-hour', style: { height: `${HOUR_H}px` } }, i ? `${String(i).padStart(2, '0')}:00` : '')));

    const columns = days.map((d) => {
      const col = h('div', {
        class: `cal-col ${d === today ? 'today' : ''}`,
        style: { height: `${24 * HOUR_H}px` },
        onclick: (e) => {
          if (e.target !== col) return;
          const y = e.clientY - col.getBoundingClientRect().top;
          const min = Math.floor((y / HOUR_H) * 2) * 30;
          openNewEvent(d, minToTime(Math.max(0, Math.min(min, 23 * 60 + 30))));
        },
      }, layoutColumns(occ.get(d).timed).map((it) => timedItem(it, true)));
      if (d === today) {
        const line = h('div', { class: 'now-line', style: { top: `${(nowMinutes() / 60) * HOUR_H}px` } });
        col.append(line);
      }
      return col;
    });

    const grid = h('div', { class: 'cal-grid', style: { gridTemplateColumns: cols } }, gutter, columns);
    const scroll = h('div', { class: 'cal-scroll' }, grid);
    const wrap = h('div', { class: `cal-timegrid ${single ? 'single' : ''}` }, head, allDay, scroll);

    const prevTop = scrollEl?.scrollTop;
    const rangeKey = `${mode}:${days[0]}`;
    render(body, wrap);
    scrollEl = scroll;
    if (rangeKey === lastRangeKey && prevTop != null) scroll.scrollTop = prevTop;
    else {
      const includesToday = days.includes(today);
      const startHour = includesToday ? Math.max(0, Math.floor(nowMinutes() / 60) - 2) : 7;
      scroll.scrollTop = startHour * HOUR_H;
    }
    lastRangeKey = rangeKey;
  }

  function renderMonth() {
    const ws = store.getSettings().weekStart;
    const today = todayISO();
    const first = startOfMonth(anchor);
    const gridStart = startOfWeek(first, ws);
    const month = fromISO(first).getMonth();
    const lastDay = addDays(addMonths(first, 1), -1);
    const weeks = Math.ceil((diffDays(gridStart, lastDay) + 1) / 7);
    const gridEnd = addDays(gridStart, weeks * 7 - 1);
    const occ = occurrencesForRange(gridStart, gridEnd);

    const head = h('div', { class: 'cal-mhead' },
      Array.from({ length: 7 }, (_, i) => h('div', null, WEEKDAYS_SHORT[(i + ws) % 7])));
    const cells = [];
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
      const day = occ.get(d);
      const items = [...day.allDay, ...day.timed];
      const max = 3;
      const date = d;
      cells.push(h('button', {
        type: 'button',
        class: `cal-mcell ${fromISO(d).getMonth() !== month ? 'other' : ''} ${d === today ? 'today' : ''}`,
        onclick: () => setMode('day', date),
      },
      h('span', { class: 'cal-mnum' }, String(fromISO(d).getDate())),
      h('div', { class: 'cal-mitems' },
        items.slice(0, max).map((it) => h('div', { class: `cal-mitem kind-${it.kind} ${it.done ? 'done' : ''}`, style: { '--c': colorOf(it) } },
          h('i', { class: 'dot' }), h('span', null, it.start != null ? h('b', { class: 't' }, minToTime(it.start) + ' ') : null, it.title))),
        items.length > max ? h('div', { class: 'cal-mmore' }, `+${items.length - max}`) : null)));
    }
    render(body, h('div', { class: 'cal-month' }, head, h('div', { class: 'cal-mgrid', style: { gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` } }, cells)));
    scrollEl = null;
    lastRangeKey = '';
  }

  function renderTitle() {
    const d = fromISO(anchor);
    if (mode === 'month') titleEl.textContent = `${capitalize(MONTHS[d.getMonth()])} ${d.getFullYear()}`;
    else if (mode === 'day') {
      const wd = WEEKDAYS_SHORT[d.getDay()];
      titleEl.textContent = `${capitalize(wd)}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
    } else {
      const s = fromISO(startOfWeek(anchor, store.getSettings().weekStart));
      const e = fromISO(addDays(startOfWeek(anchor, store.getSettings().weekStart), 6));
      titleEl.textContent = s.getMonth() === e.getMonth()
        ? `${capitalize(MONTHS[s.getMonth()])} ${s.getFullYear()}`
        : `${capitalize(MONTHS_SHORT[s.getMonth()])} – ${MONTHS_SHORT[e.getMonth()]} ${e.getFullYear()}`;
    }
  }

  function refresh() {
    modeSwitch.setValue(mode);
    renderTitle();
    body.dataset.mode = mode;
    if (mode === 'month') renderMonth();
    else if (mode === 'day') renderTimeGrid([anchor]);
    else {
      const start = startOfWeek(anchor, store.getSettings().weekStart);
      renderTimeGrid(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
    }
  }

  function activate() {
    refresh();
    clearInterval(nowTimer);
    nowTimer = setInterval(() => {
      const line = body.querySelector('.now-line');
      if (line) line.style.top = `${(nowMinutes() / 60) * HOUR_H}px`;
    }, 60000);
  }

  return { el, activate, refresh };
}
