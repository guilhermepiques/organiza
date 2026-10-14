// Campo de adição rápida, sempre à mão no rodapé da aba Tarefas.
// Entende linguagem natural e mostra uma prévia do que foi reconhecido.

import { h, render } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { toast } from '../../ui/toast.js';
import * as store from '../../core/store.js';
import { normalize, capitalize } from '../../core/util.js';
import { relativeLabel } from '../../core/date.js';
import { describe } from '../../core/recurrence.js';
import { parseTask } from './nlp.js';
import { createTask, findOrCreateProject, projects } from './task-service.js';
import { openEditor } from '../editor/editor.js';

function tokenChip(t) {
  switch (t.type) {
    case 'date': return h('span', { class: 'qa-token' }, icon('calendar', 13), relativeLabel(t.value));
    case 'time': return h('span', { class: 'qa-token' }, icon('clock', 13), t.value);
    case 'recurrence': return h('span', { class: 'qa-token' }, icon('repeat', 13), describe(t.value));
    case 'priority': return h('span', { class: `qa-token prio-text-${t.value}` }, icon('flag', 13), 'P' + t.value);
    case 'project': {
      const exists = projects().some((p) => normalize(p.name) === normalize(t.value));
      return h('span', { class: 'qa-token' }, icon('folder', 13), t.value + (exists ? '' : ' (novo)'));
    }
    case 'label': return h('span', { class: 'qa-token' }, '@' + t.value);
    default: return null;
  }
}

/**
 * @param {{ getDefaults: () => object }} opts  campos padrão conforme a visão atual
 */
export function createQuickAdd({ getDefaults }) {
  const preview = h('div', { class: 'qa-preview', 'aria-live': 'polite' });
  const input = h('input', {
    class: 'qa-input',
    placeholder: 'Nova tarefa… ex.: luz amanhã 18h',
    enterkeyhint: 'send',
    autocomplete: 'off',
    'aria-label': 'Adicionar tarefa',
    oninput: update,
  });
  const expand = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Abrir editor completo', title: 'Mais opções', onclick: openFull }, icon('edit', 18));
  const submit = h('button', { type: 'submit', class: 'qa-submit', 'aria-label': 'Adicionar' }, icon('plus', 22));
  const form = h('form', { class: 'quick-add', onsubmit: (e) => { e.preventDefault(); add(); } },
    preview,
    h('div', { class: 'qa-field' }, input, expand, submit));

  function update() {
    const text = input.value.trim();
    if (!text) return render(preview, );
    const p = parseTask(text);
    render(preview, ...p.tokens.map(tokenChip));
  }

  function build() {
    const text = input.value.trim();
    const p = parseTask(text);
    const d = getDefaults();
    const fields = {
      title: capitalize(p.title || text),
      date: p.date ?? null,
      time: p.time,
      priority: p.priority || 4,
      labels: [...new Set([...(d.labels || []), ...p.labels])],
      projectId: p.project ? findOrCreateProject(p.project).id : d.projectId || null,
      recurrence: p.recurrence,
    };
    return fields;
  }

  function add() {
    if (!input.value.trim()) return openFull();
    const fields = build();
    const task = store.batch('Tarefa criada', () => createTask(fields));
    input.value = '';
    update();
    const d = getDefaults();
    if (fields.date) {
      // Tarefa com data não vai sozinha para o calendário: oferece adicionar
      const when = relativeLabel(fields.date).toLowerCase() + (fields.time ? ' ' + fields.time : '');
      toast(`Tarefa criada para ${when}`, {
        actionLabel: 'Adicionar ao calendário',
        duration: 6000,
        onAction: () => {
          store.batch('Adicionada ao calendário', () => store.update('tasks', task.id, { block: true, duration: task.duration || 60 }));
          toast('Adicionada ao calendário');
        },
      });
    } else if (d.view === 'hoje' || d.view === 'proximos') toast('Tarefa criada na Entrada (sem data)');
    else if (fields.projectId && d.view !== 'projeto') toast(`Tarefa criada em ${store.get('projects', fields.projectId)?.name}`);
  }

  function openFull() {
    const fields = input.value.trim() ? build() : { ...getDefaults() };
    delete fields.view;
    input.value = '';
    update();
    openEditor({ type: 'task', defaults: fields });
  }

  return { el: form, focus: () => input.focus() };
}
