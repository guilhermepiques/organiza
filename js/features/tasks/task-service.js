// Regras de negócio das tarefas (sem DOM).

import * as store from '../../core/store.js';
import { todayISO, addDays, startOfWeek, toISO } from '../../core/date.js';
import { nextOccurrence } from '../../core/recurrence.js';
import { normalize, byOrder } from '../../core/util.js';
import { PROJECT_COLORS } from '../settings/palettes.js';

export const PRIORITIES = [
  { value: 1, label: 'Prioridade 1', short: 'P1' },
  { value: 2, label: 'Prioridade 2', short: 'P2' },
  { value: 3, label: 'Prioridade 3', short: 'P3' },
  { value: 4, label: 'Sem prioridade', short: 'P4' },
];

export function newTaskFields(fields = {}) {
  return {
    title: '',
    notes: '',
    date: null,
    time: null,
    duration: null,
    priority: 4,
    labels: [],
    projectId: null,
    subtasks: [],
    recurrence: null,
    reminder: null,
    block: false, // true = também aparece como bloco de horário no calendário ("tarefa + evento")
    color: null,
    done: false,
    doneAt: null,
    order: Date.now(),
    ...fields,
  };
}

export function createTask(fields) {
  return store.create('tasks', newTaskFields(fields));
}

/** Conclui (ou reabre) uma tarefa. Tarefas recorrentes avançam para a próxima data. */
export function toggleTask(id) {
  const t = store.get('tasks', id);
  if (!t) return null;
  if (t.done) {
    store.batch('Tarefa reaberta', () => {
      const last = store.all('log').filter((l) => l.taskId === id).sort((a, b) => b.at - a.at)[0];
      if (last) store.remove('log', last.id);
      store.update('tasks', id, { done: false, doneAt: null });
    });
    return { reopened: true };
  }
  return store.batch('Tarefa concluída', () => {
    store.create('log', { type: 'done', taskId: id, title: t.title, at: Date.now(), date: todayISO() });
    if (t.recurrence && t.date) {
      const today = todayISO();
      const after = t.date > today ? t.date : today;
      const next = nextOccurrence(t.date, t.recurrence, after);
      if (next) {
        store.update('tasks', id, { date: next, subtasks: (t.subtasks || []).map((s) => ({ ...s, done: false })) });
        return { next };
      }
    }
    store.update('tasks', id, { done: true, doneAt: Date.now() });
    return { done: true };
  });
}

export function deleteTask(id) {
  store.batch('Tarefa excluída', () => store.remove('tasks', id));
}

export function toggleSubtask(taskId, subId) {
  const t = store.get('tasks', taskId);
  if (!t) return;
  store.update('tasks', taskId, { subtasks: t.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s)) });
}

// ---------- projetos ----------
export function projects() {
  return store.all('projects').sort(byOrder);
}

export function findOrCreateProject(name) {
  const n = normalize(name);
  const found = projects().find((p) => normalize(p.name) === n);
  if (found) return found;
  return createProject(name);
}

export function createProject(name) {
  const count = projects().length;
  return store.create('projects', { name, color: PROJECT_COLORS[(count + 1) % PROJECT_COLORS.length], order: Date.now() });
}

export function deleteProject(id) {
  store.batch('Projeto excluído', () => {
    for (const t of store.all('tasks')) if (t.projectId === id) store.update('tasks', t.id, { projectId: null });
    store.remove('projects', id);
  });
}

