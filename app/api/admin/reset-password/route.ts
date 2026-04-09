// app/api/admin/reset-password/route.ts
// Chiama Supabase Admin API per cambiare la password di un utente

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // service_role key — solo lato server
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: Request) {
  try {
    const { user_id, new_password } = await req.json()

    if (!user_id || !new_password) {
      return NextResponse.json({ error: 'user_id e new_password sono obbligatori' }, { status: 400 })
    }

    if (new_password.length < 6) {
      return NextResponse.json({ error: 'La password deve essere di almeno 6 caratteri' }, { status: 400 })
    }

    // Aggiorna la password tramite Admin API
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: new_password
    })

    if (error) {
      console.error('[reset-password] Errore Supabase Admin:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, user_id: data.user.id })
  } catch (err: any) {
    console.error('[reset-password] Errore:', err)
    return NextResponse.json({ error: err.message || 'Errore interno' }, { status: 500 })
  }
}