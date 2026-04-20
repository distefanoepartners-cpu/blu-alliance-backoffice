'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

let sessionEmail: string | null = null
let sessionName: string | null = null

async function getSessionUser() {
  if (sessionEmail) return { email: sessionEmail, name: sessionName }
  const { data } = await supabase.auth.getSession()
  if (data?.session?.user) {
    sessionEmail = data.session.user.email || 'unknown'
    sessionName = data.session.user.user_metadata?.full_name || data.session.user.email || ''
  }
  return { email: sessionEmail || 'unknown', name: sessionName || '' }
}

export async function trackAction(pagina: string, azione: string, dettagli?: any) {
  try {
    const user = await getSessionUser()
    await supabase.from('activity_log').insert([{
      user_email: user.email,
      user_name: user.name,
      pagina,
      azione,
      dettagli: dettagli || null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 200) : null,
    }])
  } catch (e) { console.warn('Track error:', e) }
}

export function usePageTracker() {
  const pathname = usePathname()
  const lastPath = useRef('')

  useEffect(() => {
    if (pathname && pathname !== lastPath.current) {
      lastPath.current = pathname
      const pageName = pathname.replace('/dashboard/', '').replace('/dashboard', 'home') || 'home'
      trackAction(pageName, 'visita')
    }
  }, [pathname])
}