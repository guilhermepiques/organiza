// Utilitários gerais, sem dependência de DOM.

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/** Minúsculas e sem acentos. Ex.: "Feijão" -> "feijao". */
export function normalize(s = '') {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Normaliza mantendo o mesmo comprimento do texto original (1 caractere -> 1 caractere),
 * para que índices de regex no texto normalizado sirvam para recortar o original.
 */
export function normalizeAligned(s = '') {
  return s.split('').map((c) => (c.normalize('NFD')[0] || c).toLowerCase()).join('');
}

export function capitalize(s = '') {
  return s ? s[0].toLocaleUpperCase('pt-BR') + s.slice(1) : s;
}

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatMoney = (n) => money.format(n || 0);

const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
export const formatNumber = (n) => num.format(n);

/** Aceita "5,90", "5.90", "R$ 5,90". Retorna número ou null. */
export function parseNumber(s) {
  if (s == null || s === '') return null;
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  const clean = String(s).replace(/[^\d,.-]/g, '');
  if (!clean) return null;
  // "1.234,56" -> 1234.56 ; "5,9" -> 5.9 ; "5.9" -> 5.9
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

export function downloadFile(filename, content, type = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function byOrder(a, b) {
  return (a.order ?? 0) - (b.order ?? 0);
}
