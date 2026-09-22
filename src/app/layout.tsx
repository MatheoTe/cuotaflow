import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import { KanbanSquare, MessagesSquare, Smartphone } from 'lucide-react'
import { NEGOCIO } from '@/lib/negocio'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: `${NEGOCIO.nombre} · CRM`,
  description: 'Demo de agente de WhatsApp con CRM propio',
}

const NAV = [
  { href: '/tablero', label: 'Tablero', icon: KanbanSquare },
  { href: '/conversaciones', label: 'Conversaciones', icon: MessagesSquare },
  { href: '/simulador', label: 'Simulador', icon: Smartphone },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="font-sans">
        <div className="flex min-h-screen">
          <aside className="hidden w-60 shrink-0 flex-col border-r border-outline-variant bg-surface-container-low p-4 md:flex">
            <div className="mb-8 px-2">
              <div className="text-label-sm uppercase tracking-wider text-on-surface-variant">CRM</div>
              <div className="font-display text-title-lg font-semibold">{NEGOCIO.nombre}</div>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-body-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface">
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto px-2 text-label-sm text-on-surface-variant">
              Agente: {NEGOCIO.agente} · Demo
            </div>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center gap-4 border-b border-outline-variant px-4 py-3 md:hidden">
              <span className="font-semibold">{NEGOCIO.nombre}</span>
              <nav className="ml-auto flex gap-3 text-body-sm">
                {NAV.map(n => <Link key={n.href} href={n.href} className="text-on-surface-variant">{n.label}</Link>)}
              </nav>
            </header>
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  )
}
