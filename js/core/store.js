// Estado central do app: coleções em memória + gravação automática no IndexedDB.
//
// Todo registro tem: id, createdAt, updatedAt e (quando excluído) deleted: true.
// A exclusão é "lógica" (tombstone) para facilitar uma futura sincronização entre dispositivos.
// As telas nunca falam com o banco direto: usam create/update/remove e assinam mudanças com on().

import * as db from './db.js';
import { uid } from './util.js';

export const COLLECTIONS = ['tasks', 'events', 'projects', 'lists', 'items', 'catalog', 'log'];

export const DEFAULT_SETTINGS = {
  id: 'settings',
  theme: 'auto', // auto | light | dark
  palette: 'grafite',
  weekStart: 0, // 0 = domingo, 1 = segunda
  calendarView: 'week', // day | week | month
  defaultEventDuration: 60,
  taskSort: 'smart', // smart | date | priority | name | created
  showDoneInCalendar: true,
  holidays: { br: true, jundiai: true, limeira: true, facultativos: true }, // feriados no calendário
  lastListId: null,
};

const data = Object.fromEntries(COLLECTIONS.map((c) => [c, new Map()]));
let settings = { ...DEFAULT_SETTINGS };

const listeners = new Set();
const changedCols = new Set();
let emitQueued = false;

const dirty = new Map();
let flushTimer = null;

let recording = null;
const undoStack = [];

// ---------- inicialização ----------
export async function init() {
  await db.init();
  for (const col of COLLECTIONS) {
    data[col].clear();
    for (const r of await db.getAll(col)) data[col].set(r.id, r);
  }
  const meta = await db.getAll('meta');
  const s = meta.find((m) => m.id === 'settings');
  settings = { ...DEFAULT_SETTINGS, ...(s || {}) };
  db.requestPersistence();
  addEventListener('pagehide', flushNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushNow();
  });
}

// ---------- leitura ----------
export function all(col) {
  const out = [];
  for (const r of data[col].values()) if (!r.deleted) out.push(r);
  return out;
}

export function get(col, id) {
  const r = id != null ? data[col].get(id) : null;
  return r && !r.deleted ? r : null;
}

// ---------- escrita ----------
function track(col, id) {
  if (!recording) return;
  const key = `${col}:${id}`;
  if (recording.has(key)) return;
  const prev = data[col].get(id);
  recording.set(key, { col, id, prev: prev ? structuredClone(prev) : null });
}

// Ganchos para a sincronização (js/sync): avisam a cada gravação local e quando os dados são trocados por inteiro.
const writeHooks = new Set();
const resetHooks = new Set();
export const onLocalWrite = (fn) => (writeHooks.add(fn), () => writeHooks.delete(fn));
export const onReset = (fn) => (resetHooks.add(fn), () => resetHooks.delete(fn));

function write(col, rec, { remote = false } = {}) {
  data[col].set(rec.id, rec);
  dirty.set(`${col}:${rec.id}`, { col, rec });
  scheduleFlush();
  changed(col);
  if (!remote) for (const fn of writeHooks) fn(col, rec);
}

/**
 * Aplica um registro vindo de outro aparelho. Vence o mais recente (updatedAt).
 * Não dispara os ganchos de gravação local (evita mandar de volta para a nuvem).
 */
export function applyRemote(col, rec) {
  if (!data[col] || !rec?.id) return false;
  const cur = data[col].get(rec.id);
  if (cur && (cur.updatedAt || 0) >= (rec.updatedAt || 0)) return false;
  write(col, rec, { remote: true });
  return true;
}

/** Um registro mesmo que excluído (para enviar à nuvem). */
export const getRaw = (col, id) => data[col]?.get(id) || null;

/** Todos os registros, inclusive os excluídos (para enviar à nuvem). */
export function allRaw(col) {
  return [...data[col].values()];
}

export function create(col, fields = {}) {
  const now = Date.now();
  const rec = { id: uid(), createdAt: now, ...fields, updatedAt: now };
  track(col, rec.id);
  write(col, rec);
  return rec;
}

export function update(col, id, patch) {
  const cur = data[col].get(id);
  if (!cur) return null;
  track(col, id);
  const rec = { ...cur, ...patch, updatedAt: Date.now() };
  write(col, rec);
  return rec;
}

export function remove(col, id) {
  const cur = data[col].get(id);
  if (!cur || cur.deleted) return;
  track(col, id);
  write(col, { ...cur, deleted: true, updatedAt: Date.now() });
}

/**
 * Agrupa várias alterações numa única ação que pode ser desfeita.
 * Ex.: batch('Tarefa excluída', () => remove('tasks', id))
 */
export function batch(label, fn) {
  if (recording) return fn();
  recording = new Map();
  try {
    const result = fn();
    if (recording.size) {
      undoStack.push({ label, changes: [...recording.values()] });
      if (undoStack.length > 30) undoStack.shift();
    }
    return result;
  } finally {
    recording = null;
  }
}

/** Desfaz a última ação registrada com batch(). Retorna o rótulo dela ou null. */
export function undo() {
  const entry = undoStack.pop();
  if (!entry) return null;
  const now = Date.now();
  for (const { col, id, prev } of entry.changes) {
    if (prev) write(col, { ...prev, updatedAt: now });
    else {
      const cur = data[col].get(id);
      if (cur) write(col, { ...cur, deleted: true, updatedAt: now });
    }
  }
  return entry.label;
}

export const canUndo = () => undoStack.length > 0;

// ---------- configurações ----------
export const getSettings = () => settings;

export function setSettings(patch) {
  settings = { ...settings, ...patch, updatedAt: Date.now() };
  dirty.set('meta:settings', { col: 'meta', rec: settings });
  scheduleFlush();
  changed('settings');
}

// ---------- eventos de mudança ----------
function changed(col) {
  changedCols.add(col);
  if (emitQueued) return;
  emitQueued = true;
  queueMicrotask(() => {
    emitQueued = false;
    const cols = new Set(changedCols);
    changedCols.clear();
    for (const fn of listeners) {
      try {
        fn(cols);
      } catch (e) {
        console.error(e);
      }
    }
  });
}

/** Assina mudanças. O callback recebe um Set com as coleções alteradas. */
export function on(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------- gravação ----------
function scheduleFlush() {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flushNow, 120);
}

export async function flushNow() {
  clearTimeout(flushTimer);
  if (!dirty.size) return;
  const groups = {};
  for (const { col, rec } of dirty.values()) (groups[col] ||= []).push(rec);
  dirty.clear();
  for (const [col, recs] of Object.entries(groups)) {
    try {
      await db.putMany(col, recs);
    } catch (e) {
      console.error('Erro ao salvar', col, e);
    }
  }
}

// ---------- backup ----------
export function exportData() {
  const out = {};
  for (const col of COLLECTIONS) out[col] = all(col);
  return { app: 'organiza', schema: 1, exportedAt: new Date().toISOString(), settings, data: out };
}

export async function replaceAll(dump) {
  await flushNow();
  await db.clearAll();
  for (const col of COLLECTIONS) {
    data[col].clear();
    for (const r of dump.data?.[col] || []) if (r && r.id) data[col].set(r.id, r);
    await db.putMany(col, [...data[col].values()]);
  }
  settings = { ...DEFAULT_SETTINGS, ...(dump.settings || {}), id: 'settings' };
  await db.putMany('meta', [settings]);
  undoStack.length = 0;
  for (const col of [...COLLECTIONS, 'settings']) changed(col);
  for (const fn of resetHooks) fn();
}

export async function wipe() {
  await replaceAll({ data: {} });
}
