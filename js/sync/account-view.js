// Seção "Conta e sincronização" em Ajustes.

import { h, render } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { confirmDialog } from '../ui/sheet.js';
import {
  getSyncState, onSyncState, signIn, signUp, resetPassword, signOutUser, syncNow, authErrorMessage,
} from './sync.js';

const STATUS = {
  connecting: ['Conectando…', 'busy'],
  syncing: ['Sincronizando…', 'busy'],
  synced: ['Sincronizado', 'ok'],
  offline: ['Sem internet: sincroniza quando a conexão voltar', 'warn'],
  error: ['Erro ao sincronizar', 'error'],
  off: ['', ''],
};

export function accountSection() {
  const box = h('div', { class: 'account' });
  let busy = false;

  function loginForm() {
    const email = h('input', { class: 'input', type: 'email', placeholder: 'seu@email.com', autocomplete: 'username', inputmode: 'email' });
    const pass = h('input', { class: 'input', type: 'password', placeholder: 'Senha (mín. 6 caracteres)', autocomplete: 'current-password' });
    const msg = h('p', { class: 'account-msg', hidden: true });
    const show = (text, ok = false) => {
      msg.textContent = text;
      msg.hidden = !text;
      msg.classList.toggle('ok', ok);
    };
    async function run(fn, okText) {
      if (busy) return;
      if (!email.value.trim()) return show('Digite seu e-mail.');
      busy = true;
      show('');
      try {
        await fn();
        if (okText) show(okText, true);
      } catch (e) {
        show(authErrorMessage(e));
      } finally {
        busy = false;
      }
    }
    return h('form', { class: 'stack-sm', onsubmit: (e) => { e.preventDefault(); run(() => signIn(email.value.trim(), pass.value)); } },
      h('p', { class: 'muted small' }, 'Entre para ver as mesmas tarefas, calendário e listas no celular, tablet e PC.'),
      email, pass, msg,
      h('div', { class: 'row' },
        h('button', { type: 'submit', class: 'btn btn-primary grow' }, 'Entrar'),
        h('button', { type: 'button', class: 'btn grow', onclick: () => run(() => signUp(email.value.trim(), pass.value)) }, 'Criar conta')),
      h('button', {
        type: 'button', class: 'link-btn',
        onclick: () => run(() => resetPassword(email.value.trim()), 'Enviamos um e-mail para você criar uma nova senha.'),
      }, 'Esqueci minha senha'));
  }

  function loggedIn(s) {
    const [label, tone] = STATUS[s.status] || STATUS.off;
    return h('div', { class: 'stack-sm' },
      h('div', { class: 'account-user' }, icon('checkCircle', 18), h('span', null, 'Conectado como ', h('strong', null, s.user.email))),
      label ? h('p', { class: `sync-status ${tone}` }, h('i', { class: 'dot' }), label, s.status === 'error' && s.error ? h('small', null, ` (${s.error})`) : null) : null,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn grow', onclick: async () => { await syncNow(); toast('Sincronização concluída'); } }, icon('repeat', 18), 'Sincronizar agora'),
        h('button', { type: 'button', class: 'btn btn-ghost danger', onclick: async () => {
          const ok = await confirmDialog({
            title: 'Sair da conta?',
            message: 'Os dados continuam neste aparelho, mas param de sincronizar até você entrar de novo.',
            okLabel: 'Sair',
          });
          if (ok) await signOutUser();
        } }, 'Sair')));
  }

  function draw(s = getSyncState()) {
    if (!box.isConnected && box.dataset.drawn) return unsubscribe(); // painel fechado
    box.dataset.drawn = '1';
    if (!s.configured) {
      render(box, h('p', { class: 'muted small' }, 'Login ainda não ativado neste app. Por enquanto os dados ficam só neste aparelho.'));
    } else if (!s.ready) {
      render(box, h('p', { class: 'muted small' }, s.status === 'offline' ? 'Sem internet. O login fica disponível quando a conexão voltar.' : 'Conectando…'));
    } else if (!s.user) {
      if (!box.querySelector('form')) render(box, loginForm()); // não apaga o que está sendo digitado
    } else {
      render(box, loggedIn(s));
    }
  }

  const unsubscribe = onSyncState(draw);
  draw();
  return box;
}
