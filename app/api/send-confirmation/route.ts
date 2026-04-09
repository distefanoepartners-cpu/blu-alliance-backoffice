import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { sendBookingSmsToFornitore } from '@/lib/sms-service'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('📧 [send-confirmation] Request received:', body)

    const { prenotazioneId, lingua, tipo, notificaFornitore } = body

    if (!prenotazioneId) {
      return NextResponse.json({ error: 'ID prenotazione mancante' }, { status: 400 })
    }

    // Carica prenotazione completa con dati fornitore
    const { data: prenotazione, error: prenotazioneError } = await supabase
      .from('prenotazioni')
      .select(`
        *,
        clienti(nome, cognome, email, telefono),
        servizi(nome, descrizione, tipo),
        imbarcazioni(nome, tipo, categoria, fornitore_id, fornitori(ragione_sociale, email, telefono, telefono_2, telefono_2_nome))
      `)
      .eq('id', prenotazioneId)
      .single()

    if (prenotazioneError || !prenotazione) {
      console.log('❌ [send-confirmation] Booking not found:', prenotazioneError)
      return NextResponse.json({ error: 'Prenotazione non trovata' }, { status: 404 })
    }

    console.log('✅ [send-confirmation] Booking loaded:', prenotazione.codice_prenotazione)

    const lang = lingua || 'it'

    // ── 1. EMAIL CLIENTE ──────────────────────────────────────
    const emailCliente = generateEmailCliente(prenotazione, lang, tipo || 'conferma')

    const clienteOk = await sendEmail({
      to: prenotazione.clienti.email,
      subject: emailCliente.subject,
      html: emailCliente.html
    })

    if (!clienteOk) {
      return NextResponse.json(
        { error: 'Errore invio email cliente — controlla i log Vercel per dettagli Resend' },
        { status: 500 }
      )
    }

    console.log('✅ [send-confirmation] Email cliente inviata a:', prenotazione.clienti.email)

    // ── 2. CC a booking@blualliancegroup.com ─────────────────
    await delay(600) // Resend rate limit: max 2 req/sec
    await sendEmail({
      to: 'booking@blualliancegroup.com',
      subject: `[COPIA] ${emailCliente.subject}`,
      html: emailCliente.html
    })
    console.log('✅ [send-confirmation] Copia inviata a booking@blualliancegroup.com')

    // ── 3. NOTIFICA FORNITORE (opzionale o automatica) ────────
    await delay(600) // Resend rate limit
    const fornitore = prenotazione.imbarcazioni?.fornitori
    const inviaAlFornitore = notificaFornitore !== false && fornitore?.email

    if (inviaAlFornitore) {
      const emailFornitore = generateEmailFornitore(prenotazione)
      const fornitoreOk = await sendEmail({
        to: fornitore.email,
        subject: emailFornitore.subject,
        html: emailFornitore.html
      })

      if (fornitoreOk) {
        console.log('✅ [send-confirmation] Notifica fornitore inviata a:', fornitore.email)
      } else {
        console.warn('⚠️ [send-confirmation] Notifica fornitore fallita per:', fornitore.email)
        // Non blocchiamo la risposta — l'email cliente è già andata
      }
    }

    // ── 4. SMS FORNITORE ─────────────────────────────────────
    let fornitoreSmsInviato = false
    const fornitoreTelefono = fornitore?.telefono
    if (fornitoreTelefono) {
      try {
        const smsResult = await sendBookingSmsToFornitore(
          fornitoreTelefono,
          fornitore.ragione_sociale || 'Fornitore',
          {
            codice: prenotazione.codice_prenotazione,
            clienteNome: `${prenotazione.clienti?.nome || ''} ${prenotazione.clienti?.cognome || ''}`.trim(),
            barcaNome: prenotazione.imbarcazioni?.nome || '-',
            servizioNome: prenotazione.servizi?.nome || '-',
            dataServizio: prenotazione.data_servizio,
            oraImbarco: prenotazione.ora_imbarco || prenotazione.ora_inizio || '',
            portoImbarco: prenotazione.porto_imbarco || prenotazione.luogo_imbarco || '',
            numPersone: prenotazione.numero_persone || 0,
            prezzoTotale: Number(prenotazione.prezzo_totale || 0),
            caparra: Number(prenotazione.caparra_ricevuta || prenotazione.importo_pagato || 0),
            noteCliente: prenotazione.note_cliente || undefined,
            telefono_2: fornitore.telefono_2 || undefined,
            telefono_2_nome: fornitore.telefono_2_nome || undefined,
          }
        )
        fornitoreSmsInviato = smsResult.success
        if (smsResult.success) {
          console.log('✅ [send-confirmation] SMS fornitore inviato a:', fornitoreTelefono)
        } else {
          console.warn('⚠️ [send-confirmation] SMS fornitore fallito:', smsResult.error)
        }
      } catch (smsErr: any) {
        console.warn('⚠️ [send-confirmation] SMS fornitore errore:', smsErr.message)
      }
    } else {
      console.log('ℹ️ [send-confirmation] Fornitore senza telefono, SMS non inviato')
    }

    return NextResponse.json({
      success: true,
      message: 'Email inviata con successo',
      fornitoreNotificato: inviaAlFornitore && !!fornitore?.email,
      fornitoreSmsInviato
    })

  } catch (error: any) {
    console.error('❌ [send-confirmation] Error:', error)
    return NextResponse.json({ error: error.message || 'Errore interno' }, { status: 500 })
  }
}

