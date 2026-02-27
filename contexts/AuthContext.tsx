'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface AuthUser {
  id: string
  email: string
  full_name?: string
  supplier_name?: string
  role: 'admin' | 'operatore' | 'staff' | 'partner'
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  isAdmin: boolean
  isPartner: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  isPartner: false,
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) await loadUser(session.user)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (session?.user) await loadUser(session.user)
      else { setUser(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadUser(authUser: any) {
    try {
      // Usa la tabella utenti esistente con i tuoi campi (role admin/operatore)
      const { data } = await supabase
        .from('utenti')
        .select('id, email, nome, cognome, ruolo, fornitore_id')
        .eq('auth_id', authUser.id)
        .maybeSingle()

      setUser({
        id: authUser.id,
        email: authUser.email || '',
        full_name: data ? `${data.nome || ''} ${data.cognome || ''}`.trim() : authUser.email,
        role: data?.ruolo || 'operatore',
      })
    } catch {
      // Fallback minimo — non rompe nulla
      setUser({ id: authUser.id, email: authUser.email || '', role: 'operatore' })
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAdmin: user?.role === 'admin',
      isPartner: false, // Non usato nel tuo schema attuale
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}