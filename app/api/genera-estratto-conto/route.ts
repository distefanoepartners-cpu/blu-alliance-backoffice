import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export async function POST(request: NextRequest) {
  try {
    const { fornitore, mese, prenotazioni, totali } = await request.json()

    if (!fornitore || !mese) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })
    }

    const [anno, meseNum] = mese.split('-')
    const mesiItaliani = [
      'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ]
    const meseTesto = `${mesiItaliani[parseInt(meseNum) - 1]} ${anno}`

    // Crea documento PDF
    const pdfDoc = await PDFDocument.create()
    let page = pdfDoc.addPage([595, 842]) // A4
    const { width, height } = page.getSize()

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

    let yPos = height - 50

    // ============ HEADER ============
    page.drawText('BLU ALLIANCE', { 
      x: 50, 
      y: yPos, 
      size: 24, 
      font: fontBold, 
      color: rgb(0.1, 0.3, 0.6) 
    })
    yPos -= 20
    page.drawText('Consorzio Turistico Nautico - Porto di Salerno', { 
      x: 50, 
      y: yPos, 
      size: 10, 
      font: fontRegular, 
      color: rgb(0.4, 0.4, 0.4) 
    })

    // Data generazione
    page.drawText(`Generato il: ${new Date().toLocaleDateString('it-IT')}`, { 
      x: 420, 
      y: height - 50, 
      size: 9, 
      font: fontRegular, 
      color: rgb(0.5, 0.5, 0.5) 
    })

    // ============ TITOLO ============
    yPos -= 50
    page.drawText('ESTRATTO CONTO', { 
      x: 50, 
      y: yPos, 
      size: 18, 
      font: fontBold, 
      color: rgb(0, 0, 0) 
    })
    yPos -= 22
    page.drawText(`Periodo: ${meseTesto}`, { 
      x: 50, 
      y: yPos, 
      size: 12, 
      font: fontRegular, 
      color: rgb(0.3, 0.3, 0.3) 
    })

    // ============ BOX FORNITORE ============
    yPos -= 40
    const boxFornitoreHeight = 90
    page.drawRectangle({ 
      x: 50, 
      y: yPos - boxFornitoreHeight, 
      width: 495, 
      height: boxFornitoreHeight, 
      borderColor: rgb(0.8, 0.8, 0.8), 
      borderWidth: 1,
      color: rgb(0.98, 0.98, 0.98)
    })

    page.drawText('FORNITORE', { 
      x: 60, 
      y: yPos - 18, 
      size: 10, 
      font: fontBold, 
      color: rgb(0.1, 0.3, 0.6) 
    })
    
    page.drawText(fornitore.ragione_sociale || '', { 
      x: 60, 
      y: yPos - 35, 
      size: 12, 
      font: fontBold, 
      color: rgb(0, 0, 0) 
    })

    let infoY = yPos - 52
    if (fornitore.indirizzo) {
      page.drawText(fornitore.indirizzo, { 
        x: 60, 
        y: infoY, 
        size: 9, 
        font: fontRegular, 
        color: rgb(0.3, 0.3, 0.3) 
      })
      infoY -= 12
    }

    const citta = [fornitore.cap, fornitore.citta, fornitore.provincia ? `(${fornitore.provincia})` : ''].filter(Boolean).join(' ')
    if (citta) {
      page.drawText(citta, { 
        x: 60, 
        y: infoY, 
        size: 9, 
        font: fontRegular, 
        color: rgb(0.3, 0.3, 0.3) 
      })
      infoY -= 12
    }

    if (fornitore.partita_iva) {
      page.drawText(`P.IVA: ${fornitore.partita_iva}`, { 
        x: 60, 
        y: infoY, 
        size: 9, 
        font: fontRegular, 
        color: rgb(0.3, 0.3, 0.3) 
      })
    }

    // Info a destra
    page.drawText(`Commissione: ${fornitore.percentuale_commissione}%`, { 
      x: 380, 
      y: yPos - 35, 
      size: 11, 
      font: fontBold, 
      color: rgb(0.1, 0.3, 0.6) 
    })

    if (fornitore.iban) {
      page.drawText(`IBAN: ${fornitore.iban}`, { 
        x: 380, 
        y: yPos - 52, 
        size: 8, 
        font: fontRegular, 
        color: rgb(0.4, 0.4, 0.4) 
      })
    }

    // ============ TABELLA PRENOTAZIONI ============
    yPos -= (boxFornitoreHeight + 30)
    
    // Header tabella
    page.drawRectangle({ 
      x: 50, 
      y: yPos - 20, 
      width: 495, 
      height: 22, 
      color: rgb(0.1, 0.3, 0.6) 
    })

    const headers = [
      { text: 'Data', x: 55, width: 60 },
      { text: 'Codice', x: 115, width: 70 },
      { text: 'Servizio', x: 185, width: 130 },
      { text: 'Cliente', x: 315, width: 100 },
      { text: 'Importo', x: 415, width: 60 },
      { text: 'Incassato', x: 480, width: 60 },
    ]

    headers.forEach(h => {
      page.drawText(h.text, { 
        x: h.x, 
        y: yPos - 14, 
        size: 9, 
        font: fontBold, 
        color: rgb(1, 1, 1) 
      })
    })

    yPos -= 28

    // Righe prenotazioni
    if (prenotazioni && prenotazioni.length > 0) {
      prenotazioni.forEach((p: any, index: number) => {
        // Controlla se serve nuova pagina
        if (yPos < 180) {
          page = pdfDoc.addPage([595, 842])
          yPos = height - 50
          
          // Ri-disegna header tabella
          page.drawRectangle({ 
            x: 50, 
            y: yPos - 20, 
            width: 495, 
            height: 22, 
            color: rgb(0.1, 0.3, 0.6) 
          })
          headers.forEach(h => {
            page.drawText(h.text, { 
              x: h.x, 
              y: yPos - 14, 
              size: 9, 
              font: fontBold, 
              color: rgb(1, 1, 1) 
            })
          })
          yPos -= 28
        }

        // Riga alternata
        if (index % 2 === 0) {
          page.drawRectangle({ 
            x: 50, 
            y: yPos - 14, 
            width: 495, 
            height: 18, 
            color: rgb(0.96, 0.96, 0.96) 
          })
        }

        const dataFormatted = p.data_servizio 
          ? new Date(p.data_servizio).toLocaleDateString('it-IT') 
          : '-'

        page.drawText(dataFormatted, { 
          x: 55, 
          y: yPos - 10, 
          size: 8, 
          font: fontRegular, 
          color: rgb(0, 0, 0) 
        })
        
        page.drawText((p.codice_prenotazione || '-').substring(0, 12), { 
          x: 115, 
          y: yPos - 10, 
          size: 8, 
          font: fontRegular, 
          color: rgb(0, 0, 0) 
        })
        
        page.drawText((p.servizio_nome || p.nome_servizio || '-').substring(0, 24), { 
          x: 185, 
          y: yPos - 10, 
          size: 8, 
          font: fontRegular, 
          color: rgb(0, 0, 0) 
        })
        
        page.drawText((p.cliente_nome || p.nome_cliente || '-').substring(0, 18), { 
          x: 315, 
          y: yPos - 10, 
          size: 8, 
          font: fontRegular, 
          color: rgb(0, 0, 0) 
        })
        
        page.drawText(`€${Number(p.prezzo_totale || 0).toFixed(2)}`, { 
          x: 415, 
          y: yPos - 10, 
          size: 8, 
          font: fontRegular, 
          color: rgb(0, 0, 0) 
        })
        
        page.drawText(`€${Number(p.totale_incassato || 0).toFixed(2)}`, { 
          x: 480, 
          y: yPos - 10, 
          size: 8, 
          font: fontRegular, 
          color: rgb(0, 0, 0) 
        })

        yPos -= 18
      })
    } else {
      page.drawText('Nessuna prenotazione nel periodo selezionato', { 
        x: 55, 
        y: yPos - 10, 
        size: 10, 
        font: fontRegular, 
        color: rgb(0.5, 0.5, 0.5) 
      })
      yPos -= 25
    }

    // ============ BOX RIEPILOGO ============
    yPos -= 40
    const boxRiepilogoHeight = 120
    
    page.drawRectangle({ 
      x: 300, 
      y: yPos - boxRiepilogoHeight, 
      width: 245, 
      height: boxRiepilogoHeight, 
      borderColor: rgb(0.1, 0.3, 0.6), 
      borderWidth: 2,
      color: rgb(0.98, 0.98, 1)
    })

    page.drawText('RIEPILOGO', { 
      x: 315, 
      y: yPos - 20, 
      size: 12, 
      font: fontBold, 
      color: rgb(0.1, 0.3, 0.6) 
    })

    // Righe riepilogo
    const riepilogoY = yPos - 45
    
    page.drawText('Numero prenotazioni:', { 
      x: 315, 
      y: riepilogoY, 
      size: 10, 
      font: fontRegular, 
      color: rgb(0.3, 0.3, 0.3) 
    })
    page.drawText(`${prenotazioni?.length || 0}`, { 
      x: 490, 
      y: riepilogoY, 
      size: 10, 
      font: fontBold, 
      color: rgb(0, 0, 0) 
    })

    page.drawText('Fatturato lordo:', { 
      x: 315, 
      y: riepilogoY - 18, 
      size: 10, 
      font: fontRegular, 
      color: rgb(0.3, 0.3, 0.3) 
    })
    page.drawText(`€${totali.fatturato.toFixed(2)}`, { 
      x: 470, 
      y: riepilogoY - 18, 
      size: 10, 
      font: fontBold, 
      color: rgb(0, 0, 0) 
    })

    page.drawText(`Commissione (${fornitore.percentuale_commissione}%):`, { 
      x: 315, 
      y: riepilogoY - 36, 
      size: 10, 
      font: fontRegular, 
      color: rgb(0.3, 0.3, 0.3) 
    })
    page.drawText(`- €${totali.commissioni.toFixed(2)}`, { 
      x: 465, 
      y: riepilogoY - 36, 
      size: 10, 
      font: fontBold, 
      color: rgb(0.8, 0.2, 0.2) 
    })

    // Linea separatrice
    page.drawLine({ 
      start: { x: 315, y: riepilogoY - 50 }, 
      end: { x: 530, y: riepilogoY - 50 }, 
      thickness: 1, 
      color: rgb(0.7, 0.7, 0.7) 
    })

    // Totale netto
    page.drawText('NETTO DA CORRISPONDERE:', { 
      x: 315, 
      y: riepilogoY - 68, 
      size: 10, 
      font: fontBold, 
      color: rgb(0, 0, 0) 
    })
    page.drawText(`€${totali.netto.toFixed(2)}`, { 
      x: 465, 
      y: riepilogoY - 68, 
      size: 14, 
      font: fontBold, 
      color: rgb(0.1, 0.5, 0.2) 
    })

    // ============ FOOTER ============
    page.drawText('Documento generato automaticamente dal sistema Blu Alliance Booking', { 
      x: 140, 
      y: 30, 
      size: 8, 
      font: fontRegular, 
      color: rgb(0.6, 0.6, 0.6) 
    })

    // Salva PDF
    const pdfBytes = await pdfDoc.save()

    // Restituisci come file PDF
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="estratto-conto-${fornitore.ragione_sociale.replace(/\s+/g, '-')}-${mese}.pdf"`,
        'Content-Length': pdfBytes.length.toString()
      }
    })

  } catch (error: any) {
    console.error('Errore generazione PDF:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}