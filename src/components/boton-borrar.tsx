'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Borrado en dos clics, sin diálogo del navegador: primero "Borrar", después "Confirmar". */
export function BotonBorrar({ label, onConfirm }: { label: string; onConfirm: () => Promise<void> }) {
  const [armado, setArmado] = useState(false)
  const [pending, start] = useTransition()
  return (
    <div className="border-t border-white/5 pt-4">
      {!armado ? (
        <Button size="sm" variant="ghost" className="text-error hover:bg-error/10 hover:text-error" onClick={() => setArmado(true)}>
          <Trash2 className="h-4 w-4" />{label}
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label-md text-on-surface-variant">Se borra todo, sin vuelta atrás.</span>
          <Button size="sm" variant="destructive" disabled={pending} onClick={() => start(() => onConfirm())}>{pending ? 'Borrando…' : 'Confirmar borrado'}</Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setArmado(false)}>Cancelar</Button>
        </div>
      )}
    </div>
  )
}
