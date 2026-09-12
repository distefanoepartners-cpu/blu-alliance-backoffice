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
    // Carichiamo TUTTE le barche attive; il flag tour_collettivi_attivi
    // permette al frontend di distinguere la rotazione collettivi da quella privati.
    const { data: imbarcazioni, error: errImb } = await supabase
      .from('imbarcazioni')
      .select('id, nome, tipo, categoria, capacita_massima, capacita_collettiva_override, tour_collettivi_attivi, minimo_pax_collettivo, fornitore_id, ordine')
      .eq('attiva', true)
      .order('ordine', { ascending: true })

    if (errImb) return NextResponse.json({ error: errImb.message }, { status: 500 })

    // ── 3. Fornitori ────────────────────────────────────────────────
    const { data: fornitori, error: errForn } = await supabase
      .from('fornitori')
      .select('id, ragione_sociale')
      .order('ragione_sociale')

    if (errForn) return NextResponse.json({ error: errForn.message }, { status: 500 })

    // ── 4. Storico prenotazioni ultimi 365 giorni ───────────────────
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 365)

    const { data: storico, error: errStor } = await supabase
      .from('vista_prenotazioni_complete')
      .select('imbarcazione_id, imbarcazione_nome, fornitore_id, fornitore_nome, data_servizio, numero_persone, servizio_tipo, stato')
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

    // ── 6. Blocchi imbarcazioni (indisponibilità) — solo recenti/futuri ───────
    // Carichiamo solo i blocchi con data_fine dagli ultimi 30 giorni in poi:
    // sono quelli rilevanti per l'analisi disponibilità corrente, ed evita
    // il limite di default di 1000 righe di Supabase (i blocchi storici sono >1300).
    const trentaGiorniFa = new Date()
    trentaGiorniFa.setDate(trentaGiorniFa.getDate() - 30)
    const { data: blocchi } = await supabase
      .from('blocchi_imbarcazioni')
      .select('imbarcazione_id, data_inizio, data_fine, motivo, note')
      .gte('data_fine', trentaGiorniFa.toISOString().split('T')[0])
      .order('data_inizio', { ascending: false })
      .limit(2000)

    // ── 7. Posti esterni (occupazione da prenotazioni esterne) — recenti ───
    const { data: postiEsterni } = await supabase
      .from('posti_esterni')
      .select('imbarcazione_id, data, posti_occupati')
      .gte('data', trentaGiorniFa.toISOString().split('T')[0])
      .gt('posti_occupati', 0)
      .limit(2000)

    return NextResponse.json({
      navi: navi || [],
      imbarcazioni: imbarcazioni || [],
      fornitori: (fornitori || []).map((f: any) => ({ id: f.id, nome: f.ragione_sociale })),
      storico: storico || [],
      assegnate,
      blocchi: blocchi || [],
      postiEsterni: postiEsterni || [],
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}