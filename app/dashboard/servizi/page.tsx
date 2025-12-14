'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import Image from 'next/image'

export default function ServiziPage() {
  const [servizi, setServizi] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  
  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'tour',
    descrizione: '',
    prezzo_base: 0,
    attivo: true,
    immagine_url: ''
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
      attivo: true,
      immagine_url: ''
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
      attivo: servizio.attivo,
      immagine_url: servizio.immagine_url || ''
    })
    setPrezziCategoria({
      simple: servizio.prezzi_categoria?.simple?.toString() || '',
      premium: servizio.prezzi_categoria?.premium?.toString() || '',
      luxury: servizio.prezzi_categoria?.luxury?.toString() || ''
    })
    setShowModal(true)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validazione
    if (!file.type.startsWith('image/')) {
      toast.error('Il file deve essere un\'immagine')
      return
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      toast.error('Immagine troppo grande (max 5MB)')
      return
    }

    try {
      setUploadingImage(true)

      // Nome univoco per il file
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `servizi/${fileName}`

      // Upload su Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('immagini')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Ottieni URL pubblico
      const { data: { publicUrl } } = supabase.storage
        .from('immagini')
        .getPublicUrl(filePath)

      // Aggiorna form
      setFormData(prev => ({ ...prev, immagine_url: publicUrl }))
      toast.success('Immagine caricata!')

    } catch (error: any) {
      console.error('Errore upload:', error)
      toast.error(error.message || 'Errore caricamento immagine')
    } finally {
      setUploadingImage(false)
    }
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
            attivo: formData.attivo,
            immagine_url: formData.immagine_url || null
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
            attivo: formData.attivo,
            immagine_url: formData.immagine_url || null
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
            {/* Immagine Servizio */}
            {servizio.immagine_url && (
              <div className="relative h-48 w-full bg-gray-100">
                <Image
                  src={servizio.immagine_url}
                  alt={servizio.nome}
                  fill
                  className="object-cover"
                />
              </div>
            )}

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

                {/* Prezzo Base (fallback) */}
                {!servizio.prezzi_categoria?.simple && 
                 !servizio.prezzi_categoria?.premium && 
                 !servizio.prezzi_categoria?.luxury && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-gray-700">Prezzo Base</span>
                    <span className="text-sm font-semibold text-gray-900">
                      €{servizio.prezzo_base?.toLocaleString() || 0}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 bg-white border-t border-gray-100 flex gap-2">
              <button
                onClick={() => handleEdit(servizio)}
                className="flex-1 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Modifica
              </button>
              <button
                onClick={() => handleDelete(servizio.id)}
                className="px-4 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
              >
                Elimina
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold">
                {editingId ? 'Modifica Servizio' : 'Nuovo Servizio'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Immagine */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Immagine Servizio
                </label>
                
                {formData.immagine_url ? (
                  <div className="relative">
                    <div className="relative h-48 w-full rounded-lg overflow-hidden bg-gray-100">
                      <Image
                        src={formData.immagine_url}
                        alt="Preview"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, immagine_url: '' }))}
                      className="absolute top-2 right-2 px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                    >
                      Rimuovi
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="hidden"
                      id="image-upload"
                    />
                    <label
                      htmlFor="image-upload"
                      className={`cursor-pointer ${uploadingImage ? 'opacity-50' : ''}`}
                    >
                      <div className="text-gray-600">
                        {uploadingImage ? (
                          <span>⏳ Caricamento...</span>
                        ) : (
                          <>
                            <span className="text-4xl mb-2 block">📷</span>
                            <span className="text-sm">Click per caricare immagine</span>
                            <span className="text-xs text-gray-500 block mt-1">
                              JPG, PNG, WebP (max 5MB)
                            </span>
                          </>
                        )}
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Servizio *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo Servizio *
                </label>
                <select
                  value={formData.tipo}
                  onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="tour">Tour</option>
                  <option value="locazione">Noleggio</option>
                  <option value="taxi_mare">Taxi Mare</option>
                </select>
              </div>

              {/* Descrizione */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrizione
                </label>
                <textarea
                  value={formData.descrizione}
                  onChange={(e) => setFormData(prev => ({ ...prev, descrizione: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Prezzo Base */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prezzo Base (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.prezzo_base}
                  onChange={(e) => setFormData(prev => ({ ...prev, prezzo_base: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Usato come fallback se non impostati prezzi per categoria
                </p>
              </div>

              {/* Prezzi per Categoria */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Prezzi per Categoria Imbarcazione
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Simple */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-2"></span>
                      Simple (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={prezziCategoria.simple}
                      onChange={(e) => setPrezziCategoria(prev => ({ ...prev, simple: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="0.00"
                    />
                  </div>

                  {/* Premium */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-yellow-500 mr-2"></span>
                      Premium (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={prezziCategoria.premium}
                      onChange={(e) => setPrezziCategoria(prev => ({ ...prev, premium: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                      placeholder="0.00"
                    />
                  </div>

                  {/* Luxury */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-purple-500 mr-2"></span>
                      Luxury (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={prezziCategoria.luxury}
                      onChange={(e) => setPrezziCategoria(prev => ({ ...prev, luxury: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="0.00"
                    />
                  </div>
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
                  Servizio attivo
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
                  {editingId ? 'Salva Modifiche' : 'Crea Servizio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}