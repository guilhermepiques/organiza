// Login e sincronização entre aparelhos (Firebase Auth + Firestore).
//
// Como funciona:
// - Os dados continuam no aparelho (IndexedDB); a nuvem guarda uma cópia por usuário em
//   users/{uid}/records/{coleção__id}, com o registro em JSON, o updatedAt e a hora do servidor (serverAt).
// - Envio: toda gravação local entra numa fila e é enviada; ao abrir o app, reenvia o que mudou
//   desde o último envio confirmado (cobre o que foi feito offline).
// - Recebimento: escuta só os registros que chegaram na nuvem depois da última vez (serverAt).
// - Conflito: vence o updatedAt mais recente, aqui (store.applyRemote) e na nuvem (regras do Firestore
//   recusam sobrescrever uma versão mais nova — veja docs/firebase-regras.txt).
// - O SDK do Firebase só é baixado se FIREBASE_CONFIG estiver preenchido.

import * as store from '../core/store.js';
import { FIREBASE_CONFIG } from './firebase-config.js';
import { choiceDialog } from '../ui/sheet.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
const SYNCED = ['tasks', 'events', 'projects', 'lists', 'items', 'catalog', 'log']; // ajustes ficam em cada aparelho

let fb = null;
let auth = null;
let db = null;
let user = null;
let unsubscribe = null;
let pushTimer = null;
let flushing = null;
let suppressReset = false;
const pending = new Map();

