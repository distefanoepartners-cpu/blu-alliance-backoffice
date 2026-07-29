// app/api/ns3000/bookings/route.ts
// Proxya le chiamate booking verso NS3000 /api/external/bookings

import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

const NS3000_API_URL = process.env.NS3000_API_URL
const NS3000_API_KEY = process.env.NS3000_API_KEY

// ─────────────────────────────────────────────
// GET - recupera prenotazioni NS3000 (per sync disponibilità)
// ─────────────────────────────────────────────
export async function GET(request: Request) {
  if (!NS3000_API_URL || !NS3000_API_KEY) {
    return NextResponse.json({ error: 'NS3000 non configurato' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const params = new URLSearchParams()
  searchParams.forEach((value, key) => params.set(key, value))

  try {
    const res = await fetch(
      `${NS3000_API_URL}/api/external/bookings?${params.toString()}`,
      {
        headers: { 'X-API-Key': NS3000_API_KEY },
        next: { revalidate: 0 }
      }
    )

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Errore NS3000' }))
      return NextResponse.json(error, { status: res.status })
    }

    const data = await res.json()

    // ⭐ 2026-05-11 — Mappa join customers ai campi flat attesi dal frontend
    if (data.bookings) {
      data.bookings = data.bookings.map((b: any) => ({
        ...b,
        customer_name: b.customers?.first_name || '',
        customer_surname: b.customers?.last_name || '',
        customer_email: b.customers?.email || '',
        customer_phone: b.customers?.phone || '',
      }))
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Errore GET NS3000 bookings:', error)
    return NextResponse.json({ error: 'Errore connessione NS3000' }, { status: 502 })
  }
}

// ─────────────────────────────────────────────
// POST - crea prenotazione su NS3000 da BA
// ─────────────────────────────────────────────
export async function POST(request: Request) {
  if (!NS3000_API_URL || !NS3000_API_KEY) {
    return NextResponse.json({ error: 'NS3000 non configurato' }, { status: 503 })
  }

  try {
    const body = await request.json()

    // ⭐ Normalizza booking_type: il BookingModal BA può inviare 'collettivo' (IT)
    // dal ramo NS3000 diretto o 'collective' (EN) dagli altri rami. Uniformiamo qui.
    const isCollective =
      body.booking_type === 'collective' ||
      body.booking_type === 'collettivo' ||
      body.service_type === 'collective' ||
      body.service_type === 'collettivo'

    // ⭐ Validazione prezzo lato BA prima di inviare a NS3000
    const finalPrice = parseFloat(body.price) || parseFloat(body.final_price) || 0
    if (finalPrice <= 0) {
      console.warn('[BA→NS3000] Prezzo mancante o zero nel payload:', body)
    }

    // ⭐ Genera codice BA locale (usato come external_ref in NS3000)
    const baBookingCode =
      body.external_ref ||
      body.codice_prenotazione ||
      `BA${Date.now().toString(36).toUpperCase()}`

    // ⭐ Estrazione campi pagamento (BA naming → NS3000 naming)
    const depositAmount = parseFloat(body.caparra_ricevuta) || 0
    const balanceAmount = parseFloat(body.saldo_ricevuto) || 0

    // Payload verso NS3000
    const ns3000Payload = {
      // Barca e data
      boat_id: body.boat_id,
      service_id: body.service_id || null,
      booking_date: body.booking_date,
      booking_end_date: body.booking_end_date || body.booking_date,
      time_slot: body.time_slot || 'full_day',

      // Cliente
      customer_name: body.customer_name,
      customer_surname: body.customer_surname,
      customer_email: body.customer_email,
      customer_phone: body.customer_phone || '',

      // ⭐ 2026-05-14 — Documento cliente (mappato da BA)
      document_type: body.tipo_documento || body.document_type || null,
      document_number: body.numero_documento || body.document_number || null,
      document_expiry: body.scadenza_documento || body.document_expiry || null,
      has_license: body.patente_nautica ? true : false,
      license_number: body.patente_nautica || body.license_number || null,
      license_expiry: body.scadenza_patente_nautica || body.license_expiry || null,

      // Servizio
      num_passengers: body.num_passengers,
      service_type: body.booking_type === 'collective' ? 'collective' : 'charter',
      booking_type: body.booking_type || 'tour',

      // Prezzi
      price: finalPrice,
      base_price: finalPrice,
      final_price: finalPrice,

      // Pagamenti
      deposit_amount: depositAmount,
      balance_amount: balanceAmount,
      caution_amount: parseFloat(body.caution_amount) || 0,

      // Riferimento BA
      external_ref: baBookingCode,
      external_id: body.external_id || null,

      // ⭐ 2026-05-14 — Canale operativo: BA come "fornitori blualliance"
      booking_source: 'blualliance',
      source: 'blualliance',

      // ⭐ 2026-05-14 — Tracciamento operatore (created_by lato NS3000)
      created_by_name: body.created_by_name || 'Blu Alliance',

      // Orari imbarco/sbarco
      boarding_port: body.porto_imbarco || body.boarding_port || null,
      disembark_port: body.porto_imbarco || body.disembark_port || null,
      lang: body.lingua || body.lang || 'it',

      // Note
      notes: body.notes || null,
      internal_notes: body.internal_notes || null,
    }

    // Invia a NS3000
    const res = await fetch(
      `${NS3000_API_URL}/api/external/bookings`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': NS3000_API_KEY,
        },
        body: JSON.stringify(ns3000Payload),
      }
    )

    const ns3000Result = await res.json()

    if (!res.ok) {
      console.error('[BA→NS3000] Errore creazione booking:', ns3000Result)
      return NextResponse.json(
        { error: ns3000Result.error || 'Errore NS3000', message: ns3000Result.message },
        { status: res.status }
      )
    }

    // ⭐ Salva la prenotazione anche nel DB BA (tabella prenotazioni)
    // Se il chiamante ha già un imbarcazione_id BA, la prenotazione locale è già stata creata
    // Qui creiamo il record locale solo se non esiste (body.skip_local !== true)
    let localBooking = null
    if (!body.skip_local && body.ba_imbarcazione_id) {
      const codice = baBookingCode.startsWith('BA') ? baBookingCode : `BA-${baBookingCode}`

      // Cerca o crea cliente BA (fallback se cliente_id non passato)
      let clienteId: string | null = body.cliente_id || null
      if (!clienteId && body.customer_email) {
        const { data: cl } = await supabase
          .from('clienti')
          .select('id')
          .eq('email', body.customer_email)
          .maybeSingle()
        if (cl) clienteId = cl.id
      }

      // Caparra dovuta con fallback al 30%
      const caparraDovuta =
        typeof body.caparra_dovuta === 'number'
          ? body.caparra_dovuta
          : finalPrice * 0.3

      const { data: prenData, error: prenError } = await supabase
        .from('prenotazioni')
        .insert({
          codice_prenotazione: codice,
          imbarcazione_id: body.ba_imbarcazione_id,
          cliente_id: clienteId,
          servizio_id: body.servizio_id || null,
          data_servizio: body.booking_date,
          ora_inizio: body.ora_inizio || null,
          numero_persone: body.num_passengers,
          prezzo_totale: finalPrice,
          stato: body.stato || 'confermata',
          tipo_tour: isCollective ? 'collettivo' : 'privato',
          metodo_pagamento: body.metodo_pagamento || 'altro',
          metodo_pagamento_caparra: body.metodo_pagamento_caparra || null,
          metodo_pagamento_saldo: body.metodo_pagamento_saldo || null,
          caparra_dovuta: caparraDovuta,
          caparra_ricevuta: depositAmount,
          saldo_ricevuto: balanceAmount,
          lingua: body.lingua || 'it',
          porto_imbarco: body.porto_imbarco || null,
          ora_imbarco: body.ora_imbarco || null,
          note_cliente: body.notes || null,
          note_interne: body.internal_notes || null,
          source: 'blualliance',
          // ⭐ Nave di provenienza (nave_nome popolato dal trigger trg_sync_nave_nome)
          nave_id: body.nave_id ?? null,
          // Riferimento incrociato con NS3000
          ns3000_booking_id: ns3000Result.booking?.id || null,
          ns3000_booking_number: ns3000Result.booking?.booking_number || null,
        })
        .select()
        .single()

      if (prenError) {
        console.error('[BA] Errore salvataggio prenotazione locale:', prenError)
      } else {
        localBooking = prenData
      }
    }

    return NextResponse.json({
      success: true,
      ns3000_booking: ns3000Result.booking,
      local_booking: localBooking,
      // Espone il codice BA per visualizzarlo nel toast
      ba_booking_code: baBookingCode,
    }, { status: 201 })

  } catch (error: any) {
    console.error('Errore POST NS3000 bookings:', error)
    return NextResponse.json({ error: 'Errore connessione NS3000', message: error.message }, { status: 502 })
  }
}