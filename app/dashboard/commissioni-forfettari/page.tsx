'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import toast from 'react-hot-toast'

interface Prenotazione {
  id: string
  codice_prenotazione: string | null
  data_servizio: string | null
  prezzo_totale: number | null
  numero_persone: number | null
  stato: string | null
  commissione_fatturata_socio: boolean | null
  commissione_fatturata_data: string | null
  servizio_nome?: string | null
  socio_id: string
  socio_nome: string
  perc: number
  commissione: number
}

interface SocioGroup {
  socio_id: string
  socio_nome: string
  prenotazioni: Prenotazione[]
  totaleCommissione: number
  commissioneFatturata: number
  commissioneDaFatturare: number
  numPrenotazioni: number
}

export default function CommissioniForfettariPage() {
  const [gruppi, setGruppi] = useState<SocioGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [meseFiltro, setMeseFiltro] = useState<string>('') // 'YYYY-MM' o '' per tutte
  const [espansi, setEspansi] = useState<Record<string, boolean>>({})
  const [aggiornando, setAggiornando] = useState<string | null>(null)

  useEffect(() => { loadData() }, [meseFiltro])

  async function loadData() {
    setLoading(true)
    try {
      // Fornitori forfettari
      const { data: fornitori, error: errF } = await supabase
        .from('fornitori')
        .select('id, ragione_sociale, percentuale_commissione')
        .eq('forfettario', true)
      if (errF) throw errF
      const forfettariIds = (fornitori || []).map(f => f.id)
      if (forfettariIds.length === 0) { setGruppi([]); setLoading(false); return }

      // Barche di quei fornitori
      const { data: barche, error: errB } = await supabase
        .from('imbarcazioni')
        .select('id, fornitore_id')
        .in('fornitore_id', forfettariIds)
      if (errB) throw errB
      const barcaToFornitore: Record<string, string> = {}
      ;(barche || []).forEach(b => { barcaToFornitore[b.id] = b.fornitore_id })
      const barcheIds = (barche || []).map(b => b.id)
      if (barcheIds.length === 0) { setGruppi([]); setLoading(false); return }

      // Prenotazioni di quelle barche (confermate/completate)
      let query = supabase
        .from('prenotazioni')
        .select('id, codice_prenotazione, data_servizio, prezzo_totale, numero_persone, stato, imbarcazione_id, commissione_fatturata_socio, commissione_fatturata_data, servizi(nome)')
        .in('imbarcazione_id', barcheIds)
        .in('stato', ['confermata', 'completata'])
        .gte('data_servizio', '2026-08-01')
        .order('data_servizio', { ascending: false })

      if (meseFiltro) {
        const start = `${meseFiltro}-01`
        const [y, m] = meseFiltro.split('-').map(Number)
        const lastDay = new Date(y, m, 0).getDate()
        const end = `${meseFiltro}-${String(lastDay).padStart(2, '0')}`
        query = query.gte('data_servizio', start).lte('data_servizio', end)
      }

      const { data: prenotazioni, error: errP } = await query
      if (errP) throw errP

      // Mappa fornitore → dati
      const fornById: Record<string, any> = {}
      ;(fornitori || []).forEach(f => { fornById[f.id] = f })

      // Raggruppa per socio
      const map: Record<string, SocioGroup> = {}
      ;(prenotazioni || []).forEach((p: any) => {
        const fornId = barcaToFornitore[p.imbarcazione_id]
        if (!fornId) return
        const forn = fornById[fornId]
        if (!forn) return
        const perc = Number(forn.percentuale_commissione) || 18
        const commissione = Math.round((Number(p.prezzo_totale) || 0) * perc) / 100

        if (!map[fornId]) {
          map[fornId] = {
            socio_id: fornId,
            socio_nome: forn.ragione_sociale,
            prenotazioni: [],
            totaleCommissione: 0,
            commissioneFatturata: 0,
            commissioneDaFatturare: 0,
            numPrenotazioni: 0,
          }
        }
        const pren: Prenotazione = {
          id: p.id,
          codice_prenotazione: p.codice_prenotazione,
          data_servizio: p.data_servizio,
          prezzo_totale: p.prezzo_totale,
          numero_persone: p.numero_persone,
          stato: p.stato,
          commissione_fatturata_socio: p.commissione_fatturata_socio,
          commissione_fatturata_data: p.commissione_fatturata_data,
          servizio_nome: p.servizi?.nome || null,
          socio_id: fornId,
          socio_nome: forn.ragione_sociale,
          perc,
          commissione,
        }
        map[fornId].prenotazioni.push(pren)
        map[fornId].totaleCommissione += commissione
        map[fornId].numPrenotazioni += 1
        if (p.commissione_fatturata_socio) map[fornId].commissioneFatturata += commissione
        else map[fornId].commissioneDaFatturare += commissione
      })

      const arr = Object.values(map).sort((a, b) => b.commissioneDaFatturare - a.commissioneDaFatturare)
      setGruppi(arr)
    } catch (e: any) {
      console.error(e)
      toast.error('Errore caricamento: ' + (e.message || ''))
    } finally {
      setLoading(false)
    }
  }

  async function toggleFatturata(pren: Prenotazione, nuovoStato: boolean) {
    setAggiornando(pren.id)
    try {
      const { error } = await supabase
        .from('prenotazioni')
        .update({
          commissione_fatturata_socio: nuovoStato,
          commissione_fatturata_data: nuovoStato ? new Date().toISOString() : null,
        })
        .eq('id', pren.id)
      if (error) throw error
      toast.success(nuovoStato ? 'Segnata come fatturata' : 'Segnata come da fatturare')
      loadData()
    } catch (e: any) {
      toast.error('Errore: ' + (e.message || ''))
    } finally {
      setAggiornando(null)
    }
  }

  async function segnaTutteFatturate(gruppo: SocioGroup) {
    const daFatturare = gruppo.prenotazioni.filter(p => !p.commissione_fatturata_socio)
    if (daFatturare.length === 0) { toast('Nessuna commissione da fatturare per questo socio'); return }
    if (!confirm(`Segnare tutte le ${daFatturare.length} commissioni non fatturate di ${gruppo.socio_nome} come fatturate?`)) return
    setAggiornando(gruppo.socio_id)
    try {
      const ids = daFatturare.map(p => p.id)
      const { error } = await supabase
        .from('prenotazioni')
        .update({ commissione_fatturata_socio: true, commissione_fatturata_data: new Date().toISOString() })
        .in('id', ids)
      if (error) throw error
      toast.success(`${ids.length} commissioni segnate come fatturate`)
      loadData()
    } catch (e: any) {
      toast.error('Errore: ' + (e.message || ''))
    } finally {
      setAggiornando(null)
    }
  }

  const totaleGenerale = gruppi.reduce((s, g) => s + g.totaleCommissione, 0)
  const totaleDaFatturare = gruppi.reduce((s, g) => s + g.commissioneDaFatturare, 0)
  const totaleFatturato = gruppi.reduce((s, g) => s + g.commissioneFatturata, 0)

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">📋 Commissioni Soci Forfettari</h1>
        <p className="text-gray-600 mt-1">Commissioni da fatturare ai soci che incassano direttamente dal cliente.</p>
      </div>

      {/* Filtro mese */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Filtra per mese</label>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={meseFiltro}
            onChange={(e) => setMeseFiltro(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          {meseFiltro && (
            <button onClick={() => setMeseFiltro('')} className="text-sm text-blue-600 hover:text-blue-800">
              Mostra tutte
            </button>
          )}
        </div>
      </div>

      {/* Riepilogo totali */}
      {!loading && gruppi.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
            <div className="text-2xl font-bold">€{totaleDaFatturare.toFixed(2)}</div>
            <div className="text-sm text-amber-100 mt-1">Da fatturare</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
            <div className="text-2xl font-bold">€{totaleFatturato.toFixed(2)}</div>
            <div className="text-sm text-green-100 mt-1">Già fatturato</div>
          </div>
          <div className="bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl p-4 text-white">
            <div className="text-2xl font-bold">€{totaleGenerale.toFixed(2)}</div>
            <div className="text-sm text-gray-200 mt-1">Totale commissioni</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Caricamento...</div>
      ) : gruppi.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Nessuna prenotazione forfettaria{meseFiltro ? ' per il mese selezionato' : ''}.
        </div>
      ) : (
        <div className="space-y-4">
          {gruppi.map((g) => {
            const aperto = !!espansi[g.socio_id]
            return (
              <div key={g.socio_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Card socio */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                  onClick={() => setEspansi(prev => ({ ...prev, [g.socio_id]: !prev[g.socio_id] }))}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-lg">{aperto ? '▼' : '▶'}</span>
                    <div>
                      <div className="font-semibold text-gray-900">{g.socio_nome}</div>
                      <div className="text-sm text-gray-500">{g.numPrenotazioni} prenotazioni</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-amber-700">€{g.commissioneDaFatturare.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">da fatturare</div>
                    {g.commissioneFatturata > 0 && (
                      <div className="text-xs text-green-600 mt-0.5">€{g.commissioneFatturata.toFixed(2)} già fatturato</div>
                    )}
                  </div>
                </div>

                {/* Dettaglio espandibile */}
                {aperto && (
                  <div className="border-t border-gray-100">
                    <div className="px-4 py-2 bg-gray-50 flex justify-end">
                      <button
                        onClick={() => segnaTutteFatturate(g)}
                        disabled={aggiornando === g.socio_id || g.commissioneDaFatturare === 0}
                        className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40"
                      >
                        ✓ Segna tutte come fatturate
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                          <tr>
                            <th className="px-4 py-2 text-left">Data</th>
                            <th className="px-4 py-2 text-left">Servizio</th>
                            <th className="px-4 py-2 text-center">Pax</th>
                            <th className="px-4 py-2 text-right">Prezzo</th>
                            <th className="px-4 py-2 text-right">Commissione</th>
                            <th className="px-4 py-2 text-center">Fatturata</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.prenotazioni.map((p) => (
                            <tr key={p.id} className={`border-t border-gray-100 ${p.commissione_fatturata_socio ? 'bg-green-50/50' : ''}`}>
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                {p.data_servizio ? format(new Date(p.data_servizio), 'dd/MM/yyyy', { locale: it }) : '-'}
                              </td>
                              <td className="px-4 py-2.5">{p.servizio_nome || '-'}</td>
                              <td className="px-4 py-2.5 text-center">{p.numero_persone || '-'}</td>
                              <td className="px-4 py-2.5 text-right">€{(p.prezzo_totale || 0).toFixed(2)}</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-amber-700">€{p.commissione.toFixed(2)}</td>
                              <td className="px-4 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={!!p.commissione_fatturata_socio}
                                  disabled={aggiornando === p.id}
                                  onChange={(e) => toggleFatturata(p, e.target.checked)}
                                  className="w-4 h-4 accent-green-600 cursor-pointer"
                                  title={p.commissione_fatturata_data ? 'Fatturata il ' + format(new Date(p.commissione_fatturata_data), 'dd/MM/yyyy') : 'Segna come fatturata'}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}