// Deslizar uma linha para os lados: direita = ação principal (concluir), esquerda = excluir.

import { h, vibrate } from './dom.js';
import { icon } from './icons.js';

const THRESHOLD = 72;

/**
 * Envolve `content` numa linha deslizável.
 * opts: { right: { icon, className, onSwipe }, left: { icon, className, onSwipe } }
 */
export function swipeable(content, { right, left } = {}) {
  const bgRight = right ? h('div', { class: `swipe-bg swipe-bg-right ${right.className || ''}` }, icon(right.icon)) : null;
  const bgLeft = left ? h('div', { class: `swipe-bg swipe-bg-left ${left.className || ''}` }, icon(left.icon)) : null;
  content.classList.add('swipe-content');
  const row = h('div', { class: 'swipe' }, bgRight, bgLeft, content);

  let startX = 0, startY = 0, dx = 0, mode = null, pointerId = null, armed = false;

  content.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('input,textarea,select,.no-swipe')) return;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0;
    mode = null;
    pointerId = e.pointerId;
  });

  content.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return;
    const mx = e.clientX - startX;
    const my = e.clientY - startY;
    if (!mode) {
      if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.3) {
        mode = 'h';
        content.setPointerCapture(pointerId);
        row.classList.add('swiping');
      } else if (Math.abs(my) > 10) {
        mode = 'v';
      }
    }
    if (mode !== 'h') return;
    e.preventDefault();
    dx = mx;
    if ((dx > 0 && !right) || (dx < 0 && !left)) dx = dx / 6;
    content.style.transform = `translateX(${dx}px)`;
    row.dataset.dir = dx > 0 ? 'right' : 'left';
    const nowArmed = Math.abs(dx) > THRESHOLD;
    if (nowArmed !== armed) {
      armed = nowArmed;
      row.classList.toggle('armed', armed);
      if (armed) vibrate(8);
    }
  });

  const end = (e) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    if (mode !== 'h') return;
    row.classList.remove('swiping', 'armed');
    const action = dx > THRESHOLD ? right : dx < -THRESHOLD ? left : null;
    content.style.transition = 'transform 200ms var(--ease)';
    content.style.transform = action && action === left ? 'translateX(-110%)' : 'translateX(0)';
    setTimeout(() => {
      content.style.transition = '';
      if (!(action && action === left)) content.style.transform = '';
    }, 220);
    armed = false;
    // evita que o "click" do fim do gesto abra a tarefa
    const block = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    content.addEventListener('click', block, { capture: true, once: true });
    setTimeout(() => content.removeEventListener('click', block, { capture: true }), 50);
    if (action) setTimeout(() => action.onSwipe(), action === left ? 180 : 60);
  };
  content.addEventListener('pointerup', end);
  content.addEventListener('pointercancel', end);

  return row;
}
