/**
 * Service worker: guarda a casca da interface para o app abrir rapido
 * (e continuar abrindo no celular com internet ruim).
 * Nada de /api fica em cache - dados sempre vem da rede.
 */
const CACHE = 'atak-casca-v1';
const CASCA = [
  '/', '/index.html', '/css/estilo.css', '/css/tema.css',
  '/js/app.js', '/js/api.js', '/js/ui.js', '/js/graficos.js', '/js/marca.js', '/js/tema.js',
  '/marca/logo.svg', '/marca/simbolo.svg', '/manifest.webmanifest',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CASCA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const url = new URL(evento.request.url);
  if (evento.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // dados nunca saem do cache

  evento.respondWith(
    fetch(evento.request)
      .then((resposta) => {
        const copia = resposta.clone();
        caches.open(CACHE).then((cache) => cache.put(evento.request, copia)).catch(() => {});
        return resposta;
      })
      .catch(() => caches.match(evento.request).then((guardado) => guardado || caches.match('/index.html'))),
  );
});
