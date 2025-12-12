import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('📧 [send-confirmation] Request received:', body)
    
    const { prenotazioneId, lingua, tipo } = body

    if (!prenotazioneId) {
      console.log('❌ [send-confirmation] Missing prenotazioneId')
      return NextResponse.json(
        { error: 'ID prenotazione mancante' },
        { status: 400 }
      )
    }

    console.log('🔍 [send-confirmation] Loading booking:', prenotazioneId)
    
    // Carica dati prenotazione completi
    const { data: prenotazione, error: prenotazioneError } = await supabase
      .from('prenotazioni')
      .select(`
        *,
        clienti(nome, cognome, email, telefono),
        servizi(nome, descrizione, tipo),
        imbarcazioni(nome, tipo, categoria, fornitore_id, fornitori(ragione_sociale, email, telefono))
      `)
      .eq('id', prenotazioneId)
      .single()

    if (prenotazioneError || !prenotazione) {
      console.log('❌ [send-confirmation] Booking not found:', prenotazioneError)
      return NextResponse.json(
        { error: 'Prenotazione non trovata' },
        { status: 404 }
      )
    }

    console.log('✅ [send-confirmation] Booking loaded:', prenotazione.codice_prenotazione)
    console.log('📧 [send-confirmation] Sending to:', prenotazione.clienti.email)

    // Prepara contenuto email in base alla lingua
    const emailContent = generateEmailContent(prenotazione, lingua || 'it', tipo || 'conferma')

    console.log('📝 [send-confirmation] Email content generated')
    console.log('📮 [send-confirmation] Subject:', emailContent.subject)

    // Invia email usando Resend
    const emailSent = await sendEmail({
      to: prenotazione.clienti.email,
      subject: emailContent.subject,
      html: emailContent.html
    })

    if (!emailSent) {
      console.log('❌ [send-confirmation] Email sending failed')
      throw new Error('Errore invio email')
    }

    console.log('✅ [send-confirmation] Email sent successfully!')

    return NextResponse.json({ 
      success: true,
      message: 'Email inviata con successo'
    })

  } catch (error: any) {
    console.error('❌ [send-confirmation] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Errore interno' },
      { status: 500 }
    )
  }
}