// ══════════════════════════════════════════════════════════════
// EMAIL CLIENTE — stesso stile del plugin WordPress
// ══════════════════════════════════════════════════════════════
function generateEmailCliente(prenotazione: any, lingua: string, tipo: string) {
  const translations: any = {
    it: {
      subject: `✅ Conferma Prenotazione - ${prenotazione.codice_prenotazione}`,
      title: tipo === 'promemoria' ? 'Promemoria Prenotazione' : 'Prenotazione Confermata!',
      dear: 'Gentile',
      confirmed_text: 'La tua prenotazione è stata confermata. Di seguito trovi tutti i dettagli.',
      booking_code: 'Codice Prenotazione',
      service_details: 'Dettagli del Servizio',
      service: 'Servizio',
      boat: 'Imbarcazione',
      date: 'Data',
      people: 'Persone',
      boarding_point: 'Punto di Imbarco',
      time: 'Ora imbarco:',
      payment_summary: 'Riepilogo Pagamento',
      payment_type: 'Tipo pagamento',
      amount_paid: 'Importo pagato',
      balance_due: 'Saldo da pagare',
      total: 'Totale',
      deposit: 'Caparra',
      full_payment: 'Pagamento completo',
      contact_us: 'Per qualsiasi informazione non esitare a contattarci.',
      thanks: 'Grazie per aver scelto Blu Alliance!',
      team: 'Il Team di Blu Alliance',
      not_specified: 'Da definire',
    },
    en: {
      subject: `✅ Booking Confirmation - ${prenotazione.codice_prenotazione}`,
      title: tipo === 'promemoria' ? 'Booking Reminder' : 'Booking Confirmed!',
      dear: 'Dear',
      confirmed_text: 'Your booking has been confirmed. Please find all details below.',
      booking_code: 'Booking Code',
      service_details: 'Service Details',
      service: 'Service',
      boat: 'Boat',
      date: 'Date',
      people: 'People',
      boarding_point: 'Boarding Point',
      time: 'Boarding time:',
      payment_summary: 'Payment Summary',
      payment_type: 'Payment type',
      amount_paid: 'Amount paid',
      balance_due: 'Balance due',
      total: 'Total',
      deposit: 'Deposit',
      full_payment: 'Full payment',
      contact_us: 'For any information, please do not hesitate to contact us.',
      thanks: 'Thank you for choosing Blu Alliance!',
      team: 'The Blu Alliance Team',
      not_specified: 'To be defined',
    },
    fr: {
      subject: `✅ Confirmation de Réservation - ${prenotazione.codice_prenotazione}`,
      title: 'Réservation Confirmée!',
      dear: 'Cher/Chère',
      confirmed_text: 'Votre réservation a été confirmée. Vous trouverez ci-dessous tous les détails.',
      booking_code: 'Code de Réservation',
      service_details: 'Détails du Service',
      service: 'Service',
      boat: 'Bateau',
      date: 'Date',
      people: 'Personnes',
      boarding_point: "Point d'Embarquement",
      time: "Heure d'embarquement:",
      payment_summary: 'Récapitulatif du Paiement',
      payment_type: 'Type de paiement',
      amount_paid: 'Montant payé',
      balance_due: 'Solde dû',
      total: 'Total',
      deposit: 'Acompte',
      full_payment: 'Paiement complet',
      contact_us: "Pour toute information, n'hésitez pas à nous contacter.",
      thanks: "Merci d'avoir choisi Blu Alliance!",
      team: "L'équipe Blu Alliance",
      not_specified: 'À définir',
    },
    de: {
      subject: `✅ Buchungsbestätigung - ${prenotazione.codice_prenotazione}`,
      title: 'Buchung Bestätigt!',
      dear: 'Sehr geehrte/r',
      confirmed_text: 'Ihre Buchung wurde bestätigt. Nachfolgend finden Sie alle Details.',
      booking_code: 'Buchungscode',
      service_details: 'Servicedetails',
      service: 'Service',
      boat: 'Boot',
      date: 'Datum',
      people: 'Personen',
      boarding_point: 'Einstiegspunkt',
      time: 'Einstiegszeit:',
      payment_summary: 'Zahlungsübersicht',
      payment_type: 'Zahlungsart',
      amount_paid: 'Bezahlter Betrag',
      balance_due: 'Restbetrag',
      total: 'Gesamt',
      deposit: 'Anzahlung',
      full_payment: 'Vollständige Zahlung',
      contact_us: 'Für weitere Informationen zögern Sie nicht, uns zu kontaktieren.',
      thanks: 'Vielen Dank, dass Sie Blu Alliance gewählt haben!',
      team: 'Das Blu Alliance Team',
      not_specified: 'Noch festzulegen',
    },
    es: {
      subject: `✅ Confirmación de Reserva - ${prenotazione.codice_prenotazione}`,
      title: '¡Reserva Confirmada!',
      dear: 'Estimado/a',
      confirmed_text: 'Su reserva ha sido confirmada. A continuación encontrará todos los detalles.',
      booking_code: 'Código de Reserva',
      service_details: 'Detalles del Servicio',
      service: 'Servicio',
      boat: 'Embarcación',
      date: 'Fecha',
      people: 'Personas',
      boarding_point: 'Punto de Embarque',
      time: 'Hora de embarque:',
      payment_summary: 'Resumen de Pago',
      payment_type: 'Tipo de pago',
      amount_paid: 'Importe pagado',
      balance_due: 'Saldo pendiente',
      total: 'Total',
      deposit: 'Depósito',
      full_payment: 'Pago completo',
      contact_us: 'Para cualquier información no dude en contactarnos.',
      thanks: '¡Gracias por elegir Blu Alliance!',
      team: 'El Equipo de Blu Alliance',
      not_specified: 'Por definir',
    },
  }

  const t = translations[lingua] || translations.it

  const porto = prenotazione.porto_imbarco || prenotazione.luogo_imbarco || t.not_specified
  const ora = prenotazione.ora_imbarco || prenotazione.ora_inizio || ''
  const persone = prenotazione.numero_persone || '-'
  const prezzoTotale = Number(prenotazione.prezzo_totale || 0)
  const caparraRicevuta = Number(prenotazione.caparra_ricevuta || prenotazione.importo_pagato || 0)
  const saldoDovuto = prezzoTotale - caparraRicevuta

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f4f7fa;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f7fa;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#0066CC 0%,#00B4D8 100%);padding:40px 20px;text-align:center;">
              <img src="https://blualliancegroup.com/wp-content/uploads/2024/01/logo-blu-alliance-white.png" alt="Blu Alliance" style="max-width:180px;height:auto;margin-bottom:16px;">
              <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">${t.title}</h1>
            </td>
          </tr>

          <!-- CORPO -->
          <tr>
            <td style="padding:40px 30px;">
              <p style="font-size:18px;margin:0 0 8px;">${t.dear} <strong>${prenotazione.clienti.nome} ${prenotazione.clienti.cognome}</strong>,</p>
              <p style="font-size:15px;color:#666;margin:0 0 25px;">${t.confirmed_text}</p>

              <!-- BOX CODICE -->
              <table width="100%" cellpadding="20" cellspacing="0" border="0" style="background:linear-gradient(135deg,#0066CC 0%,#00B4D8 100%);border-radius:12px;margin:0 0 20px;text-align:center;">
                <tr><td>
                  <div style="font-size:13px;color:#fff;opacity:0.85;letter-spacing:1px;text-transform:uppercase;">${t.booking_code}</div>
                  <strong style="font-size:28px;font-family:monospace;letter-spacing:3px;display:block;margin-top:8px;color:#fff;">${prenotazione.codice_prenotazione}</strong>
                </td></tr>
              </table>

              <!-- DETTAGLI SERVIZIO -->
              <table width="100%" cellpadding="25" cellspacing="0" border="0" style="background:#f8f9fa;border-radius:12px;margin:0 0 20px;border-left:4px solid #0066CC;">
                <tr><td>
                  <h2 style="color:#0066CC;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 15px;">${t.service_details}</h2>
                  <table width="100%" cellpadding="6" cellspacing="0">
                    <tr><td style="font-weight:600;color:#666;width:45%;">${t.service}</td><td style="color:#111;">${prenotazione.servizi?.nome || '-'}</td></tr>
                    ${prenotazione.imbarcazioni?.nome ? `<tr><td style="font-weight:600;color:#666;">${t.boat}</td><td style="color:#111;">${prenotazione.imbarcazioni.nome}</td></tr>` : ''}
                    <tr><td style="font-weight:600;color:#666;">${t.date}</td><td style="color:#111;">${new Date(prenotazione.data_servizio).toLocaleDateString(lingua === 'it' ? 'it-IT' : lingua, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
                    <tr><td style="font-weight:600;color:#666;">${t.people}</td><td style="color:#111;">${persone}</td></tr>
                  </table>
                </td></tr>
              </table>

              <!-- PUNTO DI IMBARCO -->
              <table width="100%" cellpadding="20" cellspacing="0" border="0" style="background:#e3f2fd;border-radius:12px;margin:0 0 20px;text-align:center;">
                <tr><td>
                  <h3 style="margin:0 0 10px;color:#0066CC;font-size:15px;">⚓ ${t.boarding_point}</h3>
                  <p style="margin:5px 0;"><strong style="font-size:20px;color:#111;">${porto}</strong></p>
                  ${ora ? `<p style="margin:8px 0 0;color:#555;">${t.time} <strong>${ora}</strong></p>` : ''}
                </td></tr>
              </table>

              <!-- PAGAMENTO -->
              <table width="100%" cellpadding="20" cellspacing="0" border="0" style="background:#d4edda;border-radius:12px;margin:0 0 20px;border-left:4px solid #28a745;">
                <tr><td>
                  <h3 style="margin:0 0 15px;color:#155724;font-size:15px;">💳 ${t.payment_summary}</h3>
                  <table width="100%" cellpadding="5" cellspacing="0">
                    ${caparraRicevuta > 0 ? `<tr><td style="font-weight:600;color:#333;">${t.amount_paid}</td><td align="right" style="color:#28a745;font-size:18px;"><strong>€${caparraRicevuta.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong></td></tr>` : ''}
                    ${saldoDovuto > 0 ? `<tr><td style="font-weight:600;color:#333;">${t.balance_due}</td><td align="right" style="color:#856404;"><strong>€${saldoDovuto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong></td></tr>` : ''}
                    <tr style="border-top:2px solid #28a745;">
                      <td style="font-weight:700;padding-top:10px;color:#111;">${t.total}</td>
                      <td align="right" style="font-size:20px;padding-top:10px;"><strong>€${prezzoTotale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong></td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <p style="color:#666;font-size:14px;margin:20px 0 10px;">${t.contact_us}</p>
              <p style="margin:20px 0 0;"><strong>${t.thanks}</strong><br><em style="color:#666;">${t.team}</em></p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#1a1a2e;color:#fff;padding:30px;text-align:center;">
              <h3 style="margin:0 0 8px;font-size:18px;">Blu Alliance Group</h3>
              <p style="margin:4px 0;font-size:13px;color:#aaa;">Porto di Salerno, Italia</p>
              <p style="margin:8px 0 0;font-size:13px;">
                <a href="mailto:info@blualliancegroup.com" style="color:#00B4D8;text-decoration:none;">info@blualliancegroup.com</a>
                &nbsp;·&nbsp;
                <a href="https://blualliancegroup.com" style="color:#00B4D8;text-decoration:none;">www.blualliancegroup.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject: t.subject, html }
}

// ══════════════════════════════════════════════════════════════
// EMAIL FORNITORE — notifica interna essenziale
// ══════════════════════════════════════════════════════════════
function generateEmailFornitore(prenotazione: any) {
  const fornitore = prenotazione.imbarcazioni?.fornitori
  const porto = prenotazione.porto_imbarco || prenotazione.luogo_imbarco || 'Da definire'
  const ora = prenotazione.ora_imbarco || prenotazione.ora_inizio || '-'
  const dataServizio = new Date(prenotazione.data_servizio).toLocaleDateString('it-IT', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const subject = `🚤 Nuova Prenotazione ${prenotazione.codice_prenotazione} — ${prenotazione.imbarcazioni?.nome || ''}`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f4f7fa;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f7fa;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#0066CC 0%,#00B4D8 100%);padding:30px 20px;text-align:center;">
              <h1 style="color:#fff;margin:0;font-size:22px;">🚤 Nuova Prenotazione</h1>
              <p style="color:#fff;opacity:0.9;margin:8px 0 0;font-size:14px;">Notifica per ${fornitore?.ragione_sociale || 'Fornitore'}</p>
            </td>
          </tr>

          <!-- CORPO -->
          <tr>
            <td style="padding:30px;">

              <!-- BOX CODICE -->
              <table width="100%" cellpadding="16" cellspacing="0" border="0" style="background:linear-gradient(135deg,#0066CC 0%,#00B4D8 100%);border-radius:10px;margin:0 0 20px;text-align:center;">
                <tr><td>
                  <div style="font-size:12px;color:#fff;opacity:0.85;text-transform:uppercase;letter-spacing:1px;">Codice Prenotazione</div>
                  <strong style="font-size:26px;font-family:monospace;letter-spacing:3px;display:block;margin-top:6px;color:#fff;">${prenotazione.codice_prenotazione}</strong>
                </td></tr>
              </table>

              <!-- IMBARCAZIONE -->
              <table width="100%" cellpadding="20" cellspacing="0" border="0" style="background:#e3f2fd;border-radius:10px;margin:0 0 16px;border-left:4px solid #0066CC;">
                <tr><td>
                  <h3 style="margin:0 0 12px;color:#0066CC;font-size:13px;text-transform:uppercase;letter-spacing:1px;">🚤 Imbarcazione</h3>
                  <p style="margin:0;font-size:20px;font-weight:700;color:#111;">${prenotazione.imbarcazioni?.nome || '-'}</p>
                  ${prenotazione.imbarcazioni?.tipo ? `<p style="margin:4px 0 0;color:#555;font-size:14px;">${prenotazione.imbarcazioni.tipo}</p>` : ''}
                </td></tr>
              </table>

              <!-- DETTAGLI SERVIZIO -->
              <table width="100%" cellpadding="20" cellspacing="0" border="0" style="background:#f8f9fa;border-radius:10px;margin:0 0 16px;border-left:4px solid #0066CC;">
                <tr><td>
                  <h3 style="margin:0 0 12px;color:#0066CC;font-size:13px;text-transform:uppercase;letter-spacing:1px;">📋 Dettagli Servizio</h3>
                  <table width="100%" cellpadding="5" cellspacing="0">
                    <tr><td style="font-weight:600;color:#666;width:40%;">Servizio</td><td style="color:#111;">${prenotazione.servizi?.nome || '-'}</td></tr>
                    <tr><td style="font-weight:600;color:#666;">Data</td><td style="color:#111;font-weight:700;">${dataServizio}</td></tr>
                    <tr><td style="font-weight:600;color:#666;">Ora imbarco</td><td style="color:#111;">${ora}</td></tr>
                    <tr><td style="font-weight:600;color:#666;">Porto</td><td style="color:#111;">${porto}</td></tr>
                    <tr><td style="font-weight:600;color:#666;">Persone</td><td style="color:#111;">${prenotazione.numero_persone || '-'}</td></tr>
                  <tr><td style="font-weight:600;color:#666;">Persone</td><td style="color:#111;">${prenotazione.numero_persone || '-'}</td></tr>
                <tr><td style="font-weight:600;color:#666;">Prezzo Totale</td><td style="color:#111;font-weight:700;">€${Number(prenotazione.prezzo_totale || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td></tr>
                ${Number(prenotazione.caparra_ricevuta || prenotazione.importo_pagato || 0) > 0 ? `<tr><td style="font-weight:600;color:#666;">Acconto Ricevuto</td><td style="color:#28a745;font-weight:700;">€${Number(prenotazione.caparra_ricevuta || prenotazione.importo_pagato || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td></tr>` : ''}
                ${(Number(prenotazione.prezzo_totale || 0) - Number(prenotazione.caparra_ricevuta || prenotazione.importo_pagato || 0)) > 0 ? `<tr><td style="font-weight:600;color:#666;">Saldo da Incassare</td><td style="color:#856404;font-weight:700;">€${(Number(prenotazione.prezzo_totale || 0) - Number(prenotazione.caparra_ricevuta || prenotazione.importo_pagato || 0)).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td></tr>` : ''}
                </table>
                     
                </td></tr>
              </table>

              <!-- CLIENTE -->
              <table width="100%" cellpadding="20" cellspacing="0" border="0" style="background:#fff3cd;border-radius:10px;margin:0 0 16px;border-left:4px solid #ffc107;">
                <tr><td>
                  <h3 style="margin:0 0 12px;color:#856404;font-size:13px;text-transform:uppercase;letter-spacing:1px;">👤 Cliente</h3>
                  <table width="100%" cellpadding="5" cellspacing="0">
                    <tr><td style="font-weight:600;color:#666;width:40%;">Nome</td><td style="color:#111;font-weight:700;">${prenotazione.clienti?.nome} ${prenotazione.clienti?.cognome}</td></tr>
                    ${prenotazione.clienti?.telefono ? `<tr><td style="font-weight:600;color:#666;">Telefono</td><td><a href="tel:${prenotazione.clienti.telefono}" style="color:#0066CC;">${prenotazione.clienti.telefono}</a></td></tr>` : ''}
                    ${prenotazione.clienti?.email ? `<tr><td style="font-weight:600;color:#666;">Email</td><td><a href="mailto:${prenotazione.clienti.email}" style="color:#0066CC;">${prenotazione.clienti.email}</a></td></tr>` : ''}
                    ${prenotazione.note_cliente ? `<tr><td style="font-weight:600;color:#666;vertical-align:top;">Note</td><td style="color:#111;font-style:italic;">${prenotazione.note_cliente}</td></tr>` : ''}
                  </table>
                </td></tr>
              </table>

              <p style="color:#666;font-size:13px;margin:20px 0 0;">Per informazioni contatta Blu Alliance: <a href="mailto:info@blualliancegroup.com" style="color:#0066CC;">info@blualliancegroup.com</a></p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#1a1a2e;color:#fff;padding:20px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#aaa;">Blu Alliance Group · Porto di Salerno</p>
              <p style="margin:6px 0 0;font-size:12px;color:#666;">Questa è una notifica automatica del sistema di prenotazione</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, html }
}

// ══════════════════════════════════════════════════════════════
// INVIO EMAIL via Resend
// ══════════════════════════════════════════════════════════════
async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { data, error } = await resend.emails.send({
      from: 'Blu Alliance <info@blualliancegroup.com>',
      to,
      subject,
      html
    })

    if (error) {
      console.error('❌ [sendEmail] Resend error:', error)
      throw new Error(`Resend: ${error.message}`)
    }

    console.log('✅ [sendEmail] Sent to:', to, '| ID:', data?.id)
    return true
  } catch (error) {
    console.error('❌ [sendEmail] Exception:', error)
    return false
  }
}