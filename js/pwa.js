// Service worker (offline) e instalação como app.

let deferredPrompt = null;

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});
addEventListener('appinstalled', () => {
  deferredPrompt = null;
});

export function installState() {
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) return 'installed';
  return deferredPrompt ? 'available' : 'manual';
}

export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === 'accepted';
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    // Garante que todos os arquivos carregados nesta visita fiquem disponíveis offline
    const sendUrls = (worker) => {
      const urls = [location.href.split('#')[0], ...performance.getEntriesByType('resource').map((e) => e.name)]
        .filter((u) => u.startsWith(location.origin));
      worker?.postMessage({ type: 'cache-urls', urls });
    };
    sendUrls(reg.active || navigator.serviceWorker.controller);
    // quando uma versão nova do service worker assume, ela também recebe a lista
    navigator.serviceWorker.addEventListener('controllerchange', () => sendUrls(navigator.serviceWorker.controller));
  } catch (e) {
    console.warn('Service worker não registrado:', e);
  }
}
