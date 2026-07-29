'use client'
import { useRequireRole } from '@/lib/useRequireRole'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { authFetch } from '@/lib/api-client'

interface Categoria {
  id: string
  codice: string
  nome: string
  tipo: 'entrata' | 'uscita'
  rilevante_iva: boolean
}
interface MetodoPagamento { id: string; nome: string }
interface Fornitore { id: string; nome: string }

interface Movimento {
  id: string
  numero_progressivo: number | null
  anno: number
  data_competenza: string
  data_pagamento: string | null
  descrizione: string
  imponibile: number
  aliquota_iva: number
  iva: number
  totale: number
  tipo: 'entrata' | 'uscita'
  numero_documento: string | null
  data_documento: string | null
  allegato_url: string | null
  origine: string
  note: string | null
  fornitore_descrizione: string | null
  categoria: Categoria | null
  metodo_pagamento: MetodoPagamento | null
  fornitore: { id: string; ragione_sociale: string } | null
}

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtDateFile = (iso: string) => (iso ? iso.replace(/-/g, '') : 'all')

const P = {
  bg: '#f8f9fc', card: '#fff', border: '#e2e6ef', text: '#1a1f36', muted: '#6b7394',
  primary: '#0047AB', primaryLt: '#e8f0fe', accent: '#00875a', accentLt: '#dcfce7',
  orange: '#e07c00', red: '#de350b', redLt: '#fee2e2',
  headerBg: '#f1f3f9',
}

