import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEFAULT_RATE = 18

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dataInizio = searchParams.get('data_inizio')
    const dataFine = searchParams.get('data_fine')
    const fornitoreId = searchParams.get('fornitore_id')

    let query = supabase
      .from('vista_prenotazioni_complete')
      .select('id, data_servizio, servizio_nome, imbarcazione_id, imbarcazione_nome, percentuale_commissione, fornitore_id, fornitore_nome, numero_persone, prezzo_totale, stato')
      .not('stato', 'eq', 'cancellata')
      .order('data_servizio', { ascending: false })

    if (dataInizio) query = query.gte('data_servizio', dataInizio)
    if (dataFine) query = query.lte('data_servizio', dataFine)
    if (fornitoreId) query = query.eq('fornitore_id', fornitoreId)

    const { data: prenotazioni, error: errPren } = await query
    if (errPren) return NextResponse.json({ error: errPren.message }, { status: 500 })

    const { data: fornitori, error: errForn } = await supabase
      .from('fornitori')
      .select('id, ragione_sociale, percentuale_commissione, forfettario')
      .order('ragione_sociale')

    if (errForn) return NextResponse.json({ error: errForn.message }, { status: 500 })

    // Mappa fornitore_id -> forfettario (per marcare le prenotazioni)
    const forfettarioById: Record<string, boolean> = {}
    ;(fornitori || []).forEach((f: any) => { forfettarioById[f.id] = !!f.forfettario })

    // Barca in flotta -> 18% fisso.
    // Barca esterna -> percentuale dalla view (COALESCE override, fornitore), fallback 18%.
    const enriched = (prenotazioni || []).map((p: any) => {
      const isEsterna = !p.imbarcazione_id

      const percentuale = isEsterna
        ? (p.percentuale_commissione != null ? Number(p.percentuale_commissione) : DEFAULT_RATE)
        : DEFAULT_RATE

      return {
        id: p.id,
        data_servizio: p.data_servizio,
        servizio_nome: p.servizio_nome,
        imbarcazione_id: p.imbarcazione_id,
        imbarcazione_nome: p.imbarcazione_nome,
        barca_esterna_nome: isEsterna ? p.imbarcazione_nome : null,
        is_esterna: isEsterna,
        percentuale_commissione: percentuale,
        fornitore_id: p.fornitore_id,
        fornitore_nome: p.fornitore_nome,
        forfettario: forfettarioById[p.fornitore_id] || false,
        numero_persone: p.numero_persone,
        prezzo_totale: p.prezzo_totale,
        stato: p.stato,
      }
    })

    return NextResponse.json({
      prenotazioni: enriched,
      fornitori: (fornitori || []).map((f: any) => ({
        id: f.id,
        nome: f.ragione_sociale,
        percentuale_commissione: f.percentuale_commissione != null ? Number(f.percentuale_commissione) : null,
      })),
      default_rate: DEFAULT_RATE,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}