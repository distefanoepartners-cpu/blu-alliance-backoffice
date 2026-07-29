'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { authFetch } from '@/lib/api-client'

interface Dettaglio {
  id: string
  prenotazione_id: string
  data_servizio: string
  codice_prenotazione: string
  imbarcazione_nome: string | null
  servizio_nome: string | null
  numero_persone: number | null
  importo_lordo: number
  commissione_calcolata: number
  netto_calcolato: number
}

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
  pdf_url: string | null
  data_invio_socio: string | null
  fattura_numero: string | null
  fattura_data: string | null
  fattura_imponibile: number | null
  fattura_iva: number | null
  fattura_totale: number | null
  fattura_pdf_url: string | null
  data_pagamento: string | null
  note: string | null
  created_at: string
  updated_at: string
  fornitore: {
    id: string
    ragione_sociale: string
    email: string | null
    telefono: string | null
    partita_iva: string | null
    codice_fiscale: string | null
    indirizzo: string | null
    citta: string | null
    cap: string | null
    provincia: string | null
    pec: string | null
  } | null
}

const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
const ALIQUOTA_IVA_SOCIO = 22

const P = {
  bg: '#f8f9fc', card: '#fff', border: '#e2e6ef', text: '#1a1f36', muted: '#6b7394',
  primary: '#0047AB', primaryLt: '#e8f0fe', accent: '#00875a', accentLt: '#dcfce7',
  orange: '#e07c00', orangeLt: '#fff4e5', red: '#de350b', redLt: '#fee2e2',
  headerBg: '#f1f3f9',
}

const STATO_STYLE: Record<Estratto['stato'], { bg: string; color: string; label: string }> = {
  bozza:             { bg: P.headerBg,  color: P.muted,   label: 'Bozza' },
  inviato:           { bg: P.primaryLt, color: P.primary, label: 'Inviato' },
  fattura_ricevuta:  { bg: '#dcfce7',   color: '#166534', label: 'Fattura ricevuta' },
  pagato:            { bg: P.accentLt,  color: P.accent,  label: 'Pagato' },
  contestato:        { bg: P.orangeLt,  color: P.orange,  label: 'Contestato' },
}

