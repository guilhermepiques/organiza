// Roteamento simples por hash: #/tarefas/hoje, #/calendario, #/compras/<id>
// Trocar de aba não cria entradas no histórico (o botão "voltar" fica para fechar painéis).

let handler = null;

export function onRoute(fn) {
  handler = fn;
}

export function currentRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { tab: parts[0] || 'tarefas', parts: parts.slice(1) };
}

export function navigate(path) {
  const hash = '#/' + path.split('/').map(encodeURIComponent).join('/');
  if (location.hash !== hash) history.replaceState(history.state, '', hash);
  handler?.(currentRoute());
}

addEventListener('hashchange', () => handler?.(currentRoute()));
