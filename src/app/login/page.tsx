'use client'

/**
 * src/app/login/page.tsx
 *
 * Login Page
 *
 * Formular simplu email + parolă (Supabase Auth). Nu există
 * self-registration — conturile sunt create doar de admin din /settings.
 * La succes redirecționează către /dashboard.
 *
 * Layout „carte poștală": panou decorativ cu logo-ul mare (desktop, lg+)
 * + panou formular. <ThemeToggle/> e montat aici ca să aplice tema salvată
 * în localStorage['theme'] chiar și pe pagina de login (altfel pagina
 * ignora complet preferința, fiind în afara layout-ului (app)/).
 *
 * Fontul de titlu (Fredoka) e auto-găzduit prin @fontsource — fișierele
 * .woff2 intră direct în build, fără fetch către Google Fonts la runtime
 * (mai rapid, funcționează și offline/în spatele unui proxy restrictiv).
 * Subseturile "500"/"600" includ și latin-ext, deci diacriticele
 * românești (ă â î ș ț) sunt acoperite.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import '@fontsource/fredoka/500.css'
import '@fontsource/fredoka/600.css'
import { Mail, Lock, Eye, EyeOff, Plane } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const fredokaStyle: React.CSSProperties = { fontFamily: 'Fredoka, ui-rounded, system-ui, sans-serif' }

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('Email sau parolă incorectă')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex bg-white dark:bg-slate-950">
      <div className="fixed top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Panou decorativ — doar desktop. Cer/apus + linia mării + traseu
          de zbor punctat, cu logo-ul pe o „plachetă" albă, ca o poză de
          vacanță lipită pe o carte poștală. */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center
                       bg-gradient-to-br from-sky-300 via-sky-200 to-amber-100
                       dark:from-slate-950 dark:via-indigo-950 dark:to-orange-950">

        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-gradient-to-br from-amber-300 to-orange-400 dark:from-orange-600 dark:to-amber-500 blur-3xl opacity-60 dark:opacity-25 animate-pulse" />

        <svg className="absolute bottom-0 left-0 w-full h-[18%]" viewBox="0 0 500 80" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,40 C125,80 375,0 500,40 L500,80 L0,80 Z" className="fill-sky-500/40 dark:fill-indigo-900/60" />
        </svg>

        <svg className="absolute inset-0 w-full h-full opacity-40 dark:opacity-30" viewBox="0 0 400 500" aria-hidden="true">
          <path d="M40,420 C120,300 80,180 220,140 C300,115 340,90 370,50"
            fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 8"
            className="text-slate-700 dark:text-amber-200" />
        </svg>
        <Plane size={22} strokeWidth={1.5} className="absolute top-[9%] right-[12%] rotate-45 text-slate-700 dark:text-amber-100" aria-hidden="true" />

        <div className="relative z-10 flex flex-col items-center px-10 text-center">
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-900/10 dark:shadow-black/40 p-6 mb-7">
            <Image src="/images/logo-jinfotours.png" alt="J'Info Tours" width={320} height={59} priority className="w-56 h-auto" />
          </div>
          <p style={fredokaStyle} className="text-2xl font-medium text-slate-800 dark:text-amber-50 mb-2">
            CRM JinfoTours
          </p>
          <p className="text-sm text-slate-600/90 dark:text-slate-300/80 max-w-xs">
            De la primul mesaj al clientului, până la vacanța rezervată — totul într-un singur loc.
          </p>
        </div>
      </div>

      {/* Panou formular */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Brand — vizibil doar pe mobil/tabletă (panoul decorativ e ascuns sub lg) */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex bg-white rounded-2xl shadow-md border border-slate-100 p-3 mb-4">
              <Image src="/images/logo-jinfotours.png" alt="J'Info Tours" width={320} height={59} priority className="w-40 h-auto" />
            </div>
            <h1 style={fredokaStyle} className="text-xl font-medium text-slate-900 dark:text-slate-100">CRM JinfoTours</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Autentifică-te pentru a continua</p>
          </div>

          <div className="hidden lg:block mb-8">
            <h1 style={fredokaStyle} className="text-2xl font-medium text-slate-900 dark:text-slate-100">Bine ai revenit</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">Autentifică-te pentru a continua</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  placeholder="agent@jinfotours.ro"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl
                             bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                             transition-shadow"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Parolă
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl
                             bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                             transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ascunde parola' : 'Arată parola'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-xl px-3.5 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-sm font-medium text-white bg-blue-600 rounded-xl
                         hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Se conectează...
                </span>
              ) : (
                'Conectare'
              )}
            </button>
          </form>

          <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-8">
            Contul este creat de administrator.
            <br />
            Contactează administratorul dacă nu ai acces.
          </p>
        </div>
      </div>
    </div>
  )
}