export default function DettaglioEstrattoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [estratto, setEstratto] = useState<Estratto | null>(null)
  const [dettaglio, setDettaglio] = useState<Dettaglio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await authFetch(`/api/contabilita/estratti-conto/${id}`)
      if (!res.ok) throw new Error(`Errore ${res.status}`)
      const json = await res.json()
      setEstratto(json.estratto)
      setDettaglio(json.dettaglio || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: `4px solid ${P.primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: P.muted }}>Caricamento...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  if (error || !estratto) {
    return (
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", padding: 40, textAlign: 'center' }}>
        <p style={{ color: P.red, fontSize: 16, fontWeight: 600 }}>{error || 'Estratto conto non trovato'}</p>
        <Link href="/dashboard/contabilita/estratti-conto">
          <button style={{ marginTop: 16, padding: '10px 24px', background: P.primary, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>← Torna alla lista</button>
        </Link>
      </div>
    )
  }

  const stStyle = STATO_STYLE[estratto.stato]
  const ivaPrevista = Number(estratto.netto_socio) * ALIQUOTA_IVA_SOCIO / 100
  const totalePrevisto = Number(estratto.netto_socio) + ivaPrevista

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif", color: P.text, background: P.bg, minHeight: '100vh', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: P.muted, marginBottom: 2 }}>
            <Link href="/dashboard/contabilita/estratti-conto" style={{ color: P.muted, textDecoration: 'none' }}>Contabilità › Estratti Conto Soci</Link>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
            {estratto.fornitore?.ragione_sociale || '—'}
          </h1>
          <div style={{ fontSize: 13, color: P.muted, marginTop: 4 }}>
            {MESI[estratto.mese - 1]} {estratto.anno} · commissione {Number(estratto.percentuale_commissione)}%
            {estratto.fornitore?.partita_iva && ` · P.IVA ${estratto.fornitore.partita_iva}`}
          </div>
        </div>
        <span style={{ background: stStyle.bg, color: stStyle.color, fontSize: 12, padding: '6px 14px', borderRadius: 12, fontWeight: 600 }}>
          {stStyle.label}
        </span>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Kpi label="Lordo incassato" value={fmt(Number(estratto.totale_lordo))} color={P.primary} sub={`${estratto.numero_prenotazioni} prenotazioni`} />
        <Kpi label={`Commissione ${Number(estratto.percentuale_commissione)}%`} value={`− ${fmt(Number(estratto.commissione_consorzio))}`} color={P.orange} sub="consorzio BA" />
        <Kpi label="Netto al socio" value={fmt(Number(estratto.netto_socio))} color={P.accent} sub="imponibile fattura" />
        <Kpi label="Totale fattura" value={fmt(totalePrevisto)} color={P.text} sub={`+ IVA ${ALIQUOTA_IVA_SOCIO}% (${fmt(ivaPrevista)})`} />
      </div>

      {/* Info workflow stato */}
      {estratto.stato === 'bozza' && (
        <InfoBox color={P.orange} bg={P.orangeLt}>
          <strong>Estratto conto in bozza.</strong> Il workflow di invio al socio (generazione PDF + email) sarà attivato nella fase 2 del modulo. Per ora puoi consultare il calcolo e verificare le prenotazioni incluse.
        </InfoBox>
      )}
      {estratto.stato === 'inviato' && (
        <InfoBox color={P.primary} bg={P.primaryLt}>
          <strong>Inviato al socio</strong> il {fmtDate(estratto.data_invio_socio ? estratto.data_invio_socio.slice(0, 10) : null)}.
          In attesa fattura per <strong>{fmt(Number(estratto.netto_socio))} imponibile + IVA 22% = {fmt(totalePrevisto)} totale</strong>.
        </InfoBox>
      )}
      {estratto.stato === 'fattura_ricevuta' && estratto.fattura_numero && (
        <InfoBox color={'#166534'} bg={'#dcfce7'}>
          <strong>Fattura ricevuta:</strong> n° {estratto.fattura_numero} del {fmtDate(estratto.fattura_data)} · imponibile {fmt(Number(estratto.fattura_imponibile) || 0)} + IVA {fmt(Number(estratto.fattura_iva) || 0)} = totale {fmt(Number(estratto.fattura_totale) || 0)}. Da saldare al socio.
        </InfoBox>
      )}
      {estratto.stato === 'pagato' && (
        <InfoBox color={P.accent} bg={P.accentLt}>
          <strong>Pagato</strong> il {fmtDate(estratto.data_pagamento)}. Fattura n° {estratto.fattura_numero || '—'}.
        </InfoBox>
      )}
      {estratto.stato === 'contestato' && (
        <InfoBox color={P.orange} bg={P.orangeLt}>
          <strong>Contestato dal socio.</strong> {estratto.note || 'Verificare con il fornitore prima di procedere.'}
        </InfoBox>
      )}

      {/* Tabella dettaglio prenotazioni */}
      <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${P.border}`, fontSize: 13, fontWeight: 600, color: P.muted, display: 'flex', justifyContent: 'space-between' }}>
          <span>Dettaglio prenotazioni</span>
          <span style={{ fontSize: 11, fontWeight: 400 }}>cassa-based · data servizio</span>
        </div>
        {dettaglio.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: P.muted, fontSize: 13 }}>Nessuna prenotazione di dettaglio.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: P.headerBg }}>
                  <Th width={80}>Data</Th>
                  <Th>Codice</Th>
                  <Th>Servizio · Barca</Th>
                  <Th align="right" width={50}>Pax</Th>
                  <Th align="right" width={100}>Lordo</Th>
                  <Th align="right" width={100}>Comm.</Th>
                  <Th align="right" width={100}>Netto</Th>
                </tr>
              </thead>
              <tbody>
                {dettaglio.map((d) => (
                  <tr key={d.id}>
                    <Td>{fmtDate(d.data_servizio)}</Td>
                    <Td><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{d.codice_prenotazione}</span></Td>
                    <Td>
                      <div>{d.servizio_nome || '—'}</div>
                      <div style={{ fontSize: 11, color: P.muted }}>{d.imbarcazione_nome || '—'}</div>
                    </Td>
                    <Td align="right">{d.numero_persone || 0}</Td>
                    <Td align="right">{fmt(Number(d.importo_lordo))}</Td>
                    <Td align="right"><span style={{ color: P.orange }}>−&nbsp;{fmt(Number(d.commissione_calcolata))}</span></Td>
                    <Td align="right"><strong>{fmt(Number(d.netto_calcolato))}</strong></Td>
                  </tr>
                ))}
                <tr style={{ background: P.headerBg, borderTop: `2px solid ${P.primary}` }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700 }} colSpan={4}>TOTALE</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(estratto.totale_lordo))}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: P.orange }}>{fmt(Number(estratto.commissione_consorzio))}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(estratto.netto_socio))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Placeholder per le azioni workflow */}
      <div style={{ background: P.card, border: `1px dashed ${P.border}`, borderRadius: 12, padding: '16px 20px', color: P.muted, fontSize: 12 }}>
        <strong>Azioni workflow (fase 2):</strong> generazione PDF estratto conto · invio email al socio · caricamento fattura ricevuta · registrazione pagamento (con creazione automatica del movimento contabile in U027 - Costi di Gestione Servizi).
      </div>
    </div>
  )
}

// ── Helpers ──
function Kpi({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: '16px 18px', borderLeft: `4px solid ${color}` }}>
      <p style={{ fontSize: 20, fontWeight: 700, color, margin: 0 }}>{value}</p>
      <p style={{ fontSize: 12, color: P.muted, fontWeight: 500, marginTop: 2 }}>{label}</p>
      {sub && <p style={{ fontSize: 10, color: P.muted, marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

function InfoBox({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <div style={{ background: bg, border: `1px solid ${color}`, color, padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 20 }}>
      {children}
    </div>
  )
}

function Th({ children, align = 'left', width }: { children?: React.ReactNode; align?: 'left' | 'right' | 'center'; width?: number }) {
  return (
    <th style={{
      textAlign: align, padding: '10px 14px', fontWeight: 600, fontSize: 11,
      textTransform: 'uppercase', letterSpacing: '0.04em', color: P.muted,
      borderBottom: `2px solid ${P.border}`, whiteSpace: 'nowrap', width,
    }}>{children}</th>
  )
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <td style={{
      padding: '10px 14px', borderBottom: `1px solid ${P.border}`, textAlign: align,
      fontVariantNumeric: align === 'right' ? 'tabular-nums' : 'normal',
    }}>{children}</td>
  )
}
