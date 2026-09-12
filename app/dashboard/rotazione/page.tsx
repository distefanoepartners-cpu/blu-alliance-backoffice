'use client'

import { useState } from 'react'
import RotazioneBarche from './RotazioneBarche'
import RiepilogoUscite from './RiepilogoUscite'

const P = { border: "#e2e6ef", text: "#1a1f36", muted: "#6b7394", primary: "#0047AB", bg: "#f8f9fc" }

export default function RotazionePage() {
  const [tab, setTab] = useState<'rotazione' | 'riepilogo'>('rotazione')

  const tabBtn = (key: 'rotazione' | 'riepilogo', label: string) => (
    <button onClick={() => setTab(key)}
      style={{
        fontSize: 15, fontWeight: 700, padding: "12px 24px", border: "none", cursor: "pointer",
        background: "transparent",
        color: tab === key ? P.primary : P.muted,
        borderBottom: tab === key ? `3px solid ${P.primary}` : "3px solid transparent",
      }}>
      {label}
    </button>
  )

  return (
    <div>
      <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${P.border}`, marginBottom: 20, padding: "0 4px" }}>
        {tabBtn('rotazione', '🔄 Rotazione Barche')}
        {tabBtn('riepilogo', '📊 Riepilogo Uscite')}
      </div>
      {tab === 'rotazione' ? <RotazioneBarche /> : <RiepilogoUscite />}
    </div>
  )
}