import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dataInizio = searchParams.get('data_inizio')
    const dataFine = searchParams.get('data_fine')
    const fornitoreId = searchParams.get('fornitore_id')

    // ── Query prenotazioni ──────────────────────────────────────────
    let query = supabase
      .from('vista_prenotazioni_complete')
      .select('id, data_servizio, servizio_nome, imbarcazione_nome, fornitore_id, fornitore_nome, numero_persone, prezzo_totale, stato')
      .not('stato', 'eq', 'cancellata')
      .order('data_servizio', { ascending: false })

    if (dataInizio) query = query.gte('data_servizio', dataInizio)
    if (dataFine) query = query.lte('data_servizio', dataFine)
    if (fornitoreId) query = query.eq('fornitore_id', fornitoreId)

    const { data: prenotazioni, error: errPren } = await query

    if (errPren) {
      console.error('Errore query prenotazioni:', errPren)
      return NextResponse.json({ error: errPren.message }, { status: 500 })
    }

    // ── Query lista fornitori (per il filtro) ───────────────────────
    const { data: fornitori, error: errForn } = await supabase
      .from('fornitori')
      .select('id, ragione_sociale')
      .eq('attivo', true)
      .order('ragione_sociale')

    if (errForn) {
      console.error('Errore query fornitori:', errForn)
      return NextResponse.json({ error: errForn.message }, { status: 500 })
    }

    return NextResponse.json({
      prenotazioni: prenotazioni || [],
      fornitori: (fornitori || []).map(f => ({
        id: f.id,
        nome: f.ragione_sociale
      }))
    })

  } catch (error: any) {
    console.error('Errore API rendiconto:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}