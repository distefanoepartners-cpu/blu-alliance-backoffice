'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  userId: string
}

export default function NotificationManager({ userId }: Props) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!userId) return
    loadCount()
  }, [userId])

  async function loadCount() {
    try {
      const { count: n } = await supabase
        .from('notifiche')
        .select('*', { count: 'exact', head: true })
        .eq('utente_id', userId)
        .eq('letta', false)
      setCount(n || 0)
    } catch {
      // Tabella notifiche non ancora creata — ignora
    }
  }

  if (count === 0) return null

  return (
    <div className="relative">
      <button className="relative p-2 text-gray-600 hover:text-blue-600 transition-colors">
        🔔
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
          {count > 9 ? '9+' : count}
        </span>
      </button>
    </div>
  )
}