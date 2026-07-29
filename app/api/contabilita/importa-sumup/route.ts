import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════
// POST /api/contabilita/importa-sumup
// Inserisce i movimenti uscita importati dall'estratto SumUp.
// Deduplicazione: la colonna riferimento_esterno ha un indice unico,
// quindi i codici transazione già presenti vengono saltati.
//
// NB: allineato al pattern di /api/contabilita/movimenti (POST):
// passa solo imponibile + aliquota_iva; iva, totale e numero_progressivo
// sono calcolati/gestiti dal database (trigger/colonne generate).
// ═══════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface MovimentoInput {
  data: string         // YYYY-MM-DD
  codice: string       // codice transazione SumUp
  descrizione: string
  importo: number      // positivo
  tipo: 'entrata' | 'uscita'
  categoria_id: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const movimenti: MovimentoInput[] = body.movimenti || []

    if (!Array.isArray(movimenti) || movimenti.length === 0) {
      return NextResponse.json({ error: 'Nessun movimento da importare' }, { status: 400 })
    }

    // 1. Recupera i codici già presenti (dedup su riferimento_esterno)
    const codici = movimenti.map(m => `SUMUP:${m.codice}`)
    const { data: esistenti } = await supabase
      .from('movimenti')
      .select('riferimento_esterno')
      .in('riferimento_esterno', codici)

    const giaPresenti = new Set((esistenti || []).map(e => e.riferimento_esterno))

    // 2. Filtra solo i nuovi
    const nuovi = movimenti.filter(m => !giaPresenti.has(`SUMUP:${m.codice}`))
    const duplicati = movimenti.length - nuovi.length

    if (nuovi.length === 0) {
      return NextResponse.json({ inseriti: 0, duplicati, message: 'Tutti i movimenti erano già presenti' })
    }

    // 3. Costruisci le righe — stesso set di campi del POST funzionante.
    //    iva, totale, numero_progressivo, anno → gestiti dal DB.
    const rows = nuovi.map(m => ({
      data_competenza: m.data,
      data_pagamento: m.data,
      categoria_id: m.categoria_id,
      metodo_pagamento_id: null,
      fornitore_id: null,
      fornitore_descrizione: m.descrizione,
      descrizione: m.descrizione,
      imponibile: m.importo,    // estratto non scorpora IVA
      aliquota_iva: 0,
      tipo: m.tipo === 'entrata' ? 'entrata' : 'uscita',
      numero_documento: null,
      data_documento: null,
      allegato_url: null,
      origine: 'manuale',       // stesso valore del POST funzionante (evita CHECK constraint)
      note: 'Import estratto SumUp',
      riferimento_esterno: `SUMUP:${m.codice}`,
    }))

    // 4. Insert in blocco
    const { data: inseriti, error } = await supabase
      .from('movimenti')
      .insert(rows)
      .select('id')

    if (error) {
      console.error('[importa-sumup] insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      inseriti: inseriti?.length || 0,
      duplicati,
    })

  } catch (error: any) {
    console.error('[importa-sumup] error:', error)
    return NextResponse.json({ error: error.message || 'Errore interno' }, { status: 500 })
  }
}