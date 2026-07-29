// app/api/clienti/[id]/route.ts
// GET/PUT/DELETE singolo cliente (Next.js 16 compatible) + auth check
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth-server'

// ────────────────────────────────────────────────
// GET /api/clienti/[id]
// ────────────────────────────────────────────────
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const { data, error } = await supabaseAdmin
      .from('clienti')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 })
    }

    return NextResponse.json({ cliente: data })
  } catch (error: any) {
    console.error('GET /api/clienti/[id] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ────────────────────────────────────────────────
// PUT /api/clienti/[id] - aggiorna cliente
// ────────────────────────────────────────────────
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const body = await request.json()

    const updateData: any = {}
    if (body.nome !== undefined) updateData.nome = body.nome?.trim()
    if (body.cognome !== undefined) updateData.cognome = body.cognome?.trim()
    if (body.email !== undefined) updateData.email = body.email?.trim() || null
    if (body.telefono !== undefined) updateData.telefono = body.telefono?.trim() || null
    if (body.nazione !== undefined) updateData.nazione = body.nazione
    if (body.lingua_preferita !== undefined) updateData.lingua_preferita = body.lingua_preferita
    if (body.tipo_documento !== undefined) updateData.tipo_documento = body.tipo_documento || null
    if (body.numero_documento !== undefined) updateData.numero_documento = body.numero_documento || null
    if (body.scadenza_documento !== undefined) updateData.scadenza_documento = body.scadenza_documento || null
    if (body.patente_nautica !== undefined) updateData.patente_nautica = body.patente_nautica || null
    if (body.scadenza_patente_nautica !== undefined) updateData.scadenza_patente_nautica = body.scadenza_patente_nautica || null
    if (body.note !== undefined) updateData.note = body.note || null

    if (updateData.nome === '' || updateData.cognome === '') {
      return NextResponse.json(
        { error: 'Nome e cognome non possono essere vuoti' },
        { status: 400 }
      )
    }

    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('clienti')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 })
    }

    return NextResponse.json({ cliente: data })
  } catch (error: any) {
    console.error('PUT /api/clienti/[id] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ────────────────────────────────────────────────
// DELETE /api/clienti/[id]
// ────────────────────────────────────────────────
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { id } = await params

    const { data: prenotazioni, error: checkError } = await supabaseAdmin
      .from('prenotazioni')
      .select('id')
      .eq('cliente_id', id)
      .limit(1)

    if (checkError) throw checkError

    if (prenotazioni && prenotazioni.length > 0) {
      return NextResponse.json(
        { error: 'Impossibile eliminare: cliente ha prenotazioni associate' },
        { status: 409 }
      )
    }

    const { error } = await supabaseAdmin
      .from('clienti')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('DELETE /api/clienti/[id] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}