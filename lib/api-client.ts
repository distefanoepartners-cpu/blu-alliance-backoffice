// lib/api-client.ts
// Wrapper fetch che allega il Bearer token Supabase corrente.
// Usa nei componenti/pagine al posto di fetch().
import { supabase } from './supabase'

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return fetch(input, { ...init, headers })
}