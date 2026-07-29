import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get('from') || new Date().toISOString().split('T')[0]
    const naveId = searchParams.get('nave_id')

    // ── 1. Prossimi arrivi navi ─────────────────────────────────────
    let naviQuery = supabase
      .from('arrivi_navi')
      .select('*')
      .gte('data_arrivo', fromDate)
      .order('data_arrivo', { ascending: true })
      .limit(10)

    const { data: navi, error: errNavi } = await naviQuery
    if (errNavi) return NextResponse.json({ error: errNavi.message }, { status: 500 })

    // ── 2. Imbarcazioni attive con fornitore ────────────────────────
    const { data: imbarcazioni, error: errImb } = await supabase
      .from('imbarcazioni')
      .select('id, nome, tipo, categoria, capacita_massima, capacita_collettiva_override, tour_collettivi_attivi, fornitore_id, ordine')
      .eq('tour_collettivi_attivi', true)
      .order('ordine', { ascending: true })

    if (errImb) return NextResponse.json({ error: errImb.message }, { status: 500 })

    // ── 3. Fornitori ────────────────────────────────────────────────
    const { data: fornitori, error: errForn } = await supabase
      .from('fornitori')
      .select('id, ragione_sociale')
      .order('ragione_sociale')

    if (errForn) return NextResponse.json({ error: errForn.message }, { status: 500 })

    // ── 4. Storico prenotazioni ultimi 60 giorni ────────────────────
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 365)

    const { data: storico, error: errStor } = await supabase
      .from('vista_prenotazioni_complete')
      .select('imbarcazione_nome, fornitore_id, fornitore_nome, data_servizio, numero_persone')
      .not('stato', 'eq', 'cancellata')
      .gte('data_servizio', sixtyDaysAgo.toISOString().split('T')[0])
      .order('data_servizio', { ascending: false })

    if (errStor) return NextResponse.json({ error: errStor.message }, { status: 500 })

    // ── 5. Prenotazioni già assegnate per le date delle navi ────────
    const naviDates = (navi || []).map((n: any) => n.data_arrivo)
    let assegnate: any[] = []
    if (naviDates.length > 0) {
      const { data: ass, error: errAss } = await supabase
        .from('prenotazioni')
        .select('imbarcazione_id, data_servizio, numero_persone, stato')
        .in('data_servizio', naviDates)
        .not('stato', 'eq', 'cancellata')

      if (!errAss) assegnate = ass || []
    }

    return NextResponse.json({
      navi: navi || [],
      imbarcazioni: imbarcazioni || [],
      fornitori: (fornitori || []).map((f: any) => ({ id: f.id, nome: f.ragione_sociale })),
      storico: storico || [],
      assegnate,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}