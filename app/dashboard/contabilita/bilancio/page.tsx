'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { authFetch } from '@/lib/api-client'
import * as XLSX from 'xlsx'

interface RigaCategoria {
  categoria_nome: string
  num_movimenti: number
  imponibile: number
  iva: number
  totale: number
}
interface Totali {
  ricavi: { imponibile: number; iva: number; totale: number }
  apporti: { imponibile: number; iva: number; totale: number }
  uscite: { imponibile: number; iva: number; totale: number }
  risultatoGestione: number
  saldoComplessivo: number
}
interface BilancioData {
  periodo: { dal: string; al: string }
  ricaviGestione: RigaCategoria[]
  apportiSoci: RigaCategoria[]
  uscite: RigaCategoria[]
  totali: Totali
}

const P = {
  bg: '#f8f9fc', card: '#fff', border: '#e2e6ef', text: '#1a1f36', muted: '#6b7394',
  primary: '#0047AB', primaryLt: '#e8f0fe', accent: '#00875a', accentLt: '#dcfce7',
  orange: '#e07c00', red: '#de350b', redLt: '#fee2e2',
}

function eur(n: number) {
  return '€ ' + (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function BilancioPage() {
  const oggi = new Date()
  const [dal, setDal] = useState(`${oggi.getFullYear()}-01-01`)
  const [al, setAl] = useState(`${oggi.getFullYear()}-06-30`)
  const [data, setData] = useState<BilancioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carica = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await authFetch(`/api/contabilita/bilancio?dal=${dal}&al=${al}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Errore ${res.status}`)
      setData(json)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [dal, al])

  useEffect(() => { carica() }, [carica])

  function esportaExcel() {
    if (!data) return
    const rows: any[] = []
    rows.push(['BILANCIO PROVVISORIO — Consorzio Blu Alliance'])
    rows.push([`Periodo: dal ${formatIt(data.periodo.dal)} al ${formatIt(data.periodo.al)} (competenza)`])
    rows.push([])
    rows.push(['RICAVI DELLA GESTIONE', 'Imponibile', 'IVA', 'Totale', 'N° mov.'])
    data.ricaviGestione.forEach(r => rows.push([r.categoria_nome, r.imponibile, r.iva, r.totale, r.num_movimenti]))
    rows.push(['Totale ricavi gestione', data.totali.ricavi.imponibile, data.totali.ricavi.iva, data.totali.ricavi.totale, ''])
    rows.push([])
    rows.push(['USCITE', 'Imponibile', 'IVA', 'Totale', 'N° mov.'])
    data.uscite.forEach(r => rows.push([r.categoria_nome, r.imponibile, r.iva, r.totale, r.num_movimenti]))
    rows.push(['Totale uscite', data.totali.uscite.imponibile, data.totali.uscite.iva, data.totali.uscite.totale, ''])
    rows.push([])
    rows.push(['RISULTATO DELLA GESTIONE (imponibile)', data.totali.risultatoGestione, '', '', ''])
    rows.push([])
    if (data.apportiSoci.length > 0) {
      rows.push(['APPORTI SOCI', 'Imponibile', 'IVA', 'Totale', 'N° mov.'])
      data.apportiSoci.forEach(r => rows.push([r.categoria_nome, r.imponibile, r.iva, r.totale, r.num_movimenti]))
      rows.push(['Totale apporti soci', data.totali.apporti.imponibile, data.totali.apporti.iva, data.totali.apporti.totale, ''])
      rows.push([])
      rows.push(['SALDO COMPLESSIVO (gestione + apporti)', data.totali.saldoComplessivo, '', '', ''])
    }
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 8 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Bilancio')
    XLSX.writeFile(wb, `bilancio_${data.periodo.dal}_${data.periodo.al}.xlsx`)
  }

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif", color: P.text, background: P.bg, minHeight: '100vh', padding: '24px 20px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }} className="no-print">
          <div style={{ fontSize: 12, color: P.muted, marginBottom: 2 }}>
            <Link href="/dashboard/contabilita/movimenti" style={{ color: P.muted, textDecoration: 'none' }}>Contabilità</Link> › Bilancio provvisorio
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Bilancio provvisorio</h1>
          <p style={{ fontSize: 13, color: P.muted, marginTop: 4 }}>Prospetto economico per competenza, raggruppato per categoria. Per relazioni infrannuali ai soci.</p>
        </div>

        {/* Controlli periodo */}
        <div className="no-print" style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap', marginBottom: 20, background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: '16px 20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: P.muted, marginBottom: 4 }}>Dal</label>
            <input type="date" value={dal} onChange={e => setDal(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: P.muted, marginBottom: 4 }}>Al</label>
            <input type="date" value={al} onChange={e => setAl(e.target.value)} style={inputStyle} />
          </div>
          <button onClick={carica} style={btnStyle(P.primary)}>Aggiorna</button>
          <div style={{ flex: 1 }} />
          <button onClick={esportaExcel} disabled={!data} style={btnStyle(P.accent)}>Esporta Excel</button>
          <button onClick={() => window.print()} disabled={!data} style={btnOutline}>Stampa / PDF</button>
        </div>

        {error && (
          <div style={{ background: P.redLt, border: `1px solid ${P.red}`, color: P.red, padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: P.muted }}>Caricamento bilancio...</div>
        ) : data ? (
          <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: '28px 32px' }} id="bilancio-print">
            {/* Intestazione stampa */}
            <div style={{ textAlign: 'center', marginBottom: 24, borderBottom: `2px solid ${P.text}`, paddingBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Bilancio Provvisorio — Consorzio Blu Alliance</div>
              <div style={{ fontSize: 13, color: P.muted, marginTop: 4 }}>
                Periodo: dal {formatIt(data.periodo.dal)} al {formatIt(data.periodo.al)} · criterio di competenza
              </div>
            </div>

            {/* RICAVI GESTIONE */}
            <Sezione titolo="Ricavi della gestione" color={P.accent}
              righe={data.ricaviGestione} tot={data.totali.ricavi} />

            {/* USCITE */}
            <Sezione titolo="Uscite" color={P.red}
              righe={data.uscite} tot={data.totali.uscite} />

            {/* RISULTATO GESTIONE */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: data.totali.risultatoGestione >= 0 ? P.accentLt : P.redLt, borderRadius: 8, marginTop: 8, marginBottom: 24 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Risultato della gestione (imponibile)</span>
              <span style={{ fontWeight: 700, fontSize: 18, color: data.totali.risultatoGestione >= 0 ? P.accent : P.red }}>
                {data.totali.risultatoGestione >= 0 ? '+' : ''}{eur(data.totali.risultatoGestione)}
              </span>
            </div>

            {/* APPORTI SOCI (se presenti) */}
            {data.apportiSoci.length > 0 && (
              <>
                <Sezione titolo="Apporti dei soci (voce patrimoniale, esclusa dal risultato di gestione)" color={P.primary}
                  righe={data.apportiSoci} tot={data.totali.apporti} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: P.primaryLt, borderRadius: 8, marginTop: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Saldo complessivo (gestione + apporti soci)</span>
                  <span style={{ fontWeight: 700, fontSize: 18, color: P.primary }}>
                    {data.totali.saldoComplessivo >= 0 ? '+' : ''}{eur(data.totali.saldoComplessivo)}
                  </span>
                </div>
              </>
            )}

            {/* Nota metodologica */}
            <div style={{ fontSize: 11, color: P.muted, marginTop: 24, borderTop: `1px solid ${P.border}`, paddingTop: 12, lineHeight: 1.5 }}>
              Documento provvisorio a uso interno/informativo per i soci, non sostituisce il bilancio d'esercizio.
              Importi per competenza. Il risultato della gestione è calcolato sugli imponibili (l'IVA è partita di giro).
              Gli apporti dei soci sono esposti separatamente in quanto voci patrimoniali, non ricavi d'esercizio.
            </div>
          </div>
        ) : null}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          #bilancio-print { border: none !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  )
}

function Sezione({ titolo, color, righe, tot }: {
  titolo: string; color: string
  righe: RigaCategoria[]
  tot: { imponibile: number; iva: number; totale: number }
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>{titolo}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${P.border}`, color: P.muted, fontSize: 11, textTransform: 'uppercase' }}>
            <th style={{ textAlign: 'left', padding: '6px 8px' }}>Categoria</th>
            <th style={{ textAlign: 'right', padding: '6px 8px' }}>Imponibile</th>
            <th style={{ textAlign: 'right', padding: '6px 8px' }}>IVA</th>
            <th style={{ textAlign: 'right', padding: '6px 8px' }}>Totale</th>
            <th style={{ textAlign: 'right', padding: '6px 8px', width: 50 }}>N°</th>
          </tr>
        </thead>
        <tbody>
          {righe.map((r) => (
            <tr key={r.categoria_nome} style={{ borderBottom: `1px solid ${P.border}` }}>
              <td style={{ padding: '6px 8px' }}>{r.categoria_nome}</td>
              <td style={{ textAlign: 'right', padding: '6px 8px', fontVariantNumeric: 'tabular-nums' }}>{eur(r.imponibile)}</td>
              <td style={{ textAlign: 'right', padding: '6px 8px', fontVariantNumeric: 'tabular-nums', color: P.muted }}>{eur(r.iva)}</td>
              <td style={{ textAlign: 'right', padding: '6px 8px', fontVariantNumeric: 'tabular-nums' }}>{eur(r.totale)}</td>
              <td style={{ textAlign: 'right', padding: '6px 8px', color: P.muted }}>{r.num_movimenti}</td>
            </tr>
          ))}
          {righe.length === 0 && (
            <tr><td colSpan={5} style={{ padding: '10px 8px', color: P.muted, textAlign: 'center' }}>Nessun movimento nel periodo</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: `2px solid ${P.text}`, fontWeight: 700 }}>
            <td style={{ padding: '8px' }}>Totale</td>
            <td style={{ textAlign: 'right', padding: '8px', fontVariantNumeric: 'tabular-nums' }}>{eur(tot.imponibile)}</td>
            <td style={{ textAlign: 'right', padding: '8px', fontVariantNumeric: 'tabular-nums', color: P.muted }}>{eur(tot.iva)}</td>
            <td style={{ textAlign: 'right', padding: '8px', fontVariantNumeric: 'tabular-nums' }}>{eur(tot.totale)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function formatIt(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const inputStyle: React.CSSProperties = {
  fontSize: 14, padding: '8px 12px', border: `1px solid ${P.border}`, borderRadius: 8, outline: 'none', background: P.card, color: P.text, fontFamily: 'inherit',
}
function btnStyle(color: string): React.CSSProperties {
  return { background: color, border: `1px solid ${color}`, color: '#fff', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
}
const btnOutline: React.CSSProperties = {
  background: 'transparent', border: `1px solid ${P.border}`, color: P.text, borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer',
}