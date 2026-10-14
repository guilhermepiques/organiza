// Regras das listas de compras (sem DOM).

import * as store from '../../core/store.js';
import { normalize, byOrder, formatMoney, formatNumber, capitalize } from '../../core/util.js';
import { guessCategory, categoryById, categoryOrder, CATEGORIES, STARTER_ITEMS } from './categories.js';
import { unitLabel } from './parse-item.js';

export function lists() {
  return store.all('lists').sort(byOrder);
}

export function ensureDefaultList() {
  if (!lists().length) return store.create('lists', { name: 'Mercado', order: 1 });
  return null;
}

export function createList(name, copyFrom = null) {
  return store.batch('Lista criada', () => {
    const list = store.create('lists', { name, order: Date.now() });
    if (copyFrom) {
      for (const it of itemsOf(copyFrom)) {
        const { id, createdAt, updatedAt, ...rest } = it;
        store.create('items', { ...rest, listId: list.id, bought: false, boughtAt: null });
      }
    }
    return list;
  });
}

export function renameList(id, name) {
  store.update('lists', id, { name });
}

export function deleteList(id) {
  store.batch('Lista excluída', () => {
    for (const it of itemsOf(id)) store.remove('items', it.id);
    store.remove('lists', id);
  });
}

export function duplicateList(id) {
  const src = store.get('lists', id);
  return createList(`${src?.name || 'Lista'} (cópia)`, id);
}

export function itemsOf(listId) {
  return store.all('items').filter((i) => i.listId === listId);
}

/**
 * Itens pendentes: primeiro os marcados como prioridade ("acabou em casa"), depois agrupados
 * por categoria (na ordem do mercado); comprados no fim.
 */
export function groupedItems(listId) {
  const items = itemsOf(listId);
  const byAisle = (a, b) => categoryOrder(a.category) - categoryOrder(b.category) || byOrder(a, b);
  const pending = items.filter((i) => !i.bought).sort(byAisle);
  const urgent = pending.filter((i) => i.urgent);
  const bought = items.filter((i) => i.bought).sort((a, b) => (b.boughtAt || 0) - (a.boughtAt || 0));
  const groups = new Map();
  for (const it of pending) {
    if (it.urgent) continue;
    if (!groups.has(it.category)) groups.set(it.category, []);
    groups.get(it.category).push(it);
  }
  return { urgent, groups: [...groups.entries()].map(([id, list]) => ({ category: categoryById(id), items: list })), bought, total: items.length };
}

function learn(item) {
  const key = normalize(item.name);
  if (!key) return;
  const cur = store.get('catalog', key);
  const patch = {
    name: item.name, category: item.category, unit: item.unit || cur?.unit || 'un',
    lastQty: item.qty ?? cur?.lastQty ?? null, lastPrice: item.price ?? cur?.lastPrice ?? null, lastAt: Date.now(),
  };
  if (cur) store.update('catalog', key, { ...patch, count: (cur.count || 0) + 1 });
  else store.create('catalog', { id: key, ...patch, count: 1 });
}

export function categoryFor(name) {
  return store.get('catalog', normalize(name))?.category || guessCategory(name);
}

export function addItem(listId, { name, qty = null, unit = null, price = null, note = '', category = null, urgent = false }) {
  name = capitalize(String(name).trim());
  const existing = itemsOf(listId).find((i) => !i.bought && normalize(i.name) === normalize(name));
  return store.batch('Item adicionado', () => {
    if (existing) {
      // já está na lista: soma a quantidade em vez de duplicar
      const sameUnit = !unit || !existing.unit || unit === existing.unit;
      const nextQty = qty != null && existing.qty != null && sameUnit ? existing.qty + qty : qty ?? existing.qty;
      const item = store.update('items', existing.id, {
        qty: nextQty, unit: unit || existing.unit, price: price ?? existing.price, note: note || existing.note,
        urgent: urgent || !!existing.urgent,
      });
      return { item, merged: true };
    }
    const cat = store.get('catalog', normalize(name));
    const item = store.create('items', {
      listId, name, qty, unit: unit || (qty != null ? 'un' : null), note,
      price: price ?? cat?.lastPrice ?? null,
      category: category || categoryFor(name),
      urgent: !!urgent,
      bought: false, boughtAt: null, order: Date.now(),
    });
    learn(item);
    return { item, merged: false };
  });
}

