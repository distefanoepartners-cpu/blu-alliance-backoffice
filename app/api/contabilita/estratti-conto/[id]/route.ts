import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params

    const { data: estratto, error } = await supabase
      .from('estratti_conto_soci')
      .select(`
        *,
        fornitore:fornitori(
          id, ragione_sociale, email, telefono, partita_iva,
          codice_fiscale, indirizzo, citta, cap, provincia, pec
        )
      `)
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 404 })

    const { data: dettaglio } = await supabase
      .from('estratti_conto_soci_dettaglio')
      .select('*')
      .eq('estratto_conto_id', id)
      .order('data_servizio', { ascending: true })

    return NextResponse.json({ estratto, dettaglio: dettaglio || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
