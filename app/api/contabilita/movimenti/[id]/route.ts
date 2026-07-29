import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Next.js 15+: i params sono asincroni e vanno awaitati
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { data, error } = await supabase
      .from('movimenti')
      .select(`
        *,
        categoria:categorie_contabili(id, codice, nome, tipo, rilevante_iva),
        metodo_pagamento:metodi_pagamento(id, nome),
        fornitore:fornitori(id, ragione_sociale, partita_iva)
      `)
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json({ movimento: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const body = await request.json()

    // Solo movimenti manuali sono modificabili (quelli automatici si rigenerano)
    const { data: existing } = await supabase
      .from('movimenti')
      .select('origine')
      .eq('id', id)
      .single()

    if (existing && existing.origine !== 'manuale') {
      return NextResponse.json(
        { error: 'I movimenti generati automaticamente non sono modificabili manualmente' },
        { status: 403 }
      )
    }

    const allowedFields = [
      'data_competenza', 'data_pagamento', 'categoria_id', 'metodo_pagamento_id',
      'fornitore_id', 'fornitore_descrizione', 'descrizione', 'imponibile',
      'aliquota_iva', 'tipo', 'numero_documento', 'data_documento',
      'allegato_url', 'note',
    ]
    const updateData: Record<string, any> = {}
    for (const f of allowedFields) {
      if (f in body) updateData[f] = body[f]
    }
    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('movimenti')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ movimento: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params

    const { data: existing } = await supabase
      .from('movimenti')
      .select('origine')
      .eq('id', id)
      .single()

    if (existing && existing.origine !== 'manuale') {
      return NextResponse.json(
        { error: 'I movimenti generati automaticamente non possono essere eliminati direttamente' },
        { status: 403 }
      )
    }

    const { error } = await supabase
      .from('movimenti')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
