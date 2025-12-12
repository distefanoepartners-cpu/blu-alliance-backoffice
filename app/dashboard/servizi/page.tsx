'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function ServiziPage() {
  const [servizi, setServizi] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'tour',
    descrizione: '',
    prezzo_base: 0,
    attivo: true
  })

  const [prezziCategoria, setPrezziCategoria] = useState({
    simple: '',
    premium: '',
    luxury: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)

      // Carica servizi
      const { data: serviziData, error: serviziError } = await supabase
        .from('servizi')
        .select('*')
        .order('nome')

      if (serviziError) throw serviziError

      // Carica prezzi per categoria
      const { data: prezziData, error: prezziError } = await supabase
        .from('servizi_prezzi_categoria')
        .select('*')

      if (prezziError) throw prezziError

      // Combina dati
      const serviziConPrezzi = (serviziData || []).map(servizio => {
        const prezzi = (prezziData || []).filter(p => p.servizio_id === servizio.id)
        return {
          ...servizio,
          prezzi_categoria: {
            simple: prezzi.find(p => p.categoria === 'simple')?.prezzo || null,
            premium: prezzi.find(p => p.categoria === 'premium')?.prezzo || null,
            luxury: prezzi.find(p => p.categoria === 'luxury')?.prezzo || null
          }
        }
      })

      setServizi(serviziConPrezzi)
    } catch (error) {
      console.error('Errore:', error)
      toast.error('Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }

  function handleNew() {
    setEditingId(null)
    setFormData({
      nome: '',
      tipo: 'tour',
      descrizione: '',
      prezzo_base: 0,
      attivo: true
    })
    setPrezziCategoria({
      simple: '',
      premium: '',
      luxury: ''
    })
    setShowModal(true)
  }

  function handleEdit(servizio: any) {
    setEditingId(servizio.id)
    setFormData({
      nome: servizio.nome,
      tipo: servizio.tipo,
      descrizione: servizio.descrizione || '',
      prezzo_base: servizio.prezzo_base || 0,
      attivo: servizio.attivo
    })
    setPrezziCategoria({
      simple: servizio.prezzi_categoria?.simple?.toString() || '',
      premium: servizio.prezzi_categoria?.premium?.toString() || '',
      luxury: servizio.prezzi_categoria?.luxury?.toString() || ''
    })
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      if (editingId) {
        // Update servizio
        const { error: servizioError } = await supabase
          .from('servizi')
          .update({
            nome: formData.nome,
            tipo: formData.tipo,
            descrizione: formData.descrizione,
            prezzo_base: formData.prezzo_base,
            attivo: formData.attivo
          })
          .eq('id', editingId)

        if (servizioError) throw servizioError

        // Update prezzi categoria
        await salvaPrezziCategoria(editingId)

        toast.success('Servizio aggiornato!')
      } else {
        // Create servizio
        const { data: newServizio, error: servizioError } = await supabase
          .from('servizi')
          .insert([{
            nome: formData.nome,
            tipo: formData.tipo,
            descrizione: formData.descrizione,
            prezzo_base: formData.prezzo_base,
            attivo: formData.attivo
          }])
          .select()
          .single()

        if (servizioError) throw servizioError

        // Insert prezzi categoria
        await salvaPrezziCategoria(newServizio.id)

        toast.success('Servizio creato!')
      }

      setShowModal(false)
      loadData()
    } catch (error: any) {
      console.error('Errore salvataggio:', error)
      toast.error(error.message || 'Errore nel salvataggio')
    }
  }

  async function salvaPrezziCategoria(servizioId: string) {
    // Elimina prezzi esistenti
    await supabase
      .from('servizi_prezzi_categoria')
      .delete()
      .eq('servizio_id', servizioId)

    // Inserisci nuovi prezzi (solo se compilati)
    const prezziDaInserire = []

    if (prezziCategoria.simple && parseFloat(prezziCategoria.simple) > 0) {
      prezziDaInserire.push({
        servizio_id: servizioId,
        categoria: 'simple',
        prezzo: parseFloat(prezziCategoria.simple)
      })
    }

    if (prezziCategoria.premium && parseFloat(prezziCategoria.premium) > 0) {
      prezziDaInserire.push({
        servizio_id: servizioId,
        categoria: 'premium',
        prezzo: parseFloat(prezziCategoria.premium)
      })
    }

    if (prezziCategoria.luxury && parseFloat(prezziCategoria.luxury) > 0) {
      prezziDaInserire.push({
        servizio_id: servizioId,
        categoria: 'luxury',
        prezzo: parseFloat(prezziCategoria.luxury)
      })
    }

    if (prezziDaInserire.length > 0) {
      const { error } = await supabase
        .from('servizi_prezzi_categoria')
        .insert(prezziDaInserire)

      if (error) throw error
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Sei sicuro di voler eliminare questo servizio?')) return

    try {
      const { error } = await supabase
        .from('servizi')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Servizio eliminato!')
      loadData()
    } catch (error: any) {
      console.error('Errore eliminazione:', error)
      toast.error('Errore nell\'eliminazione')
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-gray-600">Caricamento servizi...</div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Servizi</h1>
          <p className="text-gray-600 mt-1">Gestisci tour e servizi offerti</p>
        </div>
        <button
          onClick={handleNew}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Nuovo Servizio
        </button>
      </div>

      {/* Lista Servizi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {servizi.map((servizio) => (
          <div key={servizio.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header Card */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-xl font-bold text-gray-900">{servizio.nome}</h3>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  servizio.attivo 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {servizio.attivo ? 'Attivo' : 'Inattivo'}
                </span>
              </div>
              <p className="text-sm text-gray-500 capitalize">{servizio.tipo}</p>
              {servizio.descrizione && (
                <p className="text-sm text-gray-600 mt-3 line-clamp-2">
                  {servizio.descrizione}
                </p>
              )}
            </div>

            {/* Prezzi per Categoria */}
            <div className="p-6 bg-gray-50">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Prezzi per Categoria</h4>
              <div className="space-y-2">
                {/* Simple */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    <span className="text-sm text-gray-700">Simple</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {servizio.prezzi_categoria?.simple 
                      ? `€${servizio.prezzi_categoria.simple.toLocaleString()}` 
                      : '-'}
                  </span>
                </div>

                {/* Premium */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                    <span className="text-sm text-gray-700">Premium</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {servizio.prezzi_categoria?.premium 
                      ? `€${servizio.prezzi_categoria.premium.toLocaleString()}` 
                      : '-'}
                  </span>
                </div>

                {/* Luxury */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                    <span className="text-sm text-gray-700">Luxury</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {servizio.prezzi_categoria?.luxury 
                      ? `€${servizio.prezzi_categoria.luxury.toLocaleString()}` 
                      : '-'}
                  </span>
                </div>
              </div>

              {/* Prezzo Base Fallback */}
              {servizio.prezzo_base > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Prezzo base</span>
                    <span className="text-xs text-gray-500">€{servizio.prezzo_base.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 bg-white border-t border-gray-100 flex gap-2">
              <button
                onClick={() => handleEdit(servizio)}
                className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm font-medium"
              >
                Modifica
              </button>
              <button
                onClick={() => handleDelete(servizio.id)}
                className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium"
              >
                Elimina
              </button>
            </div>
          </div>
        ))}
      </div>

      {servizi.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
          <div className="text-4xl mb-3">🎯</div>
          <p className="text-gray-500 mb-4">Nessun servizio configurato</p>
          <button
            onClick={handleNew}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Crea il Primo Servizio
          </button>
        </div>
      )}

      {/* Modal Crea/Modifica */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full my-8">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingId ? 'Modifica Servizio' : 'Nuovo Servizio'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Info Base */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Es: Tour Capri"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="tour">Tour</option>
                    <option value="noleggio">Noleggio</option>
                    <option value="escursione">Escursione</option>
                    <option value="altro">Altro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione</label>
                <textarea
                  value={formData.descrizione}
                  onChange={(e) => setFormData({ ...formData, descrizione: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Descrizione del servizio..."
                />
              </div>

              {/* Prezzi per Categoria */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Prezzi per Categoria Barca</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Imposta i prezzi in base alla categoria della barca scelta dal cliente.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Simple */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      Simple
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                      <input
                        type="number"
                        step="0.01"
                        value={prezziCategoria.simple}
                        onChange={(e) => setPrezziCategoria({ ...prezziCategoria, simple: e.target.value })}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="600"
                      />
                    </div>
                  </div>

                  {/* Premium */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                      Premium
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                      <input
                        type="number"
                        step="0.01"
                        value={prezziCategoria.premium}
                        onChange={(e) => setPrezziCategoria({ ...prezziCategoria, premium: e.target.value })}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="900"
                      />
                    </div>
                  </div>

                  {/* Luxury */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                      Luxury
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                      <input
                        type="number"
                        step="0.01"
                        value={prezziCategoria.luxury}
                        onChange={(e) => setPrezziCategoria({ ...prezziCategoria, luxury: e.target.value })}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="1500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Prezzo Base */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prezzo Base (Fallback)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.prezzo_base}
                    onChange={(e) => setFormData({ ...formData, prezzo_base: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="0"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Usato solo se non è impostato un prezzo per la categoria
                </p>
              </div>

              {/* Attivo */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="attivo"
                  checked={formData.attivo}
                  onChange={(e) => setFormData({ ...formData, attivo: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="attivo" className="text-sm font-medium text-gray-700">
                  Servizio attivo
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingId ? 'Aggiorna' : 'Crea Servizio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}