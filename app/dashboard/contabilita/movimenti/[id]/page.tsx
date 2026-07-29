'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
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

export default function ModificaMovimentoPage() {
  const router = useRouter()
  const params = useParams()
  const movimentoId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [readOnly, setReadOnly] = useState(false) // true se movimento non manuale

  const [categorie, setCategorie] = useState<Categoria[]>([])
  const [metodi, setMetodi] = useState<MetodoPagamento[]>([])
  const [fornitori, setFornitori] = useState<Fornitore[]>([])

  // Form state
  const [tipo, setTipo] = useState<'entrata' | 'uscita'>('uscita')
  const [dataCompetenza, setDataCompetenza] = useState('')
  const [dataPagamento, setDataPagamento] = useState('')
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
  const [origine, setOrigine] = useState('manuale')

  // Carica anagrafiche + movimento
  useEffect(() => {
    (async () => {
      try {
        const [cRes, mRes, fRes, movRes] = await Promise.all([
          authFetch('/api/contabilita/categorie'),
          authFetch('/api/contabilita/metodi-pagamento'),
          authFetch('/api/contabilita/movimenti'),
          authFetch(`/api/contabilita/movimenti/${movimentoId}`),
        ])
        const cJson = await cRes.json()
        const mJson = await mRes.json()
        const fJson = await fRes.json()
        setCategorie(cJson.categorie || [])
        setMetodi(mJson.metodi || [])
        setFornitori(fJson.fornitori || [])

        if (!movRes.ok) {
          const j = await movRes.json()
          throw new Error(j.error || 'Movimento non trovato')
        }
        const movJson = await movRes.json()
        const m = movJson.movimento
        if (!m) throw new Error('Movimento non trovato')

        // Pre-compila il form
        setTipo(m.tipo || 'uscita')
        setDataCompetenza(m.data_competenza || '')
        setDataPagamento(m.data_pagamento || '')
        setCategoriaId(m.categoria_id || '')
        setMetodoPagamentoId(m.metodo_pagamento_id || '')
        if (m.fornitore_id) {
          setFornitoreId(m.fornitore_id)
          setUsaFornitoreLibero(false)
        } else if (m.fornitore_descrizione) {
          setFornitoreDescrizione(m.fornitore_descrizione)
          setUsaFornitoreLibero(true)
        }
        setDescrizione(m.descrizione || '')
        setImponibile(m.imponibile != null ? String(m.imponibile).replace('.', ',') : '')
        setAliquotaIva(m.aliquota_iva != null ? Number(m.aliquota_iva) : 0)
        setNumeroDocumento(m.numero_documento || '')
        setDataDocumento(m.data_documento || '')
        setAllegatoUrl(m.allegato_url || '')
        setNote(m.note || '')
        setOrigine(m.origine || 'manuale')
        // Movimenti non manuali: sola lettura (l'API li blocca comunque)
        if (m.origine && m.origine !== 'manuale') setReadOnly(true)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [movimentoId])

  const categorieFiltered = useMemo(
    () => categorie.filter((c) => c.tipo === tipo),
    [categorie, tipo]
  )

  const calcoli = useMemo(() => {
    const imp = parseFloat(imponibile.replace(',', '.')) || 0
    const iva = imp * (aliquotaIva / 100)
    const totale = imp + iva
    return { imp, iva, totale }
  }, [imponibile, aliquotaIva])

  const handleSubmit = async (e: React.FormEvent) => {
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

      const res = await authFetch(`/api/contabilita/movimenti/${movimentoId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || `Errore ${res.status}`)
      }

      router.push('/dashboard/contabilita/movimenti')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Eliminare definitivamente questo movimento? L\'operazione non è reversibile.')) return
    setDeleting(true)
    setError(null)
    try {
      const res = await authFetch(`/api/contabilita/movimenti/${movimentoId}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || `Errore ${res.status}`)
      }
      router.push('/dashboard/contabilita/movimenti')
    } catch (err: any) {
      setError(err.message)
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: `4px solid ${P.primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: P.muted }}>Caricamento movimento...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  const tipoColor = tipo === 'entrata' ? P.accent : P.red

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif", color: P.text, background: P.bg, minHeight: '100vh', padding: '24px 20px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: P.muted, marginBottom: 2 }}>
            <Link href="/dashboard/contabilita/movimenti" style={{ color: P.muted, textDecoration: 'none' }}>Contabilità › Movimenti</Link> › Modifica
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Modifica movimento</h1>
        </div>

        {/* Banner sola lettura per movimenti automatici */}
        {readOnly && (
          <div style={{ background: P.primaryLt, border: `1px solid ${P.primary}`, color: P.primary, padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
            Questo movimento è generato automaticamente (origine: {origine}) e non è modificabile né eliminabile da qui.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: '24px 28px', opacity: readOnly ? 0.7 : 1, pointerEvents: readOnly ? 'none' : 'auto' }}>
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

            {/* Importi */}
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

            {/* Allegato */}
            <Field label="URL allegato (fattura PDF)">
              <input type="url" value={allegatoUrl} onChange={(e) => setAllegatoUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
            </Field>

            {/* Note */}
            <Field label="Note interne">
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Annotazioni libere..." style={{ ...inputStyle, resize: 'vertical' }} />
            </Field>
          </div>

          {/* Errori */}
          {error && (
            <div style={{ background: P.redLt, border: `1px solid ${P.red}`, color: P.red, padding: '10px 14px', borderRadius: 8, fontSize: 13, marginTop: 12 }}>
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 24 }}>
            {/* Elimina a sinistra */}
            <div>
              {!readOnly && (
                <button type="button" onClick={handleDelete} disabled={deleting || submitting} style={{ background: 'transparent', border: `1px solid ${P.red}`, color: P.red, borderRadius: 8, padding: '10px 18px', fontSize: 13, cursor: deleting ? 'wait' : 'pointer', opacity: deleting ? 0.6 : 1 }}>
                  {deleting ? 'Eliminazione...' : 'Elimina'}
                </button>
              )}
            </div>
            {/* Annulla + Salva a destra */}
            <div style={{ display: 'flex', gap: 10 }}>
              <Link href="/dashboard/contabilita/movimenti">
                <button type="button" style={{ background: 'transparent', border: `1px solid ${P.border}`, color: P.muted, borderRadius: 8, padding: '10px 18px', fontSize: 13, cursor: 'pointer' }}>Annulla</button>
              </Link>
              {!readOnly && (
                <button type="submit" disabled={submitting} style={{ background: tipoColor, border: `1px solid ${tipoColor}`, color: '#fff', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
                  {submitting ? 'Salvataggio...' : 'Salva modifiche'}
                </button>
              )}
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