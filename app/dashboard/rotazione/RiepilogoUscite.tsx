'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'

interface StoricoRow {
  imbarcazione_id: string
  imbarcazione_nome: string
  fornitore_id: string
  fornitore_nome: string
  data_servizio: string
  numero_persone: number
  stato: string
  servizio_tipo?: string
}
interface Fornitore { id: string; nome: string }

const P = {
  bg: "#f8f9fc", card: "#fff", border: "#e2e6ef", text: "#1a1f36", muted: "#6b7394",
  primary: "#0047AB", primaryLt: "#e8f0fe", accent: "#00875a", accentLt: "#e3fcef",
  orange: "#e07c00", headerBg: "#f1f3f9", warn: "#dc2626",
}

const tdStyle = { padding: "10px 14px", borderBottom: `1px solid ${P.border}`, fontSize: 14, color: P.text }
const thStyle: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: P.muted, background: P.headerBg, borderBottom: `2px solid ${P.border}` }

// preset periodo
function rangeOggi(): [string, string] { const d = new Date().toISOString().split('T')[0]; return [d, d] }
function rangeSettimana(): [string, string] {
  const now = new Date(); const day = (now.getDay() + 6) % 7 // lun=0
  const lun = new Date(now); lun.setDate(now.getDate() - day)
  const dom = new Date(lun); dom.setDate(lun.getDate() + 6)
  return [lun.toISOString().split('T')[0], dom.toISOString().split('T')[0]]
}
function rangeMese(): [string, string] {
  const now = new Date()
  const primo = new Date(now.getFullYear(), now.getMonth(), 1)
  const ultimo = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return [primo.toISOString().split('T')[0], ultimo.toISOString().split('T')[0]]
}

