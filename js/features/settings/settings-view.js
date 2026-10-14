// Painel de Ajustes: aparência, calendário, lembretes, dados e instalação.

import { h, render, segmented } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { openSheet, confirmDialog } from '../../ui/sheet.js';
import { toast } from '../../ui/toast.js';
import * as store from '../../core/store.js';
import { applyTheme, resolveMode } from '../../core/theme.js';
import { durationLabel } from '../../core/date.js';
import { PALETTES } from './palettes.js';
import { HOLIDAY_REGIONS, DEFAULT_HOLIDAY_SETTINGS } from '../calendar/holidays.js';
import { exportBackup, readBackupFile, importBackup, loadSampleData } from './backup.js';
import { notificationStatus, ensureNotificationPermission } from '../reminders/reminders.js';
import { installState, promptInstall } from '../../pwa.js';

export const APP_VERSION = '0.1.0';

function section(title, ...children) {
  return h('section', { class: 'settings-section' }, h('h3', { class: 'settings-title' }, title), ...children);
}
function row(label, control, hint) {
  return h('div', { class: 'settings-row' },
    h('div', { class: 'settings-label' }, label, hint ? h('small', null, hint) : null),
    h('div', { class: 'settings-control' }, control));
}

export function openSettings() {
  const s = store.getSettings();

  // ----- aparência -----
  const themeSwitch = segmented([
    { value: 'auto', label: 'Sistema', icon: icon('monitor', 16) },
    { value: 'light', label: 'Claro', icon: icon('sun', 16) },
    { value: 'dark', label: 'Escuro', icon: icon('moon', 16) },
  ], s.theme, (v) => { store.setSettings({ theme: v }); applyTheme(store.getSettings()); renderPalettes(); });

  const paletteGrid = h('div', { class: 'palette-grid' });
  function renderPalettes() {
    const cur = store.getSettings();
    const mode = resolveMode(cur.theme);
    render(paletteGrid, ...PALETTES.map((p) => h('button', {
      type: 'button', class: `palette-card ${cur.palette === p.id ? 'active' : ''}`, 'aria-pressed': String(cur.palette === p.id),
      onclick: () => { store.setSettings({ palette: p.id }); applyTheme(store.getSettings()); renderPalettes(); },
    },
    h('span', { class: 'palette-swatch', style: { background: p[mode].accent } },
      h('span', { style: { background: p[mode].soft } })),
    h('span', { class: 'palette-name' }, p.name))));
  }
  renderPalettes();

  // ----- calendário -----
  const weekSwitch = segmented([{ value: 0, label: 'Domingo' }, { value: 1, label: 'Segunda' }], s.weekStart,
    (v) => store.setSettings({ weekStart: Number(v) }));
  const durSelect = h('select', { class: 'input input-compact', onchange: () => store.setSettings({ defaultEventDuration: Number(durSelect.value) }) },
    [0, 15, 30, 45, 60, 90, 120].map((d) => h('option', { value: String(d), selected: d === s.defaultEventDuration }, durationLabel(d))));

  // ----- feriados -----
  const holidayChecks = HOLIDAY_REGIONS.map((r) => {
    const cur = { ...DEFAULT_HOLIDAY_SETTINGS, ...(s.holidays || {}) };
    const input = h('input', { type: 'checkbox', checked: !!cur[r.id], onchange: () => {
      const now = { ...DEFAULT_HOLIDAY_SETTINGS, ...(store.getSettings().holidays || {}) };
      store.setSettings({ holidays: { ...now, [r.id]: input.checked } });
    } });
    return h('label', { class: 'check-label' }, input, r.name);
  });

  // ----- lembretes -----
  const notifState = h('div', { class: 'settings-control' });
  function renderNotif() {
    const st = notificationStatus();
    const label = { granted: 'Ativadas', denied: 'Bloqueadas no navegador', unsupported: 'Sem suporte neste navegador', default: 'Desativadas' }[st];
    render(notifState, 
      h('span', { class: 'muted small' }, label),
      st === 'default' ? h('button', { type: 'button', class: 'btn btn-sm', onclick: async () => { await ensureNotificationPermission(); renderNotif(); } }, 'Ativar') : null);
  }
  renderNotif();

  // ----- dados -----
  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const dump = await readBackupFile(file);
      const n = Object.values(dump.data).reduce((acc, arr) => acc + (arr?.length || 0), 0);
      const ok = await confirmDialog({
        title: 'Importar backup?',
        message: `O arquivo tem ${n} registros (de ${new Date(dump.exportedAt).toLocaleString('pt-BR')}). Isso SUBSTITUI todos os dados atuais deste aparelho.`,
        okLabel: 'Importar', danger: true,
      });
      if (!ok) return;
      await importBackup(dump);
      applyTheme(store.getSettings());
      toast('Backup importado');
    } catch (e) {
      toast(e.message || 'Arquivo inválido');
    }
  } });

  // ----- instalar -----
  const installBox = h('div');
  function renderInstall() {
    const st = installState();
    if (st === 'installed') render(installBox, h('p', { class: 'muted small' }, 'O Organiza já está instalado como app neste aparelho. ✓'));
    else if (st === 'available') render(installBox, h('button', { type: 'button', class: 'btn btn-primary btn-block', onclick: async () => { await promptInstall(); renderInstall(); } }, icon('download', 18), 'Instalar o app'));
    else render(installBox, h('p', { class: 'muted small' },
      'iPhone: no Safari, toque em Compartilhar → "Adicionar à Tela de Início". Android: no Chrome, menu ⋮ → "Instalar app" ou "Adicionar à tela inicial".'));
  }
  renderInstall();

  const body = h('div', { class: 'settings' },
    section('Aparência',
      row('Tema', themeSwitch),
      h('div', { class: 'settings-label' }, 'Cor de destaque', h('small', null, 'Toque para testar: muda na hora.')),
      paletteGrid),
    section('Calendário',
      row('Semana começa no', weekSwitch),
      row('Duração padrão de evento', durSelect)),
    section('Feriados no calendário',
      h('div', { class: 'stack-sm' }, holidayChecks),
      h('p', { class: 'muted small' }, 'Municipais aparecem com o nome da cidade, ex.: "Corpus Christi (Jundiaí, Limeira)".')),
    section('Lembretes',
      row('Notificações', notifState, 'Funcionam com o app aberto ou recém-usado (limite do navegador, sem servidor).')),
    section('Instalar no celular', installBox),
    section('Backup e dados',
      h('div', { class: 'stack-sm' },
        h('button', { type: 'button', class: 'btn btn-block', onclick: () => { const n = exportBackup(); toast(`Backup exportado (${n} registros)`); } }, icon('download', 18), 'Exportar backup (JSON)'),
        h('button', { type: 'button', class: 'btn btn-block', onclick: () => fileInput.click() }, icon('upload', 18), 'Importar backup'),
        fileInput,
        h('button', { type: 'button', class: 'btn btn-block btn-ghost', onclick: async () => {
          loadSampleData();
          await sheet.close();
          toast('Dados de exemplo adicionados', { actionLabel: 'Desfazer', onAction: () => store.undo() });
        } }, icon('wand', 18), 'Adicionar dados de exemplo'),
        h('button', { type: 'button', class: 'btn btn-block btn-ghost danger', onclick: async () => {
          const ok = await confirmDialog({ title: 'Apagar tudo?', message: 'Todas as tarefas, eventos e listas deste aparelho serão apagados. Faça um backup antes, se quiser.', okLabel: 'Apagar tudo', danger: true });
          if (!ok) return;
          await store.wipe();
          applyTheme(store.getSettings());
          toast('Dados apagados');
        } }, icon('trash', 18), 'Apagar todos os dados')),
      h('p', { class: 'muted small' }, 'Seus dados ficam só neste aparelho/navegador. Exporte um backup de vez em quando.')),
    h('p', { class: 'settings-footer' }, `Organiza v${APP_VERSION}`));

  const sheet = openSheet({ title: 'Ajustes', body, size: 'large', className: 'settings-sheet' });
  return sheet;
}
