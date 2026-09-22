import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import type { Contact, Message, Datos, Direction, MessageKind } from './types'
import type { Etapa } from './negocio'

/**
 * Capa de datos con dos implementaciones:
 *  - Supabase cuando hay SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (producción).
 *  - Un JSON en data/store.json cuando no (desarrollo local sin configurar nada).
 * Ambas exponen la misma interfaz.
 */
export interface Store {
  listContacts(): Promise<Contact[]>
  getContact(id: string): Promise<Contact | null>
  getContactByPhone(phone: string): Promise<Contact | null>
  createContact(phone: string, name?: string | null): Promise<Contact>
  updateContact(id: string, patch: Partial<Omit<Contact, 'id' | 'phone' | 'created_at'>>): Promise<Contact>
  listMessages(contactId: string): Promise<Message[]>
  addMessage(input: { contact_id: string; direction: Direction; kind?: MessageKind; body: string; wa_id?: string | null }): Promise<Message>
  hasWaMessage(waId: string): Promise<boolean>
  reset(): Promise<void>
}

const now = () => new Date().toISOString()

const emptyContact = (phone: string, name?: string | null): Contact => ({
  id: randomUUID(),
  phone,
  name: name ?? null,
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

/* ───────────────────────── JSON local ───────────────────────── */

interface FileData { contacts: Contact[]; messages: Message[] }

class FileStore implements Store {
  // En Vercel el filesystem del proyecto es de solo lectura: se usa /tmp (efímero). Para la demo real va Supabase.
  private file = process.env.VERCEL ? '/tmp/demo-creditos-store.json' : path.join(process.cwd(), 'data', 'store.json')
  private cache: FileData | null = null

  /** Se relee siempre: el seed y el servidor son procesos distintos sobre el mismo archivo. */
  private async load(): Promise<FileData> {
    try {
      this.cache = JSON.parse(await fs.readFile(this.file, 'utf8')) as FileData
    } catch {
      this.cache = { contacts: [], messages: [] }
    }
    return this.cache
  }
  private async save() {
    await fs.mkdir(path.dirname(this.file), { recursive: true })
    await fs.writeFile(this.file, JSON.stringify(this.cache, null, 2))
  }

  async listContacts() {
    const d = await this.load()
    return [...d.contacts].sort((a, b) => (b.last_message_at ?? b.updated_at).localeCompare(a.last_message_at ?? a.updated_at))
  }
  async getContact(id: string) { return (await this.load()).contacts.find(c => c.id === id) ?? null }
  async getContactByPhone(phone: string) { return (await this.load()).contacts.find(c => c.phone === phone) ?? null }
  async createContact(phone: string, name?: string | null) {
    const d = await this.load()
    const c = emptyContact(phone, name)
    d.contacts.push(c)
    await this.save()
    return c
  }
  async updateContact(id: string, patch: Partial<Contact>) {
    const d = await this.load()
    const i = d.contacts.findIndex(c => c.id === id)
    if (i < 0) throw new Error(`contacto ${id} no existe`)
    d.contacts[i] = { ...d.contacts[i], ...patch, updated_at: now() }
    await this.save()
    return d.contacts[i]
  }
  async listMessages(contactId: string) {
    return (await this.load()).messages.filter(m => m.contact_id === contactId).sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  async addMessage(input: { contact_id: string; direction: Direction; kind?: MessageKind; body: string; wa_id?: string | null }) {
    const d = await this.load()
    const m: Message = { id: randomUUID(), kind: 'text', wa_id: null, created_at: now(), ...input }
    d.messages.push(m)
    const i = d.contacts.findIndex(c => c.id === input.contact_id)
    if (i >= 0) d.contacts[i] = { ...d.contacts[i], last_message_at: m.created_at }
    await this.save()
    return m
  }
  async hasWaMessage(waId: string) { return (await this.load()).messages.some(m => m.wa_id === waId) }
  async reset() { this.cache = { contacts: [], messages: [] }; await this.save() }
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
  async createContact(phone: string, name?: string | null) {
    const { data, error } = await this.sb.from('contacts').insert({ phone, name: name ?? null, datos: {} }).select('*').single()
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
  async addMessage(input: { contact_id: string; direction: Direction; kind?: MessageKind; body: string; wa_id?: string | null }) {
    const { data, error } = await this.sb.from('messages').insert({ kind: 'text', wa_id: null, ...input }).select('*').single()
    if (error) throw error
    await this.sb.from('contacts').update({ last_message_at: (data as Message).created_at }).eq('id', input.contact_id)
    return data as Message
  }
  async hasWaMessage(waId: string) {
    const { count } = await this.sb.from('messages').select('id', { count: 'exact', head: true }).eq('wa_id', waId)
    return (count ?? 0) > 0
  }
  async reset() {
    await this.sb.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await this.sb.from('contacts').delete().neq('id', '00000000-0000-0000-0000-000000000000')
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

export type { Contact, Message, Datos, Etapa }
