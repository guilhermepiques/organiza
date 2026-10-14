// Camada de persistência local (IndexedDB), com fallback para localStorage.
// Só o store.js conversa com este módulo. Para sincronizar entre dispositivos no futuro,
// basta adicionar um adaptador remoto ao lado deste, sem mexer nas telas.

const DB_NAME = 'organiza';
const DB_VERSION = 1;
export const STORES = ['tasks', 'events', 'projects', 'lists', 'items', 'catalog', 'log', 'meta'];

let dbPromise = null;
let useLocalStorage = false;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('IndexedDB indisponível'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB bloqueado'));
  });
  return dbPromise;
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------- fallback localStorage ----------
const lsKey = (store) => `organiza:${store}`;
function lsRead(store) {
  try {
    return JSON.parse(localStorage.getItem(lsKey(store)) || '{}');
  } catch {
    return {};
  }
}
function lsWrite(store, obj) {
  try {
    localStorage.setItem(lsKey(store), JSON.stringify(obj));
  } catch (e) {
    console.warn('Falha ao salvar no localStorage', e);
  }
}

export async function init() {
  try {
    await openDB();
  } catch (e) {
    console.warn('Usando localStorage como armazenamento:', e.message);
    useLocalStorage = true;
  }
}

export async function getAll(store) {
  if (useLocalStorage) return Object.values(lsRead(store));
  const db = await openDB();
  return requestToPromise(db.transaction(store, 'readonly').objectStore(store).getAll());
}

export async function putMany(store, records) {
  if (!records.length) return;
  if (useLocalStorage) {
    const all = lsRead(store);
    for (const r of records) all[r.id] = r;
    lsWrite(store, all);
    return;
  }
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    for (const r of records) os.put(r);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function clearAll() {
  if (useLocalStorage) {
    for (const s of STORES) localStorage.removeItem(lsKey(s));
    return;
  }
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, 'readwrite');
    for (const s of STORES) tx.objectStore(s).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

/** Pede ao navegador para não apagar os dados em caso de pouco espaço. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* sem suporte */
  }
}
