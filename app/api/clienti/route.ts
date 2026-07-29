// app/api/clienti/route.ts
// CRUD clienti server-side con service_role (bypassa RLS) + auth check
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth-server'

// ────────────────────────────────────────────────
// GET /api/clienti?email=xxx&limit=20
// Lista o ricerca per email
// ────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabaseAdmin
      .from('clienti')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (email) query = query.eq('email', email)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ clienti: data || [] })
  } catch (error: any) {
    console.error('GET /api/clienti error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ────────────────────────────────────────────────
// POST /api/clienti - crea nuovo cliente
// ────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()

    // Validazione campi obbligatori
    if (!body.nome?.trim() || !body.cognome?.trim()) {
      return NextResponse.json(
        { error: 'Nome e cognome sono obbligatori' },
        { status: 400 }
      )
    }

    // Se email fornita, controlla che non esista già
    if (body.email) {
      const { data: existing } = await supabaseAdmin
        .from('clienti')
        .select('id, nome, cognome, email')
        .eq('email', body.email)
        .maybeSingle()

      if (existing) {
        // Cliente esiste: ritorna quello esistente (no errore)
        return NextResponse.json({ cliente: existing, existing: true })
      }
    }

    // INSERT nuovo cliente
    const { data, error } = await supabaseAdmin
      .from('clienti')
      .insert([{
        nome: body.nome.trim(),
        cognome: body.cognome.trim(),
        email: body.email?.trim() || null,
        telefono: body.telefono?.trim() || null,
        nazione: body.nazione || 'IT',
        lingua_preferita: body.lingua_preferita || 'it',
        tipo_documento: body.tipo_documento || null,
        numero_documento: body.numero_documento || null,
        scadenza_documento: body.scadenza_documento || null,
        patente_nautica: body.patente_nautica || null,
        scadenza_patente_nautica: body.scadenza_patente_nautica || null,
        note: body.note || null,
      }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ cliente: data, existing: false }, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/clienti error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}