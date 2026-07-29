import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

function eur(n: number) {
  return 'EUR ' + Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export async function POST(request: NextRequest) {
  try {
    const { estratti, mese, anno, totals } = await request.json()
    if (!estratti || !mese || !anno) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })
    }

    const meseTesto = `${MESI[mese - 1]} ${anno}`
    const pdfDoc = await PDFDocument.create()
    // A4 landscape
    const page = pdfDoc.addPage([842, 595])
    const { width, height } = page.getSize()
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica)

    let y = height - 50

    // ===== Intestazione Blu Alliance =====
    page.drawText('BLU ALLIANCE', { x: 50, y, size: 20, font: fontBold, color: rgb(0.1, 0.3, 0.6) })
    y -= 16
    page.drawText('Consorzio Turistico Nautico - Porto di Salerno', { x: 50, y, size: 10, font: fontReg, color: rgb(0.4, 0.4, 0.4) })
    y -= 13
    page.drawText('Via Zammarelli 12 - 84127 Salerno', { x: 50, y, size: 9, font: fontReg, color: rgb(0.45, 0.45, 0.45) })
    y -= 12
    page.drawText('C.F./P.IVA 06411140657  -  Codice SDI KRRH6B9', { x: 50, y, size: 9, font: fontReg, color: rgb(0.45, 0.45, 0.45) })

    page.drawText(`Generato il: ${new Date().toLocaleDateString('it-IT')}`, { x: 680, y: height - 50, size: 9, font: fontReg, color: rgb(0.5, 0.5, 0.5) })

    // ===== Titolo =====
    y -= 28
    page.drawText(`Riepilogo Estratti Conto Soci - ${meseTesto}`, { x: 50, y, size: 15, font: fontBold, color: rgb(0, 0, 0) })

    // ===== Box totali =====
    y -= 30
    const t = totals || { lordo: 0, commissione: 0, netto: 0, prenotazioni: 0 }
    const boxes = [
      { label: 'Soci con prenotazioni', val: String(estratti.length) },
      { label: 'Lordo incassato', val: eur(t.lordo) },
      { label: 'Commissione BA', val: eur(t.commissione) },
      { label: 'Netto da pagare ai soci', val: eur(t.netto) },
    ]
    const boxW = 185
    boxes.forEach((b, i) => {
      const bx = 50 + i * (boxW + 8)
      page.drawRectangle({ x: bx, y: y - 42, width: boxW, height: 42, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1, color: rgb(0.98, 0.98, 0.98) })
      page.drawText(b.val, { x: bx + 10, y: y - 20, size: 13, font: fontBold, color: rgb(0.1, 0.3, 0.6) })
      page.drawText(b.label, { x: bx + 10, y: y - 35, size: 8, font: fontReg, color: rgb(0.4, 0.4, 0.4) })
    })

    // ===== Tabella =====
    y -= 65
    // Header
    page.drawRectangle({ x: 50, y: y - 18, width: 742, height: 20, color: rgb(0.94, 0.94, 0.94) })
    const cols = [
      { t: 'Socio', x: 55 },
      { t: 'P.IVA', x: 320 },
      { t: 'Pren.', x: 440 },
      { t: 'Lordo', x: 510 },
      { t: 'Commissione', x: 610 },
      { t: 'Netto', x: 720 },
    ]
    cols.forEach(c => page.drawText(c.t, { x: c.x, y: y - 13, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) }))
    y -= 25

    estratti.forEach((e: any, i: number) => {
      if (y < 60) {
        // nuova pagina se serve
        return
      }
      if (i % 2 === 0) {
        page.drawRectangle({ x: 50, y: y - 12, width: 742, height: 16, color: rgb(0.985, 0.985, 0.985) })
      }
      const nome = (e.fornitore?.ragione_sociale || '-').substring(0, 42)
      const piva = e.fornitore?.partita_iva || '-'
      page.drawText(nome, { x: 55, y: y - 8, size: 8, font: fontReg, color: rgb(0, 0, 0) })
      page.drawText(piva, { x: 320, y: y - 8, size: 8, font: fontReg, color: rgb(0.3, 0.3, 0.3) })
      page.drawText(String(e.numero_prenotazioni || 0), { x: 445, y: y - 8, size: 8, font: fontReg, color: rgb(0, 0, 0) })
      page.drawText(eur(e.totale_lordo), { x: 510, y: y - 8, size: 8, font: fontReg, color: rgb(0, 0, 0) })
      page.drawText('- ' + eur(e.commissione_consorzio), { x: 610, y: y - 8, size: 8, font: fontReg, color: rgb(0.8, 0.2, 0.2) })
      page.drawText(eur(e.netto_socio), { x: 715, y: y - 8, size: 8, font: fontBold, color: rgb(0.1, 0.5, 0.2) })
      y -= 16
    })

    // Riga totali
    y -= 4
    page.drawLine({ start: { x: 50, y: y + 8 }, end: { x: 792, y: y + 8 }, thickness: 1, color: rgb(0.6, 0.6, 0.6) })
    page.drawText('TOTALE', { x: 55, y: y - 6, size: 9, font: fontBold, color: rgb(0, 0, 0) })
    page.drawText(String(t.prenotazioni || 0), { x: 445, y: y - 6, size: 9, font: fontBold, color: rgb(0, 0, 0) })
    page.drawText(eur(t.lordo), { x: 510, y: y - 6, size: 9, font: fontBold, color: rgb(0, 0, 0) })
    page.drawText('- ' + eur(t.commissione), { x: 610, y: y - 6, size: 9, font: fontBold, color: rgb(0.8, 0.2, 0.2) })
    page.drawText(eur(t.netto), { x: 715, y: y - 6, size: 9, font: fontBold, color: rgb(0.1, 0.5, 0.2) })

    // Footer
    page.drawText('Documento generato automaticamente dal sistema Blu Alliance', { x: 50, y: 30, size: 8, font: fontReg, color: rgb(0.6, 0.6, 0.6) })

    const pdfBytes = await pdfDoc.save()
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="riepilogo-estratti-${anno}-${String(mese).padStart(2, '0')}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('Errore riepilogo PDF:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}