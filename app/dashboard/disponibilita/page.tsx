'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import toast from 'react-hot-toast'

export default function PlanningSettimanale() {
  const [imbarcazioni, setImbarcazioni] = useState<any[]>([])
  const [imbarcazioniFiltrate, setImbarcazioniFiltrate] = useState<any[]>([])
  const [fornitori, setFornitori] = useState<any[]>([])
  const [prenotazioni, setPrenotazioni] = useState<any[]>([])
  const [blocchi, setBlocchi] = useState<any[]>([])
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [loading, setLoading] = useState(true)
  const [filtroFornitore, setFiltroFornitore] = useState<string>('tutti')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('tutti')
  const [showBloccoModal, setShowBloccoModal] = useState(false)
  const [selectedCell, setSelectedCell] = useState<{imbarcazioneId: string, date: Date, imbarcazioneNome: string} | null>(null)
  const [motivoBlocco, setMotivoBlocco] = useState('')
  const [tipoBlocco, setTipoBlocco] = useState<'manutenzione' | 'prenotazione_esterna' | 'altro'>('altro')

  useEffect(() => {
    loadData()
  }, [currentWeekStart])

  useEffect(() => {
    applicaFiltri()
  }, [imbarcazioni, filtroFornitore, filtroCategoria])

  async function loadData() {
    try {
      setLoading(true)

      const weekEnd = addDays(currentWeekStart, 6)

      // Carica fornitori
      const { data: fornitoriData } = await supabase
        .from('fornitori')
        .select('id, ragione_sociale')
        .eq('attivo', true)
        .order('ragione_sociale')

      // Carica imbarcazioni
      const { data: barcheData } = await supabase
        .from('imbarcazioni')
        .select('id, nome, tipo, categoria, fornitore_id')
        .eq('attiva', true)
        .order('categoria', { ascending: false })
        .order('nome')

      // Carica prenotazioni
      const { data: prenotazioniData } = await supabase
        .from('prenotazioni')
        .select('id, imbarcazione_id, data_servizio, stato, numero_persone')
        .gte('data_servizio', format(currentWeekStart, 'yyyy-MM-dd'))
        .lte('data_servizio', format(weekEnd, 'yyyy-MM-dd'))
        .in('stato', ['confermata', 'in_attesa', 'completata'])

      // Carica blocchi
      const { data: blocchiData } = await supabase
        .from('blocchi_imbarcazioni')
        .select('id, imbarcazione_id, data_inizio, data_fine, motivo, note')
        .lte('data_inizio', format(weekEnd, 'yyyy-MM-dd'))
        .gte('data_fine', format(currentWeekStart, 'yyyy-MM-dd'))

      setFornitori(fornitoriData || [])
      setImbarcazioni(barcheData || [])
      setPrenotazioni(prenotazioniData || [])
      setBlocchi(blocchiData || [])
    } catch (error) {
      console.error('Errore:', error)
      toast.error('Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }

  function applicaFiltri() {
    let filtrate = [...imbarcazioni]

    if (filtroFornitore !== 'tutti') {
      filtrate = filtrate.filter(b => b.fornitore_id === filtroFornitore)
    }

    if (filtroCategoria !== 'tutti') {
      filtrate = filtrate.filter(b => b.categoria === filtroCategoria)
    }

    setImbarcazioniFiltrate(filtrate)
  }

  function goToPreviousWeek() {
    setCurrentWeekStart(subWeeks(currentWeekStart, 1))
  }

  function goToNextWeek() {
    setCurrentWeekStart(addWeeks(currentWeekStart, 1))
  }

  function goToToday() {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
  }

  function getCellStatus(imbarcazioneId: string, date: Date) {
    const dateStr = format(date, 'yyyy-MM-dd')

    // Controlla prenotazioni
    const prenotazione = prenotazioni.find(
      p => p.imbarcazione_id === imbarcazioneId && p.data_servizio === dateStr
    )

    // Controlla blocchi
    const blocco = blocchi.find(b => {
      if (b.imbarcazione_id !== imbarcazioneId) return false
      const dataInizio = parseISO(b.data_inizio)
      const dataFine = parseISO(b.data_fine)
      return date >= dataInizio && date <= dataFine
    })

    if (prenotazione) {
      return { type: 'prenotazione', data: prenotazione }
    }

    if (blocco) {
      return { type: 'blocco', data: blocco }
    }

    return { type: 'disponibile' }
  }

  function handleCellClick(imbarcazioneId: string, imbarcazioneNome: string, date: Date) {
    const cellStatus = getCellStatus(imbarcazioneId, date)

    if (cellStatus.type === 'prenotazione') {
      toast.error('Questa data ha già una prenotazione')
      return
    }

    if (cellStatus.type === 'blocco') {
      // Chiedi conferma per rimuovere il blocco
      if (confirm('Vuoi rimuovere questo blocco e rendere disponibile la barca?')) {
        rimuoviBlocco(cellStatus.data.id)
      }
    } else {
      // Apri modal per creare blocco
      setSelectedCell({ imbarcazioneId, date, imbarcazioneNome })
      setMotivoBlocco('')
      setTipoBlocco('altro')
      setShowBloccoModal(true)
    }
  }

  async function creaBlocco() {
    if (!selectedCell) return

    try {
      const { error } = await supabase
        .from('blocchi_imbarcazioni')
        .insert([{
          imbarcazione_id: selectedCell.imbarcazioneId,
          data_inizio: format(selectedCell.date, 'yyyy-MM-dd'),
          data_fine: format(selectedCell.date, 'yyyy-MM-dd'),
          motivo: motivoBlocco || 'Indisponibilità',
          note: tipoBlocco
        }])

      if (error) throw error

      toast.success('Blocco creato!')
      setShowBloccoModal(false)
      loadData()
    } catch (error: any) {
      console.error('Errore creazione blocco:', error)
      toast.error('Errore nella creazione del blocco')
    }
  }

  async function rimuoviBlocco(bloccoId: string) {
    try {
      const { error } = await supabase
        .from('blocchi_imbarcazioni')
        .delete()
        .eq('id', bloccoId)

      if (error) throw error

      toast.success('Blocco rimosso!')
      loadData()
    } catch (error: any) {
      console.error('Errore rimozione blocco:', error)
      toast.error('Errore nella rimozione del blocco')
    }
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i))

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-gray-600">Caricamento planning...</div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          Planning Settimanale
        </h1>
        <p className="text-gray-600">
          Click su una cella per bloccare/sbloccare la disponibilità
        </p>

        {/* Navigation */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousWeek}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ← Settimana Prec.
            </button>
            <button
              onClick={goToToday}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Oggi
            </button>
            <button
              onClick={goToNextWeek}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Settimana Succ. →
            </button>
          </div>

          <div className="text-lg font-semibold text-gray-700">
            {format(currentWeekStart, 'MMMM yyyy', { locale: it })}
          </div>
        </div>

        {/* Filtri */}
        <div className="mt-4 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fornitore
            </label>
            <select
              value={filtroFornitore}
              onChange={(e) => setFiltroFornitore(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="tutti">Tutti i fornitori ({imbarcazioni.length})</option>
              {fornitori.map(f => {
                const count = imbarcazioni.filter(b => b.fornitore_id === f.id).length
                return (
                  <option key={f.id} value={f.id}>
                    {f.ragione_sociale} ({count})
                  </option>
                )
              })}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoria
            </label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="tutti">Tutte le categorie</option>
              <option value="luxury">Luxury</option>
              <option value="premium">Premium</option>
              <option value="simple">Simple</option>
            </select>
          </div>

          {(filtroFornitore !== 'tutti' || filtroCategoria !== 'tutti') && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFiltroFornitore('tutti')
                  setFiltroCategoria('tutti')
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                ✕ Rimuovi filtri
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Legenda */}
      <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
        <div className="text-sm font-medium text-gray-700 mb-2">Legenda:</div>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border-2 border-green-400 rounded"></div>
            <span>✅ Disponibile (click per bloccare)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 border-2 border-red-400 rounded"></div>
            <span>🚫 Bloccata (click per sbloccare)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 border-2 border-blue-400 rounded"></div>
            <span>📋 Prenotata (non modificabile)</span>
          </div>
        </div>
      </div>

      {/* Planning Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 z-10 bg-gray-50 px-2 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm font-semibold text-gray-700 border-b border-r border-gray-200 min-w-[120px] md:min-w-[200px]">
                  Imbarcazione
                </th>
                {weekDays.map((day) => {
                  const isToday = isSameDay(day, new Date())
                  return (
                    <th
                      key={day.toISOString()}
                      className={`px-1 md:px-3 py-2 md:py-3 text-center text-xs md:text-sm font-semibold border-b border-r border-gray-200 min-w-[60px] md:min-w-[120px] ${
                        isToday ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-normal text-gray-500">
                          {format(day, 'EEE', { locale: it })}
                        </span>
                        <span className={`text-sm md:text-lg ${isToday ? 'font-bold' : ''}`}>
                          {format(day, 'd')}
                        </span>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {imbarcazioniFiltrate.map((barca) => (
                <tr key={barca.id} className="hover:bg-gray-50">
                  <td className="sticky left-0 z-10 bg-white px-2 md:px-4 py-2 md:py-3 border-b border-r border-gray-200">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900 text-xs md:text-base">{barca.nome}</span>
                      <span className="text-xs text-gray-500 hidden md:block">
                        {barca.tipo} • {barca.categoria}
                      </span>
                    </div>
                  </td>
                  {weekDays.map((day) => {
                    const cellStatus = getCellStatus(barca.id, day)
                    
                    let bgColor = 'bg-green-50 hover:bg-green-100'
                    let borderColor = 'border-green-300'
                    let icon = '✅'
                    let cursorStyle = 'cursor-pointer'

                    if (cellStatus.type === 'prenotazione') {
                      bgColor = 'bg-blue-50'
                      borderColor = 'border-blue-300'
                      icon = '📋'
                      cursorStyle = 'cursor-not-allowed'
                    } else if (cellStatus.type === 'blocco') {
                      bgColor = 'bg-red-50 hover:bg-red-100'
                      borderColor = 'border-red-300'
                      icon = '🚫'
                      cursorStyle = 'cursor-pointer'
                    }

                    return (
                      <td
                        key={`${barca.id}-${day.toISOString()}`}
                        className="border-b border-r border-gray-200 p-0"
                      >
                        <button
                          onClick={() => handleCellClick(barca.id, barca.nome, day)}
                          className={`w-full h-full px-1 md:px-3 py-3 md:py-6 text-center border-2 transition-all ${bgColor} ${borderColor} ${cursorStyle}`}
                          disabled={cellStatus.type === 'prenotazione'}
                        >
                          <div className="flex flex-col items-center justify-center gap-0 md:gap-1">
                            <span className="text-sm md:text-xl">{icon}</span>
                            {cellStatus.type === 'prenotazione' && (
                              <span className="text-xs font-medium text-blue-700 hidden md:block">
                                {cellStatus.data.numero_persone} pax
                              </span>
                            )}
                            {cellStatus.type === 'blocco' && cellStatus.data.motivo && (
                              <span className="text-xs text-red-700 hidden md:block">
                                {cellStatus.data.motivo.substring(0, 15)}
                              </span>
                            )}
                          </div>
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {imbarcazioniFiltrate.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {filtroFornitore !== 'tutti' || filtroCategoria !== 'tutti' 
                ? 'Nessuna imbarcazione trovata con i filtri selezionati'
                : 'Nessuna imbarcazione attiva trovata'
              }
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Barche Visualizzate</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {imbarcazioniFiltrate.length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Prenotazioni</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {prenotazioni.length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Blocchi Attivi</div>
          <div className="text-2xl font-bold text-red-600 mt-1">
            {blocchi.length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Tasso Occupazione</div>
          <div className="text-2xl font-bold text-purple-600 mt-1">
            {imbarcazioniFiltrate.length > 0 
              ? Math.round((prenotazioni.length / (imbarcazioniFiltrate.length * 7)) * 100)
              : 0}%
          </div>
        </div>
      </div>

      {/* Modal Crea Blocco */}
      {showBloccoModal && selectedCell && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Blocca Disponibilità</h2>
              <button
                onClick={() => setShowBloccoModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600">
                <strong>Barca:</strong> {selectedCell.imbarcazioneNome}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Data:</strong> {format(selectedCell.date, 'dd MMMM yyyy', { locale: it })}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo Blocco
                </label>
                <select
                  value={tipoBlocco}
                  onChange={(e) => setTipoBlocco(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="altro">Altro</option>
                  <option value="manutenzione">Manutenzione</option>
                  <option value="prenotazione_esterna">Prenotazione Esterna</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo (opzionale)
                </label>
                <textarea
                  value={motivoBlocco}
                  onChange={(e) => setMotivoBlocco(e.target.value)}
                  placeholder="Es: Manutenzione motore, prenotazione diretta..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBloccoModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                onClick={creaBlocco}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Blocca
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}