export default function MovimentiPage() {
  const { authorized, loading: authLoading } = useRequireRole(['admin'])
  const [movimenti, setMovimenti] = useState<Movimento[]>([])
  const [fornitori, setFornitori] = useState<Fornitore[]>([])
  const [categorie, setCategorie] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtri
  const [dataInizio, setDataInizio] = useState('')
  const [dataFine, setDataFine] = useState('')
  const [tipoFilter, setTipoFilter] = useState<'all' | 'entrata' | 'uscita'>('all')
  const [categoriaFilter, setCategoriaFilter] = useState('all')
  const [fornitoreFilter, setFornitoreFilter] = useState('all')
  const [origineFilter, setOrigineFilter] = useState<'all' | 'manuale' | 'auto_prenotazioni'>('all')

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams()
      if (dataInizio) params.set('data_inizio', dataInizio)
      if (dataFine) params.set('data_fine', dataFine)
      if (tipoFilter !== 'all') params.set('tipo', tipoFilter)
      if (categoriaFilter !== 'all') params.set('categoria_id', categoriaFilter)
      if (fornitoreFilter !== 'all') params.set('fornitore_id', fornitoreFilter)
      if (origineFilter !== 'all') params.set('origine', origineFilter)

      const [mRes, cRes] = await Promise.all([
        authFetch(`/api/contabilita/movimenti?${params.toString()}`),
        authFetch('/api/contabilita/categorie'),
      ])
      if (!mRes.ok) throw new Error(`Errore ${mRes.status} caricamento movimenti`)
      if (!cRes.ok) throw new Error(`Errore ${cRes.status} caricamento categorie`)
      const mJson = await mRes.json()
      const cJson = await cRes.json()
      setMovimenti(mJson.movimenti)
      setFornitori(mJson.fornitori)
      setCategorie(cJson.categorie)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [dataInizio, dataFine, tipoFilter, categoriaFilter, fornitoreFilter, origineFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const totals = useMemo(() => {
    return movimenti.reduce(
      (acc, m) => {
        if (m.tipo === 'entrata') acc.entrate += m.totale
        else acc.uscite += m.totale
        return acc
      },
      { entrate: 0, uscite: 0 }
    )
  }, [movimenti])

  // Elimina movimento (solo manuali — sui virtuali non c'è il pulsante)
  const handleDelete = async (id: string, descrizione: string) => {
    if (!confirm(`Eliminare il movimento "${descrizione}"? L'operazione non è reversibile.`)) return
    try {
      const res = await authFetch(`/api/contabilita/movimenti/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || `Errore ${res.status}`)
      }
      fetchData()
    } catch (err: any) {
      alert('Errore: ' + err.message)
    }
  }

  // Export Excel
  const exportExcel = async () => {
    const XLSX = (await import('xlsx')).default || (await import('xlsx'))
    const wb = XLSX.utils.book_new()

    const header = ['N°', 'Data', 'Tipo', 'Categoria', 'Descrizione', 'Fornitore', 'Imponibile', 'Aliq. IVA', 'IVA', 'Totale', 'Metodo', 'N° Doc.', 'Origine']
    const rows = movimenti.map((m) => [
      m.numero_progressivo ? `${m.numero_progressivo}/${m.anno}` : 'auto',
      m.data_competenza,
      m.tipo === 'entrata' ? 'Entrata' : 'Uscita',
      m.categoria ? `${m.categoria.codice} — ${m.categoria.nome}` : '',
      m.descrizione,
      m.fornitore?.ragione_sociale || m.fornitore_descrizione || '',
      m.imponibile,
      m.aliquota_iva ? `${m.aliquota_iva}%` : '—',
      m.iva,
      m.totale,
      m.metodo_pagamento?.nome || '',
      m.numero_documento || '',
      m.origine === 'manuale' ? 'Manuale' : m.origine,
    ])
    rows.push(['', '', 'TOTALE ENTRATE', '', '', '', '', '', '', totals.entrate, '', '', ''])
    rows.push(['', '', 'TOTALE USCITE', '', '', '', '', '', '', totals.uscite, '', '', ''])
    rows.push(['', '', 'SALDO', '', '', '', '', '', '', totals.entrate - totals.uscite, '', '', ''])

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    ws['!cols'] = [
      { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 40 }, { wch: 25 },
      { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 14 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Movimenti')
    XLSX.writeFile(wb, `movimenti_${fmtDateFile(dataInizio)}_${fmtDateFile(dataFine)}.xlsx`)
  }

  if (authLoading || !authorized) return <div className="p-8"><div className="text-gray-600">Verifica accesso...</div></div>
  if (loading) {
    return (
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: `4px solid ${P.primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: P.muted }}>Caricamento movimenti...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", padding: 40, textAlign: 'center' }}>
        <p style={{ color: P.red, fontSize: 16, fontWeight: 600 }}>Errore nel caricamento</p>
        <p style={{ color: P.muted, marginTop: 8 }}>{error}</p>
        <button onClick={fetchData} style={{ marginTop: 16, padding: '10px 24px', background: P.primary, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Riprova</button>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif", color: P.text, background: P.bg, minHeight: '100vh', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: P.muted, marginBottom: 2 }}>Contabilità › Movimenti</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Registro Movimenti</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportExcel} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', border: `1px solid ${P.primary}`, borderRadius: 8, cursor: 'pointer', background: P.primaryLt, color: P.primary, display: 'inline-flex', alignItems: 'center', gap: 6 }}>📊 Esporta Excel</button>
          <Link href="/dashboard/contabilita/movimenti/nuovo">
            <button style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', background: P.primary, color: '#fff' }}>+ Nuovo movimento</button>
          </Link>
        </div>
      </div>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
        <FilterField label="Data inizio">
          <input type="date" value={dataInizio} onChange={(e) => setDataInizio(e.target.value)} style={inputStyle} />
        </FilterField>
        <FilterField label="Data fine">
          <input type="date" value={dataFine} onChange={(e) => setDataFine(e.target.value)} style={inputStyle} />
        </FilterField>
        <FilterField label="Tipo">
          <select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value as any)} style={{ ...inputStyle, minWidth: 130 }}>
            <option value="all">Tutti</option>
            <option value="entrata">Solo entrate</option>
            <option value="uscita">Solo uscite</option>
          </select>
        </FilterField>
        <FilterField label="Origine">
          <select value={origineFilter} onChange={(e) => setOrigineFilter(e.target.value as any)} style={{ ...inputStyle, minWidth: 160 }}>
            <option value="all">Tutti</option>
            <option value="manuale">Solo manuali</option>
            <option value="auto_prenotazioni">Solo da prenotazioni</option>
          </select>
        </FilterField>
        <FilterField label="Categoria">
          <select value={categoriaFilter} onChange={(e) => setCategoriaFilter(e.target.value)} style={{ ...inputStyle, minWidth: 200 }}>
            <option value="all">Tutte le categorie</option>
            {categorie
              .filter((c) => tipoFilter === 'all' || c.tipo === tipoFilter)
              .map((c) => (
                <option key={c.id} value={c.id}>{c.codice} — {c.nome}</option>
              ))}
          </select>
        </FilterField>
        <FilterField label="Fornitore">
          <select value={fornitoreFilter} onChange={(e) => setFornitoreFilter(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
            <option value="all">Tutti i fornitori</option>
            {fornitori.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </FilterField>
        <button onClick={() => { setDataInizio(''); setDataFine(''); setTipoFilter('all'); setCategoriaFilter('all'); setFornitoreFilter('all'); setOrigineFilter('all') }} style={{ fontSize: 12, padding: '8px 14px', border: `1px solid ${P.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', color: P.muted, alignSelf: 'flex-end' }}>Reset</button>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KpiCard label="Totale entrate" value={fmt(totals.entrate)} color={P.accent} />
        <KpiCard label="Totale uscite" value={fmt(totals.uscite)} color={P.red} />
        <KpiCard label="Saldo" value={fmt(totals.entrate - totals.uscite)} color={totals.entrate - totals.uscite >= 0 ? P.accent : P.red} />
        <KpiCard label="N° movimenti" value={String(movimenti.length)} color={P.muted} />
      </div>

      {/* Tabella */}
      <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {movimenti.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: P.muted, fontSize: 15 }}>
            Nessun movimento per i filtri selezionati.
            <div style={{ marginTop: 12 }}>
              <Link href="/dashboard/contabilita/movimenti/nuovo">
                <button style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', background: P.primary, color: '#fff' }}>+ Inserisci il primo movimento</button>
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <Th>N°</Th>
                  <Th>Data</Th>
                  <Th>Categoria</Th>
                  <Th>Descrizione</Th>
                  <Th>Fornitore</Th>
                  <Th align="right">Imponibile</Th>
                  <Th align="right">IVA</Th>
                  <Th align="right">Totale</Th>
                  <Th>Conto</Th>
                  <Th align="center" width={70}>Azioni</Th>
                </tr>
              </thead>
              <tbody>
                {movimenti.map((m) => (
                  <tr key={m.id} style={{ transition: 'background .15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = P.primaryLt)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <Td>
                      {m.numero_progressivo ? (
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: P.muted, fontSize: 12 }}>
                          {m.numero_progressivo}/{m.anno}
                        </span>
                      ) : (
                        <span style={{ color: P.muted, fontSize: 11, fontStyle: 'italic' }} title="Movimento generato automaticamente">auto</span>
                      )}
                    </Td>
                    <Td>{fmtDate(m.data_competenza)}</Td>
                    <Td>
                      {m.categoria ? (
                        <div>
                          <div>{m.categoria.nome}</div>
                          <div style={{ fontSize: 11, color: P.muted }}>{m.categoria.codice}</div>
                        </div>
                      ) : '—'}
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 4, height: 16, background: m.tipo === 'entrata' ? P.accent : P.red, borderRadius: 2 }} />
                        <span>{m.descrizione}</span>
                        {m.allegato_url && <span title="Allegato presente" style={{ fontSize: 14, opacity: 0.5 }}>📎</span>}
                      </div>
                      {m.origine !== 'manuale' && (
                        <div style={{ fontSize: 10, color: P.muted, marginTop: 2, fontStyle: 'italic' }}>
                          {m.origine === 'auto_prenotazioni' ? 'da prenotazione (cassa-based)' : `generato automaticamente (${m.origine.replace('auto_', '')})`}
                        </div>
                      )}
                    </Td>
                    <Td>{m.fornitore?.ragione_sociale || m.fornitore_descrizione || <span style={{ color: P.muted }}>—</span>}</Td>
                    <Td align="right">{fmt(m.imponibile)}</Td>
                    <Td align="right">
                      <span style={{ color: P.muted }}>
                        {m.aliquota_iva > 0 ? fmt(m.iva) : '—'}
                      </span>
                    </Td>
                    <Td align="right">
                      <strong style={{ color: m.tipo === 'entrata' ? P.accent : P.red }}>
                        {m.tipo === 'entrata' ? '+' : '−'} {fmt(m.totale)}
                      </strong>
                    </Td>
                    <Td>
                      <span style={{ fontSize: 12, color: P.muted }}>{m.metodo_pagamento?.nome || '—'}</span>
                    </Td>
                    <Td align="center">
                      {m.origine === 'manuale' && (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <Link href={`/dashboard/contabilita/movimenti/${m.id}`}>
                            <button title="Modifica" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, padding: 2, color: P.primary }}>✏️</button>
                          </Link>
                          <button title="Elimina" onClick={() => handleDelete(m.id, m.descrizione)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, padding: 2 }}>🗑️</button>
                        </div>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helpers UI ──
const inputStyle: React.CSSProperties = {
  fontSize: 14, padding: '8px 12px', border: `1px solid ${P.border}`, borderRadius: 8,
  outline: 'none', background: P.bg, color: P.text, minWidth: 140,
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: P.muted }}>{label}</span>
      {children}
    </div>
  )
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: '18px 20px', borderLeft: `4px solid ${color}` }}>
      <p style={{ fontSize: 24, fontWeight: 700, color, margin: 0 }}>{value}</p>
      <p style={{ fontSize: 12, color: P.muted, fontWeight: 500, marginTop: 2 }}>{label}</p>
    </div>
  )
}

function Th({ children, align = 'left', width }: { children: React.ReactNode; align?: 'left' | 'right' | 'center'; width?: number }) {
  return (
    <th style={{
      textAlign: align, padding: '12px 14px', fontWeight: 600, fontSize: 11,
      textTransform: 'uppercase', letterSpacing: '0.04em',
      background: P.headerBg, color: P.muted, borderBottom: `2px solid ${P.border}`,
      whiteSpace: 'nowrap', width,
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
