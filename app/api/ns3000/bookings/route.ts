// app/api/ns3000/bookings/route.ts
// Proxya le chiamate booking verso NS3000 /api/external/bookings

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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

    // ⭐ Validazione prezzo lato BA prima di inviare a NS3000
    const finalPrice = parseFloat(body.price) || parseFloat(body.final_price) || 0
    if (finalPrice <= 0) {
      console.warn('[BA→NS3000] Prezzo mancante o zero nel payload:', body)
    }

    // ⭐ Genera codice BA locale (usato come external_ref in NS3000)
    const baBookingCode = body.external_ref || `BA${Date.now().toString(36).toUpperCase()}`

    // Payload verso NS3000
    const ns3000Payload = {
      // Barca e data
      boat_id: body.boat_id,
      booking_date: body.booking_date,
      booking_end_date: body.booking_end_date || body.booking_date,
      time_slot: body.time_slot || 'full_day',

      // Cliente
      customer_name: body.customer_name,
      customer_surname: body.customer_surname,
      customer_email: body.customer_email,
      customer_phone: body.customer_phone || '',

      // Servizio
      num_passengers: body.num_passengers,
      service_type: body.booking_type === 'collective' ? 'collective' : 'charter',
      booking_type: body.booking_type || 'tour',

      // ⭐ Prezzo — campo 'price' è quello che NS3000 legge come final_price
      price: finalPrice,
      base_price: finalPrice,
      final_price: finalPrice,

      // ⭐ Riferimento BA per tracciabilità
      // external_ref viene salvato in NS3000 e appare come "codice BA"
      external_ref: baBookingCode,
      external_id: body.external_id || null,

      // Note
      notes: body.notes || null,
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

      // Cerca o crea cliente BA
      let clienteId: string | null = body.cliente_id || null
      if (!clienteId && body.customer_email) {
        const { data: cl } = await supabase
          .from('clienti')
          .select('id')
          .eq('email', body.customer_email)
          .single()
        if (cl) clienteId = cl.id
      }

      const { data: prenData, error: prenError } = await supabase
        .from('prenotazioni')
        .insert({
          codice_prenotazione: codice,
          imbarcazione_id: body.ba_imbarcazione_id,
          cliente_id: clienteId,
          data_servizio: body.booking_date,
          numero_persone: body.num_passengers,
          prezzo_totale: finalPrice,
          stato: 'confermata',
          tipo_tour: body.booking_type === 'collective' ? 'collettivo' : 'privato',
          metodo_pagamento: body.metodo_pagamento || 'altro',
          lingua: body.lingua || 'it',
          porto_imbarco: body.porto_imbarco || null,
          ora_imbarco: body.ora_imbarco || null,
          note_interne: body.notes || null,
          source: 'blualliance',
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