// Service worker do Organiza: funciona offline.
// Estratégia "rede primeiro": online você sempre vê a versão mais nova; offline usa o cache.
// Ao mudar a estrutura de arquivos, aumente VERSION para limpar caches antigos.

const VERSION = 'v3';
const CACHE = `organiza-${VERSION}`;
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './js/app.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const current = await caches.open(CACHE);
    for (const key of await caches.keys()) {
      if (!key.startsWith('organiza-') || key === CACHE) continue;
      // copia o que ainda não está no cache novo, para o app continuar 100% offline após atualizar
      const old = await caches.open(key);
      for (const req of await old.keys()) {
        if (!(await current.match(req))) {
          const res = await old.match(req);
          if (res) await current.put(req, res);
        }
      }
      await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'cache-urls') {
    event.waitUntil(caches.open(CACHE).then((c) => Promise.all(event.data.urls.map((u) => c.add(u).catch(() => null)))));
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(respond(event, req));
});

// Rede primeiro, mas sem ficar preso em internet ruim: se a rede demorar mais que
// NETWORK_TIMEOUT e houver cópia guardada, usa a cópia (a rede continua atualizando o cache).
const NETWORK_TIMEOUT = 3000;

async function fromCache(req) {
  const cached = await caches.match(req, { ignoreSearch: true });
  if (cached) return cached;
  if (req.mode === 'navigate') return caches.match('./index.html');
  return null;
}

async function respond(event, req) {
  // no-cache = sempre confere com o servidor se há versão nova (resposta 304 é rápida)
  const network = fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      event.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)));
    }
    return res;
  });
  network.catch(() => {}); // evita erro não tratado quando a cópia guardada responde antes

  const timeout = new Promise((resolve) => setTimeout(() => resolve('timeout'), NETWORK_TIMEOUT));
  try {
    const first = await Promise.race([network, timeout]);
    if (first !== 'timeout') return first;
    const cached = await fromCache(req);
    return cached || (await network);
  } catch {
    return (await fromCache(req)) || Response.error();
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow('./');
    })
  );
});
