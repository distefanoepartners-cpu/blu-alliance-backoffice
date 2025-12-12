'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import toast from 'react-hot-toast'

export default function PrenotazioniPage() {
  const [prenotazioni, setPrenotazioni] = useState<any[]>([])
  const [statistiche, setStatistiche] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filtroStato, setFiltroStato] = useState<string>('tutte')
  const [filtroPagamento, setFiltroPagamento] = useState<string>('tutti')
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingPrenotazione, setEditingPrenotazione] = useState<any>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)

      // Carica statistiche dalla view
      const { data: statsData, error: statsError } = await supabase
        .from('vista_statistiche_ricavi')
        .select('*')
        .single()

      if (statsError && statsError.code !== 'PGRST116') {
        console.error('Errore statistiche:', statsError)
      }

      // Carica prenotazioni con dettagli
      const { data: prenotazioniData, error: prenotazioniError } = await supabase
        .from('prenotazioni')
        .select(`
          *,
          clienti(nome, cognome, email, telefono),
          servizi(nome, tipo),
          imbarcazioni(nome, tipo, categoria)
        `)
        .order('data_servizio', { ascending: false })
        .order('ora_inizio', { ascending: true })

      if (prenotazioniError) throw prenotazioniError

      setStatistiche(statsData || {
        ricavi_oggi: 0,
        ricavi_settimana: 0,
        ricavi_mese: 0,
        totale_incassato: 0,
        totale_da_incassare: 0,
        totale_prenotazioni: 0,
        prenotazioni_confermate: 0,
        prenotazioni_pagate: 0
      })
      
      setPrenotazioni(prenotazioniData || [])
    } catch (error: any) {
      console.error('Errore:', error)
      toast.error('Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }

  const prenotazioniFiltrate = prenotazioni.filter(p => {
    // Filtro stato
    if (filtroStato !== 'tutte' && p.stato !== filtroStato) return false
    
    // Filtro pagamento
    if (filtroPagamento !== 'tutti' && p.stato_pagamento !== filtroPagamento) return false
    
    // Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      const matchCodice = p.codice_prenotazione?.toLowerCase().includes(term)
      const matchCliente = `${p.clienti?.nome} ${p.clienti?.cognome}`.toLowerCase().includes(term)
      const matchEmail = p.clienti?.email?.toLowerCase().includes(term)
      const matchServizio = p.servizi?.nome?.toLowerCase().includes(term)
      
      if (!matchCodice && !matchCliente && !matchEmail && !matchServizio) return false
    }
    
    return true
  })

  function handleEdit(prenotazione: any) {
    setEditingPrenotazione(prenotazione)
    setShowModal(true)
  }

  async function handleSavePrenotazione() {
    if (!editingPrenotazione) return

    try {
      const { error } = await supabase
        .from('prenotazioni')
        .update({
          data_servizio: editingPrenotazione.data_servizio,
          ora_inizio: editingPrenotazione.ora_inizio,
          numero_persone: editingPrenotazione.numero_persone,
          stato: editingPrenotazione.stato,
          caparra_ricevuta: editingPrenotazione.caparra_ricevuta,
          saldo_ricevuto: editingPrenotazione.saldo_ricevuto,
          note_interne: editingPrenotazione.note_interne,
          note_cliente: editingPrenotazione.note_cliente
        })
        .eq('id', editingPrenotazione.id)

      if (error) throw error

      toast.success('Prenotazione aggiornata!')
      setShowModal(false)
      loadData()
    } catch (error: any) {
      console.error('Errore salvataggio:', error)
      toast.error('Errore nel salvataggio')
    }
  }

  const getStatoColor = (stato: string) => {
    switch (stato) {
      case 'confermata': return 'bg-green-100 text-green-700'
      case 'in_attesa': return 'bg-yellow-100 text-yellow-700'
      case 'completata': return 'bg-blue-100 text-blue-700'
      case 'cancellata': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatoPagamentoColor = (stato: string) => {
    switch (stato) {
      case 'pagato': return 'bg-green-100 text-green-700'
      case 'acconto_ricevuto': return 'bg-yellow-100 text-yellow-700'
      case 'parzialmente_pagato': return 'bg-orange-100 text-orange-700'
      case 'non_pagato': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatoPagamentoLabel = (stato: string) => {
    switch (stato) {
      case 'pagato': return 'Pagato'
      case 'acconto_ricevuto': return 'Acconto Ricevuto'
      case 'parzialmente_pagato': return 'Parziale'
      case 'non_pagato': return 'Non Pagato'
      default: return stato
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-gray-600">Caricamento prenotazioni...</div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Prenotazioni</h1>
        <p className="text-gray-600">Gestisci tutte le prenotazioni e i pagamenti</p>
      </div>

      {/* Statistiche Ricavi */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Statistiche Ricavi</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Ricavi Oggi */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">💰</span>
              <span className="text-xs opacity-80">Oggi</span>
            </div>
            <div className="text-2xl font-bold">
              €{(statistiche?.ricavi_oggi || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs opacity-80 mt-1">Ricavi Oggi</div>
          </div>

          {/* Ricavi Settimana */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">📊</span>
              <span className="text-xs opacity-80">7 giorni</span>
            </div>
            <div className="text-2xl font-bold">
              €{(statistiche?.ricavi_settimana || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs opacity-80 mt-1">Ricavi Settimana</div>
          </div>

          {/* Ricavi Mese */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">📈</span>
              <span className="text-xs opacity-80">30 giorni</span>
            </div>
            <div className="text-2xl font-bold">
              €{(statistiche?.ricavi_mese || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs opacity-80 mt-1">Ricavi Mese</div>
          </div>

          {/* Totale Incassato */}
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">✅</span>
              <span className="text-xs opacity-80">Incassato</span>
            </div>
            <div className="text-2xl font-bold">
              €{(statistiche?.totale_incassato || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs opacity-80 mt-1">Totale Incassato</div>
          </div>

          {/* Da Incassare */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">⏳</span>
              <span className="text-xs opacity-80">Pending</span>
            </div>
            <div className="text-2xl font-bold">
              €{(statistiche?.totale_da_incassare || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs opacity-80 mt-1">Da Incassare</div>
          </div>

          {/* Prenotazioni */}
          <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-4 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">📋</span>
              <span className="text-xs opacity-80">Totali</span>
            </div>
            <div className="text-2xl font-bold">
              {statistiche?.totale_prenotazioni || 0}
            </div>
            <div className="text-xs opacity-80 mt-1">Prenotazioni</div>
          </div>
        </div>
      </div>

      {/* Stato Prenotazioni */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Stato Prenotazioni</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="text-3xl font-bold text-yellow-600">
              {prenotazioni.filter(p => p.stato === 'in_attesa').length}
            </div>
            <div className="text-sm text-yellow-700 mt-1">In Attesa</div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="text-3xl font-bold text-green-600">
              {prenotazioni.filter(p => p.stato === 'confermata').length}
            </div>
            <div className="text-sm text-green-700 mt-1">Confermate</div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="text-3xl font-bold text-blue-600">
              {prenotazioni.filter(p => p.stato === 'completata').length}
            </div>
            <div className="text-sm text-blue-700 mt-1">Completate</div>
          </div>

          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="text-3xl font-bold text-red-600">
              {prenotazioni.filter(p => p.stato === 'cancellata').length}
            </div>
            <div className="text-sm text-red-700 mt-1">Cancellate</div>
          </div>
        </div>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cerca</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Codice, cliente, email, servizio..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* Stato */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Stato Prenotazione</label>
            <select
              value={filtroStato}
              onChange={(e) => setFiltroStato(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="tutte">Tutte</option>
              <option value="in_attesa">In Attesa</option>
              <option value="confermata">Confermate</option>
              <option value="completata">Completate</option>
              <option value="cancellata">Cancellate</option>
            </select>
          </div>

          {/* Pagamento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Stato Pagamento</label>
            <select
              value={filtroPagamento}
              onChange={(e) => setFiltroPagamento(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="tutti">Tutti</option>
              <option value="non_pagato">Non Pagato</option>
              <option value="acconto_ricevuto">Acconto Ricevuto</option>
              <option value="parzialmente_pagato">Parzialmente Pagato</option>
              <option value="pagato">Pagato</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista Prenotazioni */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">DATA</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">CLIENTE</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">SERVIZIO</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">IMPORTO</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">STATO</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">AZIONI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {prenotazioniFiltrate.map((prenotazione) => (
                <tr key={prenotazione.id} className="hover:bg-gray-50">
                  {/* Data */}
                  <td className="px-4 py-4">
                    <div className="font-medium text-gray-900">
                      {format(new Date(prenotazione.data_servizio), 'dd MMM yyyy', { locale: it })}
                    </div>
                    {prenotazione.ora_inizio && (
                      <div className="text-sm text-gray-500">
                        {prenotazione.ora_inizio.substring(0, 5)}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {prenotazione.codice_prenotazione}
                    </div>
                  </td>

                  {/* Cliente */}
                  <td className="px-4 py-4">
                    <div className="font-medium text-gray-900">
                      {prenotazione.clienti?.nome} {prenotazione.clienti?.cognome}
                    </div>
                    <div className="text-sm text-gray-500">
                      {prenotazione.clienti?.email}
                    </div>
                    {prenotazione.numero_persone && (
                      <div className="text-xs text-gray-400 mt-1">
                        👥 {prenotazione.numero_persone} persone
                      </div>
                    )}
                  </td>

                  {/* Servizio */}
                  <td className="px-4 py-4">
                    <div className="font-medium text-gray-900">
                      {prenotazione.servizi?.nome}
                    </div>
                    <div className="text-sm text-gray-500">
                      {prenotazione.imbarcazioni?.nome}
                    </div>
                    <div className="text-xs text-gray-400 capitalize">
                      {prenotazione.imbarcazioni?.categoria}
                    </div>
                  </td>

                  {/* Importo */}
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <div className="text-sm">
                        <span className="text-gray-600">Totale: </span>
                        <span className="font-bold text-gray-900">
                          €{prenotazione.prezzo_totale?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="text-xs text-blue-600">
                        Acconto ricevuto: €{(prenotazione.caparra_ricevuta || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-gray-500">
                        Saldo ricevuto: €{(prenotazione.saldo_ricevuto || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs font-semibold text-red-600">
                        Da ricevere: €{(
                          (prenotazione.prezzo_totale || 0) - 
                          (prenotazione.caparra_ricevuta || 0) - 
                          (prenotazione.saldo_ricevuto || 0)
                        ).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </td>

                  {/* Stato */}
                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getStatoColor(prenotazione.stato)}`}>
                        {prenotazione.stato?.replace('_', ' ')}
                      </span>
                      <span className={`block px-2 py-1 text-xs font-semibold rounded-full ${getStatoPagamentoColor(prenotazione.stato_pagamento)}`}>
                        {getStatoPagamentoLabel(prenotazione.stato_pagamento)}
                      </span>
                    </div>
                  </td>

                  {/* Azioni */}
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleEdit(prenotazione)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" 
                        title="Modifica"
                      >
                        ✏️
                      </button>
                      <button className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg" title="Dettagli">
                        👁️
                      </button>
                      <button className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Pagamenti">
                        💳
                      </button>
                      <button className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg" title="Email">
                        📧
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {prenotazioniFiltrate.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-3">📋</div>
              <p>Nessuna prenotazione trovata con i filtri selezionati</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer info */}
      <div className="mt-6 text-sm text-gray-500 text-center">
        Visualizzate {prenotazioniFiltrate.length} di {prenotazioni.length} prenotazioni
      </div>

      {/* Modal Modifica Prenotazione */}
      {showModal && editingPrenotazione && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-3xl w-full my-8">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Modifica Prenotazione</h2>
                <p className="text-sm text-gray-600 mt-1">{editingPrenotazione.codice_prenotazione}</p>
              </div>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Info Cliente (Read-only) */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Cliente</h3>
                <p className="text-sm text-gray-700">
                  <strong>{editingPrenotazione.clienti?.nome} {editingPrenotazione.clienti?.cognome}</strong>
                </p>
                <p className="text-sm text-gray-600">{editingPrenotazione.clienti?.email}</p>
                <p className="text-sm text-gray-600">{editingPrenotazione.clienti?.telefono}</p>
              </div>

              {/* Info Servizio (Read-only) */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Servizio e Imbarcazione</h3>
                <p className="text-sm text-gray-700">
                  <strong>{editingPrenotazione.servizi?.nome}</strong>
                </p>
                <p className="text-sm text-gray-600">
                  {editingPrenotazione.imbarcazioni?.nome} • {editingPrenotazione.imbarcazioni?.categoria}
                </p>
              </div>

              {/* Campi Modificabili */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Data Servizio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data Servizio</label>
                  <input
                    type="date"
                    value={editingPrenotazione.data_servizio}
                    onChange={(e) => setEditingPrenotazione({
                      ...editingPrenotazione,
                      data_servizio: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                {/* Ora Inizio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ora Inizio</label>
                  <input
                    type="time"
                    value={editingPrenotazione.ora_inizio || ''}
                    onChange={(e) => setEditingPrenotazione({
                      ...editingPrenotazione,
                      ora_inizio: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                {/* Numero Persone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Numero Persone</label>
                  <input
                    type="number"
                    value={editingPrenotazione.numero_persone || ''}
                    onChange={(e) => setEditingPrenotazione({
                      ...editingPrenotazione,
                      numero_persone: parseInt(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="1"
                  />
                </div>

                {/* Stato */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stato Prenotazione</label>
                  <select
                    value={editingPrenotazione.stato}
                    onChange={(e) => setEditingPrenotazione({
                      ...editingPrenotazione,
                      stato: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="in_attesa">In Attesa</option>
                    <option value="confermata">Confermata</option>
                    <option value="completata">Completata</option>
                    <option value="cancellata">Cancellata</option>
                  </select>
                </div>
              </div>

              {/* Sezione Pagamenti */}
              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Pagamenti</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {/* Prezzo Totale (Read-only) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Prezzo Totale</label>
                    <div className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 font-bold">
                      €{editingPrenotazione.prezzo_totale?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Caparra Dovuta (Read-only) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Caparra Dovuta (30%)</label>
                    <div className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700">
                      €{editingPrenotazione.caparra_dovuta?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Saldo Dovuto (Calcolato) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Saldo Dovuto</label>
                    <div className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700">
                      €{(
                        (editingPrenotazione.prezzo_totale || 0) - 
                        (editingPrenotazione.caparra_ricevuta || 0)
                      ).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Caparra Ricevuta */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Caparra Ricevuta</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                      <input
                        type="number"
                        step="0.01"
                        value={editingPrenotazione.caparra_ricevuta || 0}
                        onChange={(e) => setEditingPrenotazione({
                          ...editingPrenotazione,
                          caparra_ricevuta: parseFloat(e.target.value) || 0
                        })}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Saldo Ricevuto */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Saldo Ricevuto</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                      <input
                        type="number"
                        step="0.01"
                        value={editingPrenotazione.saldo_ricevuto || 0}
                        onChange={(e) => setEditingPrenotazione({
                          ...editingPrenotazione,
                          saldo_ricevuto: parseFloat(e.target.value) || 0
                        })}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                {/* Da Ricevere (Calcolato) */}
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Totale Da Ricevere:</span>
                    <span className="text-xl font-bold text-red-600">
                      €{(
                        (editingPrenotazione.prezzo_totale || 0) - 
                        (editingPrenotazione.caparra_ricevuta || 0) - 
                        (editingPrenotazione.saldo_ricevuto || 0)
                      ).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note Cliente</label>
                <textarea
                  value={editingPrenotazione.note_cliente || ''}
                  onChange={(e) => setEditingPrenotazione({
                    ...editingPrenotazione,
                    note_cliente: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                  placeholder="Note visibili al cliente..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note Interne</label>
                <textarea
                  value={editingPrenotazione.note_interne || ''}
                  onChange={(e) => setEditingPrenotazione({
                    ...editingPrenotazione,
                    note_interne: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                  placeholder="Note interne (non visibili al cliente)..."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white"
              >
                Annulla
              </button>
              <button
                onClick={handleSavePrenotazione}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Salva Modifiche
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}