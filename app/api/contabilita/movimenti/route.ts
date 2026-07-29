import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── GET: lista unificata movimenti + entrate da prenotazioni ──
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dataInizio = searchParams.get('data_inizio')
    const dataFine = searchParams.get('data_fine')
    const categoriaId = searchParams.get('categoria_id')
    const fornitoreId = searchParams.get('fornitore_id')
    const tipo = searchParams.get('tipo')
    const annoStr = searchParams.get('anno')
    const origineFilter = searchParams.get('origine')

    let query = supabase
      .from('v_movimenti_completi')
      .select('*')
      .order('data_competenza', { ascending: false })

    if (dataInizio) query = query.gte('data_competenza', dataInizio)
    if (dataFine) query = query.lte('data_competenza', dataFine)
    if (categoriaId) query = query.eq('categoria_id', categoriaId)
    if (fornitoreId) query = query.eq('fornitore_id', fornitoreId)
    if (tipo === 'entrata' || tipo === 'uscita') query = query.eq('tipo', tipo)
    if (origineFilter) query = query.eq('origine', origineFilter)
    if (annoStr) {
      const anno = parseInt(annoStr)
      if (!isNaN(anno)) query = query.eq('anno', anno)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Ricostruisci la struttura nidificata che il frontend si aspetta
    const movimenti = (data || []).map((m: any) => ({
      id: m.id,
      numero_progressivo: m.numero_progressivo,
      anno: m.anno,
      data_competenza: m.data_competenza,
      data_pagamento: m.data_pagamento,
      descrizione: m.descrizione,
      imponibile: Number(m.imponibile) || 0,
      aliquota_iva: Number(m.aliquota_iva) || 0,
      iva: Number(m.iva) || 0,
      totale: Number(m.totale) || 0,
      tipo: m.tipo,
      numero_documento: m.numero_documento,
      data_documento: m.data_documento,
      allegato_url: m.allegato_url,
      origine: m.origine,
      note: m.note,
      fornitore_descrizione: m.fornitore_descrizione,
      categoria: m.categoria_id ? {
        id: m.categoria_id,
        codice: m.categoria_codice,
        nome: m.categoria_nome,
        tipo: m.categoria_tipo,
        rilevante_iva: m.categoria_rilevante_iva,
      } : null,
      metodo_pagamento: m.metodo_pagamento_id ? {
        id: m.metodo_pagamento_id,
        nome: m.metodo_pagamento_nome,
      } : null,
      fornitore: m.fornitore_id ? {
        id: m.fornitore_id,
        ragione_sociale: m.fornitore_ragione_sociale,
      } : null,
    }))

    // Fornitori per il dropdown filtro
    const { data: fornitori } = await supabase
      .from('fornitori')
      .select('id, ragione_sociale')
      .eq('attivo', true)
      .order('ragione_sociale')

    return NextResponse.json({
      movimenti,
      fornitori: (fornitori || []).map((f: any) => ({ id: f.id, nome: f.ragione_sociale })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── POST: crea nuovo movimento (sempre nella tabella movimenti, mai virtuali) ──
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const required = ['data_competenza', 'categoria_id', 'descrizione', 'imponibile', 'tipo']
    for (const f of required) {
      if (body[f] === undefined || body[f] === null || body[f] === '') {
        return NextResponse.json({ error: `Campo obbligatorio mancante: ${f}` }, { status: 400 })
      }
    }
    if (!['entrata', 'uscita'].includes(body.tipo)) {
      return NextResponse.json({ error: 'Tipo deve essere entrata o uscita' }, { status: 400 })
    }
    const imponibile = Number(body.imponibile)
    if (isNaN(imponibile) || imponibile < 0) {
      return NextResponse.json({ error: 'Imponibile non valido' }, { status: 400 })
    }
    const aliquota = body.aliquota_iva !== undefined ? Number(body.aliquota_iva) : 0
    if (isNaN(aliquota) || aliquota < 0 || aliquota > 100) {
      return NextResponse.json({ error: 'Aliquota IVA non valida' }, { status: 400 })
    }

    const insertData: Record<string, any> = {
      data_competenza: body.data_competenza,
      data_pagamento: body.data_pagamento || null,
      categoria_id: body.categoria_id,
      metodo_pagamento_id: body.metodo_pagamento_id || null,
      fornitore_id: body.fornitore_id || null,
      fornitore_descrizione: body.fornitore_descrizione || null,
      descrizione: body.descrizione.trim(),
      imponibile,
      aliquota_iva: aliquota,
      tipo: body.tipo,
      numero_documento: body.numero_documento || null,
      data_documento: body.data_documento || null,
      allegato_url: body.allegato_url || null,
      origine: 'manuale',
      note: body.note || null,
    }

    const { data, error } = await supabase
      .from('movimenti')
      .insert(insertData)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ movimento: data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
