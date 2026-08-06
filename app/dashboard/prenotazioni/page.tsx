'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import toast from 'react-hot-toast'
import BookingModal from '@/components/BookingModal'

export default function PrenotazioniPage() {
  const router = useRouter()
  const [prenotazioni, setPrenotazioni] = useState<any[]>([])
  const [filtroPeriodo, setFiltroPeriodo] = useState<'oggi' | 'mese' | 'data' | 'tutte'>('tutte')
  const [dataFiltro, setDataFiltro] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [filtroStato, setFiltroStato] = useState<string>('tutte')
  const [filtroMetodo, setFiltroMetodo] = useState<string>('tutti')
  const [filtroAffiliato, setFiltroAffiliato] = useState<string>('tutti')
  const [filtroFornitore, setFiltroFornitore] = useState<string>('tutti')
  const [fornitori, setFornitori] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [editingPrenotazione, setEditingPrenotazione] = useState<any>(null)
  const [emailPrenotazione, setEmailPrenotazione] = useState<any>(null)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingPrenotazione, setDeletingPrenotazione] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [showBookingModal, setShowBookingModal] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)

      // Carica prenotazioni con dettagli
      const { data: prenotazioniData, error: prenotazioniError } = await supabase
        .from('prenotazioni')
        .select(`
          *,
          clienti(nome, cognome, email, telefono, nazione, tipo_documento, numero_documento, scadenza_documento, patente_nautica, scadenza_patente_nautica),
          servizi(nome, tipo),
          imbarcazioni(nome, tipo, categoria, fornitore_id)
        `)
        .order('data_servizio', { ascending: false })
        .order('ora_inizio', { ascending: true })

      if (prenotazioniError) throw prenotazioniError

      setPrenotazioni(prenotazioniData || [])

      // Carica fornitori attivi per il filtro
      const { data: fornitoriData } = await supabase
        .from('fornitori')
        .select('id, ragione_sociale')
        .eq('attivo', true)
        .order('ragione_sociale')
      setFornitori(fornitoriData || [])
    } catch (error: any) {
      console.error('Errore:', error)
      toast.error('Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }

  // Helper per il filtro periodo
  const oggiStr = new Date().toISOString().slice(0, 10)
  const meseCorrente = new Date().toISOString().slice(0, 7)

  const prenotazioniFiltrate = prenotazioni.filter(p => {
    // Filtro periodo (sulla data del servizio)
    if (filtroPeriodo === 'oggi' && p.data_servizio !== oggiStr) return false
    if (filtroPeriodo === 'mese' && !(p.data_servizio || '').startsWith(meseCorrente)) return false
    if (filtroPeriodo === 'data' && dataFiltro && p.data_servizio !== dataFiltro) return false

    // Filtro stato
    if (filtroStato !== 'tutte' && p.stato !== filtroStato) return false
    
    // Filtro pagamento
    
    // Filtro metodo pagamento
    if (filtroMetodo !== 'tutti') {
      if (filtroMetodo === 'non_impostato' && p.metodo_pagamento) return false
      if (filtroMetodo !== 'non_impostato' && p.metodo_pagamento !== filtroMetodo) return false
    }

    // Filtro affiliato
    if (filtroAffiliato === 'affiliato' && !p.ref_affiliato) return false
    if (filtroAffiliato === 'diretto' && p.ref_affiliato) return false
    if (filtroFornitore !== 'tutti' && p.imbarcazioni?.fornitore_id !== filtroFornitore) return false

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

  // ⭐ 4 metriche operative, calcolate sulle prenotazioni filtrate (escl. cancellate/annullate)
  const metriche = (() => {
    const valide = prenotazioniFiltrate.filter(p => p.stato !== 'cancellata' && p.stato !== 'annullata')
    return {
      numPrenotazioni: valide.length,
      numPax: valide.reduce((sum, p) => sum + (p.numero_persone || 0), 0),
      totaleFatturato: valide.reduce((sum, p) => sum + (p.prezzo_totale || 0), 0),
      numBarche: new Set(valide.map(p => p.imbarcazione_id || p.ns3000_boat_name).filter(Boolean)).size,
    }
  })()

  function handleEdit(prenotazione: any) {
    setEditingPrenotazione(prenotazione)
    setShowBookingModal(true)
  }

  async function handleSavePrenotazione() {
    if (!editingPrenotazione) return

    // Validazione metodo pagamento
    if (!editingPrenotazione.metodo_pagamento) {
      toast.error('⚠️ Metodo pagamento obbligatorio per chiusura incassi!')
      return
    }

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
          note_cliente: editingPrenotazione.note_cliente,
          lingua: editingPrenotazione.lingua,
          metodo_pagamento: editingPrenotazione.metodo_pagamento,
          metodo_pagamento_caparra: editingPrenotazione.metodo_pagamento_caparra,
          metodo_pagamento_saldo: editingPrenotazione.metodo_pagamento_saldo
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

  function handleOpenEmailModal(prenotazione: any) {
    setEmailPrenotazione(prenotazione)
    setShowEmailModal(true)
  }

  async function handleSendEmail() {
    if (!emailPrenotazione) return

    try {
      setSendingEmail(true)

      // Chiama API per inviare email
      const response = await fetch('/api/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prenotazioneId: emailPrenotazione.id,
          lingua: emailPrenotazione.lingua || 'it',
          tipo: 'conferma'
        })
      })

      if (!response.ok) throw new Error('Errore invio email')

      // Aggiorna flag email_conferma_inviata
      await supabase
        .from('prenotazioni')
        .update({ email_conferma_inviata: true })
        .eq('id', emailPrenotazione.id)

      toast.success('Email inviata con successo!')
      setShowEmailModal(false)
      loadData()
    } catch (error: any) {
      console.error('Errore invio email:', error)
      toast.error('Errore nell\'invio dell\'email')
    } finally {
      setSendingEmail(false)
    }
  }

  function handleOpenDeleteModal(prenotazione: any) {
    setDeletingPrenotazione(prenotazione)
    setDeleteConfirmText('')
    setShowDeleteModal(true)
  }

  async function handleDeletePrenotazione() {
    if (!deletingPrenotazione) return
    if (deleteConfirmText !== 'ELIMINA') {
      toast.error('Digita ELIMINA per confermare')
      return
    }

    try {
      setDeleting(true)

      const { error } = await supabase
        .from('prenotazioni')
        .delete()
        .eq('id', deletingPrenotazione.id)

      if (error) throw error

      toast.success('Prenotazione eliminata definitivamente!')
      setShowDeleteModal(false)
      setDeletingPrenotazione(null)
      setDeleteConfirmText('')
      loadData()
    } catch (error: any) {
      console.error('Errore eliminazione:', error)
      toast.error("Errore nell'eliminazione della prenotazione")
    } finally {
      setDeleting(false)
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
      case 'caparra_pagata': return 'bg-yellow-100 text-yellow-700'
      case 'acconto_ricevuto': return 'bg-yellow-100 text-yellow-700'
      case 'parzialmente_pagato': return 'bg-orange-100 text-orange-700'
      case 'non_pagato': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatoPagamentoLabel = (stato: string) => {
    switch (stato) {
      case 'pagato': return 'Pagato'
      case 'caparra_pagata': return 'Caparra Pagata'
      case 'acconto_ricevuto': return 'Acconto Ricevuto'
      case 'parzialmente_pagato': return 'Parziale'
      case 'non_pagato': return 'Non Pagato'
      default: return stato
    }
  }

  // Calcola incassi per metodo
  const incassiPerMetodo = {
    stripe: prenotazioni
      .filter(p => p.metodo_pagamento === 'stripe')
      .reduce((sum, p) => sum + (p.caparra_ricevuta || 0) + (p.saldo_ricevuto || 0), 0),
    contanti: prenotazioni
      .filter(p => p.metodo_pagamento === 'contanti')
      .reduce((sum, p) => sum + (p.caparra_ricevuta || 0) + (p.saldo_ricevuto || 0), 0),
    pos: prenotazioni
      .filter(p => p.metodo_pagamento === 'pos')
      .reduce((sum, p) => sum + (p.caparra_ricevuta || 0) + (p.saldo_ricevuto || 0), 0),
    bonifico: prenotazioni
      .filter(p => p.metodo_pagamento === 'bonifico')
      .reduce((sum, p) => sum + (p.caparra_ricevuta || 0) + (p.saldo_ricevuto || 0), 0),
    nonImpostato: prenotazioni.filter(p => !p.metodo_pagamento).length
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
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">Prenotazioni</h1>
          <p className="text-gray-600">Gestisci tutte le prenotazioni e i pagamenti</p>
        </div>
        <button
          onClick={() => {
            setEditingPrenotazione(null)
            setShowBookingModal(true)
          }}
          className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm shadow-sm"
        >
          ➕ Nuova Prenotazione
        </button>
      </div>

      {/* ⭐ Metriche operative */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Riepilogo</h2>
          {/* Filtro periodo */}
          <div className="flex flex-wrap items-center gap-2">
            {([
              { key: 'oggi', label: 'Oggi' },
              { key: 'mese', label: 'Questo mese' },
              { key: 'data', label: 'Per data' },
              { key: 'tutte', label: 'Totale' },
            ] as const).map(opt => (
              <button
                key={opt.key}
                onClick={() => setFiltroPeriodo(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filtroPeriodo === opt.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
            {filtroPeriodo === 'data' && (
              <input
                type="date"
                value={dataFiltro}
                onChange={(e) => setDataFiltro(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-sm">
            <div className="text-3xl font-bold">{metriche.numPrenotazioni}</div>
            <div className="text-sm text-blue-100 mt-1">N° Prenotazioni</div>
          </div>
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-5 text-white shadow-sm">
            <div className="text-3xl font-bold">{metriche.numPax}</div>
            <div className="text-sm text-teal-100 mt-1">N° Passeggeri</div>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white shadow-sm">
            <div className="text-3xl font-bold">€{metriche.totaleFatturato.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <div className="text-sm text-emerald-100 mt-1">Totale Fatturato</div>
          </div>
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white shadow-sm">
            <div className="text-3xl font-bold">{metriche.numBarche}</div>
            <div className="text-sm text-indigo-100 mt-1">Barche Impegnate</div>
          </div>
        </div>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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

          {/* Fornitore */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fornitore</label>
            <select
              value={filtroFornitore}
              onChange={(e) => setFiltroFornitore(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="tutti">Tutti</option>
              {fornitori.map((f) => (
                <option key={f.id} value={f.id}>{f.ragione_sociale}</option>
              ))}
            </select>
          </div>

          {/* Metodo Pagamento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Metodo Pagamento</label>
            <select
              value={filtroMetodo}
              onChange={(e) => setFiltroMetodo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="tutti">Tutti</option>
              <option value="stripe">💳 Stripe</option>
              <option value="contanti">💵 Contanti</option>
              <option value="pos">💳 POS</option>
              <option value="bonifico">🏦 Bonifico</option>
              <option value="altro">📋 Altro</option>
              <option value="non_impostato">⚠️ Non Impostato</option>
            </select>
          </div>

          {/* Provenienza */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Provenienza</label>
            <select
              value={filtroAffiliato}
              onChange={(e) => setFiltroAffiliato(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="tutti">Tutte</option>
              <option value="affiliato">🤝 Da Affiliato</option>
              <option value="diretto">⚓ Diretta</option>
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">METODO</th>
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
                    {prenotazione.ref_affiliato && (
                      <div className="mt-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">
                          🤝 {prenotazione.ref_affiliato}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Servizio */}
                  <td className="px-4 py-4">
                    <div className="font-medium text-gray-900">
                      {prenotazione.servizi?.nome}
                    </div>
                    <div className="text-sm text-gray-500">
                      {prenotazione.imbarcazioni?.nome || prenotazione.ns3000_boat_name || '—'}
                    </div>
                    <div className="text-xs text-gray-400 capitalize">
                      {prenotazione.imbarcazioni?.categoria || (prenotazione.ns3000_boat_name ? '⛵ NS3000' : '')}
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
                        Acconto: €{(prenotazione.caparra_ricevuta || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-gray-500">
                        Saldo: €{(prenotazione.saldo_ricevuto || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
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

                  {/* Metodo Pagamento */}
                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      {prenotazione.metodo_pagamento ? (
                        <div className="flex items-center gap-2">
                          {prenotazione.metodo_pagamento === 'stripe' && (
                            <>
                              <span className="text-xl">💳</span>
                              <div>
                                <div className="text-sm font-semibold text-blue-600">Stripe</div>
                                <div className="text-xs text-gray-500">Online</div>
                              </div>
                            </>
                          )}
                          {prenotazione.metodo_pagamento === 'contanti' && (
                            <>
                              <span className="text-xl">💵</span>
                              <div>
                                <div className="text-sm font-semibold text-green-600">Contanti</div>
                                <div className="text-xs text-gray-500">Cash</div>
                              </div>
                            </>
                          )}
                          {prenotazione.metodo_pagamento === 'pos' && (
                            <>
                              <span className="text-xl">💳</span>
                              <div>
                                <div className="text-sm font-semibold text-purple-600">POS</div>
                                <div className="text-xs text-gray-500">Card</div>
                              </div>
                            </>
                          )}
                          {prenotazione.metodo_pagamento === 'bonifico' && (
                            <>
                              <span className="text-xl">🏦</span>
                              <div>
                                <div className="text-sm font-semibold text-orange-600">Bonifico</div>
                                <div className="text-xs text-gray-500">Transfer</div>
                              </div>
                            </>
                          )}
                          {prenotazione.metodo_pagamento === 'altro' && (
                            <>
                              <span className="text-xl">📋</span>
                              <div>
                                <div className="text-sm font-semibold text-gray-600">Altro</div>
                                <div className="text-xs text-gray-500">Other</div>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xl">⚠️</span>
                          <div>
                            <div className="text-sm font-semibold text-red-600">Non impostato</div>
                            <div className="text-xs text-gray-500">Da definire</div>
                          </div>
                        </div>
                      )}

                      {/* Metodi Secondari */}
                      {prenotazione.metodo_pagamento_caparra && 
                       prenotazione.metodo_pagamento_caparra !== prenotazione.metodo_pagamento && (
                        <div className="text-xs text-gray-500 border-t border-gray-100 pt-1">
                          Caparra: {prenotazione.metodo_pagamento_caparra}
                        </div>
                      )}
                      {prenotazione.metodo_pagamento_saldo && 
                       prenotazione.metodo_pagamento_saldo !== prenotazione.metodo_pagamento && (
                        <div className="text-xs text-gray-500">
                          Saldo: {prenotazione.metodo_pagamento_saldo}
                        </div>
                      )}
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
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                        title="Modifica"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => router.push(`/dashboard/prenotazioni/${prenotazione.id}`)}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg cursor-pointer transition-colors" 
                        title="Dettagli"
                      >
                        👁️
                      </button>
                      <button 
                        onClick={() => router.push(`/dashboard/prenotazioni/${prenotazione.id}#pagamenti`)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg cursor-pointer transition-colors" 
                        title="Pagamenti"
                      >
                        💳
                      </button>
                      <button 
                        onClick={() => handleOpenEmailModal(prenotazione)}
                        className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors" 
                        title="Invia Email"
                      >
                        📧
                      </button>
                      <button 
                        onClick={() => handleOpenDeleteModal(prenotazione)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                        title="Elimina"
                      >
                        🗑️
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
                  {editingPrenotazione.imbarcazioni?.nome || editingPrenotazione.ns3000_boat_name || 'N/A'} • {editingPrenotazione.imbarcazioni?.categoria || (editingPrenotazione.ns3000_boat_name ? 'NS3000' : '')}
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

                {/* Lingua */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Lingua Email</label>
                  <select
                    value={editingPrenotazione.lingua || 'it'}
                    onChange={(e) => setEditingPrenotazione({
                      ...editingPrenotazione,
                      lingua: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="it">🇮🇹 Italiano</option>
                    <option value="en">🇬🇧 English</option>
                    <option value="fr">🇫🇷 Français</option>
                    <option value="de">🇩🇪 Deutsch</option>
                    <option value="es">🇪🇸 Español</option>
                  </select>
                </div>

                {/* Metodo Pagamento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Metodo Pagamento Principale *
                  </label>
                  <select
                    value={editingPrenotazione.metodo_pagamento || ''}
                    onChange={(e) => setEditingPrenotazione({
                      ...editingPrenotazione,
                      metodo_pagamento: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">⚠️ Seleziona metodo...</option>
                    <option value="stripe">💳 Stripe (Online)</option>
                    <option value="contanti">💵 Contanti</option>
                    <option value="pos">💳 POS / Carta</option>
                    <option value="bonifico">🏦 Bonifico Bancario</option>
                    <option value="altro">📋 Altro</option>
                  </select>
                  {!editingPrenotazione.metodo_pagamento && (
                    <p className="text-xs text-red-600 mt-1">
                      ⚠️ Obbligatorio per chiusura incassi
                    </p>
                  )}
                </div>
              </div>

              {/* Metodi Pagamento Dettagliati */}
              <div className="col-span-2 bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">
                  Dettaglio Metodi Pagamento (Opzionale)
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Metodo Caparra */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Metodo Caparra
                    </label>
                    <select
                      value={editingPrenotazione.metodo_pagamento_caparra || editingPrenotazione.metodo_pagamento || ''}
                      onChange={(e) => setEditingPrenotazione({
                        ...editingPrenotazione,
                        metodo_pagamento_caparra: e.target.value
                      })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    >
                      <option value="">Usa metodo principale</option>
                      <option value="stripe">💳 Stripe</option>
                      <option value="contanti">💵 Contanti</option>
                      <option value="pos">💳 POS</option>
                      <option value="bonifico">🏦 Bonifico</option>
                      <option value="altro">📋 Altro</option>
                    </select>
                  </div>

                  {/* Metodo Saldo */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Metodo Saldo
                    </label>
                    <select
                      value={editingPrenotazione.metodo_pagamento_saldo || editingPrenotazione.metodo_pagamento || ''}
                      onChange={(e) => setEditingPrenotazione({
                        ...editingPrenotazione,
                        metodo_pagamento_saldo: e.target.value
                      })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    >
                      <option value="">Usa metodo principale</option>
                      <option value="stripe">💳 Stripe</option>
                      <option value="contanti">💵 Contanti</option>
                      <option value="pos">💳 POS</option>
                      <option value="bonifico">🏦 Bonifico</option>
                      <option value="altro">📋 Altro</option>
                    </select>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-2">
                  💡 Se caparra e saldo sono pagati con metodi diversi, specificalo qui
                </p>
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

      {/* Modal Invio Email */}
      {showEmailModal && emailPrenotazione && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">Invia Email Conferma</h2>
              <p className="text-sm text-gray-600 mt-1">{emailPrenotazione.codice_prenotazione}</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Info Cliente */}
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm font-semibold text-gray-900">
                  {emailPrenotazione.clienti?.nome} {emailPrenotazione.clienti?.cognome}
                </p>
                <p className="text-sm text-gray-600">{emailPrenotazione.clienti?.email}</p>
              </div>

              {/* Info Prenotazione */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Servizio:</span>
                    <p className="font-medium">{emailPrenotazione.servizi?.nome}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Data:</span>
                    <p className="font-medium">
                      {format(new Date(emailPrenotazione.data_servizio), 'dd MMM yyyy', { locale: it })}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Imbarcazione:</span>
                    <p className="font-medium">{emailPrenotazione.imbarcazioni?.nome || emailPrenotazione.ns3000_boat_name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Importo:</span>
                    <p className="font-medium">€{emailPrenotazione.prezzo_totale?.toLocaleString('it-IT')}</p>
                  </div>
                </div>
              </div>

              {/* Selezione Lingua */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Lingua Email</label>
                <select
                  value={emailPrenotazione.lingua || 'it'}
                  onChange={(e) => setEmailPrenotazione({
                    ...emailPrenotazione,
                    lingua: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="it">🇮🇹 Italiano</option>
                  <option value="en">🇬🇧 English</option>
                  <option value="fr">🇫🇷 Français</option>
                  <option value="de">🇩🇪 Deutsch</option>
                  <option value="es">🇪🇸 Español</option>
                </select>
              </div>

              {/* Status Email */}
              {emailPrenotazione.email_conferma_inviata && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700">
                    ✅ Email di conferma già inviata
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button
                onClick={() => setShowEmailModal(false)}
                disabled={sendingEmail}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sendingEmail ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Invio...
                  </>
                ) : (
                  <>
                    📧 Invia Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Conferma Eliminazione */}
      {showDeleteModal && deletingPrenotazione && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold text-red-600">⚠️ Elimina Prenotazione</h2>
              <p className="text-sm text-gray-600 mt-1">{deletingPrenotazione.codice_prenotazione}</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Warning */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-red-800 mb-2">
                  Questa azione è irreversibile!
                </p>
                <p className="text-sm text-red-700">
                  La prenotazione verrà eliminata definitivamente dal sistema, inclusi tutti i dati di pagamento associati.
                </p>
              </div>

              {/* Info Prenotazione */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Cliente:</span>
                    <p className="font-medium">{deletingPrenotazione.clienti?.nome} {deletingPrenotazione.clienti?.cognome}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Data:</span>
                    <p className="font-medium">
                      {format(new Date(deletingPrenotazione.data_servizio), 'dd MMM yyyy', { locale: it })}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Servizio:</span>
                    <p className="font-medium">{deletingPrenotazione.servizi?.nome}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Importo:</span>
                    <p className="font-medium">€{deletingPrenotazione.prezzo_totale?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>

              {/* Conferma digitando ELIMINA */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Digita <span className="font-bold text-red-600">ELIMINA</span> per confermare
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="ELIMINA"
                  className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeletingPrenotazione(null)
                  setDeleteConfirmText('')
                }}
                disabled={deleting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={handleDeletePrenotazione}
                disabled={deleting || deleteConfirmText !== 'ELIMINA'}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Eliminazione...
                  </>
                ) : (
                  <>
                    🗑️ Elimina Definitivamente
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BookingModal per creazione e modifica */}
      <BookingModal
        isOpen={showBookingModal}
        onClose={() => {
          setShowBookingModal(false)
          setEditingPrenotazione(null)
        }}
        onSave={() => {
          loadData()
          setShowBookingModal(false)
          setEditingPrenotazione(null)
        }}
        prenotazione={editingPrenotazione}
      />
    </div>
  )
}