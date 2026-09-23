'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ETAPAS, ETAPA_LABEL, type Etapa } from '@/lib/negocio'
import { borrarContacto, cambiarEtapa, enviarAgradecimiento, enviarRecordatorio, guardarCuota } from '@/app/actions'
import { BotonBorrar } from '@/components/boton-borrar'
import type { Contact } from '@/lib/types'

export function ContactActions({ c }: { c: Contact }) {
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
          {ETAPAS.map(e => (
            <Button key={e} size="sm" variant={c.stage === e ? 'default' : 'outline'} disabled={pending} onClick={() => run(() => cambiarEtapa(c.id, e as Etapa))}>
              {ETAPA_LABEL[e]}
            </Button>
          ))}
        </div>
      </div>

      <form action={(fd) => run(() => guardarCuota(c.id, fd))} className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cuota" className="text-label-sm uppercase tracking-wide text-on-surface-variant">Cuota (ARS)</Label>
          <Input id="cuota" name="cuota" defaultValue={c.cuota ?? ''} inputMode="numeric" placeholder="85000" />
        </div>
        <div>
          <Label htmlFor="vencimiento" className="text-label-sm uppercase tracking-wide text-on-surface-variant">Vencimiento</Label>
          <Input id="vencimiento" name="vencimiento" type="date" defaultValue={c.vencimiento ?? ''} />
        </div>
        <Button type="submit" size="sm" variant="secondary" disabled={pending} className="col-span-2">Guardar cuota</Button>
      </form>

      <div>
        <Label className="mb-2 block text-label-sm uppercase tracking-wide text-on-surface-variant">Campañas</Label>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={pending} onClick={() => run(() => enviarRecordatorio(c.id))}>Recordatorio de vencimiento</Button>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => enviarAgradecimiento(c.id))}>Agradecimiento post-pago</Button>
        </div>
        {aviso && <p className="mt-2 text-label-md text-on-surface-variant">{aviso}</p>}
      </div>

      <BotonBorrar label="Borrar contacto y conversación" onConfirm={() => borrarContacto(c.id)} />
    </div>
  )
}
