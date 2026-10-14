// Lista de visões (Entrada, Hoje, Próximos, Concluídas, projetos, etiquetas).
// No PC aparece como barra lateral; no celular, num painel ao tocar no título.

import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { openMenu, promptText, confirmDialog } from '../../ui/sheet.js';
import { undoToast } from '../../ui/toast.js';
import * as store from '../../core/store.js';
import { VIEWS, counts, projects, labelsInUse, createProject, deleteProject } from './task-service.js';
import { statsCard, openStats } from './stats.js';
import { PROJECT_COLORS } from '../settings/palettes.js';

export function viewKey(view) {
  return view.id ? `${view.key}/${view.id}` : view.key;
}

function projectMenu(p) {
  openMenu({
    title: p.name,
    items: [
      { label: 'Renomear', icon: 'edit', onClick: async () => {
        const name = await promptText({ title: 'Renomear projeto', value: p.name });
        if (name) store.update('projects', p.id, { name });
      } },
      { label: 'Trocar cor', icon: 'palette', onClick: () => {
        const i = PROJECT_COLORS.indexOf(p.color);
        store.update('projects', p.id, { color: PROJECT_COLORS[(i + 1) % PROJECT_COLORS.length] });
      } },
      { separator: true },
      { label: 'Excluir projeto', icon: 'trash', danger: true, onClick: async () => {
        const ok = await confirmDialog({ title: 'Excluir projeto?', message: `As tarefas de "${p.name}" ficam sem projeto (continuam na Entrada).`, okLabel: 'Excluir', danger: true });
        if (ok) {
          deleteProject(p.id);
          undoToast('Projeto excluído');
        }
      } },
    ],
  });
}

/**
 * @param {{ current: object, onSelect: (view) => void }} opts
 */
export function taskNav({ current, onSelect }) {
  const c = counts();
  const cur = viewKey(current);
  const item = (view, iconEl, label, count, extra) =>
    h('div', { class: `nav-item ${viewKey(view) === cur ? 'active' : ''}` },
      h('button', { type: 'button', class: 'nav-link', onclick: () => onSelect(view) },
        iconEl, h('span', { class: 'nav-label' }, label), count ? h('span', { class: 'nav-count' }, String(count)) : null),
      extra || null);

  const projectsList = projects().map((p) =>
    item({ key: 'projeto', id: p.id }, h('i', { class: 'dot lg', style: { background: p.color } }), p.name, c.byProject[p.id],
      h('button', { type: 'button', class: 'icon-btn sm nav-more', 'aria-label': `Opções de ${p.name}`, onclick: () => projectMenu(p) }, icon('more', 16))));

  const labels = labelsInUse();

  return h('nav', { class: 'task-nav' },
    item({ key: 'entrada' }, icon(VIEWS.entrada.icon), 'Entrada', c.entrada),
    item({ key: 'hoje' }, icon(VIEWS.hoje.icon), 'Hoje', c.hoje),
    item({ key: 'proximos' }, icon(VIEWS.proximos.icon), 'Próximos', null),
    item({ key: 'concluidas' }, icon(VIEWS.concluidas.icon), 'Concluídas', null),
    h('div', { class: 'nav-section' },
      h('span', null, 'Projetos'),
      h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Novo projeto', onclick: async () => {
        const name = await promptText({ title: 'Novo projeto', placeholder: 'Ex.: Casa, Trabalho, Faculdade', okLabel: 'Criar' });
        if (name) {
          const p = createProject(name);
          onSelect({ key: 'projeto', id: p.id });
        }
      } }, icon('plus', 16))),
    projectsList.length ? projectsList : h('p', { class: 'nav-empty' }, 'Crie projetos para separar áreas da vida. Dica: digite #nome ao adicionar uma tarefa.'),
    labels.length ? h('div', { class: 'nav-section' }, h('span', null, 'Etiquetas')) : null,
    labels.map((l) => item({ key: 'etiqueta', id: l.name }, icon('tag'), l.name, l.count)),
    h('button', { type: 'button', class: 'nav-stats', onclick: openStats }, statsCard({ compact: true })));
}
