'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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

const P = {
  bg: '#f8f9fc', card: '#fff', border: '#e2e6ef', text: '#1a1f36', muted: '#6b7394',
  primary: '#0047AB', primaryLt: '#e8f0fe', accent: '#00875a', accentLt: '#dcfce7',
  orange: '#e07c00', red: '#de350b', redLt: '#fee2e2',
}

const ALIQUOTE_IVA = [0, 4, 10, 22]

export default function NuovoMovimentoPage() {
  const router = useRouter()
  const [loadingAnagrafiche, setLoadingAnagrafiche] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [categorie, setCategorie] = useState<Categoria[]>([])
  const [metodi, setMetodi] = useState<MetodoPagamento[]>([])
  const [fornitori, setFornitori] = useState<Fornitore[]>([])

  // Form state
  const today = new Date().toISOString().slice(0, 10)
  const [tipo, setTipo] = useState<'entrata' | 'uscita'>('uscita')
  const [dataCompetenza, setDataCompetenza] = useState(today)
  const [dataPagamento, setDataPagamento] = useState(today)
  const [categoriaId, setCategoriaId] = useState('')
  const [metodoPagamentoId, setMetodoPagamentoId] = useState('')
  const [fornitoreId, setFornitoreId] = useState('')
  const [fornitoreDescrizione, setFornitoreDescrizione] = useState('')
  const [usaFornitoreLibero, setUsaFornitoreLibero] = useState(false)
  const [descrizione, setDescrizione] = useState('')
  const [imponibile, setImponibile] = useState('')
  const [aliquotaIva, setAliquotaIva] = useState(22)
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [dataDocumento, setDataDocumento] = useState('')
  const [allegatoUrl, setAllegatoUrl] = useState('')
  const [note, setNote] = useState('')

  // Carica anagrafiche
  useEffect(() => {
    (async () => {
      try {
        const [cRes, mRes, fRes] = await Promise.all([
          authFetch('/api/contabilita/categorie'),
          authFetch('/api/contabilita/metodi-pagamento'),
          authFetch('/api/contabilita/movimenti'),
        ])
        const cJson = await cRes.json()
        const mJson = await mRes.json()
        const fJson = await fRes.json()
        setCategorie(cJson.categorie || [])
        setMetodi(mJson.metodi || [])
        setFornitori(fJson.fornitori || [])
      } catch (err: any) {
        setError('Errore caricamento anagrafiche: ' + err.message)
      } finally {
        setLoadingAnagrafiche(false)
      }
    })()
  }, [])

  // Categorie filtrate per tipo
  const categorieFiltered = useMemo(
    () => categorie.filter((c) => c.tipo === tipo),
    [categorie, tipo]
  )

  // Quando cambia categoria, applica aliquota IVA di default
  useEffect(() => {
    if (!categoriaId) return
    const cat = categorie.find((c) => c.id === categoriaId)
    if (cat) {
      setAliquotaIva(cat.rilevante_iva ? 22 : 0)
    }
  }, [categoriaId, categorie])

  // Reset categoria quando cambia tipo
  useEffect(() => {
    setCategoriaId('')
  }, [tipo])

  // Calcoli IVA in tempo reale
  const calcoli = useMemo(() => {
    const imp = parseFloat(imponibile.replace(',', '.')) || 0
    const iva = imp * (aliquotaIva / 100)
    const totale = imp + iva
    return { imp, iva, totale }
  }, [imponibile, aliquotaIva])

  const handleSubmit = async (e: React.FormEvent, salvaENuovo = false) => {
    e.preventDefault()
    setError(null)

    if (!dataCompetenza || !categoriaId || !descrizione.trim() || !imponibile) {
      setError('Compila tutti i campi obbligatori (data, categoria, descrizione, imponibile)')
      return
    }
    if (calcoli.imp <= 0) {
      setError("L'imponibile deve essere maggiore di zero")
      return
    }

    setSubmitting(true)
    try {
      const body = {
        tipo,
        data_competenza: dataCompetenza,
        data_pagamento: dataPagamento || null,
        categoria_id: categoriaId,
        metodo_pagamento_id: metodoPagamentoId || null,
        fornitore_id: !usaFornitoreLibero && fornitoreId ? fornitoreId : null,
        fornitore_descrizione: usaFornitoreLibero && fornitoreDescrizione ? fornitoreDescrizione.trim() : null,
        descrizione: descrizione.trim(),
        imponibile: calcoli.imp,
        aliquota_iva: aliquotaIva,
        numero_documento: numeroDocumento || null,
        data_documento: dataDocumento || null,
        allegato_url: allegatoUrl || null,
        note: note || null,
      }

      const res = await authFetch('/api/contabilita/movimenti', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || `Errore ${res.status}`)
      }

      if (salvaENuovo) {
        // Reset campi variabili, tieni quelli "costanti" (data, categoria, metodo, fornitore)
        setDescrizione('')
        setImponibile('')
        setNumeroDocumento('')
        setAllegatoUrl('')
        setNote('')
        setError(null)
        // Scroll in alto per vedere il messaggio di successo
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        router.push('/dashboard/contabilita/movimenti')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingAnagrafiche) {
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

  const tipoColor = tipo === 'entrata' ? P.accent : P.red
  const tipoColorLt = tipo === 'entrata' ? P.accentLt : P.redLt

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif", color: P.text, background: P.bg, minHeight: '100vh', padding: '24px 20px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: P.muted, marginBottom: 2 }}>
            <Link href="/dashboard/contabilita/movimenti" style={{ color: P.muted, textDecoration: 'none' }}>Contabilità › Movimenti</Link> › Nuovo
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Nuovo movimento</h1>
        </div>

        <form onSubmit={(e) => handleSubmit(e, false)}>
          <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: '24px 28px' }}>
            {/* Tipo toggle */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button type="button" onClick={() => setTipo('uscita')} style={tipoButton(tipo === 'uscita', P.red)}>Uscita</button>
              <button type="button" onClick={() => setTipo('entrata')} style={tipoButton(tipo === 'entrata', P.accent)}>Entrata</button>
            </div>

            {/* Date */}
            <Row>
              <Field label="Data competenza *">
                <input type="date" value={dataCompetenza} onChange={(e) => setDataCompetenza(e.target.value)} style={inputStyle} required />
              </Field>
              <Field label="Data pagamento">
                <input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} style={inputStyle} />
              </Field>
            </Row>

            {/* Categoria */}
            <Field label="Categoria *">
              <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} style={inputStyle} required>
                <option value="">Seleziona categoria...</option>
                {categorieFiltered.map((c) => (
                  <option key={c.id} value={c.id}>{c.codice} — {c.nome}{!c.rilevante_iva ? ' (fuori IVA)' : ''}</option>
                ))}
              </select>
            </Field>

            {/* Fornitore + Metodo */}
            <Row>
              <Field label="Fornitore">
                {!usaFornitoreLibero ? (
                  <>
                    <select value={fornitoreId} onChange={(e) => setFornitoreId(e.target.value)} style={inputStyle}>
                      <option value="">Nessuno / non specificato</option>
                      {fornitori.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                    </select>
                    <button type="button" onClick={() => { setUsaFornitoreLibero(true); setFornitoreId('') }} style={linkButtonStyle}>+ Inserisci nome libero</button>
                  </>
                ) : (
                  <>
                    <input type="text" value={fornitoreDescrizione} onChange={(e) => setFornitoreDescrizione(e.target.value)} placeholder="es. Anthropic, Facebook..." style={inputStyle} />
                    <button type="button" onClick={() => { setUsaFornitoreLibero(false); setFornitoreDescrizione('') }} style={linkButtonStyle}>← Scegli dall&apos;anagrafica</button>
                  </>
                )}
              </Field>
              <Field label="Metodo di pagamento">
                <select value={metodoPagamentoId} onChange={(e) => setMetodoPagamentoId(e.target.value)} style={inputStyle}>
                  <option value="">Non specificato</option>
                  {metodi.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </Field>
            </Row>

            {/* Descrizione */}
            <Field label="Descrizione *">
              <input type="text" value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="es. Abbonamento Vercel maggio 2026" style={inputStyle} required />
            </Field>

            {/* Importi - box dedicato */}
            <div style={{ background: P.bg, borderRadius: 8, padding: '16px 18px', margin: '8px 0 16px' }}>
              <div style={{ fontSize: 11, color: P.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Importi</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
                <Field label="Imponibile *" inline>
                  <input type="text" inputMode="decimal" value={imponibile} onChange={(e) => setImponibile(e.target.value)} placeholder="0,00" style={{ ...inputStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} required />
                </Field>
                <Field label="Aliquota IVA" inline>
                  <select value={aliquotaIva} onChange={(e) => setAliquotaIva(Number(e.target.value))} style={inputStyle}>
                    {ALIQUOTE_IVA.map((a) => (
                      <option key={a} value={a}>{a === 0 ? 'Fuori IVA (0%)' : `${a}%`}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Totale" inline>
                  <div style={{ padding: '8px 12px', background: P.card, border: `1px solid ${P.border}`, borderRadius: 8, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 15, color: tipoColor }}>
                    €&nbsp;{calcoli.totale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </Field>
              </div>
              {aliquotaIva > 0 && (
                <div style={{ fontSize: 11, color: P.muted, marginTop: 8 }}>
                  IVA: €&nbsp;{calcoli.iva.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · calcolata automaticamente
                </div>
              )}
            </div>

            {/* Documento */}
            <Row>
              <Field label="N° documento">
                <input type="text" value={numeroDocumento} onChange={(e) => setNumeroDocumento(e.target.value)} placeholder="es. FT-2026-0123" style={inputStyle} />
              </Field>
              <Field label="Data documento">
                <input type="date" value={dataDocumento} onChange={(e) => setDataDocumento(e.target.value)} style={inputStyle} />
              </Field>
            </Row>

            {/* Allegato URL (upload integrato in fase 2) */}
            <Field label="URL allegato (fattura PDF)">
              <input type="url" value={allegatoUrl} onChange={(e) => setAllegatoUrl(e.target.value)} placeholder="https://... (l&apos;upload diretto sar&agrave; integrato in seguito)" style={inputStyle} />
            </Field>

            {/* Note */}
            <Field label="Note interne">
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Annotazioni libere per il commercialista o per il team..." style={{ ...inputStyle, resize: 'vertical' }} />
            </Field>

            {/* Errori */}
            {error && (
              <div style={{ background: P.redLt, border: `1px solid ${P.red}`, color: P.red, padding: '10px 14px', borderRadius: 8, fontSize: 13, marginTop: 12 }}>
                {error}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <Link href="/dashboard/contabilita/movimenti">
                <button type="button" style={{ background: 'transparent', border: `1px solid ${P.border}`, color: P.muted, borderRadius: 8, padding: '10px 18px', fontSize: 13, cursor: 'pointer' }}>Annulla</button>
              </Link>
              <button type="button" onClick={(e) => handleSubmit(e, true)} disabled={submitting} style={{ background: P.card, border: `1px solid ${P.border}`, color: P.text, borderRadius: 8, padding: '10px 18px', fontSize: 13, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
                Salva &amp; nuovo
              </button>
              <button type="submit" disabled={submitting} style={{ background: tipoColor, border: `1px solid ${tipoColor}`, color: '#fff', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
                {submitting ? 'Salvataggio...' : 'Salva movimento'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Helpers ──
const inputStyle: React.CSSProperties = {
  width: '100%', fontSize: 14, padding: '8px 12px', border: `1px solid ${P.border}`,
  borderRadius: 8, outline: 'none', background: P.card, color: P.text,
  fontFamily: 'inherit',
}

const linkButtonStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', color: P.primary, fontSize: 11,
  cursor: 'pointer', padding: 0, marginTop: 4, textAlign: 'left',
}

function tipoButton(active: boolean, color: string): React.CSSProperties {
  return {
    flex: 1, padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14,
    fontWeight: 600, transition: 'all .15s',
    background: active ? color : 'transparent',
    color: active ? '#fff' : P.muted,
    border: `1px solid ${active ? color : P.border}`,
  }
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>{children}</div>
}

function Field({ label, children, inline }: { label: string; children: React.ReactNode; inline?: boolean }) {
  return (
    <div style={{ marginBottom: inline ? 0 : 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: P.muted, marginBottom: 4, fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  )
}
