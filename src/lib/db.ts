import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import type { Contact, Message, Datos, Direction, MessageKind, Media, Consulta, TipoContacto } from './types'
import type { Etapa } from './negocio'

/**
 * Capa de datos con dos implementaciones:
 *  - Supabase cuando hay SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (producción).
 *  - Un JSON en data/store.json cuando no (desarrollo local sin configurar nada).
 * Ambas exponen la misma interfaz.
 */
export interface NuevoMensaje { contact_id: string; direction: Direction; kind?: MessageKind; body: string; wa_id?: string | null; media_id?: string | null }

export interface Store {
  listContacts(): Promise<Contact[]>
  getContact(id: string): Promise<Contact | null>
  getContactByPhone(phone: string): Promise<Contact | null>
  createContact(phone: string, name?: string | null, tipo?: TipoContacto, sucursal?: string | null): Promise<Contact>
  updateContact(id: string, patch: Partial<Omit<Contact, 'id' | 'phone' | 'created_at'>>): Promise<Contact>
  listMessages(contactId: string): Promise<Message[]>
  addMessage(input: NuevoMensaje): Promise<Message>
  hasWaMessage(waId: string): Promise<boolean>
  addMedia(input: { contact_id: string; mime: string; data: string }): Promise<Media>
  getMedia(id: string): Promise<Media | null>
  listConsultas(): Promise<Consulta[]>
  getConsulta(id: string): Promise<Consulta | null>
  /** Última consulta del vendedor (completa o no): es sobre la que siguen llegando datos. */
  getConsultaActiva(vendedorId: string): Promise<Consulta | null>
  createConsulta(vendedorId: string): Promise<Consulta>
  updateConsulta(id: string, patch: Partial<Omit<Consulta, 'id' | 'vendedor_id' | 'created_at'>>): Promise<Consulta>
  /** Borra el contacto con su conversación, fotos y consultas. */
  deleteContact(id: string): Promise<void>
  deleteConsulta(id: string): Promise<void>
  reset(): Promise<void>
}

const now = () => new Date().toISOString()

const emptyContact = (phone: string, name?: string | null, tipo: TipoContacto = 'cliente', sucursal: string | null = null): Contact => ({
  id: randomUUID(),
  phone,
  name: name ?? null,
  tipo,
  sucursal,
  stage: 'nuevo',
  score: 0,
  datos: {},
  resumen: null,
  proximo_paso: null,
  vencimiento: null,
  cuota: null,
  created_at: now(),
  updated_at: now(),
  last_message_at: null,
})

const emptyConsulta = (vendedorId: string): Consulta => ({
  id: randomUUID(),
  vendedor_id: vendedorId,
  nombre_cliente: null,
  dni: null,
  banco: null,
  monto: null,
  telefono_cliente: null,
  completa: false,
  bureau: null,
  score: 0,
  stage: 'nuevo',
  resumen: null,
  proximo_paso: null,
  fotos: [],
  created_at: now(),
  updated_at: now(),
})

/* ──────────────────── JSON (memoria o archivo) ──────────────────── */

interface FileData { contacts: Contact[]; messages: Message[]; media: Media[]; consultas: Consulta[] }
const vacio = (): FileData => ({ contacts: [], messages: [], media: [], consultas: [] })

/**
 * Implementación sobre un documento JSON. Las subclases solo deciden dónde vive
 * el documento: en memoria (tests y evals) o en un archivo (desarrollo local).
 */
abstract class JsonStore implements Store {
  protected abstract load(): Promise<FileData>
  protected abstract save(d: FileData): Promise<void>

