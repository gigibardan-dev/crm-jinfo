/**
 * src/app/page.tsx
 *
 * Home Page — redirect către /dashboard
 *
 * Ruta „/” nu are conținut propriu; trimite imediat vizitatorul spre
 * dashboard (middleware-ul se ocupă separat de redirect la /login dacă
 * nu e autentificat).
 */

import { redirect } from 'next/navigation'

export default function HomePage() {
  redirect('/dashboard')
}
