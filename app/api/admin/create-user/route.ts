import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Client admin con service_role — solo server-side, mai esposto al frontend
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, nome, cognome, ruolo, fornitore_id } = body

    if (!email || !password || !nome || !cognome || !ruolo) {
      return NextResponse.json({ error: 'Campi obbligatori mancanti' }, { status: 400 })
    }

    // Crea utente in Supabase Auth con email già confermata (nessuna email di verifica)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // ← account subito attivo, nessuna conferma necessaria
      user_metadata: { nome, cognome }
    })

    if (authError) {
      if (authError.message.includes('already been registered')) {
        return NextResponse.json({ error: 'Email già esistente' }, { status: 409 })
      }
      throw authError
    }

    if (!authData.user) {
      throw new Error('Errore nella creazione utente')
    }

    // Inserisce nella tabella amministratori
    const { error: adminError } = await supabaseAdmin
      .from('amministratori')
      .insert([{
        user_id: authData.user.id,
        email,
        nome,
        cognome,
        ruolo,
        fornitore_id: ruolo === 'operatore' ? (fornitore_id || null) : null,
        attivo: true
      }])

    if (adminError) {
      // Rollback: elimina l'utente auth se l'insert fallisce
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw adminError
    }

    return NextResponse.json({ success: true, userId: authData.user.id })

  } catch (error: any) {
    console.error('Errore creazione utente:', error)
    return NextResponse.json({ error: error.message || 'Errore interno' }, { status: 500 })
  }
}