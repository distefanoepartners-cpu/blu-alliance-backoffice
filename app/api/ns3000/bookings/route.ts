import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const NS3000_API_URL = process.env.NS3000_API_URL
const NS3000_API_KEY = process.env.NS3000_API_KEY

// Supabase Blu Alliance (per salvare copia locale)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ============================================
// GET - Lista prenotazioni NS3000
// ============================================
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
        cache: 'no-store'
      }
    )

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Errore NS3000' }))
      return NextResponse.json(error, { status: res.status })
    }

    return NextResponse.json(await res.json())

  } catch (error: any) {
    console.error('Errore GET bookings NS3000:', error)
    return NextResponse.json({ error: 'Errore connessione NS3000' }, { status: 502 })
  }
}

// ============================================
// POST - Crea prenotazione su NS3000 + salva copia locale
// ============================================
export async function POST(request: Request) {
  if (!NS3000_API_URL || !NS3000_API_KEY) {
    return NextResponse.json({ error: 'NS3000 non configurato' }, { status: 503 })
  }

  try {
    const body = await request.json()

    // 1. Salva prima in locale su Blu Alliance
    const codicePrenotazione = `BA${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`

    // Sanitizza UUID — valori vuoti o non-UUID vanno a null
    const isValidUuid = (v: any) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
    const safeUuid = (v: any) => isValidUuid(v) ? v : null

    console.log('📦 [ns3000/bookings] body ricevuto:', JSON.stringify({
      boat_id: body.boat_id,
      cliente_id: body.cliente_id,
      servizio_id: body.servizio_id,
      booking_date: body.booking_date,
      num_passengers: body.num_passengers,
      price: body.price
    }))

    const localBooking: any = {
      codice_prenotazione: codicePrenotazione,
      cliente_id: safeUuid(body.cliente_id),
      servizio_id: safeUuid(body.servizio_id),
      imbarcazione_id: null, // Barca NS3000, non locale
      data_servizio: body.booking_date,
      ora_inizio: body.ora_inizio || null,
      numero_persone: body.num_passengers,
      prezzo_totale: body.price || 0,
      stato: 'confermata',
      metodo_pagamento: body.metodo_pagamento || 'contanti',
      note_interne: body.notes || null,
      lingua: body.lingua || 'it',
      // ⭐ Campi NS3000
      source: 'ns3000',
      ns3000_boat_id: String(body.boat_id),
      ns3000_boat_name: body.boat_name || null,
      sync_status: 'pending'
    }

    console.log('💾 [INSERT] localBooking:', JSON.stringify(localBooking))
    const { data: localData, error: localError } = await supabase
      .from('prenotazioni')
      .insert([localBooking])
      .select()
      .single()

    if (localError) {
      console.error('Errore salvataggio locale:', localError)
      throw localError
    }

    // 2. Crea su NS3000
    const ns3000Payload = {
      boat_id: body.boat_id,
      booking_date: body.booking_date,
      time_slot: body.time_slot || 'full_day',
      customer_name: body.customer_name,
      customer_surname: body.customer_surname,
      customer_email: body.customer_email,
      customer_phone: body.customer_phone || null,
      num_passengers: body.num_passengers,
      price: body.price || 0,
      notes: body.notes || null,
      // Riferimento a Blu Alliance
      external_id: localData.id,
      external_ref: codicePrenotazione
    }

    const res = await fetch(
      `${NS3000_API_URL}/api/external/bookings`,
      {
        method: 'POST',
        headers: {
          'X-API-Key': NS3000_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ns3000Payload)
      }
    )

    const ns3000Response = await res.json()
    console.log('🌐 [NS3000 response] status:', res.status, '| body:', JSON.stringify(ns3000Response))

    if (!res.ok) {
      // NS3000 ha rifiutato — aggiorna locale con errore
      await supabase
        .from('prenotazioni')
        .update({
          sync_status: 'error',
          note_interne: `Errore sync NS3000: ${ns3000Response.message || 'Errore sconosciuto'}`
        })
        .eq('id', localData.id)

      return NextResponse.json(
        { error: ns3000Response.error, message: ns3000Response.message, local_id: localData.id },
        { status: res.status }
      )
    }

    // 3. Aggiorna record locale con riferimento NS3000
    const booking = ns3000Response.booking || {}
    const updatePayload = {
      ns3000_booking_id: booking.id != null ? String(booking.id) : null,
      ns3000_booking_number: booking.booking_number != null ? String(booking.booking_number) : null,
      ns3000_boat_name: booking.boat_name || null,
      sync_status: 'synced',
      last_synced_at: new Date().toISOString()
    }
    console.log('🔄 [UPDATE] NS3000 response booking:', JSON.stringify(booking))
    console.log('🔄 [UPDATE] payload:', JSON.stringify(updatePayload))
    const { error: updateError } = await supabase
      .from('prenotazioni')
      .update(updatePayload)
      .eq('id', localData.id)

    if (updateError) {
      console.error('Errore aggiornamento sync locale:', updateError)
    }

    console.log(`✅ Prenotazione sincronizzata: BA=${codicePrenotazione} ↔ NS3000=${ns3000Response.booking.booking_number}`)

    return NextResponse.json({
      success: true,
      local_booking: {
        id: localData.id,
        codice: codicePrenotazione
      },
      ns3000_booking: ns3000Response.booking
    }, { status: 201 })

  } catch (error: any) {
    console.error('Errore POST booking NS3000:', error)
    return NextResponse.json(
      { error: 'Errore creazione prenotazione', message: error.message },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE - Cancella prenotazione su NS3000 + locale
// ============================================
export async function DELETE(request: Request) {
  if (!NS3000_API_URL || !NS3000_API_KEY) {
    return NextResponse.json({ error: 'NS3000 non configurato' }, { status: 503 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const ns3000Id = searchParams.get('ns3000_id')
    const localId = searchParams.get('local_id')

    if (!ns3000Id) {
      return NextResponse.json({ error: 'ns3000_id richiesto' }, { status: 400 })
    }

    // 1. Cancella su NS3000
    const res = await fetch(
      `${NS3000_API_URL}/api/external/bookings/${ns3000Id}`,
      {
        method: 'DELETE',
        headers: { 'X-API-Key': NS3000_API_KEY }
      }
    )

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Errore cancellazione NS3000' }))
      return NextResponse.json(error, { status: res.status })
    }

    // 2. Aggiorna locale (segna come cancellata)
    if (localId) {
      await supabase
        .from('prenotazioni')
        .update({
          stato: 'cancellata',
          sync_status: 'synced',
          last_synced_at: new Date().toISOString()
        })
        .eq('id', localId)
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Errore DELETE booking NS3000:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}