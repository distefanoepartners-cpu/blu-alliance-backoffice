// lib/auth-server.ts
// Auth helper per Next.js Route Handlers.
// Verifica il JWT contro il server Supabase Auth e carica il profilo da `amministratori`.
import { NextResponse } from 'next/server'
import { supabaseAdmin } from './supabase-admin'

export interface AuthedUser {
  id: string                  // auth.users.id
  email: string
  amministratoreId: string    // amministratori.id
  ruolo: 'admin' | 'operatore' | 'staff' | 'partner'
  fornitoreId: string | null
  isAdmin: boolean            // true se admin o staff
  isOperatore: boolean        // true se operatore o partner
}

/**
 * Estrae e verifica il Bearer token, carica il profilo da `amministratori`.
 * Ritorna AuthedUser oppure NextResponse di errore (401/403/500).
 *
 * Uso:
 *   const auth = await requireAuth(request)
 *   if (auth instanceof NextResponse) return auth
 *   // qui auth è tipizzato AuthedUser
 */
export async function requireAuth(request: Request): Promise<AuthedUser | NextResponse> {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 })
  }
  const token = authHeader.substring(7).trim()
  if (!token) {
    return NextResponse.json({ error: 'Token vuoto' }, { status: 401 })
  }

  // getUser(token) valida il JWT chiamando il server auth di Supabase
  // (NON si fida del payload locale)
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !user) {
    return NextResponse.json({ error: 'Token non valido o scaduto' }, { status: 401 })
  }

  // Profilo applicativo
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('amministratori')
    .select('id, email, ruolo, fornitore_id, attivo')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[requireAuth] errore profilo:', profileError)
    return NextResponse.json({ error: 'Errore caricamento profilo' }, { status: 500 })
  }
  if (!profile) {
    return NextResponse.json({ error: 'Utente non autorizzato' }, { status: 403 })
  }
  if (profile.attivo === false) {
    return NextResponse.json({ error: 'Utente disattivato' }, { status: 403 })
  }

  const ruolo = (profile.ruolo || 'operatore') as AuthedUser['ruolo']
  return {
    id: user.id,
    email: profile.email || user.email || '',
    amministratoreId: profile.id,
    ruolo,
    fornitoreId: profile.fornitore_id || null,
    isAdmin: ruolo === 'admin' || ruolo === 'staff',
    isOperatore: ruolo === 'operatore' || ruolo === 'partner',
  }
}