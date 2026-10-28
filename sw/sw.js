/* GSD Coach — service worker (in build vite.config.ts sostituisce versione ed elenco file da mettere in cache).
   App apribile anche senza rete in campo. I dati restano a carico dell'app (localStorage + coda di sincronizzazione):
   qui si mettono in cache solo i file dell'app e i font. Le chiamate a Supabase/Gemini non passano mai dalla cache. */
const VERSION = '__VERSION__'
const PRECACHE = __PRECACHE__
const APP = 'gsd-app-' + VERSION
const FONTS = 'gsd-fonts-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(APP)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('gsd-app-') && k !== APP).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const isFont = (u) => u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com'

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // font Google: dalla cache, aggiornati in background
  if (isFont(url)) {
    e.respondWith(
      caches.open(FONTS).then(async (c) => {
        const hit = await c.match(req)
        const net = fetch(req)
          .then((r) => {
            if (r.ok || r.type === 'opaque') c.put(req, r.clone())
            return r
          })
          .catch(() => hit)
        return hit || net
      }),
    )
    return
  }

  // tutto il resto fuori dall'app (Supabase, Gemini, ...) va sempre in rete
  if (url.origin !== self.location.origin) return

  // pagina: prima la rete (versione nuova appena pubblicata), senza rete la copia in cache
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone()
          caches.open(APP).then((c) => c.put('./', copy))
          return r
        })
        .catch(() => caches.match('./', { ignoreSearch: true })),
    )
    return
  }

  // file dell'app (nomi con hash, non cambiano): prima la cache
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((r) => {
          if (r.ok) {
            const copy = r.clone()
            caches.open(APP).then((c) => c.put(req, copy))
          }
          return r
        }),
    ),
  )
})
