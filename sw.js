// =============================================================
// sw.js — Service Worker v6 (Producción)
// Estrategia:
//   · HTML / JS / CSS / JSON → Network-First con cache: no-store
//   · Imágenes / Iconos       → Cache-First
//   · Supabase API            → Network-Only (nunca cachear)
//   · Resto                   → Stale-While-Revalidate
// =============================================================

const VERSION       = 'pasaje-v6';
const CACHE_SHELL   = `pasaje-shell-${VERSION}`;
const CACHE_PAGES   = `pasaje-pages-${VERSION}`;
const CACHE_IMAGES  = `pasaje-images-${VERSION}`;
const CACHE_STATIC  = `pasaje-static-${VERSION}`;

const SHELL = [
  './',
  './index.html',
  './login.html',
  './registro.html',
  './tienda.html',
  './favoritos.html',
  './manifest.json',
  './js/supabase.js',
  './js/theme-loader.js',
  './js/liquid-glass.js',
  './js/footer.js',
  './img/icon-192.png',
  './img/icon-512.png',
  './img/icon-maskable.png',
  './img/placeholder.png',
  './img/favicon.ico'
];

// -------------------------------------------------------------
// Clasificadores
// -------------------------------------------------------------
function isSupabase(url) {
  return url.hostname.includes('supabase.co') ||
         url.hostname.includes('supabase.in');
}

function isNetworkFirst(url) {
  const p = url.pathname;
  return (
    p.endsWith('.html') || p.endsWith('/') ||
    p.endsWith('.js')   || p.endsWith('.mjs') ||
    p.endsWith('.css')  || p.endsWith('.json') ||
    p.includes('/js/')  || p.includes('/admin/') ||
    p.includes('/dashboard/') || p.includes('/delivery/') ||
    p.includes('/inmuebles/')
  );
}

function isImage(url) {
  return /\.(png|jpe?g|webp|gif|svg|avif|ico)$/i.test(url.pathname);
}

// -------------------------------------------------------------
// Estrategias
// -------------------------------------------------------------
async function networkFirst(req, cacheName) {
  try {
    // cache: 'no-store' → ignora caché HTTP del navegador
    const res = await fetch(req, { cache: 'no-store' });
    if (res && res.status === 200 && res.type !== 'opaque') {
      const copy = res.clone();
      caches.open(cacheName).then(c => c.put(req, copy)).catch(() => {});
    }
    return res;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;

    if (req.mode === 'navigate') {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.status === 200 && res.type !== 'opaque') {
      const copy = res.clone();
      caches.open(cacheName).then(c => c.put(req, copy)).catch(() => {});
    }
    return res;
  } catch (err) {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cached = await caches.match(req);
  const fetchPromise = fetch(req)
    .then(res => {
      if (res && res.status === 200 && res.type !== 'opaque') {
        const copy = res.clone();
        caches.open(cacheName).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    })
    .catch(() => null);
  return cached || (await fetchPromise) || Response.error();
}

// -------------------------------------------------------------
// INSTALL
// -------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL)
      .then(cache => Promise.all(
        SHELL.map(u => cache.add(u).catch(() => null))
      ))
      .then(() => self.skipWaiting())
  );
});

// -------------------------------------------------------------
// ACTIVATE
// -------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => !k.endsWith(VERSION))
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// -------------------------------------------------------------
// FETCH
// -------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); }
  catch (e) { return; }

  // 1) Supabase → Network-Only. NUNCA cachear respuestas de la BD.
  if (isSupabase(url)) return;

  // 2) Recursos externos (fonts, CDNs) → dejar pasar sin interceptar
  if (url.origin !== self.location.origin) return;

  // 3) HTML, JS, CSS, JSON → Network-First
  if (isNetworkFirst(url)) {
    event.respondWith(networkFirst(req, CACHE_PAGES));
    return;
  }

  // 4) Imágenes → Cache-First
  if (isImage(url)) {
    event.respondWith(cacheFirst(req, CACHE_IMAGES));
    return;
  }

  // 5) Resto → Stale-While-Revalidate
  event.respondWith(staleWhileRevalidate(req, CACHE_STATIC));
});

// -------------------------------------------------------------
// MENSAJES
// -------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();

  if (event.data === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then(keys =>
        Promise.all(keys.map(k => caches.delete(k)))
      )
    );
  }
});

// -------------------------------------------------------------
// PUSH (opcional, por si después integras notificaciones push)
// -------------------------------------------------------------
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'Pasaje de los Altos', {
        body: data.body || 'Nueva notificación',
        icon: './img/icon-192.png',
        badge: './img/icon-192.png',
        vibrate: [200, 100, 200],
        tag: data.tag || 'pasaje-notification',
        data: data.url ? { url: data.url } : {}
      })
    );
  } catch (e) { /* silencioso */ }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data && event.notification.data.url;
  if (target) {
    event.waitUntil(clients.openWindow(target));
  }
});