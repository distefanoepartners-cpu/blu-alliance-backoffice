'use client'

import { useState, useMemo, useEffect, useCallback } from "react"

interface Prenotazione {
  id: string
  data_servizio: string
  forfettario?: boolean
  servizio_nome: string
  imbarcazione_id: string | null
  imbarcazione_nome: string
  barca_esterna_nome: string | null
  is_esterna: boolean
  percentuale_commissione: number
  fornitore_id: string
  fornitore_nome: string
  numero_persone: number
  prezzo_totale: number
  stato: string
}
interface Fornitore { id: string; nome: string; percentuale_commissione?: number | null }

interface RendicontoProps {
  /** Se passato, filtra solo per questo fornitore e nasconde il selettore */
  lockedFornitoreId?: string | null
  /** Nome fornitore da mostrare nel titolo (per la vista operatore) */
  fornitoreLabel?: string
}

const DEFAULT_RATE = 18

const fmt = (n: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n)
const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })
const fmtDateFile = (iso: string) => iso ? iso.replace(/-/g, "") : "all"

const VIEW_MODES = {
  completo: { label: "Estratto Conto Completo", icon: "💰", desc: "Tutti i dati contabili — per invio al fornitore" },
  rotazione: { label: "Rotazione Vendite", icon: "🔄", desc: "Solo operatività, senza importi — per i soci" },
}