// ---------- estado (para a tela de Ajustes) ----------
const state = { configured: !!FIREBASE_CONFIG, ready: false, user: null, status: 'off', error: null, lastSync: null };
// status: off | connecting | syncing | synced | offline | error
const listeners = new Set();
export const getSyncState = () => ({ ...state });
export function onSyncState(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function setState(patch) {
  Object.assign(state, patch);
  for (const fn of listeners) fn(getSyncState());
}

// ---------- marcadores por usuário neste aparelho ----------
const metaKey = (k) => `organiza:sync:${user?.uid}:${k}`;
function getMeta(k, def) {
  try {
    const v = localStorage.getItem(metaKey(k));
    return v == null ? def : JSON.parse(v);
  } catch {
    return def;
  }
}
function setMeta(k, v) {
  try {
    localStorage.setItem(metaKey(k), JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

// ---------- inicialização ----------
async function loadSdk() {
  if (fb) return fb;
  const [app, authM, fs] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  fb = { app, auth: authM, fs };
  return fb;
}

export async function initSync() {
  if (!FIREBASE_CONFIG || state.ready) return;
  setState({ status: 'connecting' });
  try {
    await loadSdk();
  } catch {
    // sem internet na primeira vez: tenta de novo quando a conexão voltar
    setState({ status: 'offline' });
    addEventListener('online', () => initSync(), { once: true });
    return;
  }
  const app = fb.app.initializeApp(FIREBASE_CONFIG);
  auth = fb.auth.getAuth(app);
  db = fb.fs.initializeFirestore(app, { ignoreUndefinedProperties: true });
  store.onLocalWrite((col, rec) => queue(col, rec.id));
  store.onReset(() => {
    if (user && !suppressReset) resync();
  });
  addEventListener('online', () => {
    if (user) flush();
  });
  setState({ ready: true, status: 'off' });
  fb.auth.onAuthStateChanged(auth, (u) => (u ? start(u) : stop()));
}

// ---------- sessão ----------
async function start(u) {
  user = u;
  setState({ user: { email: u.email, uid: u.uid }, status: 'syncing', error: null });
  if (!getMeta('joined', false)) {
    // primeira vez desta conta neste aparelho: o que fazer com os dados que já estão aqui?
    const localCount = SYNCED.filter((c) => c !== 'catalog' && c !== 'log').reduce((n, c) => n + store.all(c).length, 0);
    if (localCount > 0) {
      const choice = await choiceDialog({
        title: 'Dados deste aparelho',
        message: `Este aparelho já tem ${localCount} ite${localCount === 1 ? 'm' : 'ns'} (tarefas, eventos, listas…). O que fazer com eles?`,
        options: [
          { value: 'cloud', label: 'Usar só os da conta' },
          { value: 'merge', label: 'Juntar com a conta', primary: true },
        ],
      });
      if (choice === 'cloud') {
        suppressReset = true;
        await store.replaceAll({ data: {}, settings: store.getSettings() });
        suppressReset = false;
      } else if (choice !== 'merge') {
        // fechou sem escolher: não sincroniza agora
        await fb.auth.signOut(auth);
        return;
      }
    }
    setMeta('joined', true);
  }
  queueChangedSince(getMeta('pushedAt', 0));
  listen();
  flush();
}

function stop() {
  user = null;
  unsubscribe?.();
  unsubscribe = null;
  pending.clear();
  setState({ user: null, status: 'off', error: null });
}

function resync() {
  setMeta('pushedAt', 0);
  setMeta('pulledAt', 0);
  queueChangedSince(0);
  listen();
  flush();
}

// ---------- envio ----------
function docRef(col, id) {
  return fb.fs.doc(db, 'users', user.uid, 'records', `${col}__${encodeURIComponent(id)}`);
}

function queue(col, id) {
  if (!user || !SYNCED.includes(col)) return;
  pending.set(`${col}:${id}`, { col, id });
  clearTimeout(pushTimer);
  pushTimer = setTimeout(flush, 800);
}

function queueChangedSince(since) {
  for (const col of SYNCED) {
    for (const r of store.allRaw(col)) if ((r.updatedAt || 0) > since) pending.set(`${col}:${r.id}`, { col, id: r.id });
  }
}

async function flush() {
  if (!user || !pending.size) return;
  if (!navigator.onLine) {
    // sem internet: guarda na fila e envia quando a conexão voltar (evento "online")
    setState({ status: 'offline' });
    return;
  }
  if (flushing) {
    await flushing;
    return flush();
  }
  const items = [...pending.values()];
  pending.clear();
  flushing = (async () => {
    setState({ status: 'syncing' });
    let maxAt = getMeta('pushedAt', 0);
    const results = await Promise.allSettled(items.map(({ col, id }) => {
      const rec = store.getRaw(col, id);
      if (!rec) return Promise.resolve();
      maxAt = Math.max(maxAt, rec.updatedAt || 0);
      return fb.fs.setDoc(docRef(col, id), {
        col, id, json: JSON.stringify(rec), updatedAt: rec.updatedAt || 0, deleted: !!rec.deleted,
        serverAt: fb.fs.serverTimestamp(),
      });
    }));
    // "permission-denied" = a nuvem já tem uma versão mais nova (ela chega pelo recebimento)
    const failed = results
      .map((r, i) => (r.status === 'rejected' && r.reason?.code !== 'permission-denied' ? items[i] : null))
      .filter(Boolean);
    if (failed.length) {
      for (const it of failed) pending.set(`${it.col}:${it.id}`, it);
      const err = results.find((r) => r.status === 'rejected' && r.reason?.code !== 'permission-denied')?.reason;
      setState({ status: navigator.onLine ? 'error' : 'offline', error: err?.message || null });
    } else {
      setMeta('pushedAt', maxAt);
      setState({ status: 'synced', lastSync: Date.now(), error: null });
    }
  })();
  try {
    await flushing;
  } finally {
    flushing = null;
  }
}

// ---------- recebimento ----------
function listen() {
  unsubscribe?.();
  const since = getMeta('pulledAt', 0);
  const q = fb.fs.query(
    fb.fs.collection(db, 'users', user.uid, 'records'),
    fb.fs.where('serverAt', '>', fb.fs.Timestamp.fromMillis(since))
  );
  unsubscribe = fb.fs.onSnapshot(q, { includeMetadataChanges: false }, (snap) => {
    let maxAt = getMeta('pulledAt', 0);
    for (const ch of snap.docChanges()) {
      if (ch.type === 'removed' || ch.doc.metadata.hasPendingWrites) continue;
      const d = ch.doc.data();
      if (!d.serverAt) continue;
      try {
        if (SYNCED.includes(d.col)) store.applyRemote(d.col, JSON.parse(d.json));
      } catch (e) {
        console.warn('Registro inválido vindo da nuvem', e);
      }
      maxAt = Math.max(maxAt, d.serverAt.toMillis());
    }
    setMeta('pulledAt', maxAt);
    if (!pending.size && !flushing) setState({ status: snap.metadata.fromCache ? 'offline' : 'synced', lastSync: Date.now() });
  }, (err) => setState({ status: 'error', error: err.message }));
}

// ---------- ações da tela ----------
const AUTH_ERRORS = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'Não existe conta com este e-mail.',
  'auth/email-already-in-use': 'Já existe uma conta com este e-mail. Use "Entrar".',
  'auth/weak-password': 'Senha fraca: use pelo menos 6 caracteres.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/missing-password': 'Digite a senha.',
  'auth/network-request-failed': 'Sem internet. Tente de novo quando conectar.',
  'auth/too-many-requests': 'Muitas tentativas. Espere um pouco e tente de novo.',
  'auth/operation-not-allowed': 'O login por e-mail ainda não foi ativado no Firebase.',
};
export const authErrorMessage = (e) => AUTH_ERRORS[e?.code] || e?.message || 'Não foi possível concluir.';

export async function signIn(email, password) {
  await fb.auth.signInWithEmailAndPassword(auth, email, password);
}
export async function signUp(email, password) {
  await fb.auth.createUserWithEmailAndPassword(auth, email, password);
}
export async function resetPassword(email) {
  await fb.auth.sendPasswordResetEmail(auth, email);
}
export async function signOutUser() {
  await flush().catch(() => {});
  await fb.auth.signOut(auth);
}
export function syncNow() {
  if (!user) return;
  queueChangedSince(getMeta('pushedAt', 0));
  listen();
  return flush();
}
