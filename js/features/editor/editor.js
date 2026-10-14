// Editor único de Tarefa ou Evento. Usado pelas três abas.
//
// Tarefa: começa sem data. O botão "Data/Horário" mostra data, hora, repetição e lembrete.
// O botão "Adicionar ao calendário" faz a tarefa aparecer no calendário (campo `block`),
// com duração e cor. Tarefa com data mas fora do calendário: ao salvar, pergunta se quer adicionar.
// Evento: só existe no calendário (sempre com data).

import { h, render, segmented, autoGrow } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { openSheet, promptText, choiceDialog } from '../../ui/sheet.js';
import { undoToast, toast } from '../../ui/toast.js';
import * as store from '../../core/store.js';
import { uid } from '../../core/util.js';
import { todayISO, addDays, weekday, fromISO, relativeLabel, WEEKDAYS, WEEKDAYS_LETTER, durationLabel } from '../../core/date.js';
import { PRIORITIES, projects, createProject, labelsInUse, newTaskFields, toggleTask } from '../tasks/task-service.js';
import { EVENT_COLORS } from '../settings/palettes.js';
import { ensureNotificationPermission } from '../reminders/reminders.js';

const KINDS = [
  { value: 'task', label: 'Tarefa' },
  { value: 'event', label: 'Evento' },
];

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240, 480];
const REMINDERS = [
  { value: '', label: 'Sem lembrete' },
  { value: '0', label: 'Na hora' },
  { value: '5', label: '5 min antes' },
  { value: '10', label: '10 min antes' },
  { value: '15', label: '15 min antes' },
  { value: '30', label: '30 min antes' },
  { value: '60', label: '1 hora antes' },
  { value: '120', label: '2 horas antes' },
  { value: '1440', label: '1 dia antes' },
];

function presetOf(rule) {
  if (!rule) return 'none';
  const n = rule.interval || 1;
  const days = rule.days?.slice().sort().join();
  if (n !== 1) return 'custom';
  if (rule.freq === 'daily') return 'daily';
  if (rule.freq === 'weekly' && days === '1,2,3,4,5') return 'weekdays';
  if (rule.freq === 'weekly' && (!rule.days || rule.days.length <= 1)) return 'weekly';
  if (rule.freq === 'monthly') return 'monthly';
  if (rule.freq === 'yearly') return 'yearly';
  return 'custom';
}

/**
 * @param {{ id?: string, type?: 'task'|'event', defaults?: object }} opts
 *   defaults.block = true abre a tarefa já com "Adicionar ao calendário" ligado (ex.: criada pelo calendário).
 */
