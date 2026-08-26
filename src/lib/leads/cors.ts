/**
 * src/lib/leads/cors.ts
 *
 * CORS pentru endpoint-ul public POST /api/leads/inbound
 *
 * Doar `jinfotours.ro` (formularul Aqua CMS) apelează endpoint-ul direct din
 * browser (fetch cross-origin cu keepalive) — de aceea are nevoie de CORS.
 * Restul canalelor (Jino chatbot pe Cloudflare Worker, JinfoCruise.ro pe
 * Vercel) trimit server-to-server și nu trec prin acest header.
 * Extras din src/app/api/leads/inbound/route.ts.
 * Vezi și: claude/integrari-canale-status.md.
 */

const ALLOWED_ORIGINS = [
  'https://www.jinfotours.ro',
  'https://jinfotours.ro',
]

export function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  }
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Vary'] = 'Origin'
  }
  return headers
}
