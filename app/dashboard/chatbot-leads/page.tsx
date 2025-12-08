'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import toast from 'react-hot-toast'

export default function ChatbotLeadsPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [filteredLeads, setFilteredLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroStato, setFiltroStato] = useState('tutti')
  const [showModal, setShowModal] = useState(false)
  const [selectedLead, setSelectedLead] = useState<any>(null)

  useEffect(() => {
    loadLeads()
  }, [])

  useEffect(() => {
    applicaFiltri()
  }, [leads, searchTerm, filtroStato])

  async function loadLeads() {
    try {
      const { data, error } = await supabase
        .from('chatbot_leads')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setLeads(data || [])
    } catch (error: any) {
      toast.error('Errore nel caricamento dei lead')
      console.error('Errore:', error)
    } finally {
      setLoading(false)
    }
  }

  function applicaFiltri() {
    let risultati = [...leads]

    if (searchTerm) {
      risultati = risultati.filter(lead =>
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.cognome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.servizio_interesse?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (filtroStato !== 'tutti') {
      risultati = risultati.filter(lead => lead.stato === filtroStato)
    }

    setFilteredLeads(risultati)
  }

  async function handleCambiaStato(id: string, nuovoStato: string) {
    try {
      const updates: any = { stato: nuovoStato }

      if (nuovoStato === 'contattato' && !leads.find(l => l.id === id)?.contattato_at) {
        updates.contattato_at = new Date().toISOString()
      }

      if (nuovoStato === 'convertito') {
        updates.convertito_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('chatbot_leads')
        .update(updates)
        .eq('id', id)

      if (error) throw error

      toast.success('Stato aggiornato!')
      loadLeads()
    } catch (error: any) {
      toast.error('Errore nell\'aggiornamento')
      console.error('Errore:', error)
    }
  }

  async function handleAggiungiNote(id: string, note: string) {
    try {
      const { error } = await supabase
        .from('chatbot_leads')
        .update({ 
          note_admin: note,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error

      toast.success('Note salvate!')
      setShowModal(false)
      loadLeads()
    } catch (error: any) {
      toast.error('Errore nel salvataggio note')
      console.error('Errore:', error)
    }
  }

  function getStatoColor(stato: string) {
    switch (stato) {
      case 'nuovo': return 'bg-blue-100 text-blue-800'
      case 'contattato': return 'bg-yellow-100 text-yellow-800'
      case 'convertito': return 'bg-green-100 text-green-800'
      case 'perso': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  function getStatoLabel(stato: string) {
    const labels: Record<string, string> = {
      'nuovo': 'Nuovo',
      'contattato': 'Contattato',
      'convertito': 'Convertito',
      'perso': 'Perso'
    }
    return labels[stato] || stato
  }

  function openDetailModal(lead: any) {
    setSelectedLead(lead)
    setShowModal(true)
  }

  function esportaCSV() {
    const headers = ['Data', 'Nome', 'Cognome', 'Email', 'Telefono', 'Persone', 'Data Desiderata', 'Servizio', 'Messaggio', 'Stato']
    const rows = filteredLeads.map(l => [
      format(new Date(l.created_at), 'dd/MM/yyyy HH:mm'),
      l.nome || '',
      l.cognome || '',
      l.email,
      l.telefono || '',
      l.numero_persone || '',
      l.data_desiderata ? format(new Date(l.data_desiderata), 'dd/MM/yyyy') : '',
      l.servizio_interesse || '',
      l.messaggio || '',
      getStatoLabel(l.stato)
    ])

    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `chatbot-leads-${format(new Date(), 'yyyy-MM-dd')}.csv`
    link.click()
    toast.success('CSV esportato!')
  }

  if (loading) {
    return <div className="p-8"><div className="text-gray-600">Caricamento...</div></div>
  }

  // Statistiche
  const stats = {
    totale: leads.length,
    nuovi: leads.filter(l => l.stato === 'nuovo').length,
    contattati: leads.filter(l => l.stato === 'contattato').length,
    convertiti: leads.filter(l => l.stato === 'convertito').length,
    tassoConversione: leads.length > 0 
      ? ((leads.filter(l => l.stato === 'convertito').length / leads.length) * 100).toFixed(1)
      : '0'
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Lead Chatbot AI</h1>
          <p className="text-gray-600 mt-1">
            {filteredLeads.length} lead trovati
          </p>
        </div>
        <button
          onClick={esportaCSV}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          📥 Esporta CSV
        </button>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-600">Totale Lead</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totale}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-600">Nuovi</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.nuovi}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-600">Contattati</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.contattati}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-600">Convertiti</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.convertiti}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-600">Tasso Conv.</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{stats.tassoConversione}%</p>
        </div>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cerca</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nome, email, servizio..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Stato</label>
            <select
              value={filtroStato}
              onChange={(e) => setFiltroStato(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="tutti">Tutti</option>
              <option value="nuovo">Nuovi</option>
              <option value="contattato">Contattati</option>
              <option value="convertito">Convertiti</option>
              <option value="perso">Persi</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabella Lead */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Contatto</th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Dettagli</th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stato</th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="text-4xl mb-3">🤖</div>
                    <p>Nessun lead trovato</p>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-3 md:px-6 py-4 whitespace-nowrap text-xs md:text-sm text-gray-600">
                      {format(new Date(lead.created_at), 'dd MMM yyyy', { locale: it })}
                      <div className="text-xs text-gray-400">
                        {format(new Date(lead.created_at), 'HH:mm')}
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                      <div className="text-xs md:text-sm">
                        <div className="font-medium text-gray-900">
                          {lead.nome} {lead.cognome}
                        </div>
                        <div className="text-gray-500 text-xs">{lead.email}</div>
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-4 whitespace-nowrap text-xs md:text-sm text-gray-600 hidden md:table-cell">
                      {lead.telefono || '-'}
                    </td>
                    <td className="px-3 md:px-6 py-4 text-xs md:text-sm text-gray-600 hidden md:table-cell">
                      <div>
                        {lead.numero_persone && <div>👥 {lead.numero_persone} persone</div>}
                        {lead.data_desiderata && (
                          <div>📅 {format(new Date(lead.data_desiderata), 'dd/MM/yyyy')}</div>
                        )}
                        {lead.servizio_interesse && (
                          <div className="text-xs text-blue-600">🚤 {lead.servizio_interesse}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                      <select
                        value={lead.stato}
                        onChange={(e) => handleCambiaStato(lead.id, e.target.value)}
                        className={`px-2 md:px-3 py-1 text-xs font-semibold rounded-full border-0 cursor-pointer ${getStatoColor(lead.stato)}`}
                      >
                        <option value="nuovo">Nuovo</option>
                        <option value="contattato">Contattato</option>
                        <option value="convertito">Convertito</option>
                        <option value="perso">Perso</option>
                      </select>
                    </td>
                    <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => openDetailModal(lead)}
                        className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Dettagli
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dettagli Lead */}
      {showModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Dettagli Lead</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {format(new Date(selectedLead.created_at), 'dd MMMM yyyy - HH:mm', { locale: it })}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Info Cliente */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">👤 Informazioni Cliente</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Nome:</span>
                    <span className="ml-2 font-medium">{selectedLead.nome} {selectedLead.cognome}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Email:</span>
                    <span className="ml-2 font-medium">{selectedLead.email}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Telefono:</span>
                    <span className="ml-2 font-medium">{selectedLead.telefono || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Stato:</span>
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs font-semibold ${getStatoColor(selectedLead.stato)}`}>
                      {getStatoLabel(selectedLead.stato)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dettagli Richiesta */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">🚤 Dettagli Richiesta</h3>
                <div className="space-y-2 text-sm">
                  {selectedLead.numero_persone && (
                    <div>
                      <span className="text-gray-600">Numero Persone:</span>
                      <span className="ml-2 font-medium">{selectedLead.numero_persone}</span>
                    </div>
                  )}
                  {selectedLead.data_desiderata && (
                    <div>
                      <span className="text-gray-600">Data Desiderata:</span>
                      <span className="ml-2 font-medium">
                        {format(new Date(selectedLead.data_desiderata), 'dd MMMM yyyy', { locale: it })}
                      </span>
                    </div>
                  )}
                  {selectedLead.servizio_interesse && (
                    <div>
                      <span className="text-gray-600">Servizio:</span>
                      <span className="ml-2 font-medium">{selectedLead.servizio_interesse}</span>
                    </div>
                  )}
                  {selectedLead.messaggio && (
                    <div>
                      <span className="text-gray-600">Messaggio:</span>
                      <p className="mt-1 text-gray-700 bg-white p-3 rounded border">
                        {selectedLead.messaggio}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Conversazione */}
              {selectedLead.conversazione_json && (
                <div className="bg-purple-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">💬 Conversazione Chatbot</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {Array.isArray(selectedLead.conversazione_json) && selectedLead.conversazione_json.map((msg: any, idx: number) => (
                      <div key={idx} className={`p-2 rounded text-sm ${msg.role === 'user' ? 'bg-white text-gray-900' : 'bg-purple-100 text-gray-700'}`}>
                        <span className="font-semibold">{msg.role === 'user' ? 'Cliente' : 'Bot'}:</span> {msg.content}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Note Admin */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">📝 Note Interne</label>
                <textarea
                  defaultValue={selectedLead.note_admin || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Aggiungi note su questo lead..."
                  id="note-admin"
                />
                <button
                  onClick={() => {
                    const note = (document.getElementById('note-admin') as HTMLTextAreaElement).value
                    handleAggiungiNote(selectedLead.id, note)
                  }}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Salva Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}