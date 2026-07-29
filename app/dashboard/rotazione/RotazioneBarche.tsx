'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'

// ── Types ───────────────────────────────────────────────────────────────
interface Nave {
  id: number
  data_arrivo: string
  nome_nave: string
  capienza_pax: number
  ora_arrivo: string | null
  ora_partenza: string | null
  note: string | null
}
interface Imbarcazione {
  id: string
  nome: string
  tipo: string
  categoria: string
  capacita_massima: number
  capacita_collettiva_override: number | null
  tour_collettivi_attivi: boolean
  fornitore_id: string
  ordine: number
}
interface Fornitore { id: string; nome: string }
interface StoricoRow {
  imbarcazione_nome: string
  fornitore_id: string
  fornitore_nome: string
  data_servizio: string
  numero_persone: number
}
interface Assegnata {
  imbarcazione_id: string
  data_servizio: string
  numero_persone: number
  stato: string
}

const COMMISSION_RATE = 0.18

const fmtDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' })
const fmtDateLong = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

// Size badge for ships
function shipSize(pax: number) {
  if (pax >= 3000) return { label: 'XXL', color: '#dc2626', bg: '#fef2f2' }
  if (pax >= 2000) return { label: 'XL', color: '#ea580c', bg: '#fff7ed' }
  if (pax >= 1000) return { label: 'L', color: '#d97706', bg: '#fffbeb' }
  if (pax >= 500) return { label: 'M', color: '#0891b2', bg: '#ecfeff' }
  return { label: 'S', color: '#059669', bg: '#ecfdf5' }
}

// ── ROTATION ALGORITHM ──────────────────────────────────────────────────
function computeRotation(
  imbarcazioni: Imbarcazione[],
  fornitori: Fornitore[],
  storico: StoricoRow[],
  assegnateOggi: Assegnata[],
  naveDate: string
): { barca: Imbarcazione; fornitore: Fornitore; score: number; reason: string; selected: boolean }[] {

  // Count historical usage per supplier (last 60 days)
  const usageByFornitore: Record<string, number> = {}
  const usageByBarca: Record<string, number> = {}
  const lastUsedBarca: Record<string, string> = {} // barca_id -> last date

  const _rotCutoff = new Date(); _rotCutoff.setDate(_rotCutoff.getDate() - 60)
  const _rotCutoffStr = _rotCutoff.toISOString().split('T')[0]
  storico.forEach(s => {
    if (s.data_servizio < _rotCutoffStr) return
    usageByFornitore[s.fornitore_id] = (usageByFornitore[s.fornitore_id] || 0) + 1
    usageByBarca[s.imbarcazione_nome] = (usageByBarca[s.imbarcazione_nome] || 0) + 1
  })

  // Boats already booked on this date
  const bookedToday = new Set(assegnateOggi.filter(a => a.data_servizio === naveDate).map(a => a.imbarcazione_id))

  // Map fornitore id -> name
  const fornitoreMap = new Map(fornitori.map(f => [f.id, f]))

  // Total usage across all suppliers to compute fairness
  const totalUsage = Object.values(usageByFornitore).reduce((a, b) => a + b, 0) || 1
  const numFornitori = new Set(imbarcazioni.map(b => b.fornitore_id)).size || 1
  const fairShare = totalUsage / numFornitori

  // Score each boat (lower = should be prioritized)
  const scored = imbarcazioni.map(barca => {
    const fornitore = fornitoreMap.get(barca.fornitore_id) || { id: barca.fornitore_id, nome: 'N/D' }
    const fornUsage = usageByFornitore[barca.fornitore_id] || 0
    const barcaUsage = usageByBarca[barca.nome] || 0
    const isBooked = bookedToday.has(barca.id)

    // Score: lower = higher priority
    // Weighted: 60% supplier fairness, 30% boat fairness, 10% capacity
    const supplierScore = fornUsage / fairShare // <1 means underused
    const boatScore = barcaUsage / (totalUsage / imbarcazioni.length || 1)
    const score = supplierScore * 0.6 + boatScore * 0.3

    let reason = ''
    if (isBooked) reason = '⚠️ Già prenotata per questa data'
    else if (supplierScore < 0.5) reason = '🟢 Fornitore sottoutilizzato — priorità alta'
    else if (supplierScore < 0.8) reason = '🟡 Buon bilanciamento'
    else if (supplierScore < 1.2) reason = '🔵 Nella media'
    else reason = '🟠 Fornitore molto utilizzato — dare precedenza ad altri'

    return {
      barca,
      fornitore,
      score,
      reason,
      selected: !isBooked && supplierScore <= 1.2, // auto-select underused
    }
  })

  // Sort: unbooked first, then by score ascending (underused first)
  scored.sort((a, b) => {
    const aBooked = bookedToday.has(a.barca.id) ? 1 : 0
    const bBooked = bookedToday.has(b.barca.id) ? 1 : 0
    if (aBooked !== bBooked) return aBooked - bBooked
    return a.score - b.score
  })

  return scored
}

