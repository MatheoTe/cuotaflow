import type { Metadata } from 'next'
import { Inter, Sora } from 'next/font/google'
import { NEGOCIO } from '@/lib/negocio'
import { Shell } from '@/components/shell'
import { esDemo, REPO_URL } from '@/lib/demo'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const sora = Sora({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600', '700'] })

export const metadata: Metadata = {
  title: `${NEGOCIO.nombre} · CRM`,
  description: 'Demo de agente de WhatsApp con CRM propio',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${sora.variable}`}>
      <body className="font-sans">
        <Shell demo={esDemo() ? { repo: REPO_URL } : null}>{children}</Shell>
      </body>
    </html>
  )
}
