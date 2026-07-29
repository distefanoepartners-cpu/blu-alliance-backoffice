// app/api/prenotazioni/route.ts
// CRUD prenotazioni server-side con service_role (bypassa RLS) + auth check
// TODO: filtrare per fornitore_id quando l'utente è operatore
//       (in attesa di schema definitivo: prenotazioni.fornitore_id diretto
//        o via JOIN su imbarcazioni/servizi?)
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth-server'

// ────────────────────────────────────────────────
// GET /api/prenotazioni
// ────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const stato = searchParams.get('stato')
    const dataFrom = searchParams.get('data_from')
    const dataTo = searchParams.get('data_to')
    const clienteId = searchParams.get('cliente_id')
    const codice = searchParams.get('codice')
    const limit = parseInt(searchParams.get('limit') || '200')

    let query = supabaseAdmin
      .from('prenotazioni')
      .select(`
        *,
        clienti(id, nome, cognome, email, telefono, nazione,
                tipo_documento, numero_documento, scadenza_documento,
                patente_nautica, scadenza_patente_nautica),
        servizi(id, nome, tipo),
        imbarcazioni(id, nome, tipo, categoria, fornitore_id)
      `)
      .order('data_servizio', { ascending: false })
      .limit(limit)

    if (stato) query = query.eq('stato', stato)
    if (dataFrom) query = query.gte('data_servizio', dataFrom)
    if (dataTo) query = query.lte('data_servizio', dataTo)
    if (clienteId) query = query.eq('cliente_id', clienteId)
    if (codice) query = query.eq('codice_prenotazione', codice)

    // TODO operatore: applicare filtro fornitore_id qui

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ prenotazioni: data || [] })
  } catch (error: any) {
    console.error('GET /api/prenotazioni error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ────────────────────────────────────────────────
// POST /api/prenotazioni
// ────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()

    if (!body.codice_prenotazione?.trim()) {
      return NextResponse.json({ error: 'codice_prenotazione obbligatorio' }, { status: 400 })
    }
    if (!body.data_servizio) {
      return NextResponse.json({ error: 'data_servizio obbligatoria' }, { status: 400 })
    }
    if (!body.numero_persone || body.numero_persone < 1) {
      return NextResponse.json({ error: 'numero_persone deve essere ≥ 1' }, { status: 400 })
    }
    if (body.prezzo_totale === undefined || body.prezzo_totale === null) {
      return NextResponse.json({ error: 'prezzo_totale obbligatorio' }, { status: 400 })
    }

    const { data: existing } = await supabaseAdmin
      .from('prenotazioni')
      .select('id')
      .eq('codice_prenotazione', body.codice_prenotazione)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: `Codice ${body.codice_prenotazione} già esistente` },
        { status: 409 }
      )
    }

    const insertData: any = {
      codice_prenotazione: body.codice_prenotazione,
      cliente_id: body.cliente_id || null,
      servizio_id: body.servizio_id || null,
      imbarcazione_id: body.imbarcazione_id || null,
      barca_esterna_nome: body.barca_esterna_nome || null,
      fornitore_id: body.fornitore_id || null,
      percentuale_commissione_override: body.percentuale_commissione_override ?? null,
      data_servizio: body.data_servizio,
      ora_inizio: body.ora_inizio || null,
      ora_imbarco: body.ora_imbarco || null,
      numero_persone: body.numero_persone,
      bambini_over_3: body.bambini_over_3 || 0,
      bambini_under_3: body.bambini_under_3 || 0,
      prezzo_totale: body.prezzo_totale,
      caparra_dovuta: body.caparra_dovuta || (body.prezzo_totale * 0.3),
      caparra_ricevuta: body.caparra_ricevuta || 0,
      saldo_ricevuto: body.saldo_ricevuto || 0,
      stato: body.stato || 'in_attesa',
      tipo_tour: body.tipo_tour || 'privato',
      metodo_pagamento: body.metodo_pagamento || null,
      metodo_pagamento_caparra: body.metodo_pagamento_caparra || null,
      metodo_pagamento_saldo: body.metodo_pagamento_saldo || null,
      lingua: body.lingua || 'it',
      porto_imbarco: body.porto_imbarco || null,
      note_cliente: body.note_cliente || null,
      note_interne: body.note_interne || null,
      source: body.source || 'blualliance',
      sync_status: body.sync_status || 'local',
      ns3000_booking_id: body.ns3000_booking_id || null,
      ns3000_booking_number: body.ns3000_booking_number || null,
      ns3000_boat_id: body.ns3000_boat_id || null,
      ns3000_boat_name: body.ns3000_boat_name || null,
      ref_affiliato: body.ref_affiliato || null,
      nave_id: body.nave_id ?? null,
    }

    // TODO operatore: forzare fornitore_id = auth.fornitoreId

    const { data, error } = await supabaseAdmin
      .from('prenotazioni')
      .insert([insertData])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ prenotazione: data }, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/prenotazioni error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}