// ── COMPONENT ───────────────────────────────────────────────────────────
export default function RotazioneBarche() {
  const [navi, setNavi] = useState<Nave[]>([])
  const [imbarcazioni, setImbarcazioni] = useState<Imbarcazione[]>([])
  const [fornitori, setFornitori] = useState<Fornitore[]>([])
  const [storico, setStorico] = useState<StoricoRow[]>([])
  const [assegnate, setAssegnate] = useState<Assegnata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedNaveIdx, setSelectedNaveIdx] = useState(0)
  const [selections, setSelections] = useState<Record<string, boolean>>({})
  const [filterTipo, setFilterTipo] = useState('all')

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/rotazione')
      if (!res.ok) throw new Error(`Errore ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setNavi(json.navi)
      setImbarcazioni(json.imbarcazioni)
      setFornitori(json.fornitori)
      setStorico(json.storico)
      setAssegnate(json.assegnate)
    } catch (err: any) { setError(err.message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const selectedNave = navi[selectedNaveIdx] || null

  // Compute rotation suggestion
  const rotation = useMemo(() => {
    if (!selectedNave || imbarcazioni.length === 0) return []
    return computeRotation(imbarcazioni, fornitori, storico, assegnate, selectedNave.data_arrivo)
  }, [selectedNave, imbarcazioni, fornitori, storico, assegnate])

  // Initialize selections from algorithm
  useEffect(() => {
    if (rotation.length > 0) {
      const sel: Record<string, boolean> = {}
      rotation.forEach(r => { sel[r.barca.id] = r.selected })
      setSelections(sel)
    }
  }, [rotation])

  const toggleSelection = (id: string) => {
    setSelections(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Boat types available
  const tipi = useMemo(() => [...new Set(imbarcazioni.map(b => b.tipo))].sort(), [imbarcazioni])

  // Filtered rotation
  const filteredRotation = useMemo(() => {
    if (filterTipo === 'all') return rotation
    return rotation.filter(r => r.barca.tipo === filterTipo)
  }, [rotation, filterTipo])

  // Stats for selected boats
  const selStats = useMemo(() => {
    const selected = filteredRotation.filter(r => selections[r.barca.id])
    const byFornitore: Record<string, { nome: string; count: number; paxCapacity: number }> = {}
    selected.forEach(r => {
      const key = r.fornitore.id
      if (!byFornitore[key]) byFornitore[key] = { nome: r.fornitore.nome, count: 0, paxCapacity: 0 }
      byFornitore[key].count += 1
      byFornitore[key].paxCapacity += r.barca.capacita_collettiva_override || r.barca.capacita_massima
    })
    return {
      totalBarche: selected.length,
      totalCapacity: selected.reduce((s, r) => s + (r.barca.capacita_collettiva_override || r.barca.capacita_massima), 0),
      byFornitore: Object.entries(byFornitore).sort((a, b) => b[1].count - a[1].count),
    }
  }, [filteredRotation, selections])

  // Historical usage per supplier (for the chart)
  const [storicoDa, setStoricoDa] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 60); return d.toISOString().split('T')[0] })
  const [storicoFine, setStoricoFine] = useState(() => new Date().toISOString().split('T')[0])
  const storicoByFornitore = useMemo(() => {
    const map: Record<string, { nome: string; tours: number; pax: number }> = {}
    storico.filter(s => s.data_servizio >= storicoDa && s.data_servizio <= storicoFine).forEach(s => {
      if (!map[s.fornitore_id]) map[s.fornitore_id] = { nome: s.fornitore_nome || 'N/D', tours: 0, pax: 0 }
      map[s.fornitore_id].tours += 1
      map[s.fornitore_id].pax += s.numero_persone || 0
    })
    return Object.entries(map).sort((a, b) => b[1].tours - a[1].tours)
  }, [storico, storicoDa, storicoFine])
  const maxTours = storicoByFornitore.length > 0 ? Math.max(...storicoByFornitore.map(([, d]) => d.tours)) : 1

  // ── Palette ───────────────────────────────────────────────────────
  const P = {
    bg: "#f8f9fc", card: "#fff", border: "#e2e6ef", text: "#1a1f36", muted: "#6b7394",
    primary: "#0047AB", primaryLt: "#e8f0fe", accent: "#00875a", accentLt: "#e3fcef",
    orange: "#e07c00", headerBg: "#f1f3f9", warn: "#dc2626",
  }
  const barColors = ["#0047AB", "#7c3aed", "#00875a", "#e07c00", "#dc2626", "#0891b2", "#6366f1", "#f59e0b"]

  if (loading) return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: `4px solid ${P.primary}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ color: P.muted }}>Calcolo rotazione...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", padding: 40, textAlign: "center" }}>
      <p style={{ color: P.warn, fontSize: 16, fontWeight: 600 }}>Errore</p>
      <p style={{ color: P.muted, marginTop: 8 }}>{error}</p>
      <button onClick={fetchData} style={{ marginTop: 16, padding: "10px 24px", background: P.primary, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Riprova</button>
    </div>
  )

  if (navi.length === 0) return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", padding: 40, textAlign: "center" }}>
      <p style={{ fontSize: 48, marginBottom: 16 }}>🚢</p>
      <p style={{ color: P.text, fontSize: 18, fontWeight: 600 }}>Nessuna nave in arrivo</p>
      <p style={{ color: P.muted, marginTop: 8 }}>Non ci sono scali programmati nelle prossime date.</p>
    </div>
  )

  const size = selectedNave ? shipSize(selectedNave.capienza_pax) : shipSize(0)

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif", color: P.text, background: P.bg, minHeight: "100vh", padding: "24px 20px" }}>

      {/* ── Header ── */}
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 20px", display: "flex", alignItems: "center", gap: 10 }}>
        🔄 Rotazione Imbarcazioni
        <span style={{ fontSize: 11, fontWeight: 600, background: P.primaryLt, color: P.primary, padding: "3px 10px", borderRadius: 20 }}>Suggerimento automatico</span>
      </h1>

      {/* ── Ship selector ── */}
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, marginBottom: 20 }}>
        {navi.slice(0, 8).map((nave, idx) => {
          const s = shipSize(nave.capienza_pax)
          const isActive = idx === selectedNaveIdx
          return (
            <button key={nave.id} onClick={() => setSelectedNaveIdx(idx)} style={{
              minWidth: 160, padding: "12px 16px", border: isActive ? `2px solid ${P.primary}` : `1px solid ${P.border}`,
              borderRadius: 12, background: isActive ? P.primaryLt : P.card, cursor: "pointer",
              textAlign: "left", transition: "all .2s", flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: s.bg, color: s.color }}>{s.label}</span>
                <span style={{ fontSize: 12, color: P.muted }}>{fmtDate(nave.data_arrivo)}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nave.nome_nave}</div>
              <div style={{ fontSize: 11, color: P.muted, marginTop: 2 }}>{(nave.capienza_pax || 0).toLocaleString('it-IT')} pax</div>
            </button>
          )
        })}
      </div>

      {/* ── Selected ship detail ── */}
      {selectedNave && (
        <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 20, borderLeft: `5px solid ${size.color}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 24 }}>🚢</span>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{selectedNave.nome_nave}</span>
                <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: size.bg, color: size.color }}>{size.label} · {(selectedNave.capienza_pax || 0).toLocaleString('it-IT')} pax</span>
              </div>
              <div style={{ fontSize: 14, color: P.muted }}>
                📅 {fmtDateLong(selectedNave.data_arrivo)}
                {selectedNave.ora_arrivo && <> · ⏰ Arrivo {selectedNave.ora_arrivo.slice(0, 5)}</>}
                {selectedNave.ora_partenza && <> — Partenza {selectedNave.ora_partenza.slice(0, 5)}</>}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: P.muted }}>Barche selezionate</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: P.primary }}>{selStats.totalBarche}</div>
              <div style={{ fontSize: 11, color: P.muted }}>Capienza tot: {selStats.totalCapacity} pax</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Filters + summary row ── */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: P.muted }}>Tipo imbarcazione</span>
          <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} style={{ fontSize: 14, padding: "8px 12px", border: `1px solid ${P.border}`, borderRadius: 8, outline: "none", background: P.bg, color: P.text, cursor: "pointer" }}>
            <option value="all">Tutti i tipi</option>
            {tipi.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Quick stats per fornitore selezionato */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {selStats.byFornitore.map(([id, d], i) => (
            <div key={id} style={{ fontSize: 12, padding: "6px 12px", background: P.card, border: `1px solid ${P.border}`, borderRadius: 8, borderLeft: `3px solid ${barColors[i % barColors.length]}` }}>
              <span style={{ fontWeight: 600 }}>{d.nome}</span>
              <span style={{ color: P.muted }}> · {d.count} barche · {d.paxCapacity} pax</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Rotation table ── */}
      <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={thStyle(P)}>✓</th>
                <th style={thStyle(P)}>Barca</th>
                <th style={thStyle(P)}>Tipo</th>
                <th style={thStyle(P)}>Fornitore</th>
                <th style={{ ...thStyle(P), textAlign: "right" }}>Capienza</th>
                <th style={{ ...thStyle(P), textAlign: "center" }}>Priorità</th>
                <th style={thStyle(P)}>Motivazione</th>
              </tr>
            </thead>
            <tbody>
              {filteredRotation.map((r, i) => {
                const isSelected = selections[r.barca.id]
                const isBooked = r.reason.startsWith('⚠️')
                const cap = r.barca.capacita_collettiva_override || r.barca.capacita_massima
                return (
                  <tr key={r.barca.id}
                    onClick={() => !isBooked && toggleSelection(r.barca.id)}
                    style={{
                      cursor: isBooked ? "not-allowed" : "pointer",
                      background: isBooked ? '#fef2f2' : isSelected ? P.accentLt : "transparent",
                      opacity: isBooked ? 0.5 : 1,
                      transition: "background .15s",
                    }}
                    onMouseEnter={e => { if (!isBooked && !isSelected) e.currentTarget.style.background = P.primaryLt }}
                    onMouseLeave={e => { if (!isBooked) e.currentTarget.style.background = isSelected ? P.accentLt : "transparent" }}
                  >
                    <td style={tdStyle(P)}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 6,
                        border: isSelected ? `2px solid ${P.accent}` : `2px solid ${P.border}`,
                        background: isSelected ? P.accent : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 14, fontWeight: 700,
                      }}>
                        {isSelected ? "✓" : ""}
                      </div>
                    </td>
                    <td style={{ ...tdStyle(P), fontWeight: 700 }}>{r.barca.nome}</td>
                    <td style={tdStyle(P)}>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: P.headerBg, color: P.muted, fontWeight: 500 }}>
                        {r.barca.tipo}
                      </span>
                    </td>
                    <td style={{ ...tdStyle(P), fontWeight: 600, color: P.primary }}>{r.fornitore.nome}</td>
                    <td style={{ ...tdStyle(P), textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{cap} pax</td>
                    <td style={{ ...tdStyle(P), textAlign: "center" }}>
                      <PriorityDots score={r.score} />
                    </td>
                    <td style={{ ...tdStyle(P), fontSize: 12, color: P.muted }}>{r.reason}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Two-column: fairness gauge + historical usage ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* Fairness distribution */}
        <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: "20px 24px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>⚖️ Distribuzione selezionata</div>
          {selStats.byFornitore.length === 0 ? (
            <p style={{ color: P.muted, fontSize: 13 }}>Seleziona almeno una barca per vedere la distribuzione</p>
          ) : (
            selStats.byFornitore.map(([id, d], i) => {
              const pct = selStats.totalBarche > 0 ? (d.count / selStats.totalBarche * 100) : 0
              return (
                <div key={id} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{d.nome}</span>
                    <span style={{ color: P.muted }}>{d.count} barche · {pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 10, background: P.bg, borderRadius: 5, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: barColors[i % barColors.length], borderRadius: 5, transition: "width .3s" }} />
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Historical usage (last 60 days) */}
        <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: "20px 24px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📊 Storico periodo</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: 12, color: P.muted }}>Da</label>
            <input type="date" value={storicoDa} onChange={e => setStoricoDa(e.target.value)} style={{ fontSize: 13, padding: "6px 10px", border: `1px solid ${P.border}`, borderRadius: 6 }} />
            <label style={{ fontSize: 12, color: P.muted }}>A</label>
            <input type="date" value={storicoFine} onChange={e => setStoricoFine(e.target.value)} style={{ fontSize: 13, padding: "6px 10px", border: `1px solid ${P.border}`, borderRadius: 6 }} />
          </div>
          {storicoByFornitore.length === 0 ? (
            <p style={{ color: P.muted, fontSize: 13 }}>Nessun dato storico disponibile</p>
          ) : (
            storicoByFornitore.map(([id, d], i) => {
              const pct = (d.tours / maxTours) * 100
              return (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, minWidth: 110, textAlign: "right" }}>{d.nome}</div>
                  <div style={{ flex: 1, height: 20, background: P.bg, borderRadius: 5, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${pct}%`, background: barColors[i % barColors.length], borderRadius: 5,
                      display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6,
                      fontSize: 10, fontWeight: 700, color: "#fff", transition: "width .3s",
                    }}>
                      {pct > 25 && `${d.tours}`}
                    </div>
                  </div>
                  {pct <= 25 && <span style={{ fontSize: 11, fontWeight: 600 }}>{d.tours}</span>}
                  <span style={{ fontSize: 10, color: P.muted, minWidth: 50 }}>{d.pax} pax</span>
                </div>
              )
            })
          )}
          {storicoByFornitore.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: `2px solid ${P.border}`, fontWeight: 700, fontSize: 13, color: P.text }}>
              <span>TOTALE PERIODO</span>
              <span>{storicoByFornitore.reduce((a, [, d]) => a + d.tours, 0)} tour . {storicoByFornitore.reduce((a, [, d]) => a + d.pax, 0)} pax</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────
function PriorityDots({ score }: { score: number }) {
  // 5 dots, filled based on inverse score (lower score = more dots = higher priority)
  const filled = score <= 0.3 ? 5 : score <= 0.6 ? 4 : score <= 0.9 ? 3 : score <= 1.2 ? 2 : 1
  const color = filled >= 4 ? '#00875a' : filled >= 3 ? '#d97706' : '#dc2626'
  return (
    <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: "50%",
          background: i <= filled ? color : '#e2e6ef',
          transition: "background .2s",
        }} />
      ))}
    </div>
  )
}

function thStyle(P: any): React.CSSProperties {
  return {
    textAlign: "left", padding: "12px 16px", fontWeight: 600, fontSize: 12,
    textTransform: "uppercase", letterSpacing: "0.04em",
    background: P.headerBg, color: P.muted, borderBottom: `2px solid ${P.border}`,
    whiteSpace: "nowrap",
  }
}

function tdStyle(P: any): React.CSSProperties {
  return { padding: "11px 16px", borderBottom: `1px solid ${P.border}` }
}