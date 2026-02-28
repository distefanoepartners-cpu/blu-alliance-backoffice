'use client'

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface AuthUser {
  id: string
  email: string
  full_name?: string
  role: 'admin' | 'operatore' | 'staff' | 'partner'
  fornitore_id?: string | null
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  isAdmin: boolean
  isOperatore: boolean
  fornitoreId: string | null
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  isOperatore: false,
  fornitoreId: null,
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          await loadUser(session.user)
        }
      } catch (e) {
        console.error('Auth init error:', e)
      } finally {
        setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        return
      }
      if (session?.user) {
        await loadUser(session.user)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadUser(authUser: any) {
    try {
      const { data, error } = await supabase
        .from('amministratori')
        .select('id, email, nome, cognome, ruolo, fornitore_id, attivo')
        .eq('user_id', authUser.id)
        .maybeSingle()

      if (error) console.error('Errore lettura amministratori:', error)

      if (data && data.attivo !== false) {
        // DEBUG — rimuovere dopo test
        console.log('[Auth] Utente trovato:', data.ruolo, 'fornitore_id:', data.fornitore_id)
        setUser({
          id: authUser.id,
          email: data.email || authUser.email || '',
          full_name: `${data.nome || ''} ${data.cognome || ''}`.trim() || authUser.email,
          role: data.ruolo || 'operatore',
          fornitore_id: data.fornitore_id || null,
        })
      } else {
        console.log('[Auth] Utente NON trovato in amministratori o disattivato, data:', data)
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          full_name: authUser.email,
          role: 'operatore',
          fornitore_id: null,
        })
      }
    } catch (e) {
      console.error('loadUser error:', e)
      setUser({
        id: authUser.id,
        email: authUser.email || '',
        full_name: authUser.email,
        role: 'operatore',
        fornitore_id: null,
      })
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/')
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAdmin: user?.role === 'admin',
      isOperatore: user?.role === 'operatore',
      fornitoreId: user?.fornitore_id || null,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}