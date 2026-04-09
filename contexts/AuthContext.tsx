'use client'

import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef, ReactNode } from 'react'
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

// Cache modulo — sopravvive ai remount
let _cachedUser: AuthUser | null = null
let _ready = false

async function loadUserData(authUser: any): Promise<AuthUser> {
  try {
    const { data, error } = await supabase
      .from('amministratori')
      .select('id, email, nome, cognome, ruolo, fornitore_id, attivo')
      .eq('user_id', authUser.id)
      .maybeSingle()

    if (error) console.error('[Auth] Errore lettura amministratori:', error)

    if (data && data.attivo !== false) {
      return {
        id: authUser.id,
        email: data.email || authUser.email || '',
        full_name: `${data.nome || ''} ${data.cognome || ''}`.trim() || authUser.email,
        role: data.ruolo || 'operatore',
        fornitore_id: data.fornitore_id || null,
      }
    }
  } catch (e) {
    console.error('[Auth] loadUser error:', e)
  }

  return {
    id: authUser.id,
    email: authUser.email || '',
    full_name: authUser.email,
    role: 'operatore',
    fornitore_id: null,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(_cachedUser)
  const [loading, setLoading] = useState(!_ready)
  const router = useRouter()
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    // ═══════════════════════════════════════════════
    // Se già pronto da navigazione precedente → usa cache
    // ═══════════════════════════════════════════════
    if (_ready && _cachedUser) {
      setUser(_cachedUser)
      setLoading(false)
    }

    // ═══════════════════════════════════════════════
    // UNICA FONTE DI VERITÀ: onAuthStateChange
    // - INITIAL_SESSION: primo caricamento pagina
    // - SIGNED_IN: dopo login
    // - SIGNED_OUT: dopo logout
    // - TOKEN_REFRESHED: refresh token automatico
    //
    // NON usiamo getSession() perché si blocca
    // su Supabase free tier (cold start 5-10s)
    // ═══════════════════════════════════════════════
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return
      console.log('[Auth] onAuthStateChange:', event)

      if (event === 'SIGNED_OUT') {
        _cachedUser = null
        _ready = true
        setUser(null)
        setLoading(false)
        return
      }

      // Qualsiasi evento con sessione valida → carica utente
      if (session?.user) {
        // Carica dati completi con timeout 5s
        const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), 5000))
        const userPromise = loadUserData(session.user)
        
        const result = await Promise.race([userPromise, timeoutPromise])
        
        const authUser: AuthUser = result || {
          id: session.user.id,
          email: session.user.email || '',
          full_name: session.user.email || '',
          role: 'admin',
          fornitore_id: null,
        }
        
        _cachedUser = authUser
        _ready = true
        if (mountedRef.current) {
          setUser(authUser)
          setLoading(false)
        }
        
        // Se era il timeout, aggiorna in background quando arriva
        if (!result) {
          userPromise.then(fullUser => {
            _cachedUser = fullUser
            if (mountedRef.current) setUser(fullUser)
          }).catch(() => {})
        }
        return
      }

      // Evento senza sessione (es. INITIAL_SESSION senza login)
      _ready = true
      if (mountedRef.current) setLoading(false)
    })

    // Safety timeout — se il listener non emette nulla in 10s
    const timeoutId = setTimeout(() => {
      if (mountedRef.current && !_ready) {
        console.warn('[Auth] Safety timeout 10s — nessun evento ricevuto')
        _ready = true
        setLoading(false)
      }
    }, 10000)

    return () => {
      mountedRef.current = false
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const logout = useCallback(async () => {
    console.log('[Auth] Logout...')
    _cachedUser = null
    _ready = false
    setUser(null)

    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.error('[Auth] signOut error:', e)
    }

    router.push('/')
  }, [router])

  const value = useMemo(() => ({
    user,
    loading,
    isAdmin: user?.role === 'admin' || false,
    isOperatore: user?.role === 'operatore' || false,
    fornitoreId: user?.fornitore_id || null,
    logout,
  }), [user, loading, logout])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}