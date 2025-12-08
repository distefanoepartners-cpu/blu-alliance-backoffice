import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      email, 
      nomeCliente, 
      codicePrenotazione,
      nomeServizio,
      dataServizio,
      oraImbarco,
      luogoImbarco,
      numeroPax,
      prezzoTotale,
      accontoRicevuto,
      saldoRicevuto,
      lingua = 'it'
    } = body

    const daRicevere = prezzoTotale - accontoRicevuto - saldoRicevuto

    // Traduzioni
    const translations: any = {
      it: {
        subject: `Conferma Prenotazione ${codicePrenotazione} - Blu Alliance`,
        title: '🚢 Conferma Prenotazione',
        subtitle: 'Blu Alliance Group',
        greeting: `Gentile <strong>${nomeCliente}</strong>,`,
        intro: 'La sua prenotazione è stata confermata! Di seguito i dettagli:',
        detailsTitle: '📋 Dettagli Prenotazione',
        bookingCode: 'Codice Prenotazione:',
        service: 'Servizio:',
        date: 'Data:',
        boardingTime: 'Ora Imbarco:',
        boardingPlace: 'Luogo Imbarco:',
        passengers: 'Numero Passeggeri:',
        person: 'persona',
        people: 'persone',
        paymentsTitle: '💰 Riepilogo Pagamenti',
        totalAmount: 'Importo Totale:',
        depositReceived: 'Acconto Ricevuto:',
        balanceReceived: 'Saldo Ricevuto:',
        balanceDue: 'Saldo da Ricevere:',
        paymentComplete: '✅ Pagamento completato',
        presentAt: '📍 Presentarsi presso:',
        atTime: '🕐 Alle ore:',
        important: 'Importante:',
        importantNote: 'Si prega di presentarsi 15 minuti prima dell\'orario di imbarco.',
        contact: 'Per qualsiasi informazione o modifica, non esitare a contattarci.',
        regards: 'Cordiali saluti,',
        team: 'Il Team di Blu Alliance',
        footer1: 'Blu Alliance Group - Turismo Marittimo',
        footer2: 'Porto di Salerno | info@blualliancegroup.com',
        footer3: 'Questa è una email automatica, si prega di non rispondere.'
      },
      en: {
        subject: `Booking Confirmation ${codicePrenotazione} - Blu Alliance`,
        title: '🚢 Booking Confirmation',
        subtitle: 'Blu Alliance Group',
        greeting: `Dear <strong>${nomeCliente}</strong>,`,
        intro: 'Your booking has been confirmed! Here are the details:',
        detailsTitle: '📋 Booking Details',
        bookingCode: 'Booking Code:',
        service: 'Service:',
        date: 'Date:',
        boardingTime: 'Boarding Time:',
        boardingPlace: 'Boarding Location:',
        passengers: 'Number of Passengers:',
        person: 'person',
        people: 'people',
        paymentsTitle: '💰 Payment Summary',
        totalAmount: 'Total Amount:',
        depositReceived: 'Deposit Received:',
        balanceReceived: 'Balance Received:',
        balanceDue: 'Balance Due:',
        paymentComplete: '✅ Payment completed',
        presentAt: '📍 Please arrive at:',
        atTime: '🕐 At:',
        important: 'Important:',
        importantNote: 'Please arrive 15 minutes before boarding time.',
        contact: 'For any information or changes, please contact us.',
        regards: 'Best regards,',
        team: 'The Blu Alliance Team',
        footer1: 'Blu Alliance Group - Maritime Tourism',
        footer2: 'Port of Salerno | info@blualliancegroup.com',
        footer3: 'This is an automated email, please do not reply.'
      }
    }

    const t = translations[lingua] || translations.it

    // Formatta la data
    const dataFormattata = new Date(dataServizio).toLocaleDateString(lingua === 'en' ? 'en-US' : 'it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    const { data, error } = await resend.emails.send({
      from: 'Blu Alliance <noreply@blualliancegroup.com>',
      to: [email],
      subject: t.subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
            .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .info-row:last-child { border-bottom: none; }
            .label { font-weight: bold; color: #6b7280; }
            .value { color: #111827; }
            .highlight { background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${t.title}</h1>
              <p style="margin: 10px 0 0 0; font-size: 18px;">${t.subtitle}</p>
            </div>
            
            <div class="content">
              <p>${t.greeting}</p>
              <p>${t.intro}</p>
              
              <div class="info-box">
                <h3 style="margin-top: 0; color: #667eea;">${t.detailsTitle}</h3>
                <div class="info-row">
                  <span class="label">${t.bookingCode}</span>
                  <span class="value"><strong>${codicePrenotazione}</strong></span>
                </div>
                <div class="info-row">
                  <span class="label">${t.service}</span>
                  <span class="value">${nomeServizio}</span>
                </div>
                <div class="info-row">
                  <span class="label">${t.date}</span>
                  <span class="value">${dataFormattata}</span>
                </div>
                ${oraImbarco ? `
                <div class="info-row">
                  <span class="label">${t.boardingTime}</span>
                  <span class="value"><strong>${oraImbarco}</strong></span>
                </div>
                ` : ''}
                ${luogoImbarco ? `
                <div class="info-row">
                  <span class="label">${t.boardingPlace}</span>
                  <span class="value"><strong>${luogoImbarco}</strong></span>
                </div>
                ` : ''}
                <div class="info-row">
                  <span class="label">${t.passengers}</span>
                  <span class="value">${numeroPax} ${numeroPax === 1 ? t.person : t.people}</span>
                </div>
              </div>

              <div class="info-box">
                <h3 style="margin-top: 0; color: #667eea;">${t.paymentsTitle}</h3>
                <div class="info-row">
                  <span class="label">${t.totalAmount}</span>
                  <span class="value">€${prezzoTotale.toFixed(2)}</span>
                </div>
                <div class="info-row">
                  <span class="label">${t.depositReceived}</span>
                  <span class="value" style="color: #10b981;">€${accontoRicevuto.toFixed(2)}</span>
                </div>
                <div class="info-row">
                  <span class="label">${t.balanceReceived}</span>
                  <span class="value" style="color: #10b981;">€${saldoRicevuto.toFixed(2)}</span>
                </div>
                ${daRicevere > 0 ? `
                <div class="info-row">
                  <span class="label">${t.balanceDue}</span>
                  <span class="value" style="color: #ef4444; font-weight: bold;">€${daRicevere.toFixed(2)}</span>
                </div>
                ` : `
                <div class="highlight" style="background: #d1fae5; color: #065f46;">
                  ${t.paymentComplete}
                </div>
                `}
              </div>

              ${luogoImbarco && oraImbarco ? `
              <div class="highlight">
                <p style="margin: 0; font-size: 16px;">
                  <strong>${t.presentAt}</strong><br>
                  ${luogoImbarco}<br>
                  <strong>${t.atTime}</strong> ${oraImbarco}
                </p>
              </div>
              ` : ''}

              <p style="margin-top: 30px;">
                <strong>${t.important}</strong> ${t.importantNote}
              </p>

              <p>${t.contact}</p>

              <p style="margin-top: 30px;">
                ${t.regards}<br>
                <strong>${t.team}</strong>
              </p>
            </div>

            <div class="footer">
              <p>${t.footer1}</p>
              <p>${t.footer2}</p>
              <p style="font-size: 12px; color: #9ca3af;">${t.footer3}</p>
            </div>
          </div>
        </body>
        </html>
      `
    })

    if (error) {
      console.error('Errore Resend:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Errore invio email:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}