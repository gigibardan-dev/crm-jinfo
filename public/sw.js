/**
 * public/sw.js
 *
 * Service worker minimal — doar ca să îndeplinească criteriul de
 * instalabilitate PWA (Chrome/Edge cer un SW înregistrat cu handler de
 * `fetch` ca butonul de „Instalează" să apară). NU face caching — CRM-ul
 * trebuie mereu să afișeze date proaspete din Supabase (leaduri, remindere,
 * notificări); orice cache agresiv aici ar arăta date vechi fără ca
 * utilizatorul să-și dea seama. `fetch` doar dă mai departe cererea la rețea,
 * neschimbat.
 *
 * Înregistrat din src/components/pwa/ServiceWorkerRegister.tsx (inclus în
 * src/app/layout.tsx). Vezi și public/site.webmanifest.
 */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
