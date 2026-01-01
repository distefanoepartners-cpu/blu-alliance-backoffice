'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface Fornitore {
  id: string
  ragione_sociale: string
  email?: string
  telefono?: string
  partita_iva?: string
  codice_fiscale?: string
  indirizzo?: string
  citta?: string
  cap?: string
  provincia?: string
  attivo: boolean
  created_at?: string
  imbarcazioni?: any[]
}

export default function FornitoriPage() {
  const [loading, setLoading] = useState(true)
  const [fornitori, setFornitori] = useState<Fornitore[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  const [formData, setFormData] = useState<Fornitore>({
    id: '',
    ragione_sociale: '',
    email: '',
    telefono: '',
    partita_iva: '',
    codice_fiscale: '',
    indirizzo: '',
    citta: '',
    cap: '',
    provincia: '',
    attivo: true
  })

  useEffect(() => {
    loadFornitori()
  }, [])

  async function loadFornitori() {
    try {
      setLoading(true)

      // 🔧 QUERY CORRETTA con foreign key name
      const { data, error } = await supabase
        .from('fornitori')
        .select(`
          id,
          ragione_sociale,
          email,
          telefono,
          partita_iva,
          codice_fiscale,
          indirizzo,
          citta,
          cap,
          provincia,
          attivo,
          created_at,
          imbarcazioni(
            id,
            nome,
            tipo,
            categoria,
            prenotazioni!prenotazioni_imbarcazione_id_fkey(
              id,
              prezzo_totale,
              caparra_ricevuta,
              saldo_ricevuto,
              stato,
              data_servizio
            )
          )
        `)
        .order('ragione_sociale')

      if (error) throw error

      setFornitori(data || [])
    } catch (error: any) {
      console.error('Errore:', error)
      toast.error('Errore nel caricamento dei fornitori')
    } finally {
      setLoading(false)
    }
  }

  function handleNew() {
    setEditingId(null)
    setFormData({
      id: '',
      ragione_sociale: '',
      email: '',
      telefono: '',
      partita_iva: '',
      codice_fiscale: '',
      indirizzo: '',
      citta: '',
      cap: '',
      provincia: '',
      attivo: true
    })
    setShowModal(true)
  }

  function handleEdit(fornitore: Fornitore) {
    setEditingId(fornitore.id)
    setFormData({
      id: fornitore.id,
      ragione_sociale: fornitore.ragione_sociale,
      email: fornitore.email || '',
      telefono: fornitore.telefono || '',
      partita_iva: fornitore.partita_iva || '',
      codice_fiscale: fornitore.codice_fiscale || '',
      indirizzo: fornitore.indirizzo || '',
      citta: fornitore.citta || '',
      cap: fornitore.cap || '',
      provincia: fornitore.provincia || '',
      attivo: fornitore.attivo
    })
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      if (editingId) {
        // Update
        const { error } = await supabase
          .from('fornitori')
          .update({
            ragione_sociale: formData.ragione_sociale,
            email: formData.email || null,
            telefono: formData.telefono || null,
            partita_iva: formData.partita_iva || null,
            codice_fiscale: formData.codice_fiscale || null,
            indirizzo: formData.indirizzo || null,
            citta: formData.citta || null,
            cap: formData.cap || null,
            provincia: formData.provincia || null,
            attivo: formData.attivo
          })
          .eq('id', editingId)

        if (error) throw error
        toast.success('Fornitore aggiornato!')
      } else {
        // Create
        const { error } = await supabase
          .from('fornitori')
          .insert([{
            ragione_sociale: formData.ragione_sociale,
            email: formData.email || null,
            telefono: formData.telefono || null,
            partita_iva: formData.partita_iva || null,
            codice_fiscale: formData.codice_fiscale || null,
            indirizzo: formData.indirizzo || null,
            citta: formData.citta || null,
            cap: formData.cap || null,
            provincia: formData.provincia || null,
            attivo: formData.attivo
          }])

        if (error) throw error
        toast.success('Fornitore creato!')
      }

      setShowModal(false)
      loadFornitori()
    } catch (error: any) {
      console.error('Errore salvataggio:', error)
      toast.error(error.message || 'Errore nel salvataggio')
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase
        .from('fornitori')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Fornitore eliminato!')
      setShowDeleteConfirm(null)
      loadFornitori()
    } catch (error: any) {
      console.error('Errore eliminazione:', error)
      toast.error('Errore nell\'eliminazione')
    }
  }

  function calcolaStatistiche(fornitore: Fornitore) {
    const imbarcazioni = fornitore.imbarcazioni || []
    
    const prenotazioniValide = imbarcazioni.flatMap(imb => 
      (imb.prenotazioni || []).filter((p: any) => p.stato !== 'cancellata')
    )

    const totaleRevenue = prenotazioniValide.reduce((sum, p: any) => 
      sum + (parseFloat(p.prezzo_totale) || 0), 0
    )

    const totaleIncassato = prenotazioniValide.reduce((sum, p: any) => 
      sum + (parseFloat(p.caparra_ricevuta) || 0) + (parseFloat(p.saldo_ricevuto) || 0), 0
    )

    const daIncassare = totaleRevenue - totaleIncassato

    return {
      numImbarcazioni: imbarcazioni.length,
      numPrenotazioni: prenotazioniValide.length,
      totaleRevenue,
      totaleIncassato,
      daIncassare,
      percentualeIncassato: totaleRevenue > 0 ? (totaleIncassato / totaleRevenue * 100) : 0
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-gray-600">Caricamento fornitori...</div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Fornitori</h1>
          <p className="text-gray-600 mt-1">Gestione fornitori e statistiche performance</p>
        </div>
        <button
          onClick={handleNew}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Nuovo Fornitore
        </button>
      </div>

      {/* Lista Fornitori */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {fornitori.map((fornitore) => {
          const stats = calcolaStatistiche(fornitore)

          return (
            <div 
              key={fornitore.id} 
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              {/* Header Card */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-xl font-bold text-gray-900">
                    {fornitore.ragione_sociale}
                  </h3>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    fornitore.attivo 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {fornitore.attivo ? 'Attivo' : 'Inattivo'}
                  </span>
                </div>
                
                {fornitore.email && (
                  <p className="text-sm text-gray-600 mt-1">📧 {fornitore.email}</p>
                )}
                {fornitore.telefono && (
                  <p className="text-sm text-gray-600">📱 {fornitore.telefono}</p>
                )}
                {fornitore.partita_iva && (
                  <p className="text-sm text-gray-600">P.IVA: {fornitore.partita_iva}</p>
                )}
              </div>

              {/* Statistiche */}
              <div className="p-6 bg-gray-50">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Imbarcazioni</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {stats.numImbarcazioni}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Prenotazioni</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {stats.numPrenotazioni}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Revenue Totale</span>
                    <span className="font-semibold text-gray-900">
                      €{stats.totaleRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Incassato</span>
                    <span className="font-semibold text-green-600">
                      €{stats.totaleIncassato.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Da Incassare</span>
                    <span className="font-semibold text-orange-600">
                      €{stats.daIncassare.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Incasso</span>
                    <span>{stats.percentualeIncassato.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(stats.percentualeIncassato, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 bg-white border-t border-gray-100 flex gap-2">
                <button
                  onClick={() => handleEdit(fornitore)}
                  className="flex-1 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Modifica
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(fornitore.id)}
                  className="px-4 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                >
                  Elimina
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* No Results */}
      {fornitori.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">Nessun fornitore trovato.</p>
          <button
            onClick={handleNew}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Aggiungi Primo Fornitore
          </button>
        </div>
      )}

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold">
                {editingId ? 'Modifica Fornitore' : 'Nuovo Fornitore'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Ragione Sociale */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ragione Sociale *
                </label>
                <input
                  type="text"
                  value={formData.ragione_sociale}
                  onChange={(e) => setFormData(prev => ({ ...prev, ragione_sociale: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Email e Telefono */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefono
                  </label>
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => setFormData(prev => ({ ...prev, telefono: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* P.IVA e Codice Fiscale */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Partita IVA
                  </label>
                  <input
                    type="text"
                    value={formData.partita_iva}
                    onChange={(e) => setFormData(prev => ({ ...prev, partita_iva: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Codice Fiscale
                  </label>
                  <input
                    type="text"
                    value={formData.codice_fiscale}
                    onChange={(e) => setFormData(prev => ({ ...prev, codice_fiscale: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Indirizzo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Indirizzo
                </label>
                <input
                  type="text"
                  value={formData.indirizzo}
                  onChange={(e) => setFormData(prev => ({ ...prev, indirizzo: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Città, CAP, Provincia */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Città
                  </label>
                  <input
                    type="text"
                    value={formData.citta}
                    onChange={(e) => setFormData(prev => ({ ...prev, citta: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CAP
                  </label>
                  <input
                    type="text"
                    value={formData.cap}
                    onChange={(e) => setFormData(prev => ({ ...prev, cap: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    maxLength={5}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Provincia
                  </label>
                  <input
                    type="text"
                    value={formData.provincia}
                    onChange={(e) => setFormData(prev => ({ ...prev, provincia: e.target.value.toUpperCase() }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    maxLength={2}
                  />
                </div>
              </div>

              {/* Attivo */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.attivo}
                  onChange={(e) => setFormData(prev => ({ ...prev, attivo: e.target.checked }))}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label className="text-sm font-medium text-gray-700">
                  Fornitore attivo
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingId ? 'Salva Modifiche' : 'Crea Fornitore'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Conferma Eliminazione
            </h3>
            <p className="text-gray-600 mb-6">
              Sei sicuro di voler eliminare questo fornitore? Questa azione non può essere annullata.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Annulla
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}