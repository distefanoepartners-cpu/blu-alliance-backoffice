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
interface Blocco {
  imbarcazione_id: string
  data_inizio: string
  data_fine: string
  motivo: string
  note: string
}
interface Imbarcazione {
  id: string
  nome: string
  fornitore_id: string
  tour_collettivi_attivi?: boolean
}
interface PostoEsterno {
  imbarcazione_id: string
  data: string
  posti_occupati: number
}

// Mappa NS3000 boat_id → BA imbarcazione_id (per leggere l'occupazione NS3000)
const ns3000ToBaMap: Record<string, string> = {
  '4a222a73-304b-4945-813b-9548ba201675': 'b743d220-6200-49de-9324-68297e4eee75',
  'd03cfe13-bcb6-4f98-bda4-a18b8bf7957d': '64e06e82-ed6e-4f23-b06e-14533a0187c6',
  '00ce8828-ebf9-4aad-8ad8-8f6b4e90a1e3': '7e854592-bb5d-4971-98aa-ae66c2fa66ba',
  '2edce19e-3687-42b9-bb87-57e2aabfccd2': 'b2a20895-eeab-493d-a2fb-53ef5ba1d220',
  '937298ab-2a15-4ace-adb2-b63dd1b865b1': '4c4f4b54-4ee6-481f-94f9-a142b5d651b0',
  '6800721d-a8e9-4217-b7a2-8548359c6cfc': '9a6cc58f-bb70-440e-92a1-d2e2c2712e5b',
  '52a7e9d0-444e-4801-a095-afcbba7ceed5': 'b2c15f7e-ffb2-4afa-bf19-d53f8d26902b',
  '180dd752-b2b4-4318-beed-8bc15b3877c2': '557ecf08-2e88-4914-a1d9-da5ec5bf5845',
  '8c1b5b3d-d4a2-441c-8f8e-71b88ff6c966': '07673392-e08c-4d53-a128-e9d6c405917d',
  '42d4c904-f2e1-4436-931b-3e7b651bd7a6': '2f4f1a71-5037-4fb0-bbd1-ef6c6acf8dc5',
  'c35aefd0-6721-4f01-aeec-2d47bdf9f24f': 'e27ce151-0cd0-444e-b5f9-040b09859377',
  '0e705ad6-bcaf-445f-b640-2c4b0a9166ff': '2d4995ec-35b3-4358-ace1-54621a9528ed',
  '1e731610-2e9a-4a50-99d4-90f21488eb79': 'fb77e14d-9de5-479a-9051-beb4c4de9b09',
  'fe759df8-5d8e-401f-8fb2-dfaa3642c33c': '51231c4f-b929-466c-aed3-9440639e0bd7',
  'd5bff230-0e6a-4211-b0ce-342e8fbace51': '8d4d1bd6-142f-4d0f-8854-333742eeeba3',
  '636cb5d4-1316-4382-90db-fa6c16deb1f4': '31d0ac07-57a9-472d-b07a-f9a26b2ba89e',
  '1365d4d3-0ffb-48a8-a8a6-d3c49dd22145': 'a079598f-b25d-49d6-90ce-b25146687a31',
  '7b039929-1af2-46ab-9a91-f051497161e7': 'c8638c23-cd35-4c11-8333-4316f1ca4726',
  '02ffd51e-da3f-45fa-b2a5-92acc254e2a6': 'd8262b01-07d0-4795-ba31-e64c6eaf6f0f',
  '3b967967-d7de-48bb-9f03-5e779aa15a27': '43d0b751-da8d-4181-aabc-ba3b217142bc',
}

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
  const [blocchi, setBlocchi] = useState<Blocco[]>([])
  const [imbarcazioni, setImbarcazioni] = useState<Imbarcazione[]>([])
  const [postiEsterni, setPostiEsterni] = useState<PostoEsterno[]>([])
  // id BA delle barche occupate su NS3000 nel giorno selezionato (full_day non disponibile)
  const [ns3000OccupateIds, setNs3000OccupateIds] = useState<Set<string>>(new Set())
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
      setBlocchi(json.blocchi || [])
      setImbarcazioni(json.imbarcazioni || [])
      setPostiEsterni(json.postiEsterni || [])
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

  // ⭐ Analisi disponibilità: attiva solo quando è selezionato un SINGOLO giorno
  const giornoSingolo = dataDal && dataAl && dataDal === dataAl ? dataDal : null

  // ⭐ Carica l'occupazione NS3000 per il giorno singolo (barche mappate con full_day non disponibile)
  useEffect(() => {
    if (!giornoSingolo) { setNs3000OccupateIds(new Set()); return }
    let annullato = false
    ;(async () => {
      try {
        const res = await fetch('/api/ns3000/availability?date=' + giornoSingolo)
        if (!res.ok) return
        const data = await res.json()
        const occ = new Set<string>()
        ;(data.boats || []).forEach((boat: any) => {
          const dayAvail = boat.availability?.[giornoSingolo!]
          // occupata se il full_day non è disponibile (almeno una fascia presa)
          if (dayAvail && dayAvail.slots && dayAvail.slots.full_day === false) {
            const baId = ns3000ToBaMap[boat.boat_id]
            if (baId) occ.add(baId)
          }
        })
        if (!annullato) setNs3000OccupateIds(occ)
      } catch { /* se NS3000 non risponde, l'analisi resta senza questo dato */ }
    })()
    return () => { annullato = true }
  }, [giornoSingolo])
  const analisiGiorno = useMemo(() => {
    if (!giornoSingolo) return null
    const g = giornoSingolo

    // barche attive (già filtrate a monte dalla route con attiva=true), eventualmente filtro fornitore
    const barcheAttive = imbarcazioni.filter(b => fornitoreFiltro === 'all' || b.fornitore_id === fornitoreFiltro)

    // IMPEGNATE = solo prenotazioni BA (i tour reali del consorzio), esclusi cancellata/annullata
    const impegnateIds = new Set(
      storico.filter(s => {
        const st = (s.stato || '').toLowerCase()
        return st !== 'cancellata' && st !== 'annullata' && s.data_servizio === g &&
          (fornitoreFiltro === 'all' || s.fornitore_id === fornitoreFiltro)
      }).map(s => s.imbarcazione_id)
    )

    // NON DISPONIBILI = blocchi socio + posti esterni + occupazione NS3000 (con motivo)
    const nonDispByBarca: Record<string, string> = {}
    blocchi.forEach(b => {
      if (g >= b.data_inizio && g <= b.data_fine) nonDispByBarca[b.imbarcazione_id] = (b.note || b.motivo || 'Indisponibilità')
    })
    postiEsterni.forEach(pe => {
      if (pe.data === g && (pe.posti_occupati || 0) > 0 && !nonDispByBarca[pe.imbarcazione_id])
        nonDispByBarca[pe.imbarcazione_id] = 'prenotazione esterna'
    })
    ns3000OccupateIds.forEach(id => {
      if (!nonDispByBarca[id]) nonDispByBarca[id] = 'occupata NS3000'
    })

    const uscite: { nome: string; fornitore: string }[] = []
    const disponibiliNonUscite: { nome: string; fornitore: string }[] = []
    const bloccate: { nome: string; fornitore: string; motivo: string }[] = []

    const fornMap = new Map(fornitori.map(f => [f.id, f.nome]))
    barcheAttive.forEach(b => {
      const fn = fornMap.get(b.fornitore_id) || '—'
      if (impegnateIds.has(b.id)) uscite.push({ nome: b.nome, fornitore: fn })
      else if (nonDispByBarca[b.id]) {
        bloccate.push({ nome: b.nome, fornitore: fn, motivo: nonDispByBarca[b.id] })
      } else disponibiliNonUscite.push({ nome: b.nome, fornitore: fn })
    })

    return { uscite, disponibiliNonUscite, bloccate, totaleAttive: barcheAttive.length }
  }, [giornoSingolo, imbarcazioni, storico, blocchi, postiEsterni, ns3000OccupateIds, fornitori, fornitoreFiltro])

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

      {/* ⭐ Analisi disponibilità (solo su singolo giorno) */}
      {analisiGiorno && (
        <div style={{ background: P.card, borderRadius: 12, border: `1px solid ${P.border}`, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: P.text, marginBottom: 4 }}>
            📅 Analisi disponibilità del giorno
          </div>
          <div style={{ fontSize: 13, color: P.muted, marginBottom: 14 }}>
            Su {analisiGiorno.totaleAttive} barche attive: {analisiGiorno.uscite.length} impegnate (prenotazioni BA), {analisiGiorno.disponibiliNonUscite.length} disponibili libere, {analisiGiorno.bloccate.length} non disponibili.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {/* Uscite */}
            <div style={{ background: P.accentLt, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: P.accent, marginBottom: 8 }}>🔵 Impegnate BA ({analisiGiorno.uscite.length})</div>
              {analisiGiorno.uscite.length === 0 ? <div style={{ fontSize: 12, color: P.muted }}>—</div> :
                analisiGiorno.uscite.map((b, i) => (
                  <div key={i} style={{ fontSize: 12, color: P.text, marginBottom: 3 }}>{b.nome} <span style={{ color: P.muted }}>· {b.fornitore}</span></div>
                ))}
            </div>
            {/* Disponibili non uscite */}
            <div style={{ background: '#fffbeb', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: P.orange, marginBottom: 8 }}>🟢 Disponibili libere ({analisiGiorno.disponibiliNonUscite.length})</div>
              {analisiGiorno.disponibiliNonUscite.length === 0 ? <div style={{ fontSize: 12, color: P.muted }}>—</div> :
                analisiGiorno.disponibiliNonUscite.map((b, i) => (
                  <div key={i} style={{ fontSize: 12, color: P.text, marginBottom: 3 }}>{b.nome} <span style={{ color: P.muted }}>· {b.fornitore}</span></div>
                ))}
            </div>
            {/* Bloccate */}
            <div style={{ background: '#fef2f2', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: P.warn, marginBottom: 8 }}>⚓ Non disponibili ({analisiGiorno.bloccate.length})</div>
              {analisiGiorno.bloccate.length === 0 ? <div style={{ fontSize: 12, color: P.muted }}>—</div> :
                analisiGiorno.bloccate.map((b, i) => (
                  <div key={i} style={{ fontSize: 12, color: P.text, marginBottom: 3 }}>{b.nome} <span style={{ color: P.muted }}>· {b.motivo}</span></div>
                ))}
            </div>
          </div>
          <div style={{ fontSize: 12, color: P.muted, marginTop: 12, fontStyle: "italic" }}>
            Impegnate BA = tour reali del consorzio. Disponibili libere = potevano ricevere un tour. Non disponibili = bloccate dal socio, occupate da prenotazioni esterne o su NS3000. Solo le disponibili libere avrebbero potuto ricevere un nuovo tour.
          </div>
        </div>
      )}
      {!giornoSingolo && (
        <div style={{ fontSize: 12, color: P.muted, marginBottom: 16, fontStyle: "italic" }}>
          💡 Seleziona un singolo giorno (Dal = Al, o preset "Oggi") per vedere l'analisi di disponibilità: uscite, disponibili non uscite e barche bloccate.
        </div>
      )}

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

      {/* Riepilogo card (in fondo) */}
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
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
    </div>
  )
}