import { db } from '@/lib/db'

export const runtime = 'nodejs'

/** Sirve una foto guardada (recibida por WhatsApp o subida en el simulador). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const media = await db().getMedia(id)
  if (!media) return new Response('not found', { status: 404 })
  return new Response(Buffer.from(media.data, 'base64'), {
    headers: { 'Content-Type': media.mime, 'Cache-Control': 'private, max-age=3600' },
  })
}
