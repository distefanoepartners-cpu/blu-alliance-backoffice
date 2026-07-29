import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo') // 'entrata' | 'uscita' | null

    let query = supabase
      .from('categorie_contabili')
      .select('id, codice, nome, tipo, descrizione, rilevante_iva, ordine')
      .eq('attivo', true)
      .order('ordine', { ascending: true })
      .order('codice', { ascending: true })

    if (tipo === 'entrata' || tipo === 'uscita') {
      query = query.eq('tipo', tipo)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ categorie: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
