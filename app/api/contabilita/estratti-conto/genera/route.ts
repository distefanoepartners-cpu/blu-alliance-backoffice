import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Genera/rigenera tutti gli estratti conto per un determinato mese.
// Idempotente: ricalcola solo gli estratti in stato 'bozza'; preserva quelli
// già 'inviato' / 'fattura_ricevuta' / 'pagato' / 'contestato'.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const anno = parseInt(body.anno)
    const mese = parseInt(body.mese)

    if (isNaN(anno) || isNaN(mese) || mese < 1 || mese > 12) {
      return NextResponse.json({ error: 'Anno o mese non validi' }, { status: 400 })
    }

    // 1. Calcola i totali per ogni fornitore via vista contabile (cassa-based)
    const { data: calcoli, error: errCalc } = await supabase
      .from('v_calcolo_estratto_conto_socio')
      .select('*')
      .eq('anno', anno)
      .eq('mese', mese)

    if (errCalc) return NextResponse.json({ error: errCalc.message }, { status: 500 })

    if (!calcoli || calcoli.length === 0) {
      return NextResponse.json({
        success: true, generati: 0, aggiornati: 0, preservati: 0,
        message: 'Nessuna prenotazione pagata trovata per questo mese',
      })
    }

    let generati = 0
    let aggiornati = 0
    let preservati = 0

    // Range date per filtrare le prenotazioni del mese
    const meseStr = String(mese).padStart(2, '0')
    const dataInizio = `${anno}-${meseStr}-01`
    const dataFine = mese === 12
      ? `${anno + 1}-01-01`
      : `${anno}-${String(mese + 1).padStart(2, '0')}-01`

    for (const c of calcoli as any[]) {
      // Verifica se esiste già e in che stato
      const { data: existing } = await supabase
        .from('estratti_conto_soci')
        .select('id, stato')
        .eq('fornitore_id', c.fornitore_id)
        .eq('anno', anno)
        .eq('mese', mese)
        .maybeSingle()

      // Estratto già consolidato: preservalo
      if (existing && existing.stato !== 'bozza') {
        preservati++
        continue
      }

      const estrattoData = {
        fornitore_id: c.fornitore_id,
        anno, mese,
        totale_lordo: c.totale_incassato,
        percentuale_commissione: c.percentuale_commissione,
        commissione_consorzio: c.commissione_consorzio,
        netto_socio: c.netto_socio,
        numero_prenotazioni: c.numero_prenotazioni,
        stato: 'bozza' as const,
        updated_at: new Date().toISOString(),
      }

      let estrattoId: string

      if (existing) {
        const { data: updated, error } = await supabase
          .from('estratti_conto_soci')
          .update(estrattoData)
          .eq('id', existing.id)
          .select('id')
          .single()
        if (error || !updated) continue
        estrattoId = updated.id

        // Cancella i vecchi dettagli prima di reinserirli
        await supabase
          .from('estratti_conto_soci_dettaglio')
          .delete()
          .eq('estratto_conto_id', estrattoId)

        aggiornati++
      } else {
        const { data: created, error } = await supabase
          .from('estratti_conto_soci')
          .insert(estrattoData)
          .select('id')
          .single()
        if (error || !created) continue
        estrattoId = created.id
        generati++
      }

      // Carica le prenotazioni di dettaglio (cassa-based)
      const { data: prenotazioni } = await supabase
        .from('v_prenotazioni_contabili')
        .select('id, data_servizio, codice_prenotazione, imbarcazione_nome, servizio_nome, numero_persone, totale_incassato, percentuale_commissione, forfettario, imponibile')
        .eq('fornitore_id', c.fornitore_id)
        .gte('data_servizio', dataInizio)
        .lt('data_servizio', dataFine)
        .gt('totale_incassato', 0)
        .order('data_servizio', { ascending: true })

      if (prenotazioni && prenotazioni.length > 0) {
        const perc = Number(c.percentuale_commissione)
        const dettagli = prenotazioni.map((p: any) => ({
          estratto_conto_id: estrattoId,
          prenotazione_id: p.id,
          data_servizio: p.data_servizio,
          codice_prenotazione: p.codice_prenotazione,
          imbarcazione_nome: p.imbarcazione_nome,
          servizio_nome: p.servizio_nome,
          numero_persone: p.numero_persone,
          importo_lordo: p.totale_incassato,
          commissione_calcolata: Math.round((p.forfettario ? p.imponibile : p.totale_incassato) * perc) / 100,
          netto_calcolato: Math.round((p.forfettario ? p.imponibile : p.totale_incassato) * (100 - perc)) / 100,
        }))

        await supabase
          .from('estratti_conto_soci_dettaglio')
          .insert(dettagli)
      }
    }

    return NextResponse.json({
      success: true,
      generati, aggiornati, preservati,
      totale_processati: generati + aggiornati + preservati,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