export function openEditor({ id = null, type = 'task', defaults = {} } = {}) {
  const settings = store.getSettings();
  const sourceCol = id ? (type === 'event' ? 'events' : 'tasks') : null;
  const original = id ? store.get(sourceCol, id) : null;
  if (id && !original) return toast('Item não encontrado');
  const isNew = !original;

  const v = {
    title: '', notes: '', date: null, time: null, duration: settings.defaultEventDuration || 60, allDay: false,
    priority: 4, projectId: null, labels: [], subtasks: [], recurrence: null, reminder: null, color: null, block: false,
    ...(original || {}),
    ...defaults,
  };
  if (original && sourceCol === 'events') v.time = original.allDay ? null : original.time;
  if (!v.duration) v.duration = settings.defaultEventDuration || 60;

  let kind = original ? (sourceCol === 'events' ? 'event' : 'task') : type === 'event' ? 'event' : 'task';
  let inCal = !!v.block || type === 'both';
  let dated = !!v.date || inCal;
  if ((kind === 'event' || inCal) && !v.date) v.date = todayISO();
  let subtasks = (v.subtasks || []).map((s) => ({ ...s }));
  let labels = [...(v.labels || [])];
  let color = v.color ?? null;
  let priority = v.priority || 4;

  // ---------- campos ----------
  const titleInput = h('input', {
    class: 'editor-title', value: v.title, placeholder: 'O que precisa ser feito?', autofocus: isNew ? true : null,
    enterkeyhint: 'done', autocomplete: 'off',
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } },
  });
  const notesInput = autoGrow(h('textarea', { class: 'editor-notes', rows: '1', placeholder: 'Notas', value: v.notes || '' }));

  const dateInput = h('input', { type: 'date', class: 'input input-compact', value: v.date || '', onchange: () => { refreshRepeatLabels(); syncQuick(); } });
  const timeInput = h('input', { type: 'time', class: 'input input-compact', value: v.time || '', step: '300', onchange: () => { if (timeInput.value) allDayInput.checked = false; syncAllDay(); } });
  const clearTime = h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Remover hora', onclick: () => { timeInput.value = ''; } }, icon('x', 16));
  const allDayInput = h('input', { type: 'checkbox', checked: !!v.allDay, onchange: syncAllDay });

  const quickDates = [
    { label: 'Hoje', value: () => todayISO() },
    { label: 'Amanhã', value: () => addDays(todayISO(), 1) },
    { label: 'Próx. semana', value: () => addDays(todayISO(), ((8 - weekday(todayISO())) % 7) || 7) },
  ];
  const quickRow = h('div', { class: 'chips' }, quickDates.map((q) =>
    h('button', {
      type: 'button', class: 'chip',
      onclick: () => { dateInput.value = q.value(); refreshRepeatLabels(); syncQuick(); },
    }, q.label)));
  function syncQuick() {
    [...quickRow.children].forEach((c, i) => c.classList.toggle('active', dateInput.value === quickDates[i].value()));
  }

  const durationSelect = h('select', { class: 'input input-compact' },
    [...new Set([...DURATIONS, v.duration])].sort((a, b) => a - b).map((d) => h('option', { value: String(d), selected: d === v.duration }, durationLabel(d))));

  const prioRow = h('div', { class: 'prio-picker' });
  function renderPrio() {
    render(prioRow, ...PRIORITIES.map((p) => h('button', {
      type: 'button', class: `prio-btn prio-${p.value} ${priority === p.value ? 'active' : ''}`,
      title: p.label, 'aria-pressed': String(priority === p.value),
      onclick: () => { priority = p.value; renderPrio(); },
    }, icon('flag', 16), p.short)));
  }
  renderPrio();

  const projectSelect = h('select', { class: 'input', onchange: async () => {
    if (projectSelect.value !== '__new') return;
    const name = await promptText({ title: 'Novo projeto', placeholder: 'Ex.: Casa, Trabalho, Faculdade' });
    if (name) {
      const p = createProject(name);
      fillProjects(p.id);
    } else fillProjects(v.projectId);
  } });
  function fillProjects(selected) {
    render(projectSelect,
      h('option', { value: '' }, 'Sem projeto'),
      ...projects().map((p) => h('option', { value: p.id, selected: p.id === selected }, p.name)),
      h('option', { value: '__new' }, '+ Novo projeto…'));
    projectSelect.value = selected || '';
  }
  fillProjects(v.projectId);

  const labelsWrap = h('div', { class: 'chips' });
  const labelInput = h('input', {
    class: 'chip-input', placeholder: '+ etiqueta', enterkeyhint: 'done',
    onkeydown: (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const name = labelInput.value.trim().replace(/^@/, '').replace(/\s+/g, '-');
        if (name && !labels.includes(name)) labels.push(name);
        labelInput.value = '';
        renderLabels();
        labelInput.focus();
      }
    },
  });
  function renderLabels() {
    const known = labelsInUse().map((l) => l.name);
    const all = [...new Set([...known, ...labels])];
    render(labelsWrap,
      ...all.map((name) => h('button', {
        type: 'button', class: `chip ${labels.includes(name) ? 'active' : ''}`,
        onclick: () => { labels = labels.includes(name) ? labels.filter((l) => l !== name) : [...labels, name]; renderLabels(); },
      }, '@' + name)),
      labelInput);
  }
  renderLabels();

  // repetição
  const repeatSelect = h('select', { class: 'input', onchange: () => syncCustom() });
  const customInterval = h('input', { type: 'number', min: '1', max: '99', class: 'input input-compact num', value: String(v.recurrence?.interval || 1) });
  const customUnit = h('select', { class: 'input input-compact', onchange: () => syncCustom() },
    [['daily', 'dia(s)'], ['weekly', 'semana(s)'], ['monthly', 'mês(es)'], ['yearly', 'ano(s)']].map(([val, l]) =>
      h('option', { value: val, selected: v.recurrence?.freq === val }, l)));
  let customDays = new Set(v.recurrence?.days || []);
  const daysRow = h('div', { class: 'weekday-picker' });
  function renderDays() {
    render(daysRow, ...[0, 1, 2, 3, 4, 5, 6].map((d) => h('button', {
      type: 'button', class: customDays.has(d) ? 'active' : '', title: WEEKDAYS[d], 'aria-pressed': String(customDays.has(d)),
      onclick: () => { customDays.has(d) ? customDays.delete(d) : customDays.add(d); renderDays(); },
    }, WEEKDAYS_LETTER[d])));
  }
  renderDays();
  const customPanel = h('div', { class: 'custom-repeat' },
    h('div', { class: 'row' }, h('span', { class: 'muted' }, 'A cada'), customInterval, customUnit),
    daysRow);
  function refreshRepeatLabels() {
    const d = dateInput.value || todayISO();
    const wd = WEEKDAYS[weekday(d)];
    const day = fromISO(d).getDate();
    const current = repeatSelect.value || presetOf(v.recurrence);
    render(repeatSelect, ...[
      ['none', 'Não repete'],
      ['daily', 'Todo dia'],
      ['weekdays', 'Dias úteis (seg a sex)'],
      ['weekly', `Toda semana (${wd})`],
      ['monthly', `Todo mês (dia ${day})`],
      ['yearly', 'Todo ano'],
      ['custom', 'Personalizar…'],
    ].map(([val, l]) => h('option', { value: val, selected: val === current }, l)));
    repeatSelect.value = current;
  }
  function syncCustom() {
    customPanel.hidden = repeatSelect.value !== 'custom';
    daysRow.hidden = customUnit.value !== 'weekly';
    if (repeatSelect.value === 'custom' && customUnit.value === 'weekly' && !customDays.size) {
      customDays.add(weekday(dateInput.value || todayISO()));
      renderDays();
    }
  }
  refreshRepeatLabels();
  syncCustom();

  const reminderSelect = h('select', { class: 'input' },
    REMINDERS.map((r) => h('option', { value: r.value, selected: String(v.reminder ?? '') === r.value }, r.label)));

  const colorRow = h('div', { class: 'color-picker' });
  function renderColors() {
    render(colorRow, ...EVENT_COLORS.map((c) => h('button', {
      type: 'button', class: `swatch ${color === c.id ? 'active' : ''}`, title: c.name, 'aria-label': c.name,
      style: { background: c.id || 'var(--accent)' },
      onclick: () => { color = c.id; renderColors(); },
    })));
  }
  renderColors();

  // subtarefas
  const subList = h('div', { class: 'subtasks' });
  const subInput = h('input', {
    class: 'input subtask-add', placeholder: 'Adicionar subtarefa', enterkeyhint: 'enter',
    onkeydown: (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const t = subInput.value.trim();
      if (!t) return;
      subtasks.push({ id: uid(), title: t, done: false });
      subInput.value = '';
      renderSubtasks();
    },
  });
  function renderSubtasks() {
    render(subList, ...subtasks.map((s) => h('div', { class: `subtask ${s.done ? 'done' : ''}` },
      h('button', { type: 'button', class: `check small ${s.done ? 'is-done' : ''}`, 'aria-label': 'Concluir subtarefa',
        onclick: () => { s.done = !s.done; renderSubtasks(); } }, icon('check', 12)),
      h('input', { class: 'subtask-title', value: s.title, oninput: (e) => { s.title = e.target.value; } }),
      h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Remover subtarefa',
        onclick: () => { subtasks = subtasks.filter((x) => x !== s); renderSubtasks(); } }, icon('x', 14)))));
  }
  renderSubtasks();

  // ---------- botões "Data/Horário" e "Adicionar ao calendário" ----------
  const toggleChip = (iconName, label, onClick) => h('button', { type: 'button', class: 'toggle-chip', 'aria-pressed': 'false', onclick: onClick },
    icon(iconName, 18), h('span', null, label), h('span', { class: 'toggle-tick' }, icon('check', 16)));
  const datedBtn = toggleChip('clock', 'Data/Horário', () => {
    dated = !dated;
    if (!dated) inCal = false;
    sync();
    if (dated && !dateInput.value) dateInput.focus();
  });
  const calBtn = toggleChip('calendarDays', 'Adicionar ao calendário', () => {
    inCal = !inCal;
    if (inCal) {
      dated = true;
      if (!dateInput.value) dateInput.value = todayISO();
      refreshRepeatLabels();
      syncQuick();
    }
    sync();
  });

  // ---------- layout ----------
  const field = (iconName, label, control, cls = '') =>
    h('div', { class: `field ${cls}` }, h('div', { class: 'field-label' }, icon(iconName, 16), label), h('div', { class: 'field-control' }, control));

  const kindSwitch = segmented(KINDS, kind, (k) => {
    kind = k;
    if (k === 'event' && !dateInput.value) dateInput.value = todayISO();
    sync();
  }, { className: 'kind-switch' });

  const doneToggle = !isNew && sourceCol === 'tasks'
    ? h('button', { type: 'button', class: `check prio-${original.priority} ${original.done ? 'is-done' : ''}`, 'aria-label': 'Concluir',
        onclick: async () => {
          await s.close();
          const res = toggleTask(id);
          undoToast(res?.reopened ? 'Tarefa reaberta' : res?.next ? 'Concluída · próxima ocorrência agendada' : 'Tarefa concluída');
        } }, icon('check', 14))
    : null;

  const form = h('form', { class: 'editor', onsubmit: (e) => { e.preventDefault(); save(); } },
    kindSwitch,
    h('div', { class: 'editor-head' }, doneToggle, titleInput),
    notesInput,
    h('div', { class: 'toggle-row task-only' }, datedBtn, calBtn),
    h('div', { class: 'field-group when-dated' },
      field('calendar', 'Data', h('div', { class: 'stack-sm' }, dateInput, quickRow)),
      field('clock', 'Hora', h('div', { class: 'row' }, timeInput, clearTime,
        h('label', { class: 'check-label pure-event' }, allDayInput, 'Dia todo'))),
      field('clock', 'Duração', durationSelect, 'when-cal'),
      field('repeat', 'Repetir', h('div', { class: 'stack-sm' }, repeatSelect, customPanel)),
      field('bell', 'Lembrete', reminderSelect)),
    h('div', { class: 'field-group when-cal' }, field('palette', 'Cor', colorRow)),
    h('div', { class: 'field-group task-only' },
      field('flag', 'Prioridade', prioRow),
      field('folder', 'Projeto', projectSelect),
      field('tag', 'Etiquetas', labelsWrap)),
    h('div', { class: 'field-group task-only' },
      h('div', { class: 'field-label' }, icon('checkCircle', 16), 'Subtarefas'),
      subList, subInput));

  function syncAllDay() {
    const allDay = kind === 'event' && allDayInput.checked;
    timeInput.disabled = allDay;
    durationSelect.disabled = allDay;
    if (allDay) timeInput.value = '';
  }

  function sync() {
    form.dataset.kind = kind;
    form.dataset.dated = String(dated);
    form.dataset.cal = String(inCal);
    datedBtn.setAttribute('aria-pressed', String(dated));
    calBtn.setAttribute('aria-pressed', String(inCal));
    const titleEl = s?.el.querySelector('.sheet-title');
    if (titleEl) titleEl.textContent = sheetTitle();
    syncAllDay();
  }
  const sheetTitle = () => (isNew ? (kind === 'event' ? 'Novo evento' : 'Nova tarefa') : kind === 'event' ? 'Editar evento' : 'Editar tarefa');

  const footer = [
    !isNew ? h('button', { type: 'button', class: 'btn btn-ghost danger', onclick: remove }, icon('trash', 18), 'Excluir') : null,
    h('span', { class: 'spacer' }),
    h('button', { type: 'button', class: 'btn', onclick: () => s.close() }, 'Cancelar'),
    h('button', { type: 'button', class: 'btn btn-primary', onclick: save }, isNew ? 'Criar' : 'Salvar'),
  ];

  let s = null;
  sync();
  syncQuick();
  s = openSheet({ title: sheetTitle(), body: form, footer, size: 'large', className: 'editor-sheet' });

  // ---------- ações ----------
  function readRecurrence(date) {
    const p = repeatSelect.value;
    const base = { anchor: date };
    switch (p) {
      case 'daily': return { freq: 'daily', interval: 1, ...base };
      case 'weekdays': return { freq: 'weekly', interval: 1, days: [1, 2, 3, 4, 5], ...base };
      case 'weekly': return { freq: 'weekly', interval: 1, days: [weekday(date)], ...base };
      case 'monthly': return { freq: 'monthly', interval: 1, ...base };
      case 'yearly': return { freq: 'yearly', interval: 1, ...base };
      case 'custom': {
        const freq = customUnit.value;
        const rule = { freq, interval: Math.max(1, parseInt(customInterval.value, 10) || 1), ...base };
        if (freq === 'weekly') rule.days = customDays.size ? [...customDays].sort() : [weekday(date)];
        return rule;
      }
      default: return null;
    }
  }

  let saving = false;
  async function save() {
    if (saving) return;
    const title = titleInput.value.trim();
    if (!title) {
      titleInput.focus();
      titleInput.classList.add('shake');
      setTimeout(() => titleInput.classList.remove('shake'), 400);
      return;
    }
    const hasDateFields = kind === 'event' || dated;
    let date = hasDateFields ? dateInput.value || null : null;
    let time = hasDateFields ? timeInput.value || null : null;
    const wantsRepeat = hasDateFields && repeatSelect.value !== 'none';
    let reminder = hasDateFields && reminderSelect.value !== '' ? Number(reminderSelect.value) : null;
    // hora, repetição ou lembrete sem dia escolhido = hoje
    if (!date && (kind === 'event' || time || wantsRepeat || reminder != null)) date = todayISO();
    if (!date) { time = null; reminder = null; }
    const recurrence = date && wantsRepeat ? readRecurrence(date) : null;
    const duration = Number(durationSelect.value) || 60;
    let addToCal = kind === 'task' && inCal && !!date;

    // Tarefa com data, mas fora do calendário: confirma antes de salvar
    if (kind === 'task' && date && !addToCal && (isNew || !original?.date)) {
      saving = true;
      const when = `${relativeLabel(date).toLowerCase()}${time ? ' às ' + time : ''}`;
      const answer = await choiceDialog({
        title: 'Adicionar ao calendário?',
        message: `Esta tarefa tem data (${when}), mas não vai aparecer no calendário.`,
        options: [
          { value: 'list', label: 'Só na lista' },
          { value: 'cal', label: 'Adicionar ao calendário', primary: true },
        ],
      });
      saving = false;
      if (!answer) return; // fechou o aviso: volta para o editor
      addToCal = answer === 'cal';
    }

    const common = { title, notes: notesInput.value.trim(), date, recurrence, reminder };
    let label;
    store.batch(isNew ? 'Item criado' : 'Item alterado', () => {
      if (kind === 'event') {
        const allDay = allDayInput.checked || !time;
        const payload = { ...common, time: allDay ? null : time, allDay, duration, color };
        if (original && sourceCol === 'events') store.update('events', id, payload);
        else {
          if (original) store.remove('tasks', id);
          store.create('events', payload);
        }
        label = isNew ? 'Evento criado' : 'Evento salvo';
      } else {
        const payload = {
          ...common, time, priority, labels, projectId: projectSelect.value && projectSelect.value !== '__new' ? projectSelect.value : null,
          subtasks: subtasks.filter((st) => st.title.trim()), block: addToCal,
          duration: addToCal ? duration : original?.duration ?? null,
          color: addToCal ? color : null,
        };
        if (original && sourceCol === 'tasks') store.update('tasks', id, payload);
        else {
          if (original) store.remove('events', id);
          store.create('tasks', newTaskFields(payload));
        }
        label = isNew ? (addToCal ? 'Tarefa criada e adicionada ao calendário' : 'Tarefa criada') : 'Tarefa salva';
      }
    });
    await s.close();
    if (isNew && defaults.__announce !== false) toast(label + (date && !addToCal && kind === 'task' ? ` · ${relativeLabel(date).toLowerCase()}` : ''));
    if (reminder != null) ensureNotificationPermission();
  }

  async function remove() {
    await s.close();
    if (sourceCol === 'events') {
      store.batch('Evento excluído', () => store.remove('events', id));
      undoToast(original.recurrence ? 'Evento (série inteira) excluído' : 'Evento excluído');
    } else {
      store.batch('Tarefa excluída', () => store.remove('tasks', id));
      undoToast('Tarefa excluída');
    }
  }

  return s;
}

/** Atalho para criar um evento a partir de um horário do calendário.
 *  Se o usuário trocar para "Tarefa", ela já vem com "Adicionar ao calendário" ligado. */
export function openNewEvent(date, time) {
  const settings = store.getSettings();
  const dur = settings.defaultEventDuration || 60;
  return openEditor({ type: 'event', defaults: { date, time, duration: dur, block: true } });
}
