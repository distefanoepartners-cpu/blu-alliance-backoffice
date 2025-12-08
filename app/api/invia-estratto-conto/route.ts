import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

const resend = new Resend(process.env.RESEND_API_KEY)

async function generaPDF(fornitore: any, mese: string, prenotazioni: any[], totali: any): Promise<Buffer> {
  const [anno, meseNum] = mese.split('-')
  const mesiItaliani = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ]
  const meseTesto = `${mesiItaliani[parseInt(meseNum) - 1]} ${anno}`

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842])
  const { height } = page.getSize()

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

  let yPos = height - 50

  // Header
  page.drawText('BLU ALLIANCE', { x: 50, y: yPos, size: 20, font: fontBold, color: rgb(0.1, 0.3, 0.6) })
  yPos -= 18
  page.drawText('Consorzio Turistico Nautico - Porto di Salerno', { x: 50, y: yPos, size: 10, font: fontRegular, color: rgb(0.4, 0.4, 0.4) })

  page.drawText(`Generato il: ${new Date().toLocaleDateString('it-IT')}`, { x: 400, y: height - 50, size: 9, font: fontRegular, color: rgb(0.5, 0.5, 0.5) })

  yPos -= 40
  page.drawText('ESTRATTO CONTO', { x: 50, y: yPos, size: 16, font: fontBold, color: rgb(0, 0, 0) })
  yPos -= 18
  page.drawText(`Periodo: ${meseTesto}`, { x: 50, y: yPos, size: 12, font: fontRegular, color: rgb(0, 0, 0) })

  // Box Fornitore
  yPos -= 30
  page.drawRectangle({ x: 50, y: yPos - 80, width: 500, height: 85, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 })

  page.drawText('FORNITORE', { x: 60, y: yPos - 15, size: 11, font: fontBold, color: rgb(0.2, 0.2, 0.2) })
  page.drawText(fornitore.ragione_sociale || '', { x: 60, y: yPos - 32, size: 10, font: fontRegular, color: rgb(0, 0, 0) })

  if (fornitore.indirizzo) {
    page.drawText(fornitore.indirizzo, { x: 60, y: yPos - 46, size: 9, font: fontRegular, color: rgb(0.3, 0.3, 0.3) })
  }

  const citta = [fornitore.cap, fornitore.citta, fornitore.provincia ? `(${fornitore.provincia})` : ''].filter(Boolean).join(' ')
  if (citta) {
    page.drawText(citta, { x: 60, y: yPos - 58, size: 9, font: fontRegular, color: rgb(0.3, 0.3, 0.3) })
  }

  if (fornitore.partita_iva) {
    page.drawText(`P.IVA: ${fornitore.partita_iva}`, { x: 60, y: yPos - 72, size: 9, font: fontRegular, color: rgb(0.3, 0.3, 0.3) })
  }

  page.drawText(`Commissione: ${fornitore.percentuale_commissione}%`, { x: 350, y: yPos - 32, size: 10, font: fontBold, color: rgb(0.1, 0.3, 0.6) })

  if (fornitore.iban) {
    page.drawText(`IBAN: ${fornitore.iban}`, { x: 350, y: yPos - 48, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4) })
  }

  // Tabella prenotazioni
  yPos -= 110
  page.drawRectangle({ x: 50, y: yPos - 18, width: 500, height: 20, color: rgb(0.94, 0.94, 0.94) })

  const headers = [
    { text: 'Data', x: 55 },
    { text: 'Codice', x: 110 },
    { text: 'Servizio', x: 180 },
    { text: 'Cliente', x: 300 },
    { text: 'Importo', x: 420 },
    { text: 'Incassato', x: 480 },
  ]

  headers.forEach(h => {
    page.drawText(h.text, { x: h.x, y: yPos - 13, size: 8, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
  })

  yPos -= 25

  if (prenotazioni && prenotazioni.length > 0) {
    prenotazioni.forEach((p: any, index: number) => {
      if (yPos < 150) return

      if (index % 2 === 0) {
        page.drawRectangle({ x: 50, y: yPos - 12, width: 500, height: 16, color: rgb(0.98, 0.98, 0.98) })
      }

      const dataFormatted = p.data_servizio ? new Date(p.data_servizio).toLocaleDateString('it-IT') : '-'

      page.drawText(dataFormatted, { x: 55, y: yPos - 8, size: 8, font: fontRegular, color: rgb(0, 0, 0) })
      page.drawText((p.codice_prenotazione || '-').substring(0, 12), { x: 110, y: yPos - 8, size: 8, font: fontRegular, color: rgb(0, 0, 0) })
      page.drawText((p.servizio_nome || '-').substring(0, 22), { x: 180, y: yPos - 8, size: 8, font: fontRegular, color: rgb(0, 0, 0) })
      page.drawText((p.cliente_nome || '-').substring(0, 18), { x: 300, y: yPos - 8, size: 8, font: fontRegular, color: rgb(0, 0, 0) })
      page.drawText(`€${Number(p.prezzo_totale || 0).toFixed(2)}`, { x: 420, y: yPos - 8, size: 8, font: fontRegular, color: rgb(0, 0, 0) })
      page.drawText(`€${Number(p.totale_incassato || 0).toFixed(2)}`, { x: 480, y: yPos - 8, size: 8, font: fontRegular, color: rgb(0, 0, 0) })

      yPos -= 16
    })
  } else {
    page.drawText('Nessuna prenotazione nel periodo selezionato', { x: 55, y: yPos - 8, size: 9, font: fontRegular, color: rgb(0.5, 0.5, 0.5) })
    yPos -= 20
  }

  // Box Riepilogo
  yPos -= 30
  page.drawRectangle({ x: 300, y: yPos - 100, width: 250, height: 105, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 1 })

  page.drawText('RIEPILOGO', { x: 310, y: yPos - 15, size: 11, font: fontBold, color: rgb(0.2, 0.2, 0.2) })
  page.drawText(`Numero prenotazioni:`, { x: 310, y: yPos - 35, size: 9, font: fontRegular, color: rgb(0.3, 0.3, 0.3) })
  page.drawText(`${prenotazioni?.length || 0}`, { x: 480, y: yPos - 35, size: 9, font: fontBold, color: rgb(0, 0, 0) })
  page.drawText(`Fatturato lordo:`, { x: 310, y: yPos - 50, size: 9, font: fontRegular, color: rgb(0.3, 0.3, 0.3) })
  page.drawText(`€${totali.fatturato.toFixed(2)}`, { x: 470, y: yPos - 50, size: 9, font: fontBold, color: rgb(0, 0, 0) })
  page.drawText(`Commissione (${fornitore.percentuale_commissione}%):`, { x: 310, y: yPos - 65, size: 9, font: fontRegular, color: rgb(0.3, 0.3, 0.3) })
  page.drawText(`- €${totali.commissioni.toFixed(2)}`, { x: 465, y: yPos - 65, size: 9, font: fontBold, color: rgb(0.8, 0.2, 0.2) })

  page.drawLine({ start: { x: 310, y: yPos - 75 }, end: { x: 540, y: yPos - 75 }, thickness: 1, color: rgb(0.7, 0.7, 0.7) })

  page.drawText(`NETTO DA CORRISPONDERE:`, { x: 310, y: yPos - 90, size: 10, font: fontBold, color: rgb(0, 0, 0) })
  page.drawText(`€${totali.netto.toFixed(2)}`, { x: 465, y: yPos - 90, size: 11, font: fontBold, color: rgb(0.1, 0.5, 0.2) })

  page.drawText('Documento generato automaticamente dal sistema Blu Alliance Booking', { x: 140, y: 30, size: 8, font: fontRegular, color: rgb(0.6, 0.6, 0.6) })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

export async function POST(request: NextRequest) {
  try {
    const { fornitore, mese, prenotazioni, totali } = await request.json()

    if (!fornitore || !mese) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })
    }

    if (!fornitore.email) {
      return NextResponse.json({ error: 'Il fornitore non ha un indirizzo email' }, { status: 400 })
    }

    const [anno, meseNum] = mese.split('-')
    const mesiItaliani = [
      'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ]
    const meseTesto = `${mesiItaliani[parseInt(meseNum) - 1]} ${anno}`

    // Genera il PDF
    const pdfBuffer = await generaPDF(fornitore, mese, prenotazioni, totali)

    // Invia l'email
    const { data, error } = await resend.emails.send({
      from: 'Blu Alliance <noreply@blualliancegroup.com>',
      to: [fornitore.email],
      subject: `Estratto Conto ${meseTesto} - Blu Alliance`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1e40af; }
            .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .info-row:last-child { border-bottom: none; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📊 Estratto Conto</h1>
              <p style="margin: 10px 0 0 0; font-size: 18px;">${meseTesto}</p>
            </div>
            
            <div class="content">
              <p>Gentile <strong>${fornitore.nome_referente || fornitore.ragione_sociale}</strong>,</p>
              <p>In allegato trova l'estratto conto relativo al mese di <strong>${meseTesto}</strong>.</p>
              
              <div class="info-box">
                <h3 style="margin-top: 0; color: #1e40af;">📋 Riepilogo</h3>
                <div class="info-row">
                  <span>Numero prenotazioni:</span>
                  <strong>${prenotazioni?.length || 0}</strong>
                </div>
                <div class="info-row">
                  <span>Fatturato lordo:</span>
                  <strong>€${totali.fatturato.toFixed(2)}</strong>
                </div>
                <div class="info-row">
                  <span>Commissioni (${fornitore.percentuale_commissione}%):</span>
                  <strong style="color: #dc2626;">- €${totali.commissioni.toFixed(2)}</strong>
                </div>
                <div class="info-row" style="border-top: 2px solid #e5e7eb; padding-top: 15px;">
                  <span><strong>Netto da corrispondere:</strong></span>
                  <strong style="color: #16a34a; font-size: 18px;">€${totali.netto.toFixed(2)}</strong>
                </div>
              </div>
              
              <p>Per qualsiasi chiarimento, non esiti a contattarci.</p>
              
              <p style="margin-top: 30px;">
                Cordiali saluti,<br>
                <strong>Blu Alliance</strong>
              </p>
            </div>

            <div class="footer">
              <p>Blu Alliance Group - Turismo Marittimo</p>
              <p>Porto di Salerno | info@blualliancegroup.com</p>
              <p style="font-size: 12px; color: #9ca3af;">Questa è una email automatica.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      attachments: [
        {
          filename: `estratto-conto-${fornitore.ragione_sociale.replace(/\s+/g, '-')}-${mese}.pdf`,
          content: pdfBuffer,
        },
      ],
    })

    if (error) {
      console.error('Errore Resend:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data, message: `Email inviata a ${fornitore.email}` })

  } catch (error: any) {
    console.error('Errore invio estratto conto:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}