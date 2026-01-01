'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import toast from 'react-hot-toast'

export default function PrenotazioneDettaglioPage() {
  const params = useParams()
  const router = useRouter()
  const [prenotazione, setPrenotazione] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [showPagamentiModal, setShowPagamentiModal] = useState(false)
  const [nuovoPagamento, setNuovoPagamento] = useState({
    tipo: 'caparra',
    importo: 0,
    metodo: 'contanti',
    data: new Date().toISOString().split('T')[0],
    note: ''
  })

  useEffect(() => {
    if (params.id) {
      loadPrenotazione()
    }
  }, [params.id])

  async function loadPrenotazione() {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('prenotazioni')
        .select(`
          *,
          clienti(nome, cognome, email, telefono, nazione),
          servizi(nome, tipo, descrizione),
          imbarcazioni(nome, tipo, categoria),
          transazioni(*)
        `)
        .eq('id', params.id)
        .single()

      if (error) throw error

      setPrenotazione(data)
    } catch (error: any) {
      console.error('Errore:', error)
      toast.error('Errore nel caricamento della prenotazione')
      router.push('/backoffice/prenotazioni')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!prenotazione) return

    try {
      const { error } = await supabase
        .from('prenotazioni')
        .update({
          data_servizio: prenotazione.data_servizio,
          ora_inizio: prenotazione.ora_inizio,
          numero_persone: prenotazione.numero_persone,
          stato: prenotazione.stato,
          stato_pagamento: prenotazione.stato_pagamento,
          caparra_ricevuta: prenotazione.caparra_ricevuta,
          saldo_ricevuto: prenotazione.saldo_ricevuto,
          metodo_pagamento: prenotazione.metodo_pagamento,
          metodo_pagamento_caparra: prenotazione.metodo_pagamento_caparra,
          metodo_pagamento_saldo: prenotazione.metodo_pagamento_saldo,
          note_cliente: prenotazione.note_cliente,
          note_interne: prenotazione.note_interne,
          lingua: prenotazione.lingua
        })
        .eq('id', params.id)

      if (error) throw error

      toast.success('Prenotazione aggiornata!')
      setEditing(false)
      loadPrenotazione()
    } catch (error: any) {
      console.error('Errore:', error)
      toast.error('Errore nel salvataggio')
    }
  }

  async function handleAggiungiPagamento() {
    if (!prenotazione || !nuovoPagamento.importo) {
      toast.error('Inserisci un importo valido')
      return
    }

    try {
      // Crea transazione
      const { error: transazioneError } = await supabase
        .from('transazioni')
        .insert({
          prenotazione_id: params.id,
          importo: parseFloat(nuovoPagamento.importo.toString()),
          tipo_pagamento: nuovoPagamento.tipo,
          metodo_pagamento: nuovoPagamento.metodo,
          stato: 'completato',
          note: nuovoPagamento.note
        })

      if (transazioneError) throw transazioneError

      // Aggiorna prenotazione
      const nuoviValori: any = {}
      
      if (nuovoPagamento.tipo === 'caparra') {
        nuoviValori.caparra_ricevuta = (prenotazione.caparra_ricevuta || 0) + parseFloat(nuovoPagamento.importo.toString())
        nuoviValori.metodo_pagamento_caparra = nuovoPagamento.metodo
        nuoviValori.data_pagamento_caparra = nuovoPagamento.data
      } else if (nuovoPagamento.tipo === 'saldo') {
        nuoviValori.saldo_ricevuto = (prenotazione.saldo_ricevuto || 0) + parseFloat(nuovoPagamento.importo.toString())
        nuoviValori.metodo_pagamento_saldo = nuovoPagamento.metodo
        nuoviValori.data_pagamento_saldo = nuovoPagamento.data
      }

      // Calcola nuovo stato pagamento
      const totaleRicevuto = 
        (nuovoPagamento.tipo === 'caparra' ? nuoviValori.caparra_ricevuta : prenotazione.caparra_ricevuta || 0) +
        (nuovoPagamento.tipo === 'saldo' ? nuoviValori.saldo_ricevuto : prenotazione.saldo_ricevuto || 0)

      if (totaleRicevuto >= prenotazione.prezzo_totale) {
        nuoviValori.stato_pagamento = 'pagato'
      } else if (totaleRicevuto > 0) {
        nuoviValori.stato_pagamento = 'parzialmente_pagato'
      }

      const { error: updateError } = await supabase
        .from('prenotazioni')
        .update(nuoviValori)
        .eq('id', params.id)

      if (updateError) throw updateError

      toast.success('Pagamento registrato!')
      setShowPagamentiModal(false)
      setNuovoPagamento({
        tipo: 'caparra',
        importo: 0,
        metodo: 'contanti',
        data: new Date().toISOString().split('T')[0],
        note: ''
      })
      loadPrenotazione()
    } catch (error: any) {
      console.error('Errore:', error)
      toast.error('Errore nel registrare il pagamento')
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-gray-600">Caricamento...</div>
      </div>
    )
  }

  if (!prenotazione) {
    return (
      <div className="p-8">
        <div className="text-red-600">Prenotazione non trovata</div>
      </div>
    )
  }

  const totaleRicevuto = (prenotazione.caparra_ricevuta || 0) + (prenotazione.saldo_ricevuto || 0)
  const daRicevere = prenotazione.prezzo_totale - totaleRicevuto

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push('/backoffice/prenotazioni')}
            className="text-blue-600 hover:text-blue-700 mb-2 flex items-center gap-2"
          >
            ← Torna alle prenotazioni
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {prenotazione.codice_prenotazione}
          </h1>
          <p className="text-gray-600 mt-1">
            Prenotazione di {prenotazione.clienti?.nome} {prenotazione.clienti?.cognome}
          </p>
        </div>

        <div className="flex gap-3">
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              ✏️ Modifica
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setEditing(false)
                  loadPrenotazione()
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                💾 Salva
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status Badges */}
      <div className="mb-8 flex gap-3">
        <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
          prenotazione.stato === 'confermata' ? 'bg-green-100 text-green-700' :
          prenotazione.stato === 'in_attesa' ? 'bg-yellow-100 text-yellow-700' :
          prenotazione.stato === 'completata' ? 'bg-blue-100 text-blue-700' :
          'bg-red-100 text-red-700'
        }`}>
          {prenotazione.stato?.replace('_', ' ')}
        </span>
        <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
          prenotazione.stato_pagamento === 'pagato' ? 'bg-green-100 text-green-700' :
          prenotazione.stato_pagamento === 'parzialmente_pagato' ? 'bg-orange-100 text-orange-700' :
          'bg-red-100 text-red-700'
        }`}>
          {prenotazione.stato_pagamento?.replace('_', ' ')}
        </span>
        {prenotazione.payment_intent_id && (
          <span className="px-4 py-2 rounded-full text-sm font-semibold bg-purple-100 text-purple-700">
            💳 Stripe
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonna Sinistra - Dettagli */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Cliente */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">👤 Cliente</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Nome</div>
                <div className="font-medium text-gray-900">
                  {prenotazione.clienti?.nome} {prenotazione.clienti?.cognome}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Email</div>
                <div className="font-medium text-gray-900">{prenotazione.clienti?.email}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Telefono</div>
                <div className="font-medium text-gray-900">{prenotazione.clienti?.telefono}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Nazione</div>
                <div className="font-medium text-gray-900">{prenotazione.clienti?.nazione}</div>
              </div>
            </div>
          </div>

          {/* Info Servizio */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🚤 Servizio e Imbarcazione</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Servizio</div>
                <div className="font-medium text-gray-900">{prenotazione.servizi?.nome}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Tipo</div>
                <div className="font-medium text-gray-900 capitalize">{prenotazione.servizi?.tipo}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Imbarcazione</div>
                <div className="font-medium text-gray-900">{prenotazione.imbarcazioni?.nome || 'Non assegnata'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Categoria</div>
                <div className="font-medium text-gray-900 capitalize">{prenotazione.imbarcazioni?.categoria || '-'}</div>
              </div>
            </div>
          </div>

          {/* Dettagli Prenotazione */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📋 Dettagli Prenotazione</h2>
            <div className="space-y-4">
              {/* Data Servizio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Servizio</label>
                {editing ? (
                  <input
                    type="date"
                    value={prenotazione.data_servizio}
                    onChange={(e) => setPrenotazione({...prenotazione, data_servizio: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <div className="font-medium text-gray-900">
                    {format(new Date(prenotazione.data_servizio), 'EEEE, dd MMMM yyyy', { locale: it })}
                  </div>
                )}
              </div>

              {/* Ora e Persone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ora Inizio</label>
                  {editing ? (
                    <input
                      type="time"
                      value={prenotazione.ora_inizio || ''}
                      onChange={(e) => setPrenotazione({...prenotazione, ora_inizio: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  ) : (
                    <div className="font-medium text-gray-900">{prenotazione.ora_inizio || '-'}</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Numero Persone</label>
                  {editing ? (
                    <input
                      type="number"
                      value={prenotazione.numero_persone || ''}
                      onChange={(e) => setPrenotazione({...prenotazione, numero_persone: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      min="1"
                    />
                  ) : (
                    <div className="font-medium text-gray-900">{prenotazione.numero_persone} persone</div>
                  )}
                </div>
              </div>

              {/* Luogo Imbarco */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Luogo Imbarco</label>
                <div className="font-medium text-gray-900">{prenotazione.porto_imbarco}</div>
                {prenotazione.luogo_imbarco_dettagli && (
                  <div className="text-sm text-gray-600 mt-1">{prenotazione.luogo_imbarco_dettagli}</div>
                )}
              </div>

              {/* Stati */}
              {editing && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Stato Prenotazione</label>
                    <select
                      value={prenotazione.stato}
                      onChange={(e) => setPrenotazione({...prenotazione, stato: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="in_attesa">In Attesa</option>
                      <option value="confermata">Confermata</option>
                      <option value="completata">Completata</option>
                      <option value="cancellata">Cancellata</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Lingua</label>
                    <select
                      value={prenotazione.lingua || 'it'}
                      onChange={(e) => setPrenotazione({...prenotazione, lingua: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="it">🇮🇹 Italiano</option>
                      <option value="en">🇬🇧 English</option>
                      <option value="fr">🇫🇷 Français</option>
                      <option value="de">🇩🇪 Deutsch</option>
                      <option value="es">🇪🇸 Español</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note Cliente</label>
                {editing ? (
                  <textarea
                    value={prenotazione.note_cliente || ''}
                    onChange={(e) => setPrenotazione({...prenotazione, note_cliente: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                  />
                ) : (
                  <div className="text-gray-700">{prenotazione.note_cliente || 'Nessuna nota'}</div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note Interne</label>
                {editing ? (
                  <textarea
                    value={prenotazione.note_interne || ''}
                    onChange={(e) => setPrenotazione({...prenotazione, note_interne: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                  />
                ) : (
                  <div className="text-gray-700">{prenotazione.note_interne || 'Nessuna nota interna'}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Colonna Destra - Pagamenti */}
        <div className="space-y-6">
          {/* Riepilogo Importi */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
            <h2 className="text-lg font-bold mb-4">💰 Riepilogo Importi</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-white/20">
                <span className="text-sm opacity-90">Prezzo Totale</span>
                <span className="text-2xl font-bold">€{prenotazione.prezzo_totale?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-90">Totale Ricevuto</span>
                <span className="text-lg font-semibold text-green-200">€{totaleRicevuto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-white/20">
                <span className="text-sm opacity-90">Da Ricevere</span>
                <span className={`text-lg font-semibold ${daRicevere > 0 ? 'text-yellow-200' : 'text-green-200'}`}>
                  €{daRicevere.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <div className="text-xs opacity-75">Caparra</div>
                  <div className="font-semibold">€{(prenotazione.caparra_ricevuta || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                </div>
                <div>
                  <div className="text-xs opacity-75">Saldo</div>
                  <div className="font-semibold">€{(prenotazione.saldo_ricevuto || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Metodi Pagamento */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">💳 Metodi Pagamento</h2>
            
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Metodo Principale</label>
                  <select
                    value={prenotazione.metodo_pagamento || ''}
                    onChange={(e) => setPrenotazione({...prenotazione, metodo_pagamento: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  >
                    <option value="">Seleziona...</option>
                    <option value="stripe">💳 Stripe</option>
                    <option value="contanti">💵 Contanti</option>
                    <option value="pos">💳 POS</option>
                    <option value="bonifico">🏦 Bonifico</option>
                    <option value="altro">📋 Altro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Metodo Caparra</label>
                  <select
                    value={prenotazione.metodo_pagamento_caparra || ''}
                    onChange={(e) => setPrenotazione({...prenotazione, metodo_pagamento_caparra: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  >
                    <option value="">Usa principale</option>
                    <option value="stripe">💳 Stripe</option>
                    <option value="contanti">💵 Contanti</option>
                    <option value="pos">💳 POS</option>
                    <option value="bonifico">🏦 Bonifico</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Metodo Saldo</label>
                  <select
                    value={prenotazione.metodo_pagamento_saldo || ''}
                    onChange={(e) => setPrenotazione({...prenotazione, metodo_pagamento_saldo: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  >
                    <option value="">Usa principale</option>
                    <option value="stripe">💳 Stripe</option>
                    <option value="contanti">💵 Contanti</option>
                    <option value="pos">💳 POS</option>
                    <option value="bonifico">🏦 Bonifico</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Principale:</span>
                  <span className="font-medium">{prenotazione.metodo_pagamento || 'Non impostato'}</span>
                </div>
                {prenotazione.metodo_pagamento_caparra && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Caparra:</span>
                    <span className="font-medium">{prenotazione.metodo_pagamento_caparra}</span>
                  </div>
                )}
                {prenotazione.metodo_pagamento_saldo && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Saldo:</span>
                    <span className="font-medium">{prenotazione.metodo_pagamento_saldo}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pulsante Aggiungi Pagamento */}
          <button
            onClick={() => setShowPagamentiModal(true)}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
          >
            💰 Registra Pagamento
          </button>

          {/* Transazioni */}
          {prenotazione.transazioni && prenotazione.transazioni.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">📊 Storico Transazioni</h2>
              <div className="space-y-2">
                {prenotazione.transazioni.map((t: any) => (
                  <div key={t.id} className="flex justify-between items-center text-sm py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <div className="font-medium">{t.tipo_pagamento}</div>
                      <div className="text-xs text-gray-500">{t.metodo_pagamento}</div>
                    </div>
                    <div className="font-semibold text-green-600">
                      €{t.importo?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Aggiungi Pagamento */}
      {showPagamentiModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">Registra Pagamento</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo Pagamento</label>
                <select
                  value={nuovoPagamento.tipo}
                  onChange={(e) => setNuovoPagamento({...nuovoPagamento, tipo: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="caparra">Caparra</option>
                  <option value="saldo">Saldo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Importo</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                  <input
                    type="number"
                    step="0.01"
                    value={nuovoPagamento.importo}
                    onChange={(e) => setNuovoPagamento({...nuovoPagamento, importo: parseFloat(e.target.value)})}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Metodo Pagamento</label>
                <select
                  value={nuovoPagamento.metodo}
                  onChange={(e) => setNuovoPagamento({...nuovoPagamento, metodo: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="contanti">💵 Contanti</option>
                  <option value="pos">💳 POS</option>
                  <option value="bonifico">🏦 Bonifico</option>
                  <option value="stripe">💳 Stripe</option>
                  <option value="altro">📋 Altro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Pagamento</label>
                <input
                  type="date"
                  value={nuovoPagamento.data}
                  onChange={(e) => setNuovoPagamento({...nuovoPagamento, data: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note (opzionale)</label>
                <textarea
                  value={nuovoPagamento.note}
                  onChange={(e) => setNuovoPagamento({...nuovoPagamento, note: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                />
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button
                onClick={() => setShowPagamentiModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white"
              >
                Annulla
              </button>
              <button
                onClick={handleAggiungiPagamento}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                💰 Registra
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}