import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

import { OPERADORES, type Cuenta } from './cobranzas-base'
export * from './cobranzas-base'

export type NuevaCuenta = Omit<Cuenta, 'id' | 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }

export interface CobranzasStore {
  list(): Promise<Cuenta[]>
  get(id: string): Promise<Cuenta | null>
  update(id: string, patch: Partial<Omit<Cuenta, 'id' | 'created_at'>>): Promise<Cuenta>
  insertMany(cuentas: NuevaCuenta[]): Promise<void>
  reset(): Promise<void>
}

const now = () => new Date().toISOString()
const orden = (a: Cuenta, b: Cuenta) => b.dias_mora - a.dias_mora || b.saldo_vencido - a.saldo_vencido

class FileCobranzas implements CobranzasStore {
  private file = process.env.VERCEL ? '/tmp/demo-creditos-cobranzas.json' : path.join(process.cwd(), 'data', 'cobranzas.json')
  private async load(): Promise<Cuenta[]> {
    try { return JSON.parse(await fs.readFile(this.file, 'utf8')) as Cuenta[] } catch { return [] }
  }
  private async save(d: Cuenta[]) {
    await fs.mkdir(path.dirname(this.file), { recursive: true })
    await fs.writeFile(this.file, JSON.stringify(d, null, 2))
  }
  async list() { return (await this.load()).sort(orden) }
  async get(id: string) { return (await this.load()).find(c => c.id === id) ?? null }
  async update(id: string, patch: Partial<Cuenta>) {
    const d = await this.load()
    const i = d.findIndex(c => c.id === id)
    if (i < 0) throw new Error(`cuenta ${id} no existe`)
    d[i] = { ...d[i], ...patch, updated_at: now() }
    await this.save(d)
    return d[i]
  }
  async insertMany(cuentas: NuevaCuenta[]) {
    const d = await this.load()
    for (const c of cuentas) d.push({ id: randomUUID(), created_at: now(), updated_at: now(), ...c })
    await this.save(d)
  }
  async reset() { await this.save([]) }
}

class SupabaseCobranzas implements CobranzasStore {
  constructor(private sb: SupabaseClient) {}
  async list() {
    const { data, error } = await this.sb.from('cobranzas').select('*')
    if (error) throw error
    return ((data ?? []) as Cuenta[]).sort(orden)
  }
  async get(id: string) {
    const { data } = await this.sb.from('cobranzas').select('*').eq('id', id).maybeSingle()
    return (data as Cuenta | null) ?? null
  }
  async update(id: string, patch: Partial<Cuenta>) {
    const { data, error } = await this.sb.from('cobranzas').update({ ...patch, updated_at: now() }).eq('id', id).select('*').single()
    if (error) throw error
    return data as Cuenta
  }
  async insertMany(cuentas: NuevaCuenta[]) {
    const { error } = await this.sb.from('cobranzas').insert(cuentas)
    if (error) throw error
  }
  async reset() {
    const { error } = await this.sb.from('cobranzas').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) throw error
  }
}

let store: CobranzasStore | null = null
export function cobranzas(): CobranzasStore {
  if (store) return store
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  store = url && key ? new SupabaseCobranzas(createClient(url, key, { auth: { persistSession: false } })) : new FileCobranzas()
  return store
}

/** Resumen por operador: lo que mira la responsable del área. */
export function rendimientoOperadores(cuentas: Cuenta[]) {
  return OPERADORES.map(op => {
    const propias = cuentas.filter(c => c.operador === op)
    const gestiones = propias.flatMap(c => c.gestiones).filter(g => g.operador === op && g.canal !== 'sistema')
    const contactadas = propias.filter(c => c.gestiones.some(g => ['contactado', 'promesa', 'pago'].includes(g.resultado))).length
    const promesas = gestiones.filter(g => g.resultado === 'promesa').length
    const cumplidas = propias.filter(c => c.stage === 'regularizado' && c.gestiones.some(g => g.resultado === 'promesa')).length
    const recupero = propias.reduce((a, c) => a + c.recuperado, 0)
    const enMora = propias.filter(c => c.stage !== 'por_vencer').length
    return {
      operador: op,
      asignadas: propias.length,
      gestiones: gestiones.length,
      contactabilidad: enMora ? Math.round((contactadas / enMora) * 100) : 0,
      promesas,
      cumplidas,
      recupero,
    }
  })
}