export default function RendicontoContabile({ lockedFornitoreId, fornitoreLabel }: RendicontoProps) {
  const [dataInizio, setDataInizio] = useState("")
  const [dataFine, setDataFine] = useState("")
  const [fornitoreFilter, setFornitoreFilter] = useState("all")
  const [sortCol, setSortCol] = useState("data_servizio")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [viewMode, setViewMode] = useState<"completo" | "rotazione">("completo")
  const [exportOpen, setExportOpen] = useState(false)
  const [hoveredExport, setHoveredExport] = useState<string | null>(null)
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([])
  const [fornitori, setFornitori] = useState<Fornitore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Se l'operatore ha un fornitore bloccato, non mostra il toggle rotazione (non è per i soci)
  const isOperatore = !!lockedFornitoreId
  const isCompleto = viewMode === "completo"

  const activeFornitoreId = lockedFornitoreId || (fornitoreFilter !== "all" ? fornitoreFilter : undefined)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams()
      if (dataInizio) params.set('data_inizio', dataInizio)
      if (dataFine) params.set('data_fine', dataFine)
      if (activeFornitoreId) params.set('fornitore_id', activeFornitoreId)
      const res = await fetch(`/api/rendiconto?${params.toString()}`)
      if (!res.ok) throw new Error(`Errore ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPrenotazioni(json.prenotazioni)
      setFornitori(json.fornitori)
    } catch (err: any) { setError(err.message) } finally { setLoading(false) }
  }, [dataInizio, dataFine, activeFornitoreId])

  useEffect(() => { fetchData() }, [fetchData])

  // Aggrega tour collettivi: stessa barca + stessa data + stesso servizio = 1 tour
  const aggregatedPrenotazioni = useMemo(() => {
    const result: Prenotazione[] = []
    const grouped = new Map<string, Prenotazione[]>()

    prenotazioni.forEach(p => {
      const isCollettivo = (p.servizio_nome || '').toLowerCase().includes('collettivo')
      if (!isCollettivo) {
        result.push(p)
        return
      }
      const key = `${p.imbarcazione_nome}|${p.data_servizio}|${p.servizio_nome}|${p.percentuale_commissione}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(p)
    })

    grouped.forEach(group => {
      if (group.length === 1) {
        result.push(group[0])
      } else {
        const first = group[0]
        result.push({
          ...first,
          id: `agg-${first.id}`,
          numero_persone: group.reduce((s, p) => s + (p.numero_persone || 0), 0),
          prezzo_totale: group.reduce((s, p) => s + (p.prezzo_totale || 0), 0),
        })
      }
    })

    return result
  }, [prenotazioni])

  const rows = useMemo(() => {
    const sorted = [...aggregatedPrenotazioni]
    sorted.sort((a: any, b: any) => {
      let va = a[sortCol], vb = b[sortCol]
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va)
      return sortDir === "asc" ? va - vb : vb - va
    })
    return sorted
  }, [aggregatedPrenotazioni, sortCol, sortDir])

  const enriched = useMemo(
    () => rows.map((r) => {
      const perc = r.percentuale_commissione ?? DEFAULT_RATE
      const lordo = r.prezzo_totale || 0
      const commissione = lordo * (perc / 100)
      // ⭐ Forfettario dal 1/8/2026: BA incassa solo la commissione, non eroga nulla al socio
      // (il socio ha già incassato dal cliente). Prima/normali: BA incassa il pieno e eroga il saldo.
      const isForfAgosto = !!(r as any).forfettario && (r.data_servizio || '') >= '2026-08-01'
      const incassatoBA = isForfAgosto ? commissione : lordo
      const saldoFornitore = isForfAgosto ? 0 : lordo * (1 - perc / 100)
      return { ...r, commissione, saldoFornitore, incassatoBA, isForfAgosto }
    }),
    [rows]
  )

  const totals = useMemo(
    () => enriched.reduce((acc, r) => ({
      pax: acc.pax + (r.numero_persone || 0),
      importo: acc.importo + r.incassatoBA,
      lordo: acc.lordo + (r.prezzo_totale || 0),
      commissione: acc.commissione + r.commissione,
      saldoFornitore: acc.saldoFornitore + r.saldoFornitore,
    }), { pax: 0, importo: 0, lordo: 0, commissione: 0, saldoFornitore: 0 }),
    [enriched]
  )

  const perFornitore = useMemo(() => {
    const map: Record<string, { importo: number; commissione: number; saldo: number; pax: number; count: number; rates: Set<number> }> = {}
    enriched.forEach((r) => {
      const key = r.fornitore_nome || 'N/D'
      if (!map[key]) map[key] = { importo: 0, commissione: 0, saldo: 0, pax: 0, count: 0, rates: new Set() }
      map[key].importo += r.prezzo_totale || 0
      map[key].commissione += r.commissione
      map[key].saldo += r.saldoFornitore
      map[key].pax += r.numero_persone || 0
      map[key].count += 1
      map[key].rates.add(r.percentuale_commissione ?? DEFAULT_RATE)
    })
    return Object.entries(map).sort((a, b) => b[1].saldo - a[1].saldo)
  }, [enriched])

  const perBarca = useMemo(() => {
    const map: Record<string, { fornitore: string; pax: number; count: number; esterna: boolean }> = {}
    enriched.forEach((r) => {
      const key = r.imbarcazione_nome || 'N/D'
      if (!map[key]) map[key] = { fornitore: r.fornitore_nome || 'N/D', pax: 0, count: 0, esterna: !!r.is_esterna }
      map[key].pax += r.numero_persone || 0
      map[key].count += 1
    })
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count)
  }, [enriched])

  // Aliquote distinte presenti nel set corrente
  const rateSummary = useMemo(() => {
    const set = new Set<number>()
    enriched.forEach(r => set.add(r.percentuale_commissione ?? DEFAULT_RATE))
    const arr = Array.from(set).sort((a, b) => a - b)
    return { rates: arr, mixed: arr.length > 1, label: arr.length === 0 ? `${DEFAULT_RATE}%` : arr.length === 1 ? `${arr[0]}%` : 'variabile' }
  }, [enriched])

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortCol(col); setSortDir("asc") }
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <span style={{ opacity: 0.25, marginLeft: 4, fontSize: 11 }}>⇅</span>
    return <span style={{ marginLeft: 4, fontSize: 11 }}>{sortDir === "asc" ? "↑" : "↓"}</span>
  }

  // ── EXCEL EXPORT ──────────────────────────────────────────────────
  const exportExcel = async (mode: 'completo' | 'rotazione') => {
    setExportOpen(false)
    const XLSX = (await import('xlsx')).default || await import('xlsx')

    const wb = XLSX.utils.book_new()
    const supplierLabel = activeFornitoreId
      ? (fornitori.find(f => f.id === activeFornitoreId)?.nome || fornitoreLabel || 'fornitore')
      : 'tutti'

    if (mode === 'rotazione') {
      // ── Sheet 1: Rotazione vendite ──
      const header = ['Data', 'Tour', 'Barca', 'Tipo', 'Fornitore', 'Pax']
      const dataRows = enriched.map(r => [
        r.data_servizio, r.servizio_nome || '', r.imbarcazione_nome || '',
        r.is_esterna ? 'Esterna' : 'Flotta',
        r.fornitore_nome || '', r.numero_persone || 0,
      ])
      dataRows.push(['TOTALE', '', '', '', '', totals.pax])
      const ws1 = XLSX.utils.aoa_to_sheet([header, ...dataRows])
      ws1['!cols'] = [{ wch: 12 }, { wch: 35 }, { wch: 20 }, { wch: 10 }, { wch: 22 }, { wch: 8 }]
      styleHeader(ws1, header.length)
      styleTotalsRow(ws1, dataRows.length, header.length)
      XLSX.utils.book_append_sheet(wb, ws1, 'Rotazione Vendite')

      // ── Sheet 2: Riepilogo barche ──
      const bHeader = ['Barca', 'Tipo', 'Fornitore', 'Tour Effettuati', 'Pax Totali']
      const bRows = perBarca.map(([name, d]) => [name, d.esterna ? 'Esterna' : 'Flotta', d.fornitore, d.count, d.pax])
      const ws2 = XLSX.utils.aoa_to_sheet([bHeader, ...bRows])
      ws2['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 22 }, { wch: 16 }, { wch: 12 }]
      styleHeader(ws2, bHeader.length)
      XLSX.utils.book_append_sheet(wb, ws2, 'Impiego Barche')
    } else {
      // ── Sheet 1: Estratto conto ──
      const header = ['Data', 'Tour', 'Barca', 'Tipo', 'Fornitore', 'Pax', 'Importo Pagato', '% Comm.', 'Commissione', 'Saldo Fornitore']
      const dataRows = enriched.map(r => [
        r.data_servizio, r.servizio_nome || '', r.imbarcazione_nome || '',
        r.is_esterna ? 'Esterna' : 'Flotta',
        r.fornitore_nome || '', r.numero_persone || 0,
        r.prezzo_totale || 0, (r.percentuale_commissione ?? DEFAULT_RATE) / 100,
        r.commissione, r.saldoFornitore,
      ])
      dataRows.push(['TOTALE', '', '', '', '', totals.pax, totals.importo, '', totals.commissione, totals.saldoFornitore])
      const ws1 = XLSX.utils.aoa_to_sheet([header, ...dataRows])
      ws1['!cols'] = [
        { wch: 12 }, { wch: 35 }, { wch: 20 }, { wch: 10 }, { wch: 22 },
        { wch: 8 }, { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 16 },
      ]
      styleHeader(ws1, header.length)
      styleTotalsRow(ws1, dataRows.length, header.length)
      // Formato valuta colonne G, I, J — percentuale colonna H
      formatCurrencyCols(ws1, [6, 8, 9], dataRows.length + 1)
      formatPercentCol(ws1, 7, dataRows.length)
      XLSX.utils.book_append_sheet(wb, ws1, 'Estratto Conto')

      // ── Sheet 2: Riepilogo fornitori ──
      const fHeader = ['Fornitore', 'Aliquote %', 'Tour', 'Passeggeri', 'Incassato', 'Commissione BA', 'Saldo da Erogare']
      const fRows = perFornitore.map(([name, d]) => [
        name, Array.from(d.rates).sort((a, b) => a - b).join(' / '),
        d.count, d.pax, d.importo, d.commissione, d.saldo,
      ])
      const ws2 = XLSX.utils.aoa_to_sheet([fHeader, ...fRows])
      ws2['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 18 }]
      styleHeader(ws2, fHeader.length)
      formatCurrencyCols(ws2, [4, 5, 6], fRows.length + 1)
      XLSX.utils.book_append_sheet(wb, ws2, 'Riepilogo Fornitori')
    }

    const slug = supplierLabel.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const prefix = mode === 'rotazione' ? 'rotazione_vendite' : 'estratto_conto'
    XLSX.writeFile(wb, `${prefix}_${slug}_${fmtDateFile(dataInizio)}_${fmtDateFile(dataFine)}.xlsx`)
  }

  // ── Excel styling helpers ─────────────────────────────────────────
  function styleHeader(ws: any, cols: number) {
    for (let c = 0; c < cols; c++) {
      const ref = cellRef(0, c)
      if (!ws[ref]) continue
      ws[ref].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        fill: { fgColor: { rgb: '0047AB' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: borderStyle(),
      }
    }
  }

  function styleTotalsRow(ws: any, rowIdx: number, cols: number) {
    for (let c = 0; c < cols; c++) {
      const ref = cellRef(rowIdx, c)
      if (!ws[ref]) continue
      ws[ref].s = {
        font: { bold: true, sz: 11 },
        fill: { fgColor: { rgb: 'E8F0FE' } },
        border: { top: { style: 'medium', color: { rgb: '0047AB' } } },
        alignment: { horizontal: c >= 5 ? 'right' : 'left' },
      }
    }
  }

  function formatCurrencyCols(ws: any, colIndices: number[], totalRows: number) {
    for (const c of colIndices) {
      for (let r = 1; r < totalRows; r++) {
        const ref = cellRef(r, c)
        if (!ws[ref]) continue
        ws[ref].z = '€#,##0.00'
        if (!ws[ref].s) ws[ref].s = {}
        ws[ref].s.alignment = { horizontal: 'right' }
        ws[ref].s.numFmt = '€#,##0.00'
      }
    }
  }

  function formatPercentCol(ws: any, col: number, totalRows: number) {
    for (let r = 1; r < totalRows; r++) {
      const ref = cellRef(r, col)
      if (!ws[ref] || ws[ref].v === '') continue
      ws[ref].z = '0%'
      if (!ws[ref].s) ws[ref].s = {}
      ws[ref].s.alignment = { horizontal: 'right' }
      ws[ref].s.numFmt = '0%'
    }
  }

  function cellRef(r: number, c: number) {
    let col = ''
    let cc = c
    while (cc >= 0) { col = String.fromCharCode(65 + (cc % 26)) + col; cc = Math.floor(cc / 26) - 1 }
    return `${col}${r + 1}`
  }

  function borderStyle() {
    const b = { style: 'thin', color: { rgb: 'CCCCCC' } }
    return { top: b, bottom: b, left: b, right: b }
  }

  // ── CSV exports (fallback) ────────────────────────────────────────
  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
    setExportOpen(false)
  }

  // ── Palette ───────────────────────────────────────────────────────
  const P = {
    bg: "#f8f9fc", card: "#fff", border: "#e2e6ef", text: "#1a1f36", muted: "#6b7394",
    primary: "#0047AB", primaryLt: "#e8f0fe", accent: "#00875a",
    orange: "#e07c00", headerBg: "#f1f3f9",
    rotAccent: "#7c3aed", rotLt: "#ede9fe",
  }
  const modeAccent = isCompleto ? P.primary : P.rotAccent
  const modeLt = isCompleto ? P.primaryLt : P.rotLt
  const barColors = ["#0047AB", "#7c3aed", "#00875a", "#e07c00", "#de350b", "#0891b2"]
  const maxBarCount = perBarca.length > 0 ? Math.max(...perBarca.map(([, d]) => d.count)) : 1

  if (loading) return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: `4px solid ${P.primary}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ color: P.muted }}>Caricamento rendiconto...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", padding: 40, textAlign: "center" }}>
      <p style={{ color: "#de350b", fontSize: 16, fontWeight: 600 }}>Errore nel caricamento</p>
      <p style={{ color: P.muted, marginTop: 8 }}>{error}</p>
      <button onClick={fetchData} style={{ marginTop: 16, padding: "10px 24px", background: P.primary, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Riprova</button>
    </div>
  )

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif", color: P.text, background: P.bg, minHeight: "100vh", padding: "24px 20px" }} onClick={() => exportOpen && setExportOpen(false)}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          {isCompleto ? "💰" : "🔄"} {isOperatore ? "Il mio Rendiconto" : `Rendiconto ${isCompleto ? "Contabile" : "Rotazione Vendite"}`}
          {fornitoreLabel && <span style={{ fontSize: 14, fontWeight: 500, color: P.muted }}>— {fornitoreLabel}</span>}
          {isCompleto && <span title={rateSummary.mixed ? `Aliquote presenti: ${rateSummary.rates.join('%, ')}%` : undefined} style={{ fontSize: 11, fontWeight: 600, background: modeLt, color: modeAccent, padding: "3px 10px", borderRadius: 20 }}>Commissione {rateSummary.label}</span>}
        </h1>
      </div>

      {/* View Mode Toggle — solo admin */}
      {!isOperatore && (
        <div style={{ display: "flex", gap: 0, background: P.card, border: `1px solid ${P.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
          {Object.entries(VIEW_MODES).map(([key, m]) => (
            <button key={key} onClick={() => setViewMode(key as any)} style={{
              flex: 1, padding: "14px 20px", border: "none", cursor: "pointer",
              background: viewMode === key ? modeLt : "transparent",
              borderBottom: viewMode === key ? `3px solid ${modeAccent}` : "3px solid transparent",
              display: "flex", alignItems: "center", gap: 10, transition: "all .2s",
            }}>
              <span style={{ fontSize: 20 }}>{m.icon}</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 14, fontWeight: viewMode === key ? 700 : 500, color: viewMode === key ? modeAccent : P.text }}>{m.label}</div>
                <div style={{ fontSize: 11, color: P.muted, marginTop: 1 }}>{m.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: P.muted }}>Data inizio</span>
          <input type="date" value={dataInizio} onChange={e => setDataInizio(e.target.value)} style={{ fontSize: 14, padding: "8px 12px", border: `1px solid ${P.border}`, borderRadius: 8, outline: "none", background: P.bg, color: P.text, minWidth: 140 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: P.muted }}>Data fine</span>
          <input type="date" value={dataFine} onChange={e => setDataFine(e.target.value)} style={{ fontSize: 14, padding: "8px 12px", border: `1px solid ${P.border}`, borderRadius: 8, outline: "none", background: P.bg, color: P.text, minWidth: 140 }} />
        </div>

        {/* Selettore fornitore — solo admin */}
        {!isOperatore && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: P.muted }}>Fornitore</span>
            <select value={fornitoreFilter} onChange={e => setFornitoreFilter(e.target.value)} style={{ fontSize: 14, padding: "8px 12px", border: `1px solid ${P.border}`, borderRadius: 8, outline: "none", background: P.bg, color: P.text, minWidth: 180, cursor: "pointer" }}>
              <option value="all">Tutti i fornitori</option>
              {fornitori.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginLeft: "auto", alignSelf: "flex-end" }}>
          <button onClick={() => { setDataInizio(""); setDataFine(""); setFornitoreFilter("all") }} style={{ fontSize: 12, padding: "8px 14px", border: `1px solid ${P.border}`, borderRadius: 8, background: "transparent", cursor: "pointer", color: P.muted }}>Reset</button>

          {/* Export dropdown */}
          <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setExportOpen(!exportOpen)} style={{
              fontSize: 13, fontWeight: 600, padding: "9px 18px", border: `1px solid ${modeAccent}`,
              borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              background: modeLt, color: modeAccent,
            }}>⬇ Esporta ▾</button>
            {exportOpen && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: P.card, border: `1px solid ${P.border}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.12)", zIndex: 100, minWidth: 300, overflow: "hidden" }}>

                {/* Excel Estratto Conto */}
                <div style={{ padding: "14px 18px", cursor: "pointer", borderBottom: `1px solid ${P.border}`, background: hoveredExport === "xls-ec" ? P.bg : "transparent" }}
                  onMouseEnter={() => setHoveredExport("xls-ec")} onMouseLeave={() => setHoveredExport(null)}
                  onClick={() => exportExcel('completo')}>
                  <div><span style={{ fontSize: 16, marginRight: 8 }}>📊</span><span style={{ fontSize: 13, fontWeight: 600 }}>Excel — Estratto Conto</span></div>
                  <div style={{ fontSize: 11, color: P.muted, marginTop: 2 }}>
                    Foglio formattato con importi, commissioni e saldi
                    {activeFornitoreId && <strong> · {fornitori.find(f => f.id === activeFornitoreId)?.nome || fornitoreLabel}</strong>}
                  </div>
                </div>

                {/* Excel Rotazione — solo admin */}
                {!isOperatore && (
                  <div style={{ padding: "14px 18px", cursor: "pointer", borderBottom: `1px solid ${P.border}`, background: hoveredExport === "xls-rot" ? P.bg : "transparent" }}
                    onMouseEnter={() => setHoveredExport("xls-rot")} onMouseLeave={() => setHoveredExport(null)}
                    onClick={() => exportExcel('rotazione')}>
                    <div><span style={{ fontSize: 16, marginRight: 8 }}>📋</span><span style={{ fontSize: 13, fontWeight: 600 }}>Excel — Rotazione Vendite</span></div>
                    <div style={{ fontSize: 11, color: P.muted, marginTop: 2 }}>Per i soci — senza importi, con riepilogo barche</div>
                  </div>
                )}

                {/* CSV fallback */}
                <div style={{ padding: "10px 18px", cursor: "pointer", background: hoveredExport === "csv" ? P.bg : "transparent" }}
                  onMouseEnter={() => setHoveredExport("csv")} onMouseLeave={() => setHoveredExport(null)}
                  onClick={() => {
                    const header = isCompleto
                      ? "Data,Tour,Barca,Tipo,Fornitore,Pax,Importo,% Commissione,Commissione,Saldo Fornitore\n"
                      : "Data,Tour,Barca,Tipo,Fornitore,Pax\n"
                    const body = enriched.map(r =>
                      isCompleto
                        ? `${r.data_servizio},"${r.servizio_nome}","${r.imbarcazione_nome}",${r.is_esterna ? 'Esterna' : 'Flotta'},"${r.fornitore_nome}",${r.numero_persone},${(r.prezzo_totale||0).toFixed(2)},${r.percentuale_commissione ?? DEFAULT_RATE},${r.commissione.toFixed(2)},${r.saldoFornitore.toFixed(2)}`
                        : `${r.data_servizio},"${r.servizio_nome}","${r.imbarcazione_nome}",${r.is_esterna ? 'Esterna' : 'Flotta'},"${r.fornitore_nome}",${r.numero_persone}`
                    ).join("\n")
                    downloadCSV(header + body, `rendiconto_${fmtDateFile(dataInizio)}_${fmtDateFile(dataFine)}.csv`)
                  }}>
                  <div><span style={{ fontSize: 14, marginRight: 8, opacity: 0.5 }}>📄</span><span style={{ fontSize: 12, color: P.muted }}>Esporta CSV</span></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
        {(isCompleto ? [
          { value: fmt(totals.importo), label: "Incasso Blu Alliance", color: P.primary },
          { value: fmt(totals.commissione), label: "Commissioni Blu Alliance", color: P.accent },
          { value: fmt(totals.saldoFornitore), label: isOperatore ? "Il tuo saldo" : "Da erogare ai fornitori", color: P.orange },
          { value: String(totals.pax), label: `Passeggeri · ${enriched.length} tour`, color: P.muted },
        ] : [
          { value: String(enriched.length), label: "Tour effettuati", color: P.rotAccent },
          { value: String(totals.pax), label: "Passeggeri totali", color: "#0891b2" },
          { value: String(perBarca.length), label: "Barche impiegate", color: P.accent },
          { value: String(perFornitore.length), label: "Fornitori attivi", color: P.orange },
        ]).map((c, i) => (
          <div key={i} style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: "18px 20px", borderLeft: `4px solid ${c.color}` }}>
            <p style={{ fontSize: 24, fontWeight: 700, color: c.color, margin: 0 }}>{c.value}</p>
            <p style={{ fontSize: 12, color: P.muted, fontWeight: 500, marginTop: 2 }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Main Table */}
      <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
        {enriched.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: P.muted, fontSize: 15 }}>Nessun risultato per i filtri selezionati</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  {[
                    { key: "data_servizio", label: "Data", align: "left" as const },
                    { key: "servizio_nome", label: "Tour", align: "left" as const },
                    { key: "imbarcazione_nome", label: "Barca", align: "left" as const },
                    ...(!isOperatore ? [{ key: "fornitore_nome", label: "Fornitore", align: "left" as const }] : []),
                    { key: "numero_persone", label: "Pax", align: "right" as const },
                    ...(isCompleto ? [
                      { key: "prezzo_totale", label: "Importo", align: "right" as const },
                      { key: "percentuale_commissione", label: "%", align: "right" as const },
                      { key: "comm", label: "Commissione", align: "right" as const, noSort: true },
                      { key: "saldo", label: "Saldo Fornitore", align: "right" as const, noSort: true },
                    ] : []),
                  ].map((col: any) => (
                    <th key={col.key} onClick={() => !col.noSort && handleSort(col.key)} style={{
                      textAlign: col.align, padding: "12px 16px", fontWeight: 600, fontSize: 12,
                      textTransform: "uppercase", letterSpacing: "0.04em",
                      background: P.headerBg, color: P.muted, borderBottom: `2px solid ${P.border}`,
                      cursor: col.noSort ? "default" : "pointer", userSelect: "none", whiteSpace: "nowrap",
                    }}>
                      {col.label} {!col.noSort && <SortIcon col={col.key} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enriched.map((r) => (
                  <tr key={r.id} style={{ transition: "background .15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = modeLt}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "11px 16px", borderBottom: `1px solid ${P.border}` }}>{fmtDate(r.data_servizio)}</td>
                    <td style={{ padding: "11px 16px", borderBottom: `1px solid ${P.border}` }}>{r.servizio_nome || '—'}</td>
                    <td style={{ padding: "11px 16px", borderBottom: `1px solid ${P.border}` }}>
                      {r.imbarcazione_nome || '—'}
                      {r.is_esterna && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, background: "#fef3c7", color: "#92400e", padding: "2px 6px", borderRadius: 10, verticalAlign: "middle" }}>ESTERNA</span>}
                    </td>
                    {!isOperatore && <td style={{ padding: "11px 16px", borderBottom: `1px solid ${P.border}`, fontWeight: 600 }}>{r.fornitore_nome || '—'}</td>}
                    <td style={{ padding: "11px 16px", borderBottom: `1px solid ${P.border}`, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.numero_persone || 0}</td>
                    {isCompleto && <>
                      <td style={{ padding: "11px 16px", borderBottom: `1px solid ${P.border}`, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(r.prezzo_totale || 0)}</td>
                      <td style={{ padding: "11px 16px", borderBottom: `1px solid ${P.border}`, textAlign: "right", fontVariantNumeric: "tabular-nums", color: (r.percentuale_commissione ?? DEFAULT_RATE) !== DEFAULT_RATE ? P.orange : P.muted, fontWeight: (r.percentuale_commissione ?? DEFAULT_RATE) !== DEFAULT_RATE ? 700 : 500 }}>{r.percentuale_commissione ?? DEFAULT_RATE}%</td>
                      <td style={{ padding: "11px 16px", borderBottom: `1px solid ${P.border}`, textAlign: "right", fontVariantNumeric: "tabular-nums", color: P.accent }}>{fmt(r.commissione)}</td>
                      <td style={{ padding: "11px 16px", borderBottom: `1px solid ${P.border}`, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{fmt(r.saldoFornitore)}</td>
                    </>}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={isOperatore ? 3 : 4} style={{ padding: "12px 16px", fontWeight: 700, borderTop: `2px solid ${modeAccent}`, background: P.headerBg }}>TOTALE</td>
                  <td style={{ padding: "12px 16px", fontWeight: 700, borderTop: `2px solid ${modeAccent}`, background: P.headerBg, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{totals.pax}</td>
                  {isCompleto && <>
                    <td style={{ padding: "12px 16px", fontWeight: 700, borderTop: `2px solid ${modeAccent}`, background: P.headerBg, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(totals.importo)}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, borderTop: `2px solid ${modeAccent}`, background: P.headerBg, textAlign: "right", fontSize: 12, color: P.muted }}>{rateSummary.mixed ? '—' : `${rateSummary.rates[0] ?? DEFAULT_RATE}%`}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, borderTop: `2px solid ${modeAccent}`, background: P.headerBg, textAlign: "right", fontVariantNumeric: "tabular-nums", color: P.accent }}>{fmt(totals.commissione)}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, borderTop: `2px solid ${modeAccent}`, background: P.headerBg, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(totals.saldoFornitore)}</td>
                  </>}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Per-supplier cards — solo admin completo */}
      {isCompleto && !isOperatore && perFornitore.length > 0 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>🏢 Riepilogo per fornitore</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 20 }}>
            {perFornitore.map(([name, data]) => (
              <div key={name} style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: "16px 20px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: modeAccent }}>{name}</div>
                {[["Tour", String(data.count)], ["Passeggeri", String(data.pax)], ["Aliquota", Array.from(data.rates).sort((a, b) => a - b).join('% / ') + '%', data.rates.size > 1 ? P.orange : undefined], ["Incassato", fmt(data.importo)], ["Comm. BA", fmt(data.commissione), P.accent]].map(([l, v, c]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: P.muted }}>{l}</span><span style={{ fontWeight: 600, color: (c as string) || P.text }}>{v}</span>
                  </div>
                ))}
                <div style={{ borderTop: `1px solid ${P.border}`, marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>Saldo da erogare</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: P.accent }}>{fmt(data.saldo)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bar chart — solo admin rotazione */}
      {!isCompleto && !isOperatore && perBarca.length > 0 && (
        <>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>⛵ Impiego barche</div>
            <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
              {perBarca.map(([name, data], i) => {
                const pct = (data.count / maxBarCount) * 100
                return (
                  <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, minWidth: 120, textAlign: "right" }}>{name}</div>
                    <div style={{ flex: 1, height: 26, background: P.bg, borderRadius: 6, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: barColors[i % barColors.length], borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, fontSize: 11, fontWeight: 700, color: "#fff", transition: "width .4s" }}>
                        {pct > 30 && <span>{data.count} tour</span>}
                      </div>
                    </div>
                    {pct <= 30 && <span style={{ fontSize: 12, fontWeight: 600 }}>{data.count} tour</span>}
                    <span style={{ fontSize: 11, color: P.muted, minWidth: 60 }}>{data.pax} pax</span>
                  </div>
                )
              })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>🏢 Distribuzione per fornitore</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              {perFornitore.map(([name, data]) => {
                const tourPct = enriched.length > 0 ? ((data.count / enriched.length) * 100).toFixed(0) : "0"
                const paxPct = totals.pax > 0 ? ((data.pax / totals.pax) * 100).toFixed(0) : "0"
                return (
                  <div key={name} style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: "16px 20px" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: P.rotAccent }}>{name}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}><span style={{ color: P.muted }}>Tour</span><span style={{ fontWeight: 600 }}>{data.count} ({tourPct}%)</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}><span style={{ color: P.muted }}>Passeggeri</span><span style={{ fontWeight: 600 }}>{data.pax} ({paxPct}%)</span></div>
                    <div style={{ marginTop: 10 }}>
                      <div style={{ height: 6, background: P.bg, borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${tourPct}%`, background: P.rotAccent, borderRadius: 4 }} /></div>
                      <div style={{ fontSize: 11, color: P.muted, marginTop: 4 }}>Quota tour: {tourPct}%</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}