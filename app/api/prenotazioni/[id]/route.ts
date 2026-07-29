// app/api/prenotazioni/[id]/route.ts
// GET/PUT/DELETE singola prenotazione (Next.js 16 compatible) + auth check
// TODO: per operatore, verificare che la prenotazione appartenga al suo fornitore_id
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth-server'

// ────────────────────────────────────────────────
// GET /api/prenotazioni/[id]
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
      .from('prenotazioni')
      .select(`
        *,
        clienti(id, nome, cognome, email, telefono, nazione,
                tipo_documento, numero_documento, scadenza_documento,
                patente_nautica, scadenza_patente_nautica),
        servizi(id, nome, tipo),
        imbarcazioni(id, nome, tipo, categoria)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'Prenotazione non trovata' }, { status: 404 })
    }

    return NextResponse.json({ prenotazione: data })
  } catch (error: any) {
    console.error('GET /api/prenotazioni/[id] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ────────────────────────────────────────────────
// PUT /api/prenotazioni/[id] - aggiorna prenotazione
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

    // Whitelist campi modificabili (NO id, codice_prenotazione, created_at)
    const updateData: any = {}
    if (body.cliente_id !== undefined) updateData.cliente_id = body.cliente_id || null
    if (body.servizio_id !== undefined) updateData.servizio_id = body.servizio_id || null
    if (body.imbarcazione_id !== undefined) updateData.imbarcazione_id = body.imbarcazione_id || null
    if (body.barca_esterna_nome !== undefined) updateData.barca_esterna_nome = body.barca_esterna_nome || null
    if (body.fornitore_id !== undefined) updateData.fornitore_id = body.fornitore_id || null
    if (body.percentuale_commissione_override !== undefined) updateData.percentuale_commissione_override = body.percentuale_commissione_override ?? null
    if (body.data_servizio !== undefined) updateData.data_servizio = body.data_servizio
    if (body.ora_inizio !== undefined) updateData.ora_inizio = body.ora_inizio || null
    if (body.ora_imbarco !== undefined) updateData.ora_imbarco = body.ora_imbarco || null
    if (body.numero_persone !== undefined) updateData.numero_persone = body.numero_persone
    if (body.bambini_over_3 !== undefined) updateData.bambini_over_3 = body.bambini_over_3 || 0
    if (body.bambini_under_3 !== undefined) updateData.bambini_under_3 = body.bambini_under_3 || 0
    if (body.prezzo_totale !== undefined) updateData.prezzo_totale = body.prezzo_totale
    if (body.caparra_dovuta !== undefined) updateData.caparra_dovuta = body.caparra_dovuta
    if (body.caparra_ricevuta !== undefined) updateData.caparra_ricevuta = body.caparra_ricevuta
    if (body.saldo_ricevuto !== undefined) updateData.saldo_ricevuto = body.saldo_ricevuto
    if (body.stato !== undefined) updateData.stato = body.stato
    if (body.tipo_tour !== undefined) updateData.tipo_tour = body.tipo_tour
    if (body.metodo_pagamento !== undefined) updateData.metodo_pagamento = body.metodo_pagamento || null
    if (body.metodo_pagamento_caparra !== undefined) updateData.metodo_pagamento_caparra = body.metodo_pagamento_caparra || null
    if (body.metodo_pagamento_saldo !== undefined) updateData.metodo_pagamento_saldo = body.metodo_pagamento_saldo || null
    if (body.lingua !== undefined) updateData.lingua = body.lingua
    if (body.porto_imbarco !== undefined) updateData.porto_imbarco = body.porto_imbarco || null
    if (body.note_cliente !== undefined) updateData.note_cliente = body.note_cliente || null
    if (body.note_interne !== undefined) updateData.note_interne = body.note_interne || null
    if (body.source !== undefined) updateData.source = body.source
    if (body.sync_status !== undefined) updateData.sync_status = body.sync_status
    if (body.ns3000_booking_id !== undefined) updateData.ns3000_booking_id = body.ns3000_booking_id || null
    if (body.ns3000_booking_number !== undefined) updateData.ns3000_booking_number = body.ns3000_booking_number || null
    if (body.ns3000_boat_id !== undefined) updateData.ns3000_boat_id = body.ns3000_boat_id || null
    if (body.ns3000_boat_name !== undefined) updateData.ns3000_boat_name = body.ns3000_boat_name || null
    if (body.ref_affiliato !== undefined) updateData.ref_affiliato = body.ref_affiliato || null
    if (body.email_conferma_inviata !== undefined) updateData.email_conferma_inviata = body.email_conferma_inviata
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 })
    }

    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('prenotazioni')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) {
      // La riga non esiste (già eliminata o id inesistente): non è un errore server.
      // Ritorniamo 404 pulito così il frontend mostra un messaggio chiaro invece del 500.
      return NextResponse.json(
        { error: 'Prenotazione non trovata o già rimossa' },
        { status: 404 }
      )
    }

    return NextResponse.json({ prenotazione: data })
  } catch (error: any) {
    console.error('PUT /api/prenotazioni/[id] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ────────────────────────────────────────────────
// DELETE /api/prenotazioni/[id]
// ────────────────────────────────────────────────
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { id } = await params

    const { error } = await supabaseAdmin
      .from('prenotazioni')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('DELETE /api/prenotazioni/[id] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}