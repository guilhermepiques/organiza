// Entende "2 kg arroz", "arroz 2kg", "leite x3", "pão 6 un", "café R$ 18,90", "iogurte (sem lactose)".

import { normalizeAligned, parseNumber, capitalize } from '../../core/util.js';

export const UNITS = [
  { id: 'un', label: 'un' },
  { id: 'kg', label: 'kg' },
  { id: 'g', label: 'g' },
  { id: 'L', label: 'L' },
  { id: 'ml', label: 'ml' },
  { id: 'pct', label: 'pacote' },
  { id: 'cx', label: 'caixa' },
  { id: 'dz', label: 'dúzia' },
  { id: 'lata', label: 'lata' },
  { id: 'gf', label: 'garrafa' },
  { id: 'bdj', label: 'bandeja' },
  { id: 'mc', label: 'maço' },
];

const UNIT_WORDS = [
  ['kg', /^(kg|kgs|quilos?|kilos?)$/],
  ['g', /^(g|gr|gramas?)$/],
  ['L', /^(l|lt|lts|litros?)$/],
  ['ml', /^(ml)$/],
  ['un', /^(un|und|unid|unidades?|x)$/],
  ['pct', /^(pct|pcts|pacotes?)$/],
  ['cx', /^(cx|caixas?)$/],
  ['dz', /^(dz|duzias?)$/],
  ['lata', /^(latas?)$/],
  ['gf', /^(gf|garrafas?)$/],
  ['bdj', /^(bdj|bandejas?)$/],
  ['mc', /^(maco|macos)$/],
];
const UNIT_ALT = 'kg|kgs|quilos?|kilos?|g|gr|gramas?|l|lt|lts|litros?|ml|un|und|unid|unidades?|pct|pcts|pacotes?|cx|caixas?|dz|duzias?|latas?|gf|garrafas?|bdj|bandejas?|maco|macos';

export const unitLabel = (id) => UNITS.find((u) => u.id === id)?.label || id;

function unitFrom(word) {
  if (!word) return null;
  const w = word.toLowerCase();
  return UNIT_WORDS.find(([, re]) => re.test(w))?.[0] || null;
}

export function parseItem(text) {
  let raw = text.trim();
  let price = null;
  let note = '';

  // preço: "R$ 5,90" ou "$5.90"
  raw = raw.replace(/\s*(?:r\$|\$)\s*(\d+(?:[.,]\d{1,2})?)\s*/i, (_, p) => {
    price = parseNumber(p);
    return ' ';
  }).trim();
  // observação entre parênteses ou depois de " - "
  raw = raw.replace(/\s*\(([^)]*)\)\s*/, (_, n) => {
    note = n.trim();
    return ' ';
  }).trim();
  const dash = raw.match(/^(.*?)\s+[-–]\s+(.+)$/);
  if (dash) {
    raw = dash[1];
    note = note || dash[2].trim();
  }

  const norm = normalizeAligned(raw);
  let qty = null, unit = null, name = raw;

  // "2 kg de arroz", "2kg arroz", "3 leite"
  let m = norm.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_ALT})?\\.?\\s+(?:de\\s+)?(.+)$`));
  if (m) {
    qty = parseNumber(m[1]);
    unit = unitFrom(m[2]) || 'un';
    name = raw.slice(raw.length - m[3].length);
  } else {
    // "arroz 2kg", "leite x3", "pão 6 un"
    m = norm.match(new RegExp(`^(.+?)\\s+(?:x\\s*)?(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_ALT})?\\.?$`));
    if (m) {
      qty = parseNumber(m[2]);
      unit = unitFrom(m[3]) || 'un';
      name = raw.slice(0, m[1].length);
    } else {
      m = norm.match(/^x\s*(\d+)\s+(.+)$/);
      if (m) {
        qty = +m[1];
        unit = 'un';
        name = raw.slice(raw.length - m[2].length);
      }
    }
  }
  return { name: capitalize(name.trim()), qty, unit, price, note };
}