  async listContacts() {
    const d = await this.load()
    return [...d.contacts].sort((a, b) => (b.last_message_at ?? b.updated_at).localeCompare(a.last_message_at ?? a.updated_at))
  }
  async getContact(id: string) { return (await this.load()).contacts.find(c => c.id === id) ?? null }
  async getContactByPhone(phone: string) { return (await this.load()).contacts.find(c => c.phone === phone) ?? null }
  async createContact(phone: string, name?: string | null, tipo?: TipoContacto, sucursal?: string | null) {
    const d = await this.load()
    const c = emptyContact(phone, name, tipo, sucursal)
    d.contacts.push(c)
    await this.save(d)
    return c
  }
  async updateContact(id: string, patch: Partial<Contact>) {
    const d = await this.load()
    const i = d.contacts.findIndex(c => c.id === id)
    if (i < 0) throw new Error(`contacto ${id} no existe`)
    d.contacts[i] = { ...d.contacts[i], ...patch, updated_at: now() }
    await this.save(d)
    return d.contacts[i]
  }
  async listMessages(contactId: string) {
    return (await this.load()).messages.filter(m => m.contact_id === contactId).sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  async addMessage(input: NuevoMensaje) {
    const d = await this.load()
    if (input.wa_id && d.messages.some(m => m.wa_id === input.wa_id)) throw new Error(`mensaje ${input.wa_id} duplicado`)
    const m: Message = { id: randomUUID(), kind: 'text', wa_id: null, media_id: null, created_at: now(), ...input }
    d.messages.push(m)
    const i = d.contacts.findIndex(c => c.id === input.contact_id)
    if (i >= 0) d.contacts[i] = { ...d.contacts[i], last_message_at: m.created_at }
    await this.save(d)
    return m
  }
  async hasWaMessage(waId: string) { return (await this.load()).messages.some(m => m.wa_id === waId) }
  async addMedia(input: { contact_id: string; mime: string; data: string }) {
    const d = await this.load()
    const m: Media = { id: randomUUID(), created_at: now(), ...input }
    d.media.push(m)
    await this.save(d)
    return m
  }
  async getMedia(id: string) { return (await this.load()).media.find(m => m.id === id) ?? null }
  async listConsultas() {
    return [...(await this.load()).consultas].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }
  async getConsulta(id: string) { return (await this.load()).consultas.find(c => c.id === id) ?? null }
  async getConsultaActiva(vendedorId: string) {
    const propias = (await this.load()).consultas.filter(c => c.vendedor_id === vendedorId)
    return propias.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  }
  async createConsulta(vendedorId: string) {
    const d = await this.load()
    const c = emptyConsulta(vendedorId)
    d.consultas.push(c)
    await this.save(d)
    return c
  }
  async updateConsulta(id: string, patch: Partial<Consulta>) {
    const d = await this.load()
    const i = d.consultas.findIndex(c => c.id === id)
    if (i < 0) throw new Error(`consulta ${id} no existe`)
    d.consultas[i] = { ...d.consultas[i], ...patch, updated_at: now() }
    await this.save(d)
    return d.consultas[i]
  }
  async deleteContact(id: string) {
    const d = await this.load()
    d.contacts = d.contacts.filter(c => c.id !== id)
    d.messages = d.messages.filter(m => m.contact_id !== id)
    d.media = d.media.filter(m => m.contact_id !== id)
    d.consultas = d.consultas.filter(c => c.vendedor_id !== id)
    await this.save(d)
  }
  async deleteConsulta(id: string) {
    const d = await this.load()
    d.consultas = d.consultas.filter(c => c.id !== id)
    await this.save(d)
  }
  async reset() { await this.save(vacio()) }
}

/** Store en memoria: sin I/O, aislado por instancia. Lo usan los tests y los evals. */
export class MemoryStore extends JsonStore {
  private data = vacio()
  protected async load() { return this.data }
  protected async save(d: FileData) { this.data = d }
}

class FileStore extends JsonStore {
  // En Vercel el filesystem del proyecto es de solo lectura: se usa /tmp (efímero). Para la demo real va Supabase.
  private file = process.env.VERCEL ? '/tmp/demo-creditos-store.json' : path.join(process.cwd(), 'data', 'store.json')

  /** Se relee siempre: el seed y el servidor son procesos distintos sobre el mismo archivo. */
  protected async load(): Promise<FileData> {
    try {
      return { ...vacio(), ...(JSON.parse(await fs.readFile(this.file, 'utf8')) as Partial<FileData>) }
    } catch {
      return vacio()
    }
  }
  protected async save(d: FileData) {
    await fs.mkdir(path.dirname(this.file), { recursive: true })
    await fs.writeFile(this.file, JSON.stringify(d, null, 2))
  }
}

/* ───────────────────────── Supabase ───────────────────────── */

class SupabaseStore implements Store {
  constructor(private sb: SupabaseClient) {}

