// Mini-helper para criar elementos: h('button', { class: 'btn', onclick }, 'Texto')

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [prop, val] of Object.entries(v)) {
          if (prop.startsWith('--')) el.style.setProperty(prop, val);
          else el.style[prop] = val;
        }
      }
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value' || k === 'checked' || k === 'selected' || k === 'indeterminate') el[k] = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

/** Substitui o conteúdo de `el` pelos filhos dados. */
export function render(el, ...children) {
  clear(el);
  append(el, children);
  return el;
}

/** Segmented control: [{ value, label }] */
export function segmented(options, value, onChange, { className = '' } = {}) {
  const wrap = h('div', { class: `segmented ${className}`, role: 'radiogroup' });
  const set = (v) => {
    for (const b of wrap.children) b.setAttribute('aria-checked', String(b.dataset.value === String(v)));
  };
  for (const o of options) {
    wrap.append(
      h('button', {
        type: 'button',
        role: 'radio',
        dataset: { value: String(o.value) },
        onclick: () => {
          set(o.value);
          onChange(o.value);
        },
      }, o.icon || null, o.label)
    );
  }
  set(value);
  wrap.setValue = set;
  return wrap;
}

/** Textarea que cresce com o conteúdo. */
export function autoGrow(textarea) {
  const fit = () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };
  textarea.addEventListener('input', fit);
  requestAnimationFrame(fit);
  return textarea;
}

export const isDesktop = () => matchMedia('(min-width: 900px)').matches;

export function vibrate(ms = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}
