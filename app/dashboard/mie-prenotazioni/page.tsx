'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { it } from 'date-fns/locale'
import toast from 'react-hot-toast'

export default function MiePrenotazioniPage() {
  const router = useRouter()
  const { isOperatore, fornitoreId, loading: authLoading } = useAuth()

  const [prenotazioni, setPrenotazioni] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStato, setFiltroStato] = useState<string>('tutte')
  const [filtroPagamento, setFiltroPagamento] = useState<string>('tutti')
  const [searchTerm, setSearchTerm] = useState('')
  const [meseSelezionato, setMeseSelezionato] = useState(format(new Date(), 'yyyy-MM'))

  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailPrenotazione, setEmailPrenotazione] = useState<any>(null)
  const [sendingEmail, setSendingEmail] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!isOperatore || !fornitoreId) return
    loadData()
  }, [authLoading, isOperatore, fornitoreId, meseSelezionato])

  async function loadData() {
    try {
      setLoading(true)
      const inizioMese = meseSelezionato + '-01'
      const dataInizio = new Date(inizioMese)
      const fineMese = format(endOfMonth(dataInizio), 'yyyy-MM-dd')

      // Carica imbarcazioni del fornitore
      const { data: barcheData } = await supabase
        .from('imbarcazioni')
        .select('id')
        .eq('fornitore_id', fornitoreId)

      const barcheIds = (barcheData || []).map((b: any) => b.id)
      if (barcheIds.length === 0) {
        setPrenotazioni([])
        return
      }

      const { data, error } = await supabase
        .from('prenotazioni')
        .select(`
          *,
          clienti(nome, cognome, email, telefono),
          servizi(nome, tipo),
          imbarcazioni(nome, tipo, categoria)
        `)
        .in('imbarcazione_id', barcheIds)
        .gte('data_servizio', inizioMese)
        .lte('data_servizio', fineMese)
        .not('stato', 'eq', 'cancellata')
        .order('data_servizio', { ascending: true })
        .order('ora_inizio', { ascending: true })

      if (error) throw error
      setPrenotazioni(data || [])
    } catch (error: any) {
      console.error('Errore:', error)
      toast.error('Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }

  const prenotazioniFiltrate = prenotazioni.filter(p => {
    if (filtroStato !== 'tutte' && p.stato !== filtroStato) return false
    if (filtroPagamento !== 'tutti' && p.stato_pagamento !== filtroPagamento) return false
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

  // Statistiche mese
  const totaleRevenue = prenotazioniFiltrate.reduce((sum, p) => sum + (p.prezzo_totale || 0), 0)
  const totaleIncassato = prenotazioniFiltrate.reduce((sum, p) => sum + (p.caparra_ricevuta || 0) + (p.saldo_ricevuto || 0), 0)
  const daIncassare = totaleRevenue - totaleIncassato

  async function handleSendEmail() {
    if (!emailPrenotazione) return
    try {
      setSendingEmail(true)
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
      await supabase.from('prenotazioni').update({ email_conferma_inviata: true }).eq('id', emailPrenotazione.id)
      toast.success('Email inviata!')
      setShowEmailModal(false)
      loadData()
    } catch (error: any) {
      toast.error("Errore nell'invio dell'email")
    } finally {
      setSendingEmail(false)
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
      default: return stato || '—'
    }
  }

  if (authLoading || loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-gray-500">Caricamento prenotazioni...</p>
        </div>
      </div>
    )
  }

  if (!isOperatore || !fornitoreId) {
    return (
      <div className="p-8 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <p className="text-gray-500">Sezione riservata agli operatori</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full border border-blue-200">
              👤 Vista Operatore
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Le mie Prenotazioni</h1>
          <p className="text-gray-500 mt-1 text-sm">Prenotazioni relative alle tue imbarcazioni</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/mia-azienda')}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
        >
          ← La mia Azienda
        </button>
      </div>

      {/* Filtro Mese */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Mese</label>
          <input
            type="month"
            value={meseSelezionato}
            onChange={(e) => setMeseSelezionato(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2 mt-4">
        {['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12'].map(m => (
  <button key={m} onClick={() => setMeseSelezionato(m)}
    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
      meseSelezionato === m
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
    }`}>
    {format(new Date(m + '-01'), 'MMM', { locale: it }).toUpperCase()}
  </button>
    ))}
      </div>
      </div>

      {/* Statistiche Mese */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <div className="text-xs opacity-80 mb-1">Prenotazioni</div>
          <div className="text-2xl font-bold">{prenotazioniFiltrate.length}</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
          <div className="text-xs opacity-80 mb-1">Revenue Mese</div>
          <div className="text-xl font-bold">€{totaleRevenue.toLocaleString('it-IT', { minimumFractionDigits: 0 })}</div>
        </div>
        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 text-white">
          <div className="text-xs opacity-80 mb-1">Incassato</div>
          <div className="text-xl font-bold">€{totaleIncassato.toLocaleString('it-IT', { minimumFractionDigits: 0 })}</div>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
          <div className="text-xs opacity-80 mb-1">Da Incassare</div>
          <div className="text-xl font-bold">€{daIncassare.toLocaleString('it-IT', { minimumFractionDigits: 0 })}</div>
        </div>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cerca</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Codice, cliente, email, servizio..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Stato Prenotazione</label>
            <select value={filtroStato} onChange={(e) => setFiltroStato(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="tutte">Tutte</option>
              <option value="in_attesa">In Attesa</option>
              <option value="confermata">Confermate</option>
              <option value="completata">Completate</option>
              <option value="cancellata">Cancellate</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Stato Pagamento</label>
            <select value={filtroPagamento} onChange={(e) => setFiltroPagamento(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="tutti">Tutti</option>
              <option value="non_pagato">Non Pagato</option>
              <option value="caparra_pagata">Caparra Pagata</option>
              <option value="acconto_ricevuto">Acconto Ricevuto</option>
              <option value="parzialmente_pagato">Parzialmente Pagato</option>
              <option value="pagato">Pagato</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabella */}
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
                      <div className="text-sm text-gray-500">{prenotazione.ora_inizio.substring(0, 5)}</div>
                    )}
                    {prenotazione.porto_imbarco && (
                      <div className="text-xs text-gray-400 mt-0.5">⚓ {prenotazione.porto_imbarco}</div>
                    )}
                    <div className="text-xs text-gray-400 mt-1 font-mono">{prenotazione.codice_prenotazione}</div>
                  </td>

                  {/* Cliente */}
                  <td className="px-4 py-4">
                    <div className="font-medium text-gray-900">
                      {prenotazione.clienti?.nome} {prenotazione.clienti?.cognome}
                    </div>
                    {prenotazione.clienti?.telefono && (
                      <a href={`tel:${prenotazione.clienti.telefono}`} className="text-sm text-blue-600 hover:underline">
                        📱 {prenotazione.clienti.telefono}
                      </a>
                    )}
                    <div className="text-xs text-gray-400 mt-0.5">{prenotazione.clienti?.email}</div>
                    {prenotazione.numero_persone && (
                      <div className="text-xs text-gray-400 mt-0.5">👥 {prenotazione.numero_persone} pax</div>
                    )}
                  </td>

                  {/* Servizio */}
                  <td className="px-4 py-4">
                    <div className="font-medium text-gray-900">{prenotazione.servizi?.nome || '—'}</div>
                    <div className="text-sm text-gray-500">
                      {prenotazione.imbarcazioni?.nome || prenotazione.ns3000_boat_name || '—'}
                    </div>
                    {prenotazione.note_cliente && (
                      <div className="text-xs text-amber-600 mt-1 bg-amber-50 rounded px-1.5 py-0.5 max-w-[160px] truncate" title={prenotazione.note_cliente}>
                        📝 {prenotazione.note_cliente}
                      </div>
                    )}
                  </td>

                  {/* Importo */}
                  <td className="px-4 py-4">
                    <div className="text-sm font-bold text-gray-900">
                      €{(prenotazione.prezzo_totale || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-blue-600">
                      Acc: €{(prenotazione.caparra_ricevuta || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-gray-500">
                      Saldo: €{(prenotazione.saldo_ricevuto || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </div>
                    {(() => {
                      const daRicevere = (prenotazione.prezzo_totale || 0) - (prenotazione.caparra_ricevuta || 0) - (prenotazione.saldo_ricevuto || 0)
                      return daRicevere > 0 ? (
                        <div className="text-xs font-semibold text-red-600">
                          Da: €{daRicevere.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                        </div>
                      ) : null
                    })()}
                  </td>

                  {/* Metodo Pagamento */}
                  <td className="px-4 py-4">
                    {prenotazione.metodo_pagamento ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg">
                          {prenotazione.metodo_pagamento === 'stripe' ? '💳' :
                           prenotazione.metodo_pagamento === 'contanti' ? '💵' :
                           prenotazione.metodo_pagamento === 'pos' ? '💳' :
                           prenotazione.metodo_pagamento === 'bonifico' ? '🏦' : '📋'}
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-gray-700 capitalize">
                            {prenotazione.metodo_pagamento}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-red-500">⚠️ N/D</span>
                    )}
                  </td>

                  {/* Stato */}
                  <td className="px-4 py-4">
                    <div className="space-y-1.5">
                      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${getStatoColor(prenotazione.stato)}`}>
                        {prenotazione.stato?.replace('_', ' ')}
                      </span>
                      <span className={`block px-2 py-0.5 text-xs font-semibold rounded-full ${getStatoPagamentoColor(prenotazione.stato_pagamento)}`}>
                        {getStatoPagamentoLabel(prenotazione.stato_pagamento)}
                      </span>
                      {prenotazione.email_conferma_inviata && (
                        <span className="block text-xs text-green-600">✅ Email inviata</span>
                      )}
                    </div>
                  </td>

                  {/* Azioni */}
                  <td className="px-4 py-4">
                    <div className="flex gap-1">
                      <button
                        onClick={() => router.push(`/dashboard/prenotazioni/${prenotazione.id}`)}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Dettagli"
                      >
                        👁️
                      </button>
                      <button
                        onClick={() => { setEmailPrenotazione(prenotazione); setShowEmailModal(true) }}
                        className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        title="Invia Email"
                      >
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
              <p>Nessuna prenotazione trovata per {format(new Date(meseSelezionato + '-01'), 'MMMM yyyy', { locale: it })}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-500 text-center">
        {prenotazioniFiltrate.length} prenotazioni · {format(new Date(meseSelezionato + '-01'), 'MMMM yyyy', { locale: it })}
      </div>

      {/* Modal Invio Email */}
      {showEmailModal && emailPrenotazione && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">📧 Invia Email Conferma</h2>
                <p className="text-sm text-gray-500 mt-0.5">{emailPrenotazione.codice_prenotazione}</p>
              </div>
              <button onClick={() => setShowEmailModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-sm font-semibold text-gray-900">
                  {emailPrenotazione.clienti?.nome} {emailPrenotazione.clienti?.cognome}
                </p>
                <p className="text-sm text-gray-600">{emailPrenotazione.clienti?.email}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-sm grid grid-cols-2 gap-2">
                <div><span className="text-gray-500">Data:</span><p className="font-medium">{format(new Date(emailPrenotazione.data_servizio), 'dd MMM yyyy', { locale: it })}</p></div>
                <div><span className="text-gray-500">Importo:</span><p className="font-medium">€{emailPrenotazione.prezzo_totale?.toLocaleString('it-IT')}</p></div>
              </div>
              {emailPrenotazione.email_conferma_inviata && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                  ✅ Email già inviata in precedenza
                </div>
              )}
            </div>
            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button onClick={() => setShowEmailModal(false)} disabled={sendingEmail}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white disabled:opacity-50 text-sm">
                Annulla
              </button>
              <button onClick={handleSendEmail} disabled={sendingEmail}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                {sendingEmail ? '⏳ Invio...' : '📧 Invia Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}