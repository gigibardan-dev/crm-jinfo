/**
 * src/middleware.ts
 *
 * Next.js Middleware — Auth session refresh + route protection
 *
 * Rulează pe (aproape) fiecare request (vezi `config.matcher` mai jos):
 * reîmprospătează sesiunea Supabase din cookies și redirecționează
 * utilizatorii neautentificați către /login, respectiv pe cei deja
 * autentificați departe de /login. Rutele de webhook (/api/leads/inbound,
 * /api/leads/facebook, /api/leads/sync/facebook-sheets) sunt excluse din
 * protecția de auth — nu au sesiune de browser (apelate server-to-server
 * sau de un pinger extern), au propria autentificare în interiorul rutei
 * (x-api-key la webhook-uri, CRON_SECRET la sync — vezi
 * src/app/api/leads/sync/facebook-sheets/route.ts).
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Public routes that don't require auth
  const publicPaths = ['/login']
  const isPublicPath = publicPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  // API routes for webhooks (no auth needed) — fiecare are propria autentificare internă
  const isWebhookRoute = request.nextUrl.pathname.startsWith('/api/leads/inbound') ||
    request.nextUrl.pathname.startsWith('/api/leads/facebook') ||
    request.nextUrl.pathname.startsWith('/api/leads/sync/facebook-sheets')

  if (isWebhookRoute) {
    return supabaseResponse
  }

  // Redirect unauthenticated users to login
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from login
  if (user && isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, site.webmanifest, sw.js — fișiere PWA la rădăcina
     *   /public (vezi public/site.webmanifest + public/sw.js). Fără
     *   excluderea asta, cererea trecea prin auth-ul din middleware ca
     *   orice altă rută și, dacă fetch-ul browserului pt. manifest/SW nu
     *   ajungea cu cookie-ul de sesiune, primea redirect 307 spre /login —
     *   pagina HTML de login, nu JSON, ceea ce dădea exact eroarea din
     *   consolă: „Manifest: Line 1, column 1, Syntax error" (browserul
     *   încerca să parseze HTML-ul redirectului ca JSON)
     * - restul fișierelor din /public cu extensii de imagine/icon comune
     */
    '/((?!_next/static|_next/image|favicon\\.ico|site\\.webmanifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)',
  ],
}