  async listContacts() {
    const { data, error } = await this.sb.from('contacts').select('*').order('last_message_at', { ascending: false, nullsFirst: false })
    if (error) throw error
    return (data ?? []) as Contact[]
  }
  async getContact(id: string) {
    const { data } = await this.sb.from('contacts').select('*').eq('id', id).maybeSingle()
    return (data as Contact | null) ?? null
  }
  async getContactByPhone(phone: string) {
    const { data } = await this.sb.from('contacts').select('*').eq('phone', phone).maybeSingle()
    return (data as Contact | null) ?? null
  }
  async createContact(phone: string, name?: string | null, tipo: TipoContacto = 'cliente', sucursal: string | null = null) {
    const { data, error } = await this.sb.from('contacts').insert({ phone, name: name ?? null, tipo, sucursal, datos: {} }).select('*').single()
    if (error) throw error
    return data as Contact
  }
  async updateContact(id: string, patch: Partial<Contact>) {
    const { data, error } = await this.sb.from('contacts').update({ ...patch, updated_at: now() }).eq('id', id).select('*').single()
    if (error) throw error
    return data as Contact
  }
  async listMessages(contactId: string) {
    const { data, error } = await this.sb.from('messages').select('*').eq('contact_id', contactId).order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as Message[]
  }
  async addMessage(input: NuevoMensaje) {
    const { data, error } = await this.sb.from('messages').insert({ kind: 'text', wa_id: null, media_id: null, ...input }).select('*').single()
    if (error) throw error
    await this.sb.from('contacts').update({ last_message_at: (data as Message).created_at }).eq('id', input.contact_id)
    return data as Message
  }
  async hasWaMessage(waId: string) {
    const { count } = await this.sb.from('messages').select('id', { count: 'exact', head: true }).eq('wa_id', waId)
    return (count ?? 0) > 0
  }
  async addMedia(input: { contact_id: string; mime: string; data: string }) {
    const { data, error } = await this.sb.from('media').insert(input).select('*').single()
    if (error) throw error
    return data as Media
  }
  async getMedia(id: string) {
    const { data } = await this.sb.from('media').select('*').eq('id', id).maybeSingle()
    return (data as Media | null) ?? null
  }
  async listConsultas() {
    const { data, error } = await this.sb.from('consultas').select('*').order('updated_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Consulta[]
  }
  async getConsulta(id: string) {
    const { data } = await this.sb.from('consultas').select('*').eq('id', id).maybeSingle()
    return (data as Consulta | null) ?? null
  }
  async getConsultaActiva(vendedorId: string) {
    const { data } = await this.sb.from('consultas').select('*').eq('vendedor_id', vendedorId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    return (data as Consulta | null) ?? null
  }
  async createConsulta(vendedorId: string) {
    const { data, error } = await this.sb.from('consultas').insert({ vendedor_id: vendedorId, fotos: [] }).select('*').single()
    if (error) throw error
    return data as Consulta
  }
  async updateConsulta(id: string, patch: Partial<Consulta>) {
    const { data, error } = await this.sb.from('consultas').update({ ...patch, updated_at: now() }).eq('id', id).select('*').single()
    if (error) throw error
    return data as Consulta
  }
  async deleteContact(id: string) {
    // messages, media y consultas caen en cascada por la FK
    const { error } = await this.sb.from('contacts').delete().eq('id', id)
    if (error) throw error
  }
  async deleteConsulta(id: string) {
    const { error } = await this.sb.from('consultas').delete().eq('id', id)
    if (error) throw error
  }
  async reset() {
    const todo = '00000000-0000-0000-0000-000000000000'
    await this.sb.from('consultas').delete().neq('id', todo)
    await this.sb.from('messages').delete().neq('id', todo)
    await this.sb.from('media').delete().neq('id', todo)
    await this.sb.from('contacts').delete().neq('id', todo)
  }
}

/* ───────────────────────── Selección ───────────────────────── */

let store: Store | null = null

export function db(): Store {
  if (store) return store
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  store = url && key
    ? new SupabaseStore(createClient(url, key, { auth: { persistSession: false } }))
    : new FileStore()
  return store
}

export function storeKind(): 'supabase' | 'archivo' {
  return process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'archivo'
}

export type { Contact, Message, Datos, Etapa, Media, Consulta }
