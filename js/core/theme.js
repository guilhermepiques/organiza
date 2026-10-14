// Aplica tema (claro/escuro/sistema) e paleta de destaque como variáveis CSS no <html>.

import { PALETTES } from '../features/settings/palettes.js';

const media = matchMedia('(prefers-color-scheme: dark)');
let current = null;

export function resolveMode(theme) {
  return theme === 'auto' ? (media.matches ? 'dark' : 'light') : theme;
}

export function applyTheme(settings, paletteOverride) {
  current = settings;
  const root = document.documentElement;
  const mode = resolveMode(settings.theme);
  const palette = PALETTES.find((p) => p.id === (paletteOverride || settings.palette)) || PALETTES[0];
  const c = palette[mode];
  root.dataset.theme = mode;
  root.style.setProperty('--accent', c.accent);
  root.style.setProperty('--accent-contrast', c.contrast);
  root.style.setProperty('--accent-soft', c.soft);
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || (mode === 'dark' ? '#111113' : '#fafafa'));
}

media.addEventListener?.('change', () => {
  if (current?.theme === 'auto') applyTheme(current);
});