export function updateItem(id, patch) {
  const item = store.update('items', id, patch);
  if (item && ('category' in patch || 'unit' in patch || 'price' in patch)) {
    const key = normalize(item.name);
    if (store.get('catalog', key)) store.update('catalog', key, { category: item.category, unit: item.unit || 'un', lastPrice: item.price ?? null });
    else learn(item);
  }
  return item;
}

export function toggleItem(id) {
  const it = store.get('items', id);
  if (!it) return;
  // ao comprar, a prioridade sai (o item não está mais faltando); Desfazer devolve
  store.batch(it.bought ? 'Item desmarcado' : 'Item comprado', () =>
    store.update('items', id, it.bought ? { bought: false, boughtAt: null } : { bought: true, boughtAt: Date.now(), urgent: false }));
}

export function deleteItem(id) {
  store.batch('Item excluído', () => store.remove('items', id));
}

export function clearBought(listId) {
  const bought = itemsOf(listId).filter((i) => i.bought);
  store.batch('Comprados removidos', () => bought.forEach((i) => store.remove('items', i.id)));
  return bought.length;
}

export function uncheckAll(listId) {
  const bought = itemsOf(listId).filter((i) => i.bought);
  store.batch('Lista reiniciada', () => bought.forEach((i) => store.update('items', i.id, { bought: false, boughtAt: null })));
  return bought.length;
}

export function lineTotal(it) {
  if (it.price == null) return null;
  const q = it.qty ?? 1;
  // preço é por unidade; para gramas/ml considera o preço como total da linha
  return ['g', 'ml'].includes(it.unit) ? it.price : it.price * q;
}

export function listTotals(listId) {
  const items = itemsOf(listId);
  let total = 0, priced = 0, cart = 0;
  for (const it of items) {
    const t = lineTotal(it);
    if (t == null) continue;
    total += t;
    priced++;
    if (it.bought) cart += t;
  }
  return { total, priced, cart, count: items.length, pending: items.filter((i) => !i.bought).length };
}

export function qtyLabel(it) {
  if (it.qty == null) return '';
  return `${formatNumber(it.qty)} ${unitLabel(it.unit || 'un')}`;
}

/** Autocompletar: itens do histórico que combinam com o texto digitado. */
export function suggestions(listId, query, limit = 6) {
  const q = normalize(query);
  if (!q) return [];
  const inList = new Set(itemsOf(listId).filter((i) => !i.bought).map((i) => normalize(i.name)));
  const fromCatalog = store.all('catalog')
    .filter((c) => !inList.has(c.id) && c.id.includes(q))
    .sort((a, b) => (b.id.startsWith(q) - a.id.startsWith(q)) || (b.count || 0) - (a.count || 0))
    .slice(0, limit);
  return fromCatalog.map((c) => ({ name: c.name, category: c.category, unit: c.unit, price: c.lastPrice, qty: c.lastQty }));
}

/** Itens frequentes que ainda não estão na lista. */
export function frequent(listId, limit = 12) {
  const inList = new Set(itemsOf(listId).filter((i) => !i.bought).map((i) => normalize(i.name)));
  const cat = store.all('catalog').filter((c) => !inList.has(c.id)).sort((a, b) => (b.count || 0) - (a.count || 0) || (b.lastAt || 0) - (a.lastAt || 0));
  const names = cat.slice(0, limit).map((c) => c.name);
  if (names.length < 6) {
    for (const s of STARTER_ITEMS) {
      if (names.length >= limit) break;
      if (!inList.has(normalize(s)) && !names.some((n) => normalize(n) === normalize(s))) names.push(s);
    }
  }
  return names;
}

export function shareText(listId) {
  const list = store.get('lists', listId);
  const { urgent, groups } = groupedItems(listId);
  const lines = [`🛒 *${list?.name || 'Lista de compras'}*`, ''];
  if (urgent.length) {
    lines.push('❗ *Prioridade (acabou em casa)*');
    for (const it of urgent) {
      const q = qtyLabel(it);
      lines.push(`• ${it.name}${q ? ' — ' + q : ''}${it.note ? ` (${it.note})` : ''}`);
    }
    lines.push('');
  }
  for (const g of groups) {
    lines.push(`${g.category.emoji} *${g.category.name}*`);
    for (const it of g.items) {
      const q = qtyLabel(it);
      lines.push(`• ${it.name}${q ? ' — ' + q : ''}${it.note ? ` (${it.note})` : ''}`);
    }
    lines.push('');
  }
  const { total, priced } = listTotals(listId);
  if (priced) lines.push(`Total estimado: ${formatMoney(total)}`);
  return lines.join('\n').trim();
}

export { CATEGORIES };
