import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const annoStr = searchParams.get('anno')
    const meseStr = searchParams.get('mese')

    let query = supabase
      .from('estratti_conto_soci')
      .select(`
        id, anno, mese, totale_lordo, percentuale_commissione,
        commissione_consorzio, netto_socio, numero_prenotazioni, stato,
        pdf_url, data_invio_socio, fattura_numero, fattura_data,
        fattura_imponibile, fattura_iva, fattura_totale, data_pagamento,
        created_at, updated_at,
        fornitore:fornitori(id, ragione_sociale, email, partita_iva)
      `)
      .order('netto_socio', { ascending: false })

    if (annoStr) {
      const anno = parseInt(annoStr)
      if (!isNaN(anno)) query = query.eq('anno', anno)
    }
    if (meseStr) {
      const mese = parseInt(meseStr)
      if (!isNaN(mese)) query = query.eq('mese', mese)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ estratti: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
