'use client'
import { useRequireRole } from '@/lib/useRequireRole'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { authFetch } from '@/lib/api-client'

interface Estratto {
  id: string
  anno: number
  mese: number
  totale_lordo: number
  percentuale_commissione: number
  commissione_consorzio: number
  netto_socio: number
  numero_prenotazioni: number
  stato: 'bozza' | 'inviato' | 'fattura_ricevuta' | 'pagato' | 'contestato'
  data_invio_socio: string | null
  fattura_numero: string | null
  data_pagamento: string | null
  fornitore: { id: string; ragione_sociale: string; email: string | null; partita_iva: string | null } | null
}

const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
const ALIQUOTA_IVA_SOCIO = 22

const P = {
  bg: '#f8f9fc', card: '#fff', border: '#e2e6ef', text: '#1a1f36', muted: '#6b7394',
  primary: '#0047AB', primaryLt: '#e8f0fe', accent: '#00875a', accentLt: '#dcfce7',
  orange: '#e07c00', orangeLt: '#fff4e5', red: '#de350b', redLt: '#fee2e2',
  headerBg: '#f1f3f9',
}

const STATO_STYLE: Record<Estratto['stato'], { bg: string; color: string; label: string }> = {
  bozza:             { bg: P.headerBg, color: P.muted,   label: 'Bozza' },
  inviato:           { bg: P.primaryLt, color: P.primary, label: 'Inviato' },
  fattura_ricevuta:  { bg: '#dcfce7',   color: '#166534', label: 'Fattura ricevuta' },
  pagato:            { bg: P.accentLt,  color: P.accent,  label: 'Pagato' },
  contestato:        { bg: P.orangeLt,  color: P.orange,  label: 'Contestato' },
}