function generateEmailContent(prenotazione: any, lingua: string, tipo: string) {
  const translations: any = {
    it: {
      subject: `Conferma Prenotazione - ${prenotazione.codice_prenotazione}`,
      greeting: `Gentile ${prenotazione.clienti.nome} ${prenotazione.clienti.cognome},`,
      confirmation: 'La tua prenotazione è stata confermata!',
      details: 'Dettagli Prenotazione:',
      bookingCode: 'Codice Prenotazione',
      date: 'Data',
      time: 'Ora',
      service: 'Servizio',
      boat: 'Imbarcazione',
      people: 'Numero Persone',
      totalPrice: 'Importo Totale',
      deposit: 'Caparra',
      balance: 'Saldo',
      meetingPoint: 'Punto di Imbarco',
      thanks: 'Grazie per aver scelto Blu Alliance!'
    },
    en: {
      subject: `Booking Confirmation - ${prenotazione.codice_prenotazione}`,
      greeting: `Dear ${prenotazione.clienti.nome} ${prenotazione.clienti.cognome},`,
      confirmation: 'Your booking has been confirmed!',
      details: 'Booking Details:',
      bookingCode: 'Booking Code',
      date: 'Date',
      time: 'Time',
      service: 'Service',
      boat: 'Boat',
      people: 'Number of People',
      totalPrice: 'Total Price',
      deposit: 'Deposit',
      balance: 'Balance',
      meetingPoint: 'Meeting Point',
      thanks: 'Thank you for choosing Blu Alliance!'
    },
    fr: {
      subject: `Confirmation de Réservation - ${prenotazione.codice_prenotazione}`,
      greeting: `Cher ${prenotazione.clienti.nome} ${prenotazione.clienti.cognome},`,
      confirmation: 'Votre réservation a été confirmée!',
      details: 'Détails de la Réservation:',
      bookingCode: 'Code de Réservation',
      date: 'Date',
      time: 'Heure',
      service: 'Service',
      boat: 'Bateau',
      people: 'Nombre de Personnes',
      totalPrice: 'Prix Total',
      deposit: 'Acompte',
      balance: 'Solde',
      meetingPoint: 'Point d\'Embarquement',
      thanks: 'Merci d\'avoir choisi Blu Alliance!'
    },
    de: {
      subject: `Buchungsbestätigung - ${prenotazione.codice_prenotazione}`,
      greeting: `Sehr geehrte/r ${prenotazione.clienti.nome} ${prenotazione.clienti.cognome},`,
      confirmation: 'Ihre Buchung wurde bestätigt!',
      details: 'Buchungsdetails:',
      bookingCode: 'Buchungscode',
      date: 'Datum',
      time: 'Uhrzeit',
      service: 'Service',
      boat: 'Boot',
      people: 'Anzahl Personen',
      totalPrice: 'Gesamtpreis',
      deposit: 'Anzahlung',
      balance: 'Restbetrag',
      meetingPoint: 'Treffpunkt',
      thanks: 'Vielen Dank, dass Sie Blu Alliance gewählt haben!'
    },
    es: {
      subject: `Confirmación de Reserva - ${prenotazione.codice_prenotazione}`,
      greeting: `Estimado/a ${prenotazione.clienti.nome} ${prenotazione.clienti.cognome},`,
      confirmation: '¡Su reserva ha sido confirmada!',
      details: 'Detalles de la Reserva:',
      bookingCode: 'Código de Reserva',
      date: 'Fecha',
      time: 'Hora',
      service: 'Servicio',
      boat: 'Embarcación',
      people: 'Número de Personas',
      totalPrice: 'Precio Total',
      deposit: 'Depósito',
      balance: 'Saldo',
      meetingPoint: 'Punto de Embarque',
      thanks: '¡Gracias por elegir Blu Alliance!'
    }
  }

  const t = translations[lingua] || translations.it

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
        .detail-label { font-weight: 600; color: #6b7280; }
        .detail-value { color: #111827; }
        .highlight { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        .footer { background: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-radius: 0 0 10px 10px; }
        .price { font-size: 24px; font-weight: 700; color: #1E40AF; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">Blu Alliance</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">${t.confirmation}</p>
        </div>
        
        <div class="content">
          <p>${t.greeting}</p>
          <p>${t.confirmation}</p>
          
          <h2>${t.details}</h2>
          
          <div class="detail-row">
            <span class="detail-label">${t.bookingCode}:</span>
            <span class="detail-value"><strong>${prenotazione.codice_prenotazione}</strong></span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">${t.date}:</span>
            <span class="detail-value">${new Date(prenotazione.data_servizio).toLocaleDateString(lingua)}</span>
          </div>
          
          ${prenotazione.ora_inizio ? `
          <div class="detail-row">
            <span class="detail-label">${t.time}:</span>
            <span class="detail-value">${prenotazione.ora_inizio}</span>
          </div>
          ` : ''}
          
          <div class="detail-row">
            <span class="detail-label">${t.service}:</span>
            <span class="detail-value">${prenotazione.servizi.nome}</span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">${t.boat}:</span>
            <span class="detail-value">${prenotazione.imbarcazioni.nome}</span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">${t.people}:</span>
            <span class="detail-value">${prenotazione.numero_persone || '-'}</span>
          </div>
          
          ${prenotazione.luogo_imbarco ? `
          <div class="detail-row">
            <span class="detail-label">${t.meetingPoint}:</span>
            <span class="detail-value">${prenotazione.luogo_imbarco}</span>
          </div>
          ` : ''}
          
          <div class="highlight">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 600;">${t.totalPrice}:</span>
              <span class="price">€${prenotazione.prezzo_totale?.toLocaleString(lingua)}</span>
            </div>
            ${prenotazione.caparra_dovuta > 0 ? `
            <div style="margin-top: 10px; font-size: 14px; color: #6b7280;">
              ${t.deposit}: €${prenotazione.caparra_dovuta?.toLocaleString(lingua)}<br>
              ${t.balance}: €${(prenotazione.prezzo_totale - prenotazione.caparra_ricevuta)?.toLocaleString(lingua)}
            </div>
            ` : ''}
          </div>
          
          ${prenotazione.note_cliente ? `
          <div style="background: #eff6ff; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <strong>Note:</strong><br>
            ${prenotazione.note_cliente}
          </div>
          ` : ''}
          
          <p style="margin-top: 30px;">${t.thanks}</p>
        </div>
        
        <div class="footer">
          <p style="margin: 0;">Blu Alliance - Turismo Nautico</p>
          <p style="margin: 5px 0;">Porto di Salerno, Italia</p>
          <p style="margin: 5px 0;">info@blualliancegroup.com</p>
        </div>
      </div>
    </body>
    </html>
  `

  return {
    subject: t.subject,
    html
  }
}

async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  try {
    console.log('📮 [sendEmail] Initializing Resend...')
    console.log('📮 [sendEmail] API Key present:', !!process.env.RESEND_API_KEY)
    
    const resend = new Resend(process.env.RESEND_API_KEY)
    
    console.log('📮 [sendEmail] Sending email to:', to)
    
    const result = await resend.emails.send({
      from: 'Blu Alliance <noreply@blualliancegroup.com>',
      to,
      subject,
      html
    })
    
    console.log('✅ [sendEmail] Email sent successfully!')
    console.log('✅ [sendEmail] Resend response:', result)
    
    return true
  } catch (error) {
    console.error('❌ [sendEmail] Error:', error)
    return false
  }
}