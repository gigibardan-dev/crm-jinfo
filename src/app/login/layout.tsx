/**
 * src/app/login/layout.tsx
 *
 * Login Layout
 *
 * Layout minimal (pass-through) pentru ruta /login — nu adaugă Sidebar/
 * Header, spre deosebire de src/app/(app)/layout.tsx folosit de restul
 * paginilor autentificate.
 */

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
