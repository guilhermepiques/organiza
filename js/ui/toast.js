// Aviso rápido no rodapé, com ação opcional (ex.: "Desfazer").

import { h } from './dom.js';
import * as store from '../core/store.js';

let current = null;

export function toast(message, { actionLabel, onAction, duration = 4500 } = {}) {
  current?.dismiss();
  const el = h('div', { class: 'toast', role: 'status' },
    h('span', { class: 'toast-msg' }, message),
    actionLabel
      ? h('button', {
          class: 'toast-action',
          type: 'button',
          onclick: () => {
            dismiss();
            onAction?.();
          },
        }, actionLabel)
      : null);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const timer = setTimeout(dismiss, duration);
  function dismiss() {
    clearTimeout(timer);
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
    if (current?.el === el) current = null;
  }
  current = { el, dismiss };
  return current;
}

/** Toast com botão "Desfazer" ligado ao histórico do store. */
export function undoToast(message) {
  return toast(message, {
    actionLabel: 'Desfazer',
    onAction: () => {
      const label = store.undo();
      if (label) toast('Ação desfeita');
    },
  });
}
