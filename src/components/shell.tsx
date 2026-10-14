'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, ExternalLink, FilePlus2, KanbanSquare, LayoutDashboard, MessagesSquare, Search, Smartphone, Sparkles } from 'lucide-react'
import { NEGOCIO } from '@/lib/negocio'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tablero', label: 'Pipeline', icon: KanbanSquare },
  { href: '/conversaciones', label: 'Conversaciones', icon: MessagesSquare },
  { href: '/consulta', label: 'Nueva consulta', icon: FilePlus2 },
  { href: '/simulador', label: 'Simulador', icon: Smartphone },
]

const TITULOS: Array<[RegExp, string]> = [
  [/^\/$/, 'Dashboard'],
  [/^\/tablero/, 'Pipeline'],
  [/^\/conversaciones/, 'Conversaciones'],
  [/^\/simulador/, 'Simulador de WhatsApp'],
  [/^\/contactos/, 'Ficha del contacto'],
  [/^\/consultas/, 'Consulta de vendedor'],
  [/^\/cobranzas/, 'Cuenta en cobranza'],
  [/^\/consulta$/, 'Nueva consulta'],
]

/** Franja del modo demo público: discreta, una línea, con el link al repo. */
function BannerDemo({ repo }: { repo: string }) {
  return (
    <div className="flex items-center justify-center gap-2 border-b border-white/10 bg-primary/10 px-4 py-1.5 text-center text-label-md text-on-surface-variant">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" aria-hidden />
      <span>Cuotaflow live demo · fictional data · resets nightly</span>
      <span aria-hidden className="text-on-surface-variant/40">·</span>
      <a href={repo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">
        Source on GitHub <ExternalLink className="h-3 w-3" aria-hidden />
      </a>
    </div>
  )
}

export function Shell({ children, demo = null }: { children: React.ReactNode; demo?: { repo: string } | null }) {
  const path = usePathname()
  const titulo = TITULOS.find(([re]) => re.test(path))?.[1] ?? 'CRM'
  return (
    <div className="flex min-h-screen">
      <aside className="glass sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col rounded-none border-y-0 border-l-0 p-4 md:flex">
        <Link href="/" className="mb-8 flex items-center gap-3 px-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-tertiary text-on-primary shadow-lg shadow-primary/30">
            <Sparkles className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-display text-title-md font-semibold leading-tight">{NEGOCIO.nombre}</span>
            <span className="block text-label-sm uppercase tracking-[0.18em] text-on-surface-variant">Cuotaflow · Agente IA</span>
          </span>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const activo = href === '/' ? path === '/' : path.startsWith(href) || (href === '/tablero' && path.startsWith('/cobranzas'))
            return (
              <Link key={href} href={href} className={cn('group flex items-center gap-3 rounded-xl px-3 py-2.5 text-body-sm transition-all', activo ? 'bg-primary/15 text-on-surface shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)]' : 'text-on-surface-variant hover:bg-white/5 hover:text-on-surface')}>
                <Icon className={cn('h-4 w-4 transition-colors', activo ? 'text-primary' : 'text-on-surface-variant group-hover:text-on-surface')} />
                {label}
                {activo && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />}
              </Link>
            )
          })}
        </nav>
        <div className="card mt-auto p-3">
          <div className="flex items-center gap-3">
            <span className="avatar flex h-9 w-9 items-center justify-center rounded-full text-label-lg font-bold" style={{ ['--etapa-color' as string]: 'var(--primary)' }}>S</span>
            <div className="min-w-0">
              <div className="truncate text-body-sm font-medium">{NEGOCIO.agente} · agente</div>
              <div className="flex items-center gap-1.5 text-label-sm text-on-surface-variant"><span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />Atendiendo WhatsApp</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {demo && <BannerDemo repo={demo.repo} />}
        <header className="glass sticky top-0 z-20 flex items-center gap-4 rounded-none border-x-0 border-t-0 px-4 py-3 md:px-6">
          <div className="min-w-0">
            <div className="font-display text-title-md font-semibold md:text-title-lg">{titulo}</div>
            <div className="hidden text-label-sm text-on-surface-variant md:block">{NEGOCIO.nombre} · demo</div>
          </div>
          <div className="ml-auto hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-body-sm text-on-surface-variant md:flex">
            <Search className="h-4 w-4" />
            <span className="w-44">Buscar contacto o DNI</span>
          </div>
          <nav className="flex gap-3 text-body-sm md:hidden">
            {NAV.map(n => <Link key={n.href} href={n.href} className={cn((n.href === '/' ? path === '/' : path.startsWith(n.href)) ? 'text-primary' : 'text-on-surface-variant')}>{n.label}</Link>)}
          </nav>
          <button className="relative hidden h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-on-surface-variant md:flex" aria-label="Notificaciones">
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-warning shadow-[0_0_8px_hsl(var(--warning))]" />
          </button>
          <span className="hidden h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-tertiary to-primary text-label-lg font-bold text-on-primary shadow-lg shadow-tertiary/30 md:flex">JM</span>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
