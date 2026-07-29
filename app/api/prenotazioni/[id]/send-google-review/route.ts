// app/api/prenotazioni/[id]/send-google-review/route.ts
//
// Invia richiesta recensione Google via WhatsApp al cliente di una prenotazione (Blu Alliance).
// Usa il template Twilio approvato tramite l'helper sendGoogleReviewWhatsApp (lib/whatsapp-service).
// Gate: solo prenotazioni con stato 'completata'.
// Tracking: aggiorna google_review_sent_at, send_count e operatore su `prenotazioni`.

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendGoogleReviewWhatsApp } from '@/lib/whatsapp-service'

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    let body: any = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    // Carica prenotazione + cliente
    const { data: prenotazione, error: fetchError } = await supabaseAdmin
      .from('prenotazioni')
      .select(`
        id,
        codice_prenotazione,
        stato,
        data_servizio,
        lingua,
        google_review_send_count,
        clienti ( id, nome, cognome, telefono, email, lingua_preferita )
      `)
      .eq('id', id)
      .single()

    if (fetchError || !prenotazione) {
      console.error('❌ [google-review] Prenotazione non trovata:', id, fetchError)
      return NextResponse.json(
        { error: 'Prenotazione non trovata' },
        { status: 404 }
      )
    }

    // Gate: solo prenotazioni completate
    if (prenotazione.stato !== 'completata') {
      return NextResponse.json(
        { error: 'La richiesta recensione è disponibile solo per prenotazioni completate' },
        { status: 400 }
      )
    }

    const cliente: any = Array.isArray(prenotazione.clienti)
      ? prenotazione.clienti[0]
      : prenotazione.clienti

    if (!cliente?.telefono) {
      return NextResponse.json(
        { error: 'Numero di telefono del cliente non disponibile' },
        { status: 400 }
      )
    }

    const customerName = `${cliente.nome || ''} ${cliente.cognome || ''}`.trim()
    // Lingua: prima quella della prenotazione, poi quella preferita del cliente, fallback IT
    const lang = prenotazione.lingua || cliente.lingua_preferita || 'it'

    console.log('📤 [google-review] Invio:', {
      prenotazione: prenotazione.codice_prenotazione,
      telefono: cliente.telefono,
      lang,
    })

    const result = await sendGoogleReviewWhatsApp(cliente.telefono, {
      customer_name: customerName,
      booking_date: prenotazione.data_servizio,
      lang,
    })

    if (!result.success) {
      console.error('❌ [google-review] Twilio errore:', result.error)
      return NextResponse.json(
        { error: result.error || 'Errore invio WhatsApp' },
        { status: 502 }
      )
    }

    console.log('✅ [google-review] Inviato, SID:', result.messageId)

    // Tracking (non bloccante)
    const newCount = (prenotazione.google_review_send_count || 0) + 1
    const updatePayload: any = {
      google_review_sent_at: new Date().toISOString(),
      google_review_send_count: newCount,
    }
    if (body.user_id) updatePayload.google_review_sent_by = body.user_id
    if (body.user_name) updatePayload.google_review_sent_by_name = body.user_name

    const { error: updateError } = await supabaseAdmin
      .from('prenotazioni')
      .update(updatePayload)
      .eq('id', id)

    if (updateError) {
      console.warn('⚠️ [google-review] Errore tracking (non bloccante):', updateError)
    }

    return NextResponse.json({
      success: true,
      message: `⭐ Recensione richiesta a ${customerName}`,
      messageId: result.messageId,
      send_count: newCount,
    })
  } catch (error: any) {
    console.error('❌ [google-review] Errore generico:', error)
    return NextResponse.json(
      {
        error: error.message || 'Errore invio WhatsApp',
        twilio_code: error.code,
        twilio_more_info: error.moreInfo,
      },
      { status: 500 }
    )
  }
}