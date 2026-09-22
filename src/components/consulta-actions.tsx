'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ETAPAS, ETAPA_LABEL, type Etapa } from '@/lib/negocio'
import { cambiarEtapaConsulta, avisarVendedor } from '@/app/actions'
import type { Consulta } from '@/lib/types'

export function ConsultaActions({ c }: { c: Consulta }) {
  const [pending, start] = useTransition()
  const [aviso, setAviso] = useState<string | null>(null)

  const run = (fn: () => Promise<{ ok: boolean; detalle: string } | void>) =>
    start(async () => {
      setAviso(null)
      const r = await fn()
      if (r && 'detalle' in r) setAviso(r.detalle)
    })

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label className="mb-2 block text-label-sm uppercase tracking-wide text-on-surface-variant">Etapa</Label>
        <div className="flex flex-wrap gap-2">
          {ETAPAS.filter(e => e !== 'cobranza').map(e => (
            <Button key={e} size="sm" variant={c.stage === e ? 'default' : 'outline'} disabled={pending} onClick={() => run(() => cambiarEtapaConsulta(c.id, e as Etapa))}>
              {ETAPA_LABEL[e]}
            </Button>
          ))}
        </div>
      </div>
      <div>
        <Label className="mb-2 block text-label-sm uppercase tracking-wide text-on-surface-variant">Avisar al vendedor</Label>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={pending} onClick={() => run(() => avisarVendedor(c.id, 'aprobada'))}>Crédito aprobado</Button>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => avisarVendedor(c.id, 'falta_documentacion'))}>Falta documentación</Button>
        </div>
        {aviso && <p className="mt-2 text-label-md text-on-surface-variant">{aviso}</p>}
      </div>
    </div>
  )
}
