// Linha de tarefa: círculo de concluir (cor = prioridade), título e metadados.

import { h, vibrate } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { swipeable } from '../../ui/swipe.js';
import { undoToast } from '../../ui/toast.js';
import * as store from '../../core/store.js';
import { relativeLabel, todayISO } from '../../core/date.js';
import { describe } from '../../core/recurrence.js';
import { toggleTask, deleteTask } from './task-service.js';
import { openEditor } from '../editor/editor.js';

export function completeWithFeedback(task) {
  vibrate(12);
  const res = toggleTask(task.id);
  if (!res) return;
  if (res.reopened) undoToast('Tarefa reaberta');
  else if (res.next) undoToast(`Concluída · próxima: ${relativeLabel(res.next)}`);
  else undoToast('Tarefa concluída');
}

export function checkButton(task, { onToggle } = {}) {
  return h('button', {
    type: 'button',
    class: `check prio-${task.priority || 4} ${task.done ? 'is-done' : ''}`,
    'aria-label': task.done ? 'Reabrir tarefa' : 'Concluir tarefa',
    onclick: (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      btn.classList.add('pop');
      const row = btn.closest('.task-row');
      if (!task.done && !task.recurrence) row?.classList.add('completing');
      setTimeout(() => (onToggle ? onToggle(task) : completeWithFeedback(task)), task.done ? 0 : 260);
    },
  }, icon('check', 14));
}

export function taskMeta(task, { hideDate = false, hideProject = false } = {}) {
  const today = todayISO();
  const parts = [];
  if (task.date && (!hideDate || task.time)) {
    const overdue = !task.done && task.date < today;
    const label = hideDate ? task.time : `${relativeLabel(task.date)}${task.time ? ' ' + task.time : ''}`;
    parts.push(h('span', { class: `meta meta-date ${overdue ? 'overdue' : ''} ${task.date === today ? 'today' : ''}` }, icon('calendar', 13), label));
  }
  if (task.recurrence) parts.push(h('span', { class: 'meta', title: describe(task.recurrence, task.date) }, icon('repeat', 13)));
  if (task.reminder != null) parts.push(h('span', { class: 'meta', title: 'Lembrete' }, icon('bell', 13)));
  if (task.block) parts.push(h('span', { class: 'meta', title: 'No calendário' }, icon('calendarDays', 13)));
  if (task.subtasks?.length) {
    const done = task.subtasks.filter((s) => s.done).length;
    parts.push(h('span', { class: 'meta' }, icon('checkCircle', 13), `${done}/${task.subtasks.length}`));
  }
  if (task.notes) parts.push(h('span', { class: 'meta', title: 'Tem notas' }, icon('notes', 13)));
  for (const l of task.labels || []) parts.push(h('span', { class: 'meta meta-label' }, '@' + l));
  if (!hideProject && task.projectId) {
    const p = store.get('projects', task.projectId);
    if (p) parts.push(h('span', { class: 'meta meta-project' }, h('i', { class: 'dot', style: { background: p.color } }), p.name));
  }
  return parts.length ? h('div', { class: 'task-meta' }, parts) : null;
}

export function taskRow(task, opts = {}) {
  const content = h('div', {
    class: `task-row ${task.done ? 'done' : ''}`,
    dataset: { id: task.id },
    tabindex: '0',
    onclick: () => openEditor({ id: task.id, type: 'task' }),
    onkeydown: (e) => {
      if (e.key === 'Enter') openEditor({ id: task.id, type: 'task' });
    },
  },
  checkButton(task),
  h('div', { class: 'task-main' },
    h('div', { class: 'task-title' }, task.title || 'Sem título'),
    taskMeta(task, opts)));

  return swipeable(content, {
    right: { icon: task.done ? 'undo' : 'check', className: 'bg-success', onSwipe: () => completeWithFeedback(task) },
    left: {
      icon: 'trash',
      className: 'bg-danger',
      onSwipe: () => {
        deleteTask(task.id);
        undoToast('Tarefa excluída');
      },
    },
  });
}
