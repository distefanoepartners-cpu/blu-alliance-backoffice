'use client'

import { useState, useMemo, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/api-client'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════
// Import Estratto Conto SumUp → Movimenti Contabili
// Pagina: /dashboard/contabilita/importa-sumup
//
// Flusso:
//  1. Carica CSV SumUp (Resoconto_transazioni_*.csv)
//  2. Parsing client-side + categorizzazione automatica per parola chiave
//  3. Anteprima editabile (correggi categoria riga per riga)
//  4. Salvataggio via API route (dedup su riferimento_esterno)
//
// NB: importa SOLO le uscite (importo negativo). Le entrate PAYOUT sono
//     gli accrediti aggregati SumUp e vengono ignorate (gli incassi sono
//     già registrati dalle prenotazioni).
// ═══════════════════════════════════════════════════════════════

// ⭐ ID categorie contabili (da categorie_contabili)
const CAT = {
  MARKETING: '0257366b-db57-4e7a-8ba5-1684fa56821a',     // Marketing e Pubblicità
  SOFTWARE: 'ab26a165-7283-436a-8789-152cc2a2cc07',       // Software, Licenze, SaaS
  SPESE_BANCARIE: '6c663e6d-e16e-4e9c-b89d-95eb2bb36768', // Spese Bancarie
  ACQUISTI: '38fe934f-33a1-4ecb-890f-ba37e2e28c1a',       // Acquisti Merci e Materiali
  TELEFONIA: 'beb529ae-120b-4f80-aef9-12c52ebe073d',      // Telefonia e Internet
  COSTI_SERVIZI: '6b5f3a64-b6ef-4e29-be1a-90f0a5cfeea2',  // Costi di Gestione Servizi
  CONSULENZE: '6ec8a08e-3a16-4d0f-bc7a-5afa3580e694',     // Consulenze Professionali
  STIPENDI: 'f7a54ecb-a9c8-4579-82ae-2f46a3152859',       // Personale - Stipendi
  ALTRE_USCITE: 'fe811521-4c5b-4dcc-bbdc-9d4e7a9a2987',   // Altre Uscite
}

// ⭐ Mappa parola chiave (nel campo Riferimento) → categoria_id.
// Usata SOLO per spese ricorrenti che NON sono fornitori barche
// (i fornitori barche vengono riconosciuti dall'anagrafica, vedi categorizza()).
// L'ordine conta: la prima che matcha vince. '' = lascia "da categorizzare".
const KEYWORD_MAP: Array<{ match: string; categoria_id: string }> = [
  // ── Pubblicità / Marketing ──
  { match: 'FACEBK', categoria_id: CAT.MARKETING },        // Facebook/Meta ads
  { match: 'FACEBOOK', categoria_id: CAT.MARKETING },
  { match: 'GOOGLE', categoria_id: CAT.MARKETING },        // Google Ads
  { match: '100 STAMPE', categoria_id: CAT.MARKETING },    // tipografia: brochure/locandine
  // ── Software / SaaS ──
  { match: 'TWILIO', categoria_id: CAT.SOFTWARE },         // WhatsApp/SMS
  { match: 'VERCEL', categoria_id: CAT.SOFTWARE },
  { match: 'SUPABASE', categoria_id: CAT.SOFTWARE },
  { match: 'OPENAI', categoria_id: CAT.SOFTWARE },
  { match: 'ANTHROPIC', categoria_id: CAT.SOFTWARE },
  { match: 'TRUSTINDEX', categoria_id: CAT.SOFTWARE },     // gestione recensioni
  // ── Spese bancarie ──
  { match: 'SUMUP', categoria_id: CAT.SPESE_BANCARIE },    // canone/commissioni SumUp
  // ── Acquisti ──
  { match: 'AMZN', categoria_id: CAT.ACQUISTI },           // Amazon
  { match: 'AMAZON', categoria_id: CAT.ACQUISTI },
  // ── Consulenze ──
  { match: 'TECH-NICOS', categoria_id: CAT.CONSULENZE },   // commercialista
  { match: 'TECH NICOS', categoria_id: CAT.CONSULENZE },
  // ── Personale (dipendenti) ──
  { match: 'WILLIAM LEONE', categoria_id: CAT.STIPENDI },
  { match: 'MARIAM NAMOUCHI', categoria_id: CAT.STIPENDI },
  { match: 'SILVIA CORVO', categoria_id: CAT.STIPENDI },
  // DS&P: volutamente NON mappato → resta "da categorizzare"
  // (movimenti misti: compensi, riaddebiti, rimborsi)
]

// Parole troppo comuni: ignorate nel match con l'anagrafica fornitori,
// per evitare falsi positivi (es. "RENT", "PARTNERS", "CHARTER").
const STOPWORDS = new Set([
  'RENT','SRL','SRLS','SAS','SNC','SPA','GROUP','PARTNERS','CHARTER','SEA',
  'SERVICE','FAMILY','ROYAL','LUCA','LUIGI','MARIA','MARIO','DAVIDE','NELLO',
  'DELIA','CECERE','FEDERICO','PATRIZIO','DIRECTION','CAPRI','ALFONSO','CRISTINA',
  'DELLA','DEL','DI'
])

interface RigaMovimento {
  data: string            // YYYY-MM-DD
  codice: string          // Codice transazione SumUp (anti-duplicato)
  riferimento: string     // descrizione/controparte ripulita
  importo: number         // valore assoluto (positivo)
  tipo: 'entrata' | 'uscita'
  categoria_id: string    // '' = da categorizzare
  includi: boolean        // se importare questa riga
}

// Accrediti tecnici da IGNORARE sempre (non sono né quote soci né costi):
// incassi già contabilizzati dalle prenotazioni o micro-accrediti di servizio.
const SKIP_ENTRATE = ['PAYOUT', 'STRIPE', 'SUMUP', 'GOOGLE IRELAND', 'GOOGLE ']

function isAccreditoTecnico(riferimento: string): boolean {
  const up = riferimento.toUpperCase()
  return SKIP_ENTRATE.some(k => up.includes(k))
}

function pulisciRiferimento(ref: string): string {
  return ref.replace(/\s{2,}/g, ' ').trim()
}

interface Fornitore {
  id: string
  ragione_sociale: string
  _tokens: string[]   // token distintivi precalcolati
}

function normalizza(s: string): string {
  return s.toUpperCase().replace(/[.,&'\-]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Token distintivi = parole >3 char che non sono forme societarie/nomi comuni
function tokenDistintivi(s: string): string[] {
  return normalizza(s).split(' ').filter(w => w.length > 3 && !STOPWORDS.has(w))
}

// Categorizzazione a livelli:
//  1. Match con anagrafica fornitori (match rigoroso: TUTTI i token distintivi
//     del fornitore devono comparire nel riferimento) → Costi di Gestione Servizi
//  2. Mappa keyword (spese ricorrenti non-fornitore)
//  3. '' → da categorizzare a mano
function categorizza(riferimento: string, fornitori: Fornitore[]): string {
  const rif = ' ' + normalizza(riferimento) + ' '

  // Livello 1: anagrafica fornitori (i fornitori barche, anche nuovi)
  for (const f of fornitori) {
    if (f._tokens.length === 0) continue
    const allHit = f._tokens.every(t => rif.includes(' ' + t + ' ') || rif.includes(' ' + t))
    if (allHit) return CAT.COSTI_SERVIZI
  }

  // Livello 2: mappa keyword (spese ricorrenti)
  const up = riferimento.toUpperCase()
  for (const k of KEYWORD_MAP) {
    if (up.includes(k.match)) return k.categoria_id
  }

  // Livello 3: manuale
  return ''
}

// Parser CSV per il formato SumUp (5 colonne: Data, Codice, Riferimento, Importo, Saldo)
function parseCsvSumUp(text: string, fornitori: Fornitore[]): RigaMovimento[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length < 2) return []

  const righe: RigaMovimento[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const parts = line.split(',')
    if (parts.length < 5) continue

    const data = parts[0].trim()
    const codice = parts[1].trim()
    const importoRaw = parts[parts.length - 2].trim()
    const riferimento = pulisciRiferimento(parts.slice(2, parts.length - 2).join(','))

    const importo = parseFloat(importoRaw)
    if (isNaN(importo)) continue

    if (importo < 0) {
      // ── USCITA: categorizzazione automatica ──
      righe.push({
        data,
        codice,
        riferimento,
        importo: Math.abs(importo),
        tipo: 'uscita',
        categoria_id: categorizza(riferimento, fornitori),
        includi: true,
      })
    } else {
      // ── ENTRATA: salta gli accrediti tecnici (PAYOUT, Stripe, SumUp, Google).
      //    Le altre (quote soci come Andreffe, Dolce Vita) → da categorizzare a mano. ──
      if (isAccreditoTecnico(riferimento)) continue
      righe.push({
        data,
        codice,
        riferimento,
        importo: Math.abs(importo),
        tipo: 'entrata',
        categoria_id: '', // sempre manuale per le entrate
        includi: true,
      })
    }
  }
  return righe
}

export default function ImportaSumUpPage() {
  const [righe, setRighe] = useState<RigaMovimento[]>([])
  const [categorie, setCategorie] = useState<Array<{ id: string; nome: string }>>([])
  const [fornitori, setFornitori] = useState<Fornitore[]>([])
  const [fileName, setFileName] = useState('')
  const [pendingText, setPendingText] = useState('')
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState(false)
  const [filtroDa, setFiltroDa] = useState('')
  const [filtroA, setFiltroA] = useState('')

  // Carica categorie + anagrafica fornitori (servono per la categorizzazione)
  useEffect(() => {
    (async () => {
      const [catRes, fornRes] = await Promise.all([
        supabase.from('categorie_contabili').select('id, nome').order('nome'),
        supabase.from('fornitori').select('id, ragione_sociale').eq('attivo', true),
      ])
      setCategorie(catRes.data || [])
      const forn: Fornitore[] = (fornRes.data || []).map((f: any) => ({
        id: f.id,
        ragione_sociale: f.ragione_sociale,
        _tokens: tokenDistintivi(f.ragione_sociale || ''),
      }))
      setFornitori(forn)
      setReady(true)
    })()
  }, [])

  // Quando i fornitori sono pronti e c'è un file in attesa, esegui il parsing
  useEffect(() => {
    if (ready && pendingText) {
      const parsed = parseCsvSumUp(pendingText, fornitori)
      setRighe(parsed)
      setPendingText('')
      if (parsed.length === 0) {
        toast.error('Nessuna uscita trovata nel file (o formato non riconosciuto)')
      } else {
        const daCat = parsed.filter(r => !r.categoria_id).length
        toast.success(`${parsed.length} uscite caricate${daCat > 0 ? ` — ${daCat} da categorizzare` : ''}`)
      }
    }
  }, [ready, pendingText, fornitori])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = String(ev.target?.result || '')
      if (ready) {
        const parsed = parseCsvSumUp(text, fornitori)
        setRighe(parsed)
        if (parsed.length === 0) {
          toast.error('Nessuna uscita trovata nel file (o formato non riconosciuto)')
        } else {
          const daCat = parsed.filter(r => !r.categoria_id).length
          toast.success(`${parsed.length} uscite caricate${daCat > 0 ? ` — ${daCat} da categorizzare` : ''}`)
        }
      } else {
        // fornitori non ancora pronti: metti il testo in attesa
        setPendingText(text)
      }
    }
    reader.readAsText(file)
  }

  function updateRiga(codice: string, patch: Partial<RigaMovimento>) {
    setRighe(prev => prev.map(r => r.codice === codice ? { ...r, ...patch } : r))
  }

  // Righe visibili in base al filtro data (estremi inclusi)
  const righeVisibili = useMemo(() => {
    return righe.filter(r => {
      if (filtroDa && r.data < filtroDa) return false
      if (filtroA && r.data > filtroA) return false
      return true
    })
  }, [righe, filtroDa, filtroA])

  const totaleUscite = useMemo(
    () => righeVisibili.filter(r => r.includi && r.tipo === 'uscita').reduce((s, r) => s + r.importo, 0),
    [righeVisibili]
  )
  const totaleEntrate = useMemo(
    () => righeVisibili.filter(r => r.includi && r.tipo === 'entrata').reduce((s, r) => s + r.importo, 0),
    [righeVisibili]
  )
  const daCategorizzzare = righeVisibili.filter(r => r.includi && !r.categoria_id).length

  async function handleSalva() {
    const daSalvare = righeVisibili.filter(r => r.includi)
    if (daSalvare.length === 0) { toast.error('Nessuna riga selezionata'); return }

    // Le entrate DEVONO avere una categoria esplicita (nessun default sicuro)
    const entrateSenzaCat = daSalvare.filter(r => r.tipo === 'entrata' && !r.categoria_id)
    if (entrateSenzaCat.length > 0) {
      toast.error(`${entrateSenzaCat.length} entrate senza categoria. Assegna una categoria a ogni entrata prima di importare.`)
      return
    }

    const usciteSenzaCat = daSalvare.filter(r => r.tipo === 'uscita' && !r.categoria_id).length
    if (usciteSenzaCat > 0) {
      if (!confirm(`Ci sono ${usciteSenzaCat} uscite senza categoria. Verranno salvate come "Altre Uscite". Procedere?`)) return
    }

    try {
      setSaving(true)
      const payload = daSalvare.map(r => ({
        data: r.data,
        codice: r.codice,
        descrizione: r.riferimento,
        importo: r.importo,
        tipo: r.tipo,
        categoria_id: r.categoria_id || CAT.ALTRE_USCITE,
      }))

      const res = await authFetch('/api/contabilita/importa-sumup', {
        method: 'POST',
        body: JSON.stringify({ movimenti: payload }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Errore salvataggio')

      toast.success(`✅ ${result.inseriti} movimenti importati${result.duplicati > 0 ? ` — ${result.duplicati} già presenti (saltati)` : ''}`)
      setRighe([])
      setFileName('')
    } catch (err: any) {
      toast.error(err.message || 'Errore durante il salvataggio')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Importa Estratto Conto SumUp</h1>
        <p className="text-sm text-gray-500 mt-1">
          Carica il file <code>Resoconto_transazioni_*.csv</code> esportato da SumUp.
          Vengono importate solo le <strong>uscite</strong> (pagamenti). Gli accrediti PAYOUT
          sono ignorati perché gli incassi arrivano dalle prenotazioni.
        </p>
      </div>

      {/* Caricamento file */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">File CSV SumUp</label>
        <input type="file" accept=".csv" onChange={handleFile}
          className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white file:text-sm file:font-medium hover:file:bg-blue-700" />
        {fileName && <p className="text-xs text-gray-500 mt-2">File: {fileName}</p>}
      </div>

      {righe.length > 0 && (
        <>
          {/* Riepilogo */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-500">Movimenti</p>
              <p className="text-2xl font-bold text-gray-900">{righeVisibili.filter(r => r.includi).length}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-500">Totale uscite</p>
              <p className="text-2xl font-bold text-red-600">€{totaleUscite.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-500">Totale entrate</p>
              <p className="text-2xl font-bold text-green-600">€{totaleEntrate.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className={`border rounded-lg p-3 ${daCategorizzzare > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
              <p className="text-xs text-gray-500">Da categorizzare</p>
              <p className={`text-2xl font-bold ${daCategorizzzare > 0 ? 'text-amber-600' : 'text-green-600'}`}>{daCategorizzzare}</p>
            </div>
          </div>

          {/* Filtro periodo */}
          <div className="flex items-end gap-3 mb-3 flex-wrap">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Dal</label>
              <input type="date" value={filtroDa} onChange={(e) => setFiltroDa(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Al</label>
              <input type="date" value={filtroA} onChange={(e) => setFiltroA(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
            </div>
            {(filtroDa || filtroA) && (
              <button onClick={() => { setFiltroDa(''); setFiltroA('') }}
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                Azzera filtro
              </button>
            )}
            <p className="text-xs text-gray-500 ml-auto self-center">
              Mostrate {righeVisibili.length} di {righe.length} righe — solo quelle nel periodo verranno importate
            </p>
          </div>

          {/* Tabella anteprima */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-8"></th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Data</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Descrizione</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Importo</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Categoria</th>
                </tr>
              </thead>
              <tbody>
                {righeVisibili.map((r) => (
                  <tr key={r.codice} className={`border-b border-gray-100 ${!r.includi ? 'opacity-40' : ''} ${!r.categoria_id && r.includi ? 'bg-amber-50' : ''}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={r.includi}
                        onChange={(e) => updateRiga(r.codice, { includi: e.target.checked })} />
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                      {new Date(r.data).toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.tipo === 'entrata'
                        ? <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">▲ Entrata</span>
                        : <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">▼ Uscita</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-900">{r.riferimento}</td>
                    <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${r.tipo === 'entrata' ? 'text-green-600' : 'text-red-600'}`}>
                      {r.tipo === 'entrata' ? '+' : '−'}€{r.importo.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2">
                      <select value={r.categoria_id}
                        onChange={(e) => updateRiga(r.codice, { categoria_id: e.target.value })}
                        className={`w-full px-2 py-1 border rounded text-xs ${!r.categoria_id ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`}>
                        <option value="">⚠️ Da categorizzare...</option>
                        {categorie.map(c => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Azioni */}
          <div className="flex justify-end gap-3">
            <button onClick={() => { setRighe([]); setFileName('') }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm" disabled={saving}>
              Annulla
            </button>
            <button onClick={handleSalva}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm" disabled={saving}>
              {saving ? 'Salvataggio...' : `Importa ${righeVisibili.filter(r => r.includi).length} movimenti`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}