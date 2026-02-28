'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function InAppNotificationHandler() {
  useEffect(() => {
    // Ascolta nuove prenotazioni in realtime
    const channel = supabase
      .channel('notifiche-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'prenotazioni' },
        (payload) => {
          const p = payload.new as any
          if (p?.codice_prenotazione) {
            toast.success(`🆕 Nuova prenotazione: ${p.codice_prenotazione}`, {
              duration: 5000,
              position: 'top-right',
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return null
}