// Aba Compras: várias listas, itens agrupados por corredor, total estimado.

import { h, render, vibrate } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { openSheet, openMenu, promptText, confirmDialog } from '../../ui/sheet.js';
import { toast, undoToast } from '../../ui/toast.js';
import { swipeable } from '../../ui/swipe.js';
import * as store from '../../core/store.js';
import { navigate } from '../../core/router.js';
import { formatMoney, parseNumber, formatNumber } from '../../core/util.js';
import { uid } from '../../core/util.js';
import {
  lists, ensureDefaultList, createList, renameList, deleteList, duplicateList, itemsOf, groupedItems,
  addItem, updateItem, toggleItem, deleteItem, clearBought, uncheckAll, listTotals, lineTotal, qtyLabel,
  suggestions, frequent, shareText, categoryFor, CATEGORIES,
} from './shopping-service.js';
import { parseItem, UNITS } from './parse-item.js';
import { categoryById } from './categories.js';
import { openEditor } from '../editor/editor.js';
import { openSettings } from '../settings/settings-view.js';
import { openSearch } from '../search/search.js';

export function createShoppingView() {
  let listId = null;
  let highlightId = null; // item vindo da busca, destacado por alguns instantes

  // ---------- cabeçalho ----------
  const header = h('header', { class: 'view-header' },
    h('div', { class: 'view-heading' }, h('h1', { class: 'view-title' }, 'Compras')),
    h('div', { class: 'header-actions' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Buscar', onclick: openSearch }, icon('search')),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Compartilhar lista', onclick: share }, icon('share')),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Opções da lista', onclick: listMenu }, icon('more')),
      h('button', { type: 'button', class: 'icon-btn hide-desktop', 'aria-label': 'Ajustes', onclick: openSettings }, icon('settings'))));

  const tabs = h('div', { class: 'list-tabs', role: 'tablist' });
  const content = h('div', { class: 'shop-content' });
  const body = h('div', { class: 'view-body' }, content);
  const totalBar = h('div', { class: 'shop-total' });

  // ---------- adicionar item ----------
  const suggestBox = h('div', { class: 'shop-suggest', hidden: true });
  const hint = h('div', { class: 'qa-preview' });
  const input = h('input', {
    class: 'qa-input', placeholder: 'Novo item… ex.: 2 kg arroz', enterkeyhint: 'done', autocomplete: 'off',
    'aria-label': 'Adicionar item',
    oninput: updateSuggest,
    onfocus: () => { suggestBox.hidden = false; updateSuggest(); },
    onblur: () => setTimeout(() => { if (document.activeElement !== input) suggestBox.hidden = true; }, 150),
  });
  const form = h('form', { class: 'quick-add', onsubmit: (e) => { e.preventDefault(); submitText(); } },
    suggestBox, hint,
    h('div', { class: 'qa-field' }, input, h('button', { type: 'submit', class: 'qa-submit', 'aria-label': 'Adicionar' }, icon('plus', 22))));

  const el = h('section', { class: 'view view-shopping' }, header, tabs, body, totalBar, form);

  function keepFocus(e) {
    e.preventDefault(); // não tira o foco do campo (teclado continua aberto)
  }

  function updateSuggest() {
    const text = input.value.trim();
    if (!text) {
      render(hint, );
      const names = frequent(listId);
      render(suggestBox, 
        names.length ? h('div', { class: 'suggest-label' }, 'Sugestões') : null,
        h('div', { class: 'chips scroll-x' }, names.map((n) => h('button', {
          type: 'button', class: 'chip', onpointerdown: keepFocus,
          onclick: () => quickAdd({ name: n }),
        }, '+ ' + n))));
      return;
    }
    const p = parseItem(text);
    const cat = categoryById(categoryFor(p.name));
    render(hint, 
      h('span', { class: 'qa-token' }, cat.emoji, ' ', cat.name),
      p.qty != null ? h('span', { class: 'qa-token' }, `${formatNumber(p.qty)} ${UNITS.find((u) => u.id === p.unit)?.label || ''}`) : null,
      p.price != null ? h('span', { class: 'qa-token' }, formatMoney(p.price)) : null,
      p.note ? h('span', { class: 'qa-token' }, p.note) : null);
    const list = suggestions(listId, p.name);
    render(suggestBox, ...list.map((s) => h('button', {
      type: 'button', class: 'suggest-item', onpointerdown: keepFocus,
      onclick: () => quickAdd({ ...s, qty: p.qty ?? s.qty ?? null, unit: p.qty != null ? p.unit : s.unit, price: p.price ?? s.price, note: p.note }),
    }, h('span', null, categoryById(s.category).emoji), h('span', { class: 'grow' }, s.name), s.price != null ? h('span', { class: 'muted small' }, formatMoney(s.price)) : null)));
  }

  function quickAdd(data) {
    const res = addItem(listId, data);
    input.value = '';
    updateSuggest();
    vibrate(8);
    if (res?.merged) toast(`${res.item.name}: quantidade atualizada`);
  }

  function submitText() {
    const text = input.value.trim();
    if (!text) return;
    // vários itens de uma vez, separados por vírgula ou linha: "leite, pão, 2 kg arroz"
    // (vírgula seguida de número não separa: "1,5 kg", "R$ 5,90")
    const parts = text.split(/\s*[;\n]\s*|\s*,(?!\d)\s*/).filter(Boolean);
    for (const part of parts) {
      const p = parseItem(part);
      if (p.name) addItem(listId, p);
    }
    input.value = '';
    updateSuggest();
    vibrate(8);
    if (parts.length > 1) toast(`${parts.length} itens adicionados`);
  }

  // ---------- listas ----------
  function selectList(id) {
    navigate(`compras/${id}`);
  }

  async function newList() {
    const nameInput = h('input', { class: 'input', placeholder: 'Ex.: Farmácia, Casa, Churrasco', autofocus: true, enterkeyhint: 'done' });
    const copySelect = h('select', { class: 'input' },
      h('option', { value: '' }, 'Começar vazia'),
      lists().map((l) => h('option', { value: l.id }, `Copiar itens de "${l.name}"`)));
    const s = openSheet({
      title: 'Nova lista',
      size: 'small',
      body: h('form', { class: 'stack', onsubmit: (e) => { e.preventDefault(); create(); } }, nameInput, copySelect),
      footer: [
        h('button', { type: 'button', class: 'btn', onclick: () => s.close() }, 'Cancelar'),
        h('button', { type: 'button', class: 'btn btn-primary', onclick: create }, 'Criar'),
      ],
    });
    async function create() {
      const name = nameInput.value.trim();
      if (!name) return nameInput.focus();
      const list = createList(name, copySelect.value || null);
      await s.close();
      selectList(list.id);
    }
  }

  function listMenu() {
    const list = store.get('lists', listId);
    if (!list) return;
    const t = listTotals(listId);
    openMenu({
      title: list.name,
      items: [
        { label: 'Renomear lista', icon: 'edit', onClick: async () => {
          const name = await promptText({ title: 'Renomear lista', value: list.name });
          if (name) renameList(listId, name);
        } },
        { label: 'Duplicar lista', icon: 'copy', onClick: () => {
          const copy = duplicateList(listId);
          selectList(copy.id);
          toast('Lista duplicada');
        } },
        { label: 'Nova lista', icon: 'plus', onClick: newList },
        { separator: true },
        t.count - t.pending > 0 ? { label: 'Desmarcar todos (reaproveitar lista)', icon: 'undo', onClick: () => {
          const n = uncheckAll(listId);
          undoToast(`${n} ite${n === 1 ? 'm voltou' : 'ns voltaram'} para a lista`);
        } } : null,
        t.count - t.pending > 0 ? { label: 'Limpar comprados', icon: 'checkCheck', onClick: () => {
          const n = clearBought(listId);
          undoToast(`${n} ite${n === 1 ? 'm removido' : 'ns removidos'}`);
        } } : null,
        { label: 'Criar tarefa / lembrete de compras', icon: 'bell', onClick: listToTask },
        { label: 'Compartilhar como texto', icon: 'share', onClick: share },
        { separator: true },
        { label: 'Excluir lista', icon: 'trash', danger: true, onClick: async () => {
          const ok = await confirmDialog({ title: 'Excluir lista?', message: `"${list.name}" e seus ${t.count} itens serão excluídos.`, okLabel: 'Excluir', danger: true });
          if (!ok) return;
          deleteList(listId);
          undoToast('Lista excluída');
          const next = lists()[0] || ensureDefaultList();
          if (next) selectList(next.id);
        } },
      ],
    });
  }

  function listToTask() {
    const list = store.get('lists', listId);
    const pending = itemsOf(listId).filter((i) => !i.bought);
    openEditor({
      type: 'task',
      defaults: {
        title: `Compras: ${list.name}`,
        subtasks: pending.map((i) => ({ id: uid(), title: `${i.name}${qtyLabel(i) ? ' — ' + qtyLabel(i) : ''}`, done: false })),
        labels: ['compras'],
      },
    });
  }

  async function share() {
    const text = shareText(listId);
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    const s = openSheet({
      title: 'Compartilhar lista',
      size: 'small',
      body: h('div', { class: 'stack' },
        h('pre', { class: 'share-preview' }, text),
        h('div', { class: 'row' },
          h('a', { class: 'btn btn-primary grow', href: `https://wa.me/?text=${encodeURIComponent(text)}`, target: '_blank', rel: 'noopener' }, icon('share', 18), 'WhatsApp'),
          h('button', { type: 'button', class: 'btn grow', onclick: async () => {
            try {
              await navigator.clipboard.writeText(text);
              toast('Texto copiado');
              s.close();
            } catch {
              toast('Não foi possível copiar');
            }
          } }, icon('copy', 18), 'Copiar'))),
    });
  }

  // ---------- item ----------
  function openItem(item) {
    const name = h('input', { class: 'input', value: item.name });
    const qty = h('input', { class: 'input num', inputmode: 'decimal', value: item.qty != null ? formatNumber(item.qty) : '', placeholder: 'Qtd.' });
    const unit = h('select', { class: 'input' }, h('option', { value: '' }, '—'), UNITS.map((u) => h('option', { value: u.id, selected: u.id === item.unit }, u.label)));
    const cat = h('select', { class: 'input' }, CATEGORIES.map((c) => h('option', { value: c.id, selected: c.id === item.category }, `${c.emoji} ${c.name}`)));
    const price = h('input', { class: 'input', inputmode: 'decimal', value: item.price != null ? String(item.price).replace('.', ',') : '', placeholder: 'R$ por unidade' });
    const note = h('input', { class: 'input', value: item.note || '', placeholder: 'Ex.: sem lactose, marca X' });
    const step = (d) => {
      const n = (parseNumber(qty.value) || 0) + d;
      qty.value = n > 0 ? formatNumber(n) : '';
      if (!unit.value && n > 0) unit.value = 'un';
    };
    const s = openSheet({
      title: 'Item',
      size: 'small',
      body: h('div', { class: 'stack' },
        h('label', { class: 'field-v' }, h('span', null, 'Nome'), name),
        h('div', { class: 'row' },
          h('label', { class: 'field-v grow' }, h('span', null, 'Quantidade'),
            h('div', { class: 'stepper' },
              h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Menos', onclick: () => step(-1) }, '−'),
              qty,
              h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Mais', onclick: () => step(1) }, '+'))),
          h('label', { class: 'field-v' }, h('span', null, 'Unidade'), unit)),
        h('label', { class: 'field-v' }, h('span', null, 'Categoria'), cat),
        h('label', { class: 'field-v' }, h('span', null, 'Preço (opcional)'), price),
        h('label', { class: 'field-v' }, h('span', null, 'Observação'), note),
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: async () => {
          await s.close();
          openEditor({ type: 'task', defaults: { title: `Comprar ${item.name}`, labels: ['compras'] } });
        } }, icon('tasks', 18), 'Transformar em tarefa')),
      footer: [
        h('button', { type: 'button', class: 'btn btn-ghost danger', onclick: async () => {
          await s.close();
          deleteItem(item.id);
          undoToast('Item excluído');
        } }, icon('trash', 18), 'Excluir'),
        h('span', { class: 'spacer' }),
        h('button', { type: 'button', class: 'btn btn-primary', onclick: async () => {
          const n = name.value.trim();
          if (!n) return name.focus();
          store.batch('Item alterado', () => updateItem(item.id, {
            name: n, qty: parseNumber(qty.value), unit: unit.value || (parseNumber(qty.value) != null ? 'un' : null),
            category: cat.value, price: parseNumber(price.value), note: note.value.trim(),
          }));
          await s.close();
        } }, 'Salvar'),
      ],
    });
  }

  function itemRow(it) {
    const total = lineTotal(it);
    const content = h('div', { class: `shop-row ${it.bought ? 'bought' : ''}`, dataset: { id: it.id }, onclick: () => openItem(it) },
      h('button', {
        type: 'button', class: `box ${it.bought ? 'is-done' : ''}`, 'aria-label': it.bought ? 'Desmarcar' : 'Marcar como comprado',
        onclick: (e) => { e.stopPropagation(); vibrate(8); e.currentTarget.classList.add('pop'); setTimeout(() => toggleItem(it.id), 160); },
      }, icon('check', 14)),
      h('div', { class: 'shop-main' },
        h('div', { class: 'shop-name' }, it.name, qtyLabel(it) ? h('span', { class: 'qty' }, qtyLabel(it)) : null),
        it.note ? h('div', { class: 'shop-note' }, it.note) : null),
      total != null ? h('span', { class: 'shop-price' }, formatMoney(total)) : null);
    return swipeable(content, {
      right: { icon: it.bought ? 'undo' : 'check', className: 'bg-success', onSwipe: () => toggleItem(it.id) },
      left: { icon: 'trash', className: 'bg-danger', onSwipe: () => { deleteItem(it.id); undoToast('Item excluído'); } },
    });
  }

  // ---------- render ----------
  function renderTabs() {
    render(tabs,
      lists().map((l) => {
        const pending = itemsOf(l.id).filter((i) => !i.bought).length;
        return h('button', {
          type: 'button', role: 'tab', class: `list-tab ${l.id === listId ? 'active' : ''}`, 'aria-selected': String(l.id === listId),
          onclick: () => (l.id === listId ? listMenu() : selectList(l.id)),
        }, l.name, pending ? h('span', { class: 'tab-count' }, String(pending)) : null);
      }),
      h('button', { type: 'button', class: 'list-tab add', 'aria-label': 'Nova lista', onclick: newList }, icon('plus', 16)));
    tabs.querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function renderContent() {
    const { groups, bought, total } = groupedItems(listId);
    const out = [];
    for (const g of groups) {
      out.push(h('section', { class: 'shop-group' },
        h('div', { class: 'group-head' }, h('span', { class: 'group-title' }, `${g.category.emoji}  ${g.category.name}`), h('span', { class: 'group-count' }, String(g.items.length))),
        h('div', { class: 'shop-list' }, g.items.map(itemRow))));
    }
    if (bought.length) {
      out.push(h('section', { class: 'shop-group bought-group' },
        h('div', { class: 'group-head' },
          h('span', { class: 'group-title' }, `No carrinho`), h('span', { class: 'group-count' }, String(bought.length)),
          h('button', { type: 'button', class: 'link-btn', onclick: () => {
            const n = clearBought(listId);
            undoToast(`${n} ite${n === 1 ? 'm removido' : 'ns removidos'}`);
          } }, 'Limpar')),
        h('div', { class: 'shop-list' }, bought.map(itemRow))));
    }
    if (!total) {
      out.push(h('div', { class: 'empty' },
        h('div', { class: 'empty-icon' }, icon('cart', 28)),
        h('h3', null, 'Lista vazia'),
        h('p', null, 'Digite abaixo ou toque nas sugestões. Dica: "2 kg arroz, leite, pão".'),
        h('div', { class: 'chips center' }, frequent(listId, 8).map((n) => h('button', { type: 'button', class: 'chip', onclick: () => quickAdd({ name: n }) }, '+ ' + n)))));
    } else if (!groups.length) {
      out.unshift(h('div', { class: 'all-done' }, icon('checkCircle', 18), 'Tudo no carrinho!'));
    }
    render(content, out);
    if (highlightId) {
      const row = content.querySelector(`.shop-row[data-id="${CSS.escape(highlightId)}"]`);
      if (row) {
        row.scrollIntoView({ block: 'center' });
        row.classList.add('flash');
      }
    }

    const t = listTotals(listId);
    totalBar.hidden = !t.priced;
    render(totalBar,
      h('span', null, 'Total estimado ', h('strong', null, formatMoney(t.total))),
      t.cart ? h('span', { class: 'muted' }, `No carrinho: ${formatMoney(t.cart)}`) : null);
  }

  function refresh() {
    if (!store.get('lists', listId)) {
      const first = lists()[0] || ensureDefaultList();
      listId = first?.id || null;
    }
    renderTabs();
    renderContent();
    if (!suggestBox.hidden) updateSuggest();
  }

  function activate(parts = []) {
    const wanted = parts[0];
    ensureDefaultList();
    const settings = store.getSettings();
    listId = (wanted && store.get('lists', wanted) ? wanted : null) || (store.get('lists', settings.lastListId) ? settings.lastListId : lists()[0]?.id);
    if (settings.lastListId !== listId) store.setSettings({ lastListId: listId });
    // veio da busca (#/compras/<lista>/<item>): rola até o item e destaca (aplicado em renderContent)
    if (parts[1]) {
      highlightId = parts[1];
      setTimeout(() => { highlightId = null; }, 1600);
    }
    refresh();
  }

  return { el, activate, refresh };
}