// ---------- etiquetas ----------
export function labelsInUse() {
  const map = new Map();
  for (const t of store.all('tasks')) {
    for (const l of t.labels || []) {
      const key = normalize(l);
      const cur = map.get(key) || { name: l, count: 0 };
      if (!t.done) cur.count++;
      map.set(key, cur);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

// ---------- visões ----------
export const VIEWS = {
  entrada: { title: 'Entrada', icon: 'inbox' },
  hoje: { title: 'Hoje', icon: 'sun' },
  proximos: { title: 'Próximos', icon: 'calendarDays' },
  concluidas: { title: 'Concluídas', icon: 'checkCircle' },
};

export function viewTitle(view) {
  if (VIEWS[view.key]) return VIEWS[view.key].title;
  if (view.key === 'projeto') return store.get('projects', view.id)?.name || 'Projeto';
  if (view.key === 'etiqueta') return '@' + view.id;
  return 'Tarefas';
}

const SORTERS = {
  smart: (a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.time || '99').localeCompare(b.time || '99') || a.priority - b.priority || byOrder(a, b),
  date: (a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.time || '99').localeCompare(b.time || '99') || byOrder(a, b),
  priority: (a, b) => a.priority - b.priority || SORTERS.date(a, b),
  name: (a, b) => a.title.localeCompare(b.title, 'pt-BR'),
  created: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
};
export const SORT_OPTIONS = [
  { value: 'smart', label: 'Inteligente (data, hora, prioridade)' },
  { value: 'date', label: 'Data' },
  { value: 'priority', label: 'Prioridade' },
  { value: 'name', label: 'Nome (A–Z)' },
  { value: 'created', label: 'Mais recentes primeiro' },
];

/**
 * Monta os grupos de tarefas de uma visão. (A busca fica em features/search.)
 * @returns {Array<{ id, title, tasks, tone?, dateGroup? }>}
 */
export function groupsFor(view, { sort = 'smart', priorities = null } = {}) {
  const today = todayISO();
  const sorter = SORTERS[sort] || SORTERS.smart;
  let tasks = store.all('tasks');
  if (priorities?.size) tasks = tasks.filter((t) => priorities.has(t.priority));

  const open = tasks.filter((t) => !t.done);
  const overdue = (list) => list.filter((t) => t.date && t.date < today).sort(sorter);

  switch (view.key) {
    case 'hoje':
      return [
        { id: 'atrasadas', title: 'Atrasadas', tone: 'danger', tasks: overdue(open), overdue: true },
        { id: 'hoje', title: 'Hoje', tasks: open.filter((t) => t.date === today).sort(sorter), dateGroup: true },
      ];
    case 'proximos': {
      const groups = [{ id: 'atrasadas', title: 'Atrasadas', tone: 'danger', tasks: overdue(open), overdue: true }];
      const future = open.filter((t) => t.date && t.date >= today).sort(sorter);
      const byDate = new Map();
      // só os dias que têm alguma tarefa (pedido do usuário)
      for (const t of future) {
        if (!byDate.has(t.date)) byDate.set(t.date, []);
        byDate.get(t.date).push(t);
      }
      for (const [date, list] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        groups.push({ id: date, date, tasks: list, dateGroup: true });
      }
      return groups;
    }
    case 'concluidas': {
      const done = tasks.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
      const byDay = new Map();
      for (const t of done) {
        const d = toISO(new Date(t.doneAt || t.updatedAt));
        if (!byDay.has(d)) byDay.set(d, []);
        byDay.get(d).push(t);
      }
      return [...byDay.entries()].map(([date, list]) => ({ id: date, date, tasks: list }));
    }
    case 'projeto':
      return [
        { id: 'projeto', tasks: open.filter((t) => t.projectId === view.id).sort(sorter) },
        { id: 'feitas', title: 'Concluídas', collapsible: true, tasks: tasks.filter((t) => t.done && t.projectId === view.id).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)) },
      ];
    case 'etiqueta': {
      const n = normalize(view.id);
      return [{ id: 'etiqueta', tasks: open.filter((t) => (t.labels || []).some((l) => normalize(l) === n)).sort(sorter) }];
    }
    case 'entrada':
    default:
      // Entrada = todas as tarefas pendentes (com ou sem projeto), separadas em
      // Sem data · Atrasadas · Próximos (pedido do usuário). Dentro de cada grupo vale a ordenação escolhida;
      // em "Próximos" a ordem é sempre por data (hoje, amanhã…).
      return [
        { id: 'sem-data', title: 'Sem data', tasks: open.filter((t) => !t.date).sort(sorter) },
        { id: 'atrasadas', title: 'Atrasadas', tone: 'danger', tasks: overdue(open), overdue: true },
        { id: 'proximas', title: 'Próximos', tasks: open.filter((t) => t.date && t.date >= today).sort(SORTERS.smart) },
      ];
  }
}

export function counts() {
  const today = todayISO();
  const open = store.all('tasks').filter((t) => !t.done);
  const byProject = {};
  for (const t of open) if (t.projectId) byProject[t.projectId] = (byProject[t.projectId] || 0) + 1;
  return {
    entrada: open.length,
    hoje: open.filter((t) => t.date && t.date <= today).length,
    proximos: open.filter((t) => t.date && t.date >= today).length,
    byProject,
  };
}

export function rescheduleOverdueToToday() {
  const today = todayISO();
  const list = store.all('tasks').filter((t) => !t.done && t.date && t.date < today);
  if (!list.length) return 0;
  store.batch('Tarefas reagendadas', () => {
    for (const t of list) store.update('tasks', t.id, { date: today });
  });
  return list.length;
}

// ---------- produtividade ----------
export function stats(weekStart = 0) {
  const logs = store.all('log').filter((l) => l.type === 'done');
  const today = todayISO();
  const days = new Map();
  for (const l of logs) {
    const d = l.date || toISO(new Date(l.at));
    days.set(d, (days.get(d) || 0) + 1);
  }
  const ws = startOfWeek(today, weekStart);
  let week = 0;
  for (const [d, n] of days) if (d >= ws && d <= today) week += n;
  let streak = 0;
  let cursor = days.has(today) ? today : addDays(today, -1);
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    last7.push({ date: d, count: days.get(d) || 0 });
  }
  return { today: days.get(today) || 0, week, streak, total: logs.length, last7 };
}
