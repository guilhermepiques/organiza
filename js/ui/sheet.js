// Painéis (bottom sheet no celular, janela central no PC) e diálogos simples.
// O botão "voltar" do Android fecha o painel aberto em vez de sair do app.

import { h } from './dom.js';
import { icon } from './icons.js';

const stack = [];
let ignorePops = 0;
const popWaiters = [];

addEventListener('popstate', () => {
  if (ignorePops > 0) {
    ignorePops--;
    popWaiters.shift()?.();
    return;
  }
  stack[stack.length - 1]?.close(true);
});

addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) {
    e.preventDefault();
    stack[stack.length - 1].close();
  }
});

/**
 * Abre um painel.
 * @returns {{ close: () => Promise<void>, el: HTMLElement }}
 */
export function openSheet({ title, body, footer, headerActions, className = '', size = 'auto', onClose } = {}) {
  const backdrop = h('div', { class: 'sheet-backdrop' });
  const sheet = h(
    'div',
    { class: `sheet sheet-${size} ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': typeof title === 'string' ? title : null },
    h('div', { class: 'sheet-handle', 'aria-hidden': 'true' }),
    title != null
      ? h('div', { class: 'sheet-header' },
          h('h2', { class: 'sheet-title' }, title),
          headerActions || null,
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Fechar', onclick: () => entry.close() }, icon('x')))
      : null,
    h('div', { class: 'sheet-body' }, body),
    footer ? h('div', { class: 'sheet-footer' }, footer) : null
  );

  let closed = false;
  const entry = {
    el: sheet,
    close(fromPop = false) {
      if (closed) return Promise.resolve();
      closed = true;
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      sheet.classList.remove('open');
      backdrop.classList.remove('open');
      setTimeout(() => {
        sheet.remove();
        backdrop.remove();
      }, 280);
      const done = fromPop
        ? Promise.resolve()
        : new Promise((resolve) => {
            ignorePops++;
            popWaiters.push(resolve);
            history.back();
            setTimeout(resolve, 1500); // só segurança caso o popstate não venha (curto demais atrapalha a navegação em celular lento)
          });
      // onClose só roda depois que o histórico assentou, para que o próximo painel/navegação não se atrapalhe
      return done.then(() => onClose?.());
    },
  };

  backdrop.addEventListener('click', () => entry.close());
  document.body.append(backdrop, sheet);
  stack.push(entry);
  history.pushState({ sheet: stack.length }, '');
  requestAnimationFrame(() => {
    backdrop.classList.add('open');
    sheet.classList.add('open');
    const auto = sheet.querySelector('[autofocus]');
    if (auto) setTimeout(() => auto.focus({ preventScroll: true }), 60);
  });
  return entry;
}

/** Menu de ações: [{ label, icon, onClick, danger, hint }] */
export function openMenu({ title, items }) {
  const list = h('div', { class: 'menu-list' });
  const s = openSheet({ title, body: list, size: 'small' });
  for (const it of items) {
    if (!it) continue;
    if (it.separator) {
      list.append(h('div', { class: 'menu-sep' }));
      continue;
    }
    list.append(
      h('button', {
        type: 'button',
        class: `menu-item ${it.danger ? 'danger' : ''} ${it.active ? 'active' : ''}`,
        onclick: async () => {
          await s.close();
          it.onClick?.();
        },
      },
      it.icon ? icon(it.icon) : null,
      h('span', { class: 'menu-label' }, it.label),
      it.hint ? h('span', { class: 'menu-hint' }, it.hint) : null,
      it.active ? icon('check', 18) : null)
    );
  }
  return s;
}

/** Pede um texto. Resolve com o texto ou null se cancelado. */
export function promptText({ title, value = '', placeholder = '', okLabel = 'Salvar' }) {
  return new Promise((resolve) => {
    let result = null;
    const input = h('input', { class: 'input', value, placeholder, autofocus: true, enterkeyhint: 'done' });
    const form = h('form', {
      class: 'stack',
      onsubmit: (e) => {
        e.preventDefault();
        const v = input.value.trim();
        if (!v) return input.focus();
        result = v;
        s.close();
      },
    }, input);
    const s = openSheet({
      title,
      body: form,
      size: 'small',
      footer: [
        h('button', { class: 'btn', type: 'button', onclick: () => s.close() }, 'Cancelar'),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => form.requestSubmit() }, okLabel),
      ],
      onClose: () => resolve(result),
    });
  });
}

/**
 * Pergunta com várias respostas: options = [{ value, label, primary }].
 * Resolve com o value escolhido, ou null se o painel foi fechado sem escolher.
 */
export function choiceDialog({ title, message, options }) {
  return new Promise((resolve) => {
    let result = null;
    const s = openSheet({
      title,
      body: h('p', { class: 'muted' }, message),
      size: 'small',
      footer: options.map((o) => h('button', {
        type: 'button',
        class: `btn grow ${o.primary ? 'btn-primary' : ''}`,
        onclick: () => {
          result = o.value;
          s.close();
        },
      }, o.label)),
      onClose: () => resolve(result),
    });
  });
}

/** Confirmação. Resolve true/false. */
export function confirmDialog({ title, message, okLabel = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    let ok = false;
    const s = openSheet({
      title,
      body: h('p', { class: 'muted' }, message),
      size: 'small',
      footer: [
        h('button', { class: 'btn', type: 'button', onclick: () => s.close() }, 'Cancelar'),
        h('button', {
          class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
          type: 'button',
          onclick: () => {
            ok = true;
            s.close();
          },
        }, okLabel),
      ],
      onClose: () => resolve(ok),
    });
  });
}
