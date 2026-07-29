'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

interface FornitoreRiga {
  id: string
  ragione_sociale: string
  email?: string | null
  nome_referente?: string | null
  percentuale_commissione?: number | null
  numPrenotazioni: number
  fatturato: number
  netto: number
  caricato: boolean
}

const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
]

function fmt(n: number) {
  return '€' + n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function InvioEstrattiPage() {
  const [loading, setLoading] = useState(true)
  const [righe, setRighe] = useState<FornitoreRiga[]>([])
  const [selezionati, setSelezionati] = useState<Set<string>>(new Set())
  const [inviando, setInviando] = useState(false)
  const [progresso, setProgresso] = useState<{ corrente: number; totale: number; nome: string } | null>(null)
  const [risultato, setRisultato] = useState<{ inviati: number; saltati: string[]; errori: string[] } | null>(null)

  // Default: mese scorso
  const oggi = new Date()
  const mesePrecedente = new Date(oggi.getFullYear(), oggi.getMonth() - 1, 1)
  const [mese, setMese] = useState(format(mesePrecedente, 'yyyy-MM'))

  useEffect(() => { caricaDati() }, [mese])

  async function caricaDati() {
    try {
      setLoading(true)
      setRisultato(null)
      setSelezionati(new Set())

      // 1. Carica fornitori attivi
      const { data: fornitori, error } = await supabase
        .from('fornitori')
        .select('id, ragione_sociale, email, nome_referente, percentuale_commissione, attivo')
        .eq('attivo', true)
        .order('ragione_sociale')
      if (error) throw error

      // 2. Range mese
      const inizioMese = mese + '-01'
      const dataInizio = new Date(inizioMese)
      const dataFine = new Date(dataInizio.getFullYear(), dataInizio.getMonth() + 1, 0)
      const fineMese = format(dataFine, 'yyyy-MM-dd')

      // 3. Per ogni fornitore, conta prenotazioni e calcola totali del mese
      const righeCalcolate: FornitoreRiga[] = []
      for (const f of (fornitori || [])) {
        const { data: prenotazioni } = await supabase
          .from('vista_vendite_fornitori')
          .select('prezzo_totale')
          .eq('fornitore_id', f.id)
          .gte('data_servizio', inizioMese)
          .lte('data_servizio', fineMese)

        const fatturato = (prenotazioni || []).reduce((sum: number, p: any) => sum + Number(p.prezzo_totale || 0), 0)
        const commissione = fatturato * ((f.percentuale_commissione || 25) / 100)
        const netto = fatturato - commissione

        righeCalcolate.push({
          id: f.id,
          ragione_sociale: f.ragione_sociale,
          email: f.email,
          nome_referente: f.nome_referente,
          percentuale_commissione: f.percentuale_commissione,
          numPrenotazioni: prenotazioni?.length || 0,
          fatturato,
          netto,
          caricato: true,
        })
      }

      setRighe(righeCalcolate)
    } catch (e: any) {
      toast.error('Errore caricamento: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  function toggleSelezione(id: string) {
    setSelezionati(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTutti() {
    // Seleziona solo quelli con email e con almeno 1 prenotazione
    const selezionabili = righe.filter(r => r.email && r.numPrenotazioni > 0).map(r => r.id)
    if (selezionati.size === selezionabili.length && selezionabili.length > 0) {
      setSelezionati(new Set())
    } else {
      setSelezionati(new Set(selezionabili))
    }
  }

  async function inviaSelezionati() {
    const daInviare = righe.filter(r => selezionati.has(r.id))
    if (daInviare.length === 0) {
      toast.error('Seleziona almeno un fornitore')
      return
    }

    setInviando(true)
    setRisultato(null)
    const inizioMese = mese + '-01'
    const dataInizio = new Date(inizioMese)
    const dataFine = new Date(dataInizio.getFullYear(), dataInizio.getMonth() + 1, 0)
    const fineMese = format(dataFine, 'yyyy-MM-dd')

    let inviati = 0
    const saltati: string[] = []
    const errori: string[] = []

    for (let i = 0; i < daInviare.length; i++) {
      const f = daInviare[i]
      setProgresso({ corrente: i + 1, totale: daInviare.length, nome: f.ragione_sociale })

      // Skip senza email
      if (!f.email) {
        saltati.push(`${f.ragione_sociale} (nessuna email)`)
        continue
      }

      try {
        // Ricarica prenotazioni complete per il PDF
        const { data: prenotazioni, error } = await supabase
          .from('vista_vendite_fornitori')
          .select('*')
          .eq('fornitore_id', f.id)
          .gte('data_servizio', inizioMese)
          .lte('data_servizio', fineMese)
          .order('data_servizio')
        if (error) throw error

        const fatturato = (prenotazioni || []).reduce((sum: number, p: any) => sum + Number(p.prezzo_totale || 0), 0)
        const commissioni = fatturato * ((f.percentuale_commissione || 25) / 100)
        const totali = { fatturato, commissioni, netto: fatturato - commissioni }

        // Oggetto fornitore completo per l'endpoint
        const fornitoreCompleto = {
          id: f.id,
          ragione_sociale: f.ragione_sociale,
          email: f.email,
          nome_referente: f.nome_referente,
          percentuale_commissione: f.percentuale_commissione,
        }

        const response = await fetch('/api/invia-estratto-conto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fornitore: fornitoreCompleto, mese, prenotazioni: prenotazioni || [], totali }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Errore invio')
        inviati++
      } catch (e: any) {
        errori.push(`${f.ragione_sociale}: ${e.message}`)
      }

      // Piccola pausa tra invii (gentile con Resend)
      await new Promise(r => setTimeout(r, 600))
    }

    setProgresso(null)
    setInviando(false)
    setRisultato({ inviati, saltati, errori })
    if (inviati > 0) toast.success(`${inviati} estratti conto inviati!`)
  }

  const selezionabili = righe.filter(r => r.email && r.numPrenotazioni > 0)
  const totSelezionatiNetto = righe.filter(r => selezionati.has(r.id)).reduce((s, r) => s + r.netto, 0)

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">📧 Invio Estratti Conto</h1>
        <p className="text-sm text-gray-500 mt-1">Seleziona i fornitori a cui inviare l'estratto conto via email.</p>
      </div>

      {/* Selettore mese */}
      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm font-medium text-gray-700">Mese:</label>
        <input
          type="month"
          value={mese}
          onChange={e => setMese(e.target.value)}
          disabled={inviando}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <button
          onClick={caricaDati}
          disabled={loading || inviando}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          🔄 Ricarica
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Caricamento fornitori...</div>
      ) : (
        <>
          {/* Tabella */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="p-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selezionabili.length > 0 && selezionati.size === selezionabili.length}
                      onChange={toggleTutti}
                      disabled={inviando}
                    />
                  </th>
                  <th className="p-3 text-left font-semibold text-gray-700">Fornitore</th>
                  <th className="p-3 text-left font-semibold text-gray-700">Email</th>
                  <th className="p-3 text-right font-semibold text-gray-700">Pren.</th>
                  <th className="p-3 text-right font-semibold text-gray-700">Netto</th>
                </tr>
              </thead>
              <tbody>
                {righe.map((r, i) => {
                  const haEmail = !!r.email
                  const haPrenotazioni = r.numPrenotazioni > 0
                  const disabilitato = !haEmail || !haPrenotazioni || inviando
                  return (
                    <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selezionati.has(r.id)}
                          onChange={() => toggleSelezione(r.id)}
                          disabled={disabilitato}
                        />
                      </td>
                      <td className="p-3 font-medium text-gray-900">{r.ragione_sociale}</td>
                      <td className="p-3 text-gray-600">
                        {haEmail ? r.email : <span className="text-amber-600">⚠️ nessuna email</span>}
                      </td>
                      <td className="p-3 text-right text-gray-700">{r.numPrenotazioni}</td>
                      <td className="p-3 text-right font-medium text-gray-900">{fmt(r.netto)}</td>
                    </tr>
                  )
                })}
                {righe.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-gray-400">Nessun fornitore attivo</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Barra azioni */}
          <div className="flex items-center justify-between mt-4 p-4 bg-blue-50 rounded-xl">
            <div className="text-sm text-gray-700">
              <strong>{selezionati.size}</strong> selezionati · Netto totale: <strong>{fmt(totSelezionatiNetto)}</strong>
            </div>
            <button
              onClick={inviaSelezionati}
              disabled={inviando || selezionati.size === 0}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm"
            >
              {inviando ? 'Invio in corso...' : `📧 Invia ${selezionati.size > 0 ? selezionati.size : ''} estratti`}
            </button>
          </div>

          {/* Progresso */}
          {progresso && (
            <div className="mt-4 p-4 bg-white border border-gray-200 rounded-xl">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-700">Invio {progresso.corrente}/{progresso.totale}: {progresso.nome}</span>
                <span className="text-gray-500">{Math.round((progresso.corrente / progresso.totale) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${(progresso.corrente / progresso.totale) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Riepilogo finale */}
          {risultato && (
            <div className="mt-4 p-4 bg-white border border-gray-200 rounded-xl space-y-2">
              <h3 className="font-semibold text-gray-900">Riepilogo invio</h3>
              <p className="text-sm text-green-700">✅ {risultato.inviati} estratti conto inviati</p>
              {risultato.saltati.length > 0 && (
                <div className="text-sm text-amber-700">
                  ⚠️ {risultato.saltati.length} saltati:
                  <ul className="ml-5 list-disc">{risultato.saltati.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              {risultato.errori.length > 0 && (
                <div className="text-sm text-red-700">
                  ❌ {risultato.errori.length} errori:
                  <ul className="ml-5 list-disc">{risultato.errori.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}