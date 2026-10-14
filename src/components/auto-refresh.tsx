'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Refresca la página cada N segundos: en la demo, el tablero se mueve solo mientras alguien chatea. */
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000)
    return () => clearInterval(id)
  }, [router, seconds])
  return null
}
