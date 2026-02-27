'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  userId: string
}

export default function BriefingModal({ userId }: Props) {
  const [briefing, setBriefing] = useState<any>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!userId) return
    checkBriefings()
  }, [userId])

  async function checkBriefings() {
    try {
      const oggi = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('briefings')
        .select('*')
        .eq('data', oggi)
        .eq('attivo', true)
        .limit(1)
        .maybeSingle()

      if (data) {
        setBriefing(data)
        setShow(true)
      }
    } catch {
      // Tabella briefings non ancora creata — ignora
    }
  }

  if (!show || !briefing) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">📋 Promemoria del Giorno</h2>
          <button onClick={() => setShow(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
          {briefing.contenuto || briefing.testo || briefing.note}
        </div>
        <button
          onClick={() => setShow(false)}
          className="mt-5 w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
        >
          Ho letto
        </button>
      </div>
    </div>
  )
}