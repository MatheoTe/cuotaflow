'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cambiarEtapaCobranza, enviarRecordatorioCobranza, registrarGestion } from '@/app/actions'
import { ETAPAS_COBRANZA, ETAPA_COBRANZA_LABEL, type Cuenta } from '@/lib/cobranzas-base'

const selectCls = 'h-9 w-full rounded-md border border-input bg-black/20 px-3 text-body-sm text-on-surface'

export function CobranzaActions({ c }: { c: Cuenta }) {
  const [pending, start] = useTransition()
  const [aviso, setAviso] = useState<string | null>(null)
  const [resultado, setResultado] = useState('contactado')

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
          {ETAPAS_COBRANZA.map(e => (
            <Button key={e} size="sm" variant={c.stage === e ? 'default' : 'outline'} disabled={pending} onClick={() => run(() => cambiarEtapaCobranza(c.id, e))}>
              {ETAPA_COBRANZA_LABEL[e]}
            </Button>
          ))}
        </div>
      </div>

      <form action={fd => run(() => registrarGestion(c.id, fd))} className="grid grid-cols-2 gap-3">
        <div className="col-span-2 text-label-sm uppercase tracking-wide text-on-surface-variant">Registrar gestión</div>
        <div>
          <Label htmlFor="canal" className="text-label-sm text-on-surface-variant">Canal</Label>
          <select id="canal" name="canal" className={selectCls} defaultValue="llamada">
            <option value="llamada">Llamada</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>
        <div>
          <Label htmlFor="resultado" className="text-label-sm text-on-surface-variant">Resultado</Label>
          <select id="resultado" name="resultado" className={selectCls} value={resultado} onChange={e => setResultado(e.target.value)}>
            <option value="sin_respuesta">Sin respuesta</option>
            <option value="contactado">Contactado</option>
            <option value="promesa">Promesa de pago</option>
            <option value="pago">Pagó</option>
          </select>
        </div>
        {(resultado === 'promesa' || resultado === 'pago') && (
          <>
            <div>
              <Label htmlFor="monto" className="text-label-sm text-on-surface-variant">Monto (ARS)</Label>
              <Input id="monto" name="monto" inputMode="numeric" defaultValue={c.saldo_vencido || c.cuota} />
            </div>
            {resultado === 'promesa' && (
              <div>
                <Label htmlFor="promesa_fecha" className="text-label-sm text-on-surface-variant">Fecha de pago</Label>
                <Input id="promesa_fecha" name="promesa_fecha" type="date" />
              </div>
            )}
          </>
        )}
        <div className="col-span-2">
          <Label htmlFor="nota" className="text-label-sm text-on-surface-variant">Nota</Label>
          <Input id="nota" name="nota" placeholder="Qué dijo el cliente" />
        </div>
        <Button type="submit" size="sm" variant="secondary" disabled={pending} className="col-span-2">Guardar gestión</Button>
      </form>

      <div>
        <Label className="mb-2 block text-label-sm uppercase tracking-wide text-on-surface-variant">WhatsApp de cobranzas</Label>
        <Button size="sm" disabled={pending} onClick={() => run(() => enviarRecordatorioCobranza(c.id))}>
          {c.dias_mora > 0 ? 'Enviar aviso de deuda (plantilla)' : 'Enviar recordatorio (plantilla)'}
        </Button>
        {aviso && <p className="mt-2 text-label-md text-on-surface-variant">{aviso}</p>}
      </div>
    </div>
  )
}
