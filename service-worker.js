const CACHE_NAME = 'pedidos-pan-v9';
const APP_SHELL = [
  './index.html',
  './styles.css',
  './app.js',
  './buscador-clientes.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './logo.png',
  './logo-full.png',
];
const ESPERA_RED_MS = 2500; // con mala cobertura, tras este tiempo se usa la copia guardada

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function guardarEnCache(request, respuesta) {
  if (!respuesta || (respuesta.status !== 200 && respuesta.type !== 'opaque')) return;
  const copia = respuesta.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, copia)).catch(() => {});
}

// Código (html, js, css): se pide a la red para tener SIEMPRE la última versión,
// pero si la red tarda más de ESPERA_RED_MS o no hay, sale la copia guardada.
function redPrimeroConLimite(request) {
  return new Promise((resolve, reject) => {
    let resuelto = false;
    const usarCopia = () => caches.match(request).then((copia) => {
      if (copia && !resuelto) { resuelto = true; resolve(copia); }
      return copia;
    });
    const temporizador = setTimeout(usarCopia, ESPERA_RED_MS);

    fetch(request, { cache: 'no-cache' })
      .then((respuesta) => {
        clearTimeout(temporizador);
        guardarEnCache(request, respuesta);
        if (!resuelto) { resuelto = true; resolve(respuesta); }
      })
      .catch((error) => {
        clearTimeout(temporizador);
        usarCopia().then((copia) => { if (!copia && !resuelto) { resuelto = true; reject(error); } });
      });
  });
}

// Imágenes e iconos: no cambian casi nunca, así que salen de la copia guardada al instante.
function cachePrimero(request) {
  return caches.match(request).then((copia) => {
    if (copia) return copia;
    return fetch(request).then((respuesta) => { guardarEnCache(request, respuesta); return respuesta; });
  });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Las llamadas a la API de Apps Script van siempre a la red (datos en vivo)
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleusercontent.com')) {
    event.respondWith(fetch(event.request).catch(() => new Response(JSON.stringify({ ok: false, error: 'offline' }), { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  if (event.request.method !== 'GET') return;

  if (/\.(png|jpe?g|svg|ico|webp|woff2?)$/i.test(url.pathname)) {
    event.respondWith(cachePrimero(event.request));
  } else {
    event.respondWith(redPrimeroConLimite(event.request));
  }
});
