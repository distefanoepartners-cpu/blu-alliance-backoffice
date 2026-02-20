import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const NS3000_API_URL = process.env.NS3000_API_URL
const NS3000_API_KEY = process.env.NS3000_API_KEY
const CRON_SECRET = process.env.CRON_SECRET

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * POST /api/ns3000/sync
 * 
 * Sincronizza prenotazioni NS3000 → Blu Alliance
 * Importa SOLO indisponibilità barche (no dati cliente, no prezzi, no n° pax)
 * 
 * PROTEZIONE: Richiede autenticazione (CRON_SECRET o JWT Supabase)
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  
  const isCronJob = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`
  
  if (!isCronJob) {
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Autenticazione richiesta' },
        { status: 401 }
      )
    }
    
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    
    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Token non valido' },
        { status: 401 }
      )
    }
  }

  if (!NS3000_API_URL || !NS3000_API_KEY) {
    return NextResponse.json({ error: 'NS3000 non configurato' }, { status: 503 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    
    const today = new Date().toISOString().split('T')[0]
    const ninetyDaysLater = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const dateFrom = body.date_from || today
    const dateTo = body.date_to || ninetyDaysLater

    // 1. Recupera prenotazioni NS3000 (solo indisponibilità, no dati cliente)
    const res = await fetch(
      `${NS3000_API_URL}/api/external/bookings?date_from=${dateFrom}&date_to=${dateTo}`,
      {
        headers: { 'X-API-Key': NS3000_API_KEY },
        cache: 'no-store'
      }
    )

    if (!res.ok) {
      throw new Error(`NS3000 API error: ${res.status}`)
    }

    const ns3000Data = await res.json()
    const ns3000Bookings = ns3000Data.bookings || []

    // 2. Recupera prenotazioni già sincronizzate in locale
    const { data: localSynced } = await supabaseAdmin
      .from('prenotazioni')
      .select('id, ns3000_booking_id, updated_at')
      .not('ns3000_booking_id', 'is', null)

    const syncedMap = new Map(
      (localSynced || []).map(b => [b.ns3000_booking_id, b])
    )

    let created = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (const ns3000Booking of ns3000Bookings) {
      try {
        const existing = syncedMap.get(ns3000Booking.id)

        // ⭐ PRIVACY: Mappa solo dati indisponibilità, no dati cliente
        const mappedData = {
          codice_prenotazione: `NS-${ns3000Booking.booking_number}`,
          data_servizio: ns3000Booking.booking_date,
          ora_inizio: ns3000Booking.time_slot === 'morning' ? '09:00' :
                      ns3000Booking.time_slot === 'afternoon' ? '14:00' : '09:00',
          stato: mapStatus(ns3000Booking.booking_status_id),
          // ⭐ Nessun dato cliente: no nome, no email, no telefono, no n° pax
          // Campi sync
          source: ns3000Booking.source === 'blualliance' ? 'blualliance' : 'ns3000',
          ns3000_booking_id: ns3000Booking.id,
          ns3000_boat_id: ns3000Booking.boat_id,
          ns3000_boat_name: ns3000Booking.boats?.name || 'Barca NS3000',
          ns3000_booking_number: ns3000Booking.booking_number,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString()
        }

        if (existing) {
          const ns3000Updated = new Date(ns3000Booking.updated_at).getTime()
          const localUpdated = new Date(existing.updated_at).getTime()

          if (ns3000Updated > localUpdated) {
            await supabaseAdmin
              .from('prenotazioni')
              .update(mappedData)
              .eq('id', existing.id)
            updated++
          } else {
            skipped++
          }
        } else {
          // Se è una prenotazione creata da Blu Alliance, dovrebbe già esistere
          if (ns3000Booking.source === 'blualliance' && ns3000Booking.external_id) {
            const { data: byExternal } = await supabaseAdmin
              .from('prenotazioni')
              .select('id')
              .eq('id', ns3000Booking.external_id)
              .single()

            if (byExternal) {
              await supabaseAdmin
                .from('prenotazioni')
                .update({
                  ns3000_booking_id: ns3000Booking.id,
                  ns3000_booking_number: ns3000Booking.booking_number,
                  sync_status: 'synced',
                  last_synced_at: new Date().toISOString()
                })
                .eq('id', byExternal.id)
              updated++
              continue
            }
          }

          // ⭐ Nuova prenotazione NS3000 → crea in locale SENZA dati cliente
          await supabaseAdmin
            .from('prenotazioni')
            .insert([{
              ...mappedData,
              cliente_id: null,           // Nessun cliente associato
              numero_persone: null,       // Non trasmesso
              prezzo_totale: 0,           // Non trasmesso
              note_interne: 'Prenotazione NS3000 (solo indisponibilità)',
              metodo_pagamento: null
            }])

          created++
        }
      } catch (itemError: any) {
        errors.push(`Booking ${ns3000Booking.id}: ${itemError.message}`)
      }
    }

    console.log(`🔄 Sync NS3000 completata: ${created} create, ${updated} aggiornate, ${skipped} invariate, ${errors.length} errori`)

    return NextResponse.json({
      success: true,
      summary: {
        total_ns3000: ns3000Bookings.length,
        created,
        updated,
        skipped,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined,
      synced_at: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Errore sync NS3000:', error)
    return NextResponse.json(
      { error: 'Errore sincronizzazione', message: error.message },
      { status: 500 }
    )
  }
}

function mapStatus(statusId: string): string {
  const statusMap: Record<string, string> = {
    'ab4bad3b-2f9f-4a0b-a867-54f9f1efc470': 'confermata',
    '5051f7bd-c062-4e63-9e30-4336c37be226': 'in_attesa',
    'e7798e9d-fcea-4f91-9661-454e403e673e': 'completata',
    '79468a4e-b39e-456a-9ea0-0b4085ad662e': 'cancellata',
  }
  return statusMap[statusId] || 'in_attesa'
}