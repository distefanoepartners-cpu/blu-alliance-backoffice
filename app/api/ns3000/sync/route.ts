import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const NS3000_API_URL = process.env.NS3000_API_URL
const NS3000_API_KEY = process.env.NS3000_API_KEY
const CRON_SECRET = process.env.CRON_SECRET

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
// ⭐ 2026-05-11 — Mappa NS3000 boat_id → BA imbarcazione_id
// Deve corrispondere alle stesse mappe definite nei 3 file frontend BA:
//  - app/dashboard/disponibilita/page.tsx (ns3000ToBaMap)
//  - app/dashboard/collettivi/page.tsx (NS3000_TO_BA_MAP)
//  - components/BookingModal.tsx (BA_TO_NS3000_MAP, inverso)
// Espandi quando aggiungi nuove barche NS3000.
const NS3000_TO_BA_MAP: Record<string, string> = {
  '4a222a73-304b-4945-813b-9548ba201675': 'b743d220-6200-49de-9324-68297e4eee75',
  'd03cfe13-bcb6-4f98-bda4-a18b8bf7957d': '64e06e82-ed6e-4f23-b06e-14533a0187c6',
  '00ce8828-ebf9-4aad-8ad8-8f6b4e90a1e3': '7e854592-bb5d-4971-98aa-ae66c2fa66ba',
  '2edce19e-3687-42b9-bb87-57e2aabfccd2': 'b2a20895-eeab-493d-a2fb-53ef5ba1d220',
  '937298ab-2a15-4ace-adb2-b63dd1b865b1': '4c4f4b54-4ee6-481f-94f9-a142b5d651b0',
  '6800721d-a8e9-4217-b7a2-8548359c6cfc': '9a6cc58f-bb70-440e-92a1-d2e2c2712e5b',
  '42d4c904-f2e1-4436-931b-3e7b651bd7a6': '2f4f1a71-5037-4fb0-bbd1-ef6c6acf8dc5',
  '52a7e9d0-444e-4801-a095-afcbba7ceed5': 'b2c15f7e-ffb2-4afa-bf19-d53f8d26902b',
  '180dd752-b2b4-4318-beed-8bc15b3877c2': '557ecf08-2e88-4914-a1d9-da5ec5bf5845',
  '8c1b5b3d-d4a2-441c-8f8e-71b88ff6c966': '07673392-e08c-4d53-a128-e9d6c405917d',
  // ⭐ 2026-05-11 — Domar F8 mapping aggiornato (vecchia c35aefd0 è diventata Mito 45 su NS3000)
  '0e705ad6-bcaf-445f-b640-2c4b0a9166ff': '2d4995ec-35b3-4358-ace1-54621a9528ed', // 12 - Domar F8
  'c35aefd0-6721-4f01-aeec-2d47bdf9f24f': 'e27ce151-0cd0-444e-b5f9-040b09859377', // Mito 45 (ex Cab Dorado NS3000)
  'fe759df8-5d8e-401f-8fb2-dfaa3642c33c': '51231c4f-b929-466c-aed3-9440639e0bd7',
  'd5bff230-0e6a-4211-b0ce-342e8fbace51': '8d4d1bd6-142f-4d0f-8854-333742eeeba3',
  '1365d4d3-0ffb-48a8-a8a6-d3c49dd22145': 'a079598f-b25d-49d6-90ce-b25146687a31',
  '636cb5d4-1316-4382-90db-fa6c16deb1f4': '31d0ac07-57a9-472d-b07a-f9a26b2ba89e',
  '7b039929-1af2-46ab-9a91-f051497161e7': 'c8638c23-cd35-4c11-8333-4316f1ca4726',
  '02ffd51e-da3f-45fa-b2a5-92acc254e2a6': 'd8262b01-07d0-4795-ba31-e64c6eaf6f0f',
  '3b967967-d7de-48bb-9f03-5e779aa15a27': '43d0b751-da8d-4181-aabc-ba3b217142bc',
  'fa08fd1a-43af-4f4d-9f52-8eb0b5abf1ca': 'd37bd3b0-35a0-48be-81b9-9816686137b1',
}
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
      .select('id, ns3000_booking_id, updated_at, source')
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

       // ⭐ PRIVACY: Mappa solo dati indisponibilità + imbarcazione_id, no dati cliente
        const mappedData: any = {
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

        // ⭐ 2026-05-11 — Propaga imbarcazione_id quando la barca NS3000 è mappata su BA
        // Questo permette al sync di correggere mismatch dovuti a cambio barca su NS3000
        // (es. operatore NS3000 sposta la booking da Cayman 6 a Cayman 5 dopo creazione BA)
        const mappedImbarcazioneId = NS3000_TO_BA_MAP[ns3000Booking.boat_id]
        if (mappedImbarcazioneId) {
          mappedData.imbarcazione_id = mappedImbarcazioneId
        }

        if (existing) {
          const ns3000Updated = new Date(ns3000Booking.updated_at).getTime()
          const localUpdated = new Date(existing.updated_at).getTime()

          if (ns3000Updated > localUpdated) {
            // ⭐ 2026-06-24 — FIX stato che "torna in attesa":
            // Per le prenotazioni NATE su BA, lo stato è gestito a mano dagli
            // operatori BA e NON deve mai essere sovrascritto dal sync NS3000.
            // Rimuoviamo il campo `stato` dall'update così la modifica manuale
            // (es. "completata") resta stabile. Le prenotazioni nate su NS3000
            // continuano a ricevere lo stato dal sync normalmente.
            const updateData = { ...mappedData }
            if (existing.source === 'blualliance') {
              delete updateData.stato
            }

            await supabaseAdmin
              .from('prenotazioni')
              .update(updateData)
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
    '79468a4e-b39e-456a-9ea0-0b4085ad662e': 'da_recuperare',   // ex 'cancellata' — semantica chiarita
    '69db943f-96d3-4ae0-bb23-53c359e82433': 'annullata',       // ⭐ 2026-05-11 — nuovo status NS3000
  }
  return statusMap[statusId] || 'in_attesa'
}