export default function EstrattiContoPage() {
  const { authorized, loading: authLoading } = useRequireRole(['admin'])
  const now = new Date()
  const [anno, setAnno] = useState(now.getFullYear())
  // Default: mese precedente (chiuso)
  const [mese, setMese] = useState(now.getMonth() === 0 ? 12 : now.getMonth())
  const [estratti, setEstratti] = useState<Estratto[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await authFetch(`/api/contabilita/estratti-conto?anno=${anno}&mese=${mese}`)
      if (!res.ok) throw new Error(`Errore ${res.status}`)
      const json = await res.json()
      setEstratti(json.estratti || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [anno, mese])

  useEffect(() => { fetchData() }, [fetchData])

  const handleGenera = async () => {
    if (!confirm(`Generare gli estratti conto per ${MESI[mese - 1]} ${anno}?\n\nGli estratti già consolidati (inviati/fatturati/pagati) saranno preservati.`)) return
    setGenerating(true); setError(null); setMessage(null)
    try {
      const res = await authFetch('/api/contabilita/estratti-conto/genera', {
        method: 'POST',
        body: JSON.stringify({ anno, mese }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Errore ${res.status}`)

      const parts: string[] = []
      if (json.generati) parts.push(`${json.generati} creati`)
      if (json.aggiornati) parts.push(`${json.aggiornati} aggiornati`)
      if (json.preservati) parts.push(`${json.preservati} preservati`)
      setMessage(parts.length > 0 ? parts.join(' · ') : (json.message || 'Nessun dato da elaborare'))

      fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const totals = useMemo(() => {
    return estratti.reduce(
      (acc, e) => ({
        lordo: acc.lordo + Number(e.totale_lordo),
        commissione: acc.commissione + Number(e.commissione_consorzio),
        netto: acc.netto + Number(e.netto_socio),
        prenotazioni: acc.prenotazioni + e.numero_prenotazioni,
      }),
      { lordo: 0, commissione: 0, netto: 0, prenotazioni: 0 }
    )
  }, [estratti])

  if (authLoading || !authorized) return <div className="p-8"><div className="text-gray-600">Verifica accesso...</div></div>
  if (loading) {
    return (
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: `4px solid ${P.primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: P.muted }}>Caricamento estratti conto...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif", color: P.text, background: P.bg, minHeight: '100vh', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: P.muted, marginBottom: 2 }}>Contabilità › Estratti Conto Soci</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
            Estratti Conto · {MESI[mese - 1]} {anno}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={mese} onChange={(e) => setMese(Number(e.target.value))} style={inputStyle}>
            {MESI.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={anno} onChange={(e) => setAnno(Number(e.target.value))} style={inputStyle}>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={handleGenera} disabled={generating} style={{
            fontSize: 13, fontWeight: 600, padding: '9px 16px', border: `1px solid ${P.primary}`,
            borderRadius: 8, cursor: generating ? 'wait' : 'pointer', background: P.primary, color: '#fff',
            opacity: generating ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>{generating ? 'Generazione...' : '⟳ Genera dal DB'}</button>
          <button onClick={async () => {
            if (estratti.length === 0) { setError('Nessun estratto da esportare'); return }
            try {
              const res = await authFetch('/api/contabilita/estratti-conto/riepilogo-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estratti, mese, anno, totals }),
              })
              if (!res.ok) { setError('Errore generazione PDF'); return }
              const blob = await res.blob()
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `riepilogo-estratti-${anno}-${String(mese).padStart(2, '0')}.pdf`
              a.click()
              URL.revokeObjectURL(url)
            } catch { setError('Errore generazione PDF') }
          }} style={{
            fontSize: 13, fontWeight: 600, padding: '9px 16px', border: `1px solid ${P.primary}`,
            borderRadius: 8, cursor: 'pointer', background: '#fff', color: P.primary,
            display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 8,
          }}>📄 Scarica PDF</button>
        </div>
      </div>

      {message && (
        <div style={{ background: P.accentLt, border: `1px solid ${P.accent}`, color: P.accent, padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
          ✓ {message}
        </div>
      )}
      {error && (
        <div style={{ background: P.redLt, border: `1px solid ${P.red}`, color: P.red, padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Kpi label="Soci con prenotazioni" value={String(estratti.length)} color={P.muted} />
        <Kpi label="Lordo incassato" value={fmt(totals.lordo)} color={P.primary} />
        <Kpi label="Commissione BA (18%)" value={fmt(totals.commissione)} color={P.accent} />
        <Kpi label="Da pagare ai soci" value={fmt(totals.netto)} color={P.orange} sub={`+ IVA ${fmt(totals.netto * ALIQUOTA_IVA_SOCIO / 100)} = ${fmt(totals.netto * (1 + ALIQUOTA_IVA_SOCIO / 100))}`} />
      </div>

      {/* Tabella */}
      <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {estratti.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: P.muted, fontSize: 15 }}>
            Nessun estratto conto per {MESI[mese - 1]} {anno}.
            <div style={{ marginTop: 12, fontSize: 13 }}>
              Clicca <strong>Genera dal DB</strong> per crearli a partire dalle prenotazioni del mese.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <Th>Socio</Th>
                  <Th align="right" width={70}>Pren.</Th>
                  <Th align="right" width={110}>Lordo</Th>
                  <Th align="right" width={100}>Comm.</Th>
                  <Th align="right" width={110}>Netto</Th>
                  <Th align="center" width={150}>Stato</Th>
                  <Th width={40}></Th>
                </tr>
              </thead>
              <tbody>
                {estratti.map((e) => {
                  const stStyle = STATO_STYLE[e.stato]
                  return (
                    <tr key={e.id} style={{ transition: 'background .15s' }}
                      onMouseEnter={(ev) => (ev.currentTarget.style.background = P.primaryLt)}
                      onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}>
                      <Td>
                        <Link href={`/dashboard/contabilita/estratti-conto/${e.id}`} style={{ color: P.text, textDecoration: 'none' }}>
                          <div style={{ fontWeight: 600 }}>{e.fornitore?.ragione_sociale || '—'}</div>
                          <div style={{ fontSize: 11, color: P.muted }}>
                            {e.fornitore?.partita_iva ? `P.IVA ${e.fornitore.partita_iva}` : 'P.IVA non in anagrafica'}
                            {' · '}
                            commissione {Number(e.percentuale_commissione)}%
                          </div>
                        </Link>
                      </Td>
                      <Td align="right">{e.numero_prenotazioni}</Td>
                      <Td align="right">{fmt(Number(e.totale_lordo))}</Td>
                      <Td align="right"><span style={{ color: P.accent }}>−&nbsp;{fmt(Number(e.commissione_consorzio))}</span></Td>
                      <Td align="right"><strong>{fmt(Number(e.netto_socio))}</strong></Td>
                      <Td align="center">
                        <span style={{ background: stStyle.bg, color: stStyle.color, fontSize: 11, padding: '3px 10px', borderRadius: 12, fontWeight: 600 }}>
                          {stStyle.label}
                        </span>
                      </Td>
                      <Td align="center">
                        <Link href={`/dashboard/contabilita/estratti-conto/${e.id}`} style={{ color: P.muted, textDecoration: 'none', fontSize: 16 }}>›</Link>
                      </Td>
                    </tr>
                  )
                })}
                <tr style={{ background: P.headerBg, borderTop: `2px solid ${P.primary}` }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700 }}>TOTALE</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{totals.prenotazioni}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(totals.lordo)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: P.accent }}>{fmt(totals.commissione)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(totals.netto)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helpers ──
const inputStyle: React.CSSProperties = {
  fontSize: 14, padding: '8px 12px', border: `1px solid ${P.border}`, borderRadius: 8,
  outline: 'none', background: P.card, color: P.text, cursor: 'pointer',
}

function Kpi({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: '16px 18px', borderLeft: `4px solid ${color}` }}>
      <p style={{ fontSize: 22, fontWeight: 700, color, margin: 0 }}>{value}</p>
      <p style={{ fontSize: 12, color: P.muted, fontWeight: 500, marginTop: 2 }}>{label}</p>
      {sub && <p style={{ fontSize: 10, color: P.muted, marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

function Th({ children, align = 'left', width }: { children?: React.ReactNode; align?: 'left' | 'right' | 'center'; width?: number }) {
  return (
    <th style={{
      textAlign: align, padding: '12px 14px', fontWeight: 600, fontSize: 11,
      textTransform: 'uppercase', letterSpacing: '0.04em', background: P.headerBg,
      color: P.muted, borderBottom: `2px solid ${P.border}`, whiteSpace: 'nowrap', width,
    }}>{children}</th>
  )
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <td style={{
      padding: '11px 14px', borderBottom: `1px solid ${P.border}`, textAlign: align,
      fontVariantNumeric: align === 'right' ? 'tabular-nums' : 'normal',
    }}>{children}</td>
  )
}