export default function RiepilogoUscite() {
  const [storico, setStorico] = useState<StoricoRow[]>([])
  const [fornitori, setFornitori] = useState<Fornitore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [fornitoreFiltro, setFornitoreFiltro] = useState('all')
  const [dataDal, setDataDal] = useState('')
  const [dataAl, setDataAl] = useState('')
  const [presetAttivo, setPresetAttivo] = useState<'oggi' | 'settimana' | 'mese' | 'totale' | 'custom'>('totale')

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/rotazione')
      if (!res.ok) throw new Error(`Errore ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setStorico(json.storico || [])
      setFornitori(json.fornitori || [])
    } catch (err: any) { setError(err.message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function applicaPreset(p: 'oggi' | 'settimana' | 'mese' | 'totale') {
    setPresetAttivo(p)
    if (p === 'oggi') { const [a, b] = rangeOggi(); setDataDal(a); setDataAl(b) }
    else if (p === 'settimana') { const [a, b] = rangeSettimana(); setDataDal(a); setDataAl(b) }
    else if (p === 'mese') { const [a, b] = rangeMese(); setDataDal(a); setDataAl(b) }
    else { setDataDal(''); setDataAl('') } // totale
  }

  // Aggregazione per barca (solo confermate/completate, filtri periodo + fornitore)
  const righe = useMemo(() => {
    const validi = storico.filter(s => {
      const st = (s.stato || '').toLowerCase()
      if (st !== 'confermata' && st !== 'completata') return false
      if (fornitoreFiltro !== 'all' && s.fornitore_id !== fornitoreFiltro) return false
      const d = s.data_servizio || ''
      if (dataDal && d < dataDal) return false
      if (dataAl && d > dataAl) return false
      return true
    })
    const map: Record<string, {
      barca: string; fornitore: string;
      giorni: Set<string>;  // date distinte = uscite (barca+giorno = 1 uscita)
      pax: number;
    }> = {}
    validi.forEach(s => {
      const key = s.imbarcazione_id || s.imbarcazione_nome
      if (!map[key]) map[key] = { barca: s.imbarcazione_nome || '—', fornitore: s.fornitore_nome || '—', giorni: new Set(), pax: 0 }
      map[key].giorni.add(s.data_servizio || '')  // stessa barca+giorno = 1 uscita
      map[key].pax += s.numero_persone || 0        // pax sempre sommati
    })
    return Object.values(map)
      .map(m => ({
        barca: m.barca,
        fornitore: m.fornitore,
        uscite: m.giorni.size,  // numero di giorni distinti = uscite reali
        pax: m.pax,
      }))
      .sort((a, b) => b.uscite - a.uscite)
  }, [storico, fornitoreFiltro, dataDal, dataAl])

  const totali = useMemo(() => ({
    uscite: righe.reduce((s, r) => s + r.uscite, 0),
    pax: righe.reduce((s, r) => s + r.pax, 0),
  }), [righe])

  async function esportaExcel() {
    const header = ['Barca', 'Fornitore', 'N° Uscite', 'N° Passeggeri']
    const dati = righe.map(r => [r.barca, r.fornitore, r.uscite, r.pax])
    const periodo = dataDal || dataAl ? `${dataDal || '...'}_${dataAl || '...'}` : 'totale'
    const filename = `riepilogo_uscite_${periodo}.xlsx`

    try {
      const XLSX = await import('xlsx')
      const wsData = [header, ...dati, [], ['TOTALE', '', totali.uscite, totali.pax]]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      ws['!cols'] = [{ wch: 28 }, { wch: 32 }, { wch: 12 }, { wch: 14 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Riepilogo Uscite')
      XLSX.writeFile(wb, filename)
    } catch {
      // fallback CSV se xlsx non disponibile
      const rows = [header, ...dati, [], ['TOTALE', '', totali.uscite, totali.pax]]
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename.replace('.xlsx', '.csv'); a.click()
      URL.revokeObjectURL(url)
    }
  }

  const presetBtn = (key: 'oggi' | 'settimana' | 'mese' | 'totale', label: string) => (
    <button onClick={() => applicaPreset(key)}
      style={{ fontSize: 13, fontWeight: 600, padding: "7px 14px", border: `1px solid ${P.border}`, borderRadius: 8, cursor: "pointer",
        background: presetAttivo === key ? P.primary : P.bg, color: presetAttivo === key ? '#fff' : P.text }}>
      {label}
    </button>
  )

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: P.muted }}>Caricamento…</div>
  if (error) return <div style={{ padding: 20, background: '#fef2f2', color: P.warn, borderRadius: 8 }}>Errore: {error}</div>

  return (
    <div>
      {/* Filtri */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: P.muted }}>Fornitore</span>
          <select value={fornitoreFiltro} onChange={e => setFornitoreFiltro(e.target.value)}
            style={{ fontSize: 14, padding: "8px 12px", border: `1px solid ${P.border}`, borderRadius: 8, background: P.bg, color: P.text, cursor: "pointer", minWidth: 200 }}>
            <option value="all">Tutti i fornitori</option>
            {fornitori.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: P.muted }}>Periodo</span>
          <div style={{ display: "flex", gap: 6 }}>
            {presetBtn('oggi', 'Oggi')}
            {presetBtn('settimana', 'Settimana')}
            {presetBtn('mese', 'Mese')}
            {presetBtn('totale', 'Totale')}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: P.muted }}>Dal / Al</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="date" value={dataDal} onChange={e => { setDataDal(e.target.value); setPresetAttivo('custom') }}
              style={{ fontSize: 14, padding: "7px 10px", border: `1px solid ${P.border}`, borderRadius: 8 }} />
            <span style={{ color: P.muted }}>→</span>
            <input type="date" value={dataAl} onChange={e => { setDataAl(e.target.value); setPresetAttivo('custom') }}
              style={{ fontSize: 14, padding: "7px 10px", border: `1px solid ${P.border}`, borderRadius: 8 }} />
          </div>
        </div>

        <button onClick={esportaExcel}
          style={{ marginLeft: "auto", fontSize: 14, fontWeight: 600, padding: "9px 18px", border: "none", borderRadius: 8, cursor: "pointer", background: P.accent, color: "#fff" }}>
          ⬇ Esporta Excel
        </button>
      </div>

      {/* Riepilogo card */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={{ background: P.primaryLt, borderRadius: 10, padding: "12px 18px" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: P.primary }}>{righe.length}</div>
          <div style={{ fontSize: 12, color: P.muted }}>Barche uscite</div>
        </div>
        <div style={{ background: P.accentLt, borderRadius: 10, padding: "12px 18px" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: P.accent }}>{totali.uscite}</div>
          <div style={{ fontSize: 12, color: P.muted }}>Uscite totali</div>
        </div>
        <div style={{ background: P.headerBg, borderRadius: 10, padding: "12px 18px" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: P.text }}>{totali.pax.toLocaleString('it-IT')}</div>
          <div style={{ fontSize: 12, color: P.muted }}>Passeggeri imbarcati</div>
        </div>
      </div>

      {/* Tabella */}
      <div style={{ background: P.card, borderRadius: 12, border: `1px solid ${P.border}`, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Barca</th>
              <th style={thStyle}>Fornitore</th>
              <th style={{ ...thStyle, textAlign: "right" }}>N° Uscite</th>
              <th style={{ ...thStyle, textAlign: "right" }}>N° Passeggeri</th>
            </tr>
          </thead>
          <tbody>
            {righe.length === 0 ? (
              <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: P.muted, padding: 30 }}>Nessuna uscita nel periodo selezionato</td></tr>
            ) : righe.map((r, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : P.bg }}>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{r.barca}</td>
                <td style={{ ...tdStyle, color: P.primary, fontWeight: 600 }}>{r.fornitore}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{r.uscite}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.pax.toLocaleString('it-IT')}</td>
              </tr>
            ))}
          </tbody>
          {righe.length > 0 && (
            <tfoot>
              <tr style={{ background: P.headerBg, fontWeight: 800 }}>
                <td style={{ ...tdStyle, fontWeight: 800 }}>TOTALE</td>
                <td style={tdStyle}></td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>{totali.uscite}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>{totali.pax.toLocaleString('it-IT')}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}