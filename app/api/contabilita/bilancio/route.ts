import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ═══════════════════════════════════════════════════════════════
// GET /api/contabilita/bilancio?dal=YYYY-MM-DD&al=YYYY-MM-DD
// Bilancio provvisorio per competenza, aggregato per categoria.
// Legge dalla vista unificata v_movimenti_completi (movimenti manuali
// + entrate da prenotazioni). Separa "Ricavi gestione" da "Apporti soci".
// ═══════════════════════════════════════════════════════════════

// Categorie che rappresentano APPORTI dei soci (non ricavi di gestione)
const CATEGORIE_APPORTI = ['Versamento Soci', 'Restituzione Versamenti Soci']

interface RigaCategoria {
  categoria_nome: string
  num_movimenti: number
  imponibile: number
  iva: number
  totale: number
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dal = searchParams.get('dal') || `${new Date().getFullYear()}-01-01`
    const al = searchParams.get('al') || new Date().toISOString().slice(0, 10)

    // Leggo tutte le righe del periodo (competenza)
    const { data, error } = await supabase
      .from('v_movimenti_completi')
      .select('tipo, categoria_nome, imponibile, iva, totale, data_competenza')
      .gte('data_competenza', dal)
      .lte('data_competenza', al)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Aggrego per tipo + categoria
    const mappa = new Map<string, RigaCategoria>()
    for (const r of (data || [])) {
      const tipo = r.tipo === 'entrata' ? 'entrata' : 'uscita'
      const cat = r.categoria_nome || 'Senza categoria'
      const key = `${tipo}::${cat}`
      if (!mappa.has(key)) {
        mappa.set(key, { categoria_nome: cat, num_movimenti: 0, imponibile: 0, iva: 0, totale: 0 })
      }
      const riga = mappa.get(key)!
      riga.num_movimenti += 1
      riga.imponibile += Number(r.imponibile) || 0
      riga.iva += Number(r.iva) || 0
      riga.totale += Number(r.totale) || 0
    }

    // Divido in tre gruppi: ricavi gestione, apporti soci, uscite
    const ricaviGestione: RigaCategoria[] = []
    const apportiSoci: RigaCategoria[] = []
    const uscite: RigaCategoria[] = []

    for (const [key, riga] of mappa.entries()) {
      const [tipo] = key.split('::')
      if (tipo === 'entrata') {
        if (CATEGORIE_APPORTI.includes(riga.categoria_nome)) apportiSoci.push(riga)
        else ricaviGestione.push(riga)
      } else {
        uscite.push(riga)
      }
    }

    // Ordino per imponibile decrescente
    const perImponibile = (a: RigaCategoria, b: RigaCategoria) => b.imponibile - a.imponibile
    ricaviGestione.sort(perImponibile)
    apportiSoci.sort(perImponibile)
    uscite.sort(perImponibile)

    // Totali
    const somma = (arr: RigaCategoria[], campo: keyof RigaCategoria) =>
      arr.reduce((s, r) => s + (r[campo] as number), 0)

    const totRicavi = {
      imponibile: somma(ricaviGestione, 'imponibile'),
      iva: somma(ricaviGestione, 'iva'),
      totale: somma(ricaviGestione, 'totale'),
    }
    const totApporti = {
      imponibile: somma(apportiSoci, 'imponibile'),
      iva: somma(apportiSoci, 'iva'),
      totale: somma(apportiSoci, 'totale'),
    }
    const totUscite = {
      imponibile: somma(uscite, 'imponibile'),
      iva: somma(uscite, 'iva'),
      totale: somma(uscite, 'totale'),
    }

    // Risultato gestione (sull'imponibile) = ricavi - uscite
    const risultatoGestione = totRicavi.imponibile - totUscite.imponibile
    // Saldo complessivo (con apporti soci) sull'imponibile
    const saldoComplessivo = (totRicavi.imponibile + totApporti.imponibile) - totUscite.imponibile

    return NextResponse.json({
      periodo: { dal, al },
      ricaviGestione,
      apportiSoci,
      uscite,
      totali: {
        ricavi: totRicavi,
        apporti: totApporti,
        uscite: totUscite,
        risultatoGestione,
        saldoComplessivo,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}