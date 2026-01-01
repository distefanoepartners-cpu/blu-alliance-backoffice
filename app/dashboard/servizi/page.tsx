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
    immagine_url: '',
    durata_ore: 0,
    durata_minuti: 0,
    luogo_imbarco: '',
    ora_imbarco: ''
  })

  const [prezziCategoria, setPrezziCategoria] = useState({
    simple: '',
    premium: '',
    luxury: ''
  })

  // Lista porti d'imbarco
  const portiImbarco = [
    'Salerno',
    'Amalfi',
    'Positano',
    'Cetara',
    'Maiori',
    'Minori',
    'Vietri sul Mare'
  ]

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
      immagine_url: '',
      durata_ore: 0,
      durata_minuti: 0,
      luogo_imbarco: '',
      ora_imbarco: ''
    })
    setPrezziCategoria({
      simple: '',
      premium: '',
      luxury: ''
    })
    setShowModal(true)
  }

  function handleEdit(servizio: any) {
    // Converti durata_minuti in ore e minuti
    const totMinuti = servizio.durata_minuti || 0
    const ore = Math.floor(totMinuti / 60)
    const minuti = totMinuti % 60
    
    setEditingId(servizio.id)
    setFormData({
      nome: servizio.nome,
      tipo: servizio.tipo,
      descrizione: servizio.descrizione || '',
      prezzo_base: servizio.prezzo_base || 0,
      attivo: servizio.attivo,
      immagine_url: servizio.immagine_url || '',
      durata_ore: ore,
      durata_minuti: minuti,
      luogo_imbarco: servizio.luogo_imbarco || '',
      ora_imbarco: servizio.ora_imbarco || ''
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

    if (file.size > 5 * 1024 * 1024) {
      toast.error('L\'immagine deve essere massimo 5MB')
      return
    }

    setUploadingImage(true)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `servizi/${fileName}`

      const { error: uploadError, data } = await supabase.storage
        .from('immagini')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('immagini')
        .getPublicUrl(filePath)

      setFormData(prev => ({ ...prev, immagine_url: publicUrl }))
      toast.success('Immagine caricata!')
    } catch (error: any) {
      console.error('Errore upload:', error)
      toast.error('Errore nel caricamento immagine')
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      // Converti ore e minuti in totale minuti
      const durataMinutiTotali = (formData.durata_ore * 60) + formData.durata_minuti

      const dataToSave = {
        nome: formData.nome,
        tipo: formData.tipo,
        descrizione: formData.descrizione,
        prezzo_base: formData.prezzo_base,
        attivo: formData.attivo,
        immagine_url: formData.immagine_url,
        durata_minuti: durataMinutiTotali,
        luogo_imbarco: formData.luogo_imbarco,
        ora_imbarco: formData.ora_imbarco || null
      }

      if (editingId) {
        // Update
        const { error } = await supabase
          .from('servizi')
          .update(dataToSave)
          .eq('id', editingId)

        if (error) throw error

        // Aggiorna prezzi categoria
        await updatePrezziCategoria(editingId)

        toast.success('Servizio aggiornato!')
      } else {
        // Insert
        const { data, error } = await supabase
          .from('servizi')
          .insert([dataToSave])
          .select()
          .single()

        if (error) throw error

        // Inserisci prezzi categoria
        await updatePrezziCategoria(data.id)

        toast.success('Servizio creato!')
      }

      setShowModal(false)
      loadData()
    } catch (error: any) {
      console.error('Errore:', error)
      toast.error(error.message || 'Errore nel salvataggio')
    }
  }

  async function updatePrezziCategoria(servizioId: string) {
    try {
      // Elimina prezzi esistenti
      await supabase
        .from('servizi_prezzi_categoria')
        .delete()
        .eq('servizio_id', servizioId)

      // Inserisci nuovi prezzi se valorizzati
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
    } catch (error) {
      console.error('Errore aggiornamento prezzi:', error)
      throw error
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
      console.error('Errore:', error)
      toast.error('Errore nell\'eliminazione')
    }
  }

  // Helper per formattare durata
  function formatDurata(minuti: number): string {
    if (!minuti) return '-'
    const ore = Math.floor(minuti / 60)
    const min = minuti % 60
    if (ore > 0 && min > 0) return `${ore}h ${min}m`
    if (ore > 0) return `${ore}h`
    return `${min}m`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Caricamento...</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Servizi</h1>
          <p className="text-gray-600 mt-1">Gestisci tour e servizi offerti</p>
        </div>
        <button
          onClick={handleNew}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          + Nuovo Servizio
        </button>
      </div>

      {/* Lista Servizi */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {servizi.map(servizio => (
          <div key={servizio.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
            {/* Immagine */}
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

            <div className="p-6">
              {/* Badge tipo */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  servizio.tipo === 'tour' ? 'bg-blue-100 text-blue-700' :
                  servizio.tipo === 'locazione' ? 'bg-green-100 text-green-700' :
                  'bg-purple-100 text-purple-700'
                }`}>
                  {servizio.tipo === 'tour' ? 'Tour' : servizio.tipo === 'locazione' ? 'Noleggio' : 'Taxi Mare'}
                </span>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  servizio.attivo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {servizio.attivo ? 'Attivo' : 'Inattivo'}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {servizio.nome}
              </h3>

              {servizio.descrizione && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {servizio.descrizione}
                </p>
              )}

              {/* Durata */}
              {servizio.durata_minuti > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                  <span>⏱</span>
                  <span>{formatDurata(servizio.durata_minuti)}</span>
                </div>
              )}

              {/* Luogo imbarco */}
              {servizio.luogo_imbarco && (
                <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                  <span>📍</span>
                  <span>{servizio.luogo_imbarco}</span>
                </div>
              )}

              {/* Orario imbarco */}
              {servizio.ora_imbarco && (
                <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                  <span>🕐</span>
                  <span>{servizio.ora_imbarco}</span>
                </div>
              )}

              {/* Prezzi per Categoria */}
              <div className="border-t border-gray-100 pt-4 mt-4">
                <h4 className="text-xs font-semibold text-gray-700 mb-2">Prezzi per Categoria</h4>
                <div className="space-y-1">
                  {servizio.prezzi_categoria.simple && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-green-500"></span>
                        Simple
                      </span>
                      <span className="font-semibold">€{servizio.prezzi_categoria.simple}</span>
                    </div>
                  )}
                  {servizio.prezzi_categoria.premium && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                        Premium
                      </span>
                      <span className="font-semibold">€{servizio.prezzi_categoria.premium}</span>
                    </div>
                  )}
                  {servizio.prezzi_categoria.luxury && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                        Luxury
                      </span>
                      <span className="font-semibold">€{servizio.prezzi_categoria.luxury}</span>
                    </div>
                  )}
                  {!servizio.prezzi_categoria.simple && !servizio.prezzi_categoria.premium && !servizio.prezzi_categoria.luxury && (
                    <div className="text-sm text-gray-600">
                      Prezzo base: €{servizio.prezzo_base || 0}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleEdit(servizio)}
                  className="flex-1 px-4 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
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
                  <option value="tour_collettivo">Tour Collettivo</option>
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

              {/* Durata - Ore e Minuti */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Durata
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Ore</label>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={formData.durata_ore}
                      onChange={(e) => setFormData(prev => ({ ...prev, durata_ore: parseInt(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Minuti</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={formData.durata_minuti}
                      onChange={(e) => setFormData(prev => ({ ...prev, durata_minuti: parseInt(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Esempio: 7 ore 30 minuti
                </p>
              </div>

              {/* Luogo d'Imbarco */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Luogo d'Imbarco
                </label>
                <select
                  value={formData.luogo_imbarco}
                  onChange={(e) => setFormData(prev => ({ ...prev, luogo_imbarco: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleziona porto...</option>
                  {portiImbarco.map(porto => (
                    <option key={porto} value={porto}>{porto}</option>
                  ))}
                </select>
              </div>

              {/* Orario d'Imbarco */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Orario d'Imbarco
                </label>
                <input
                  type="time"
                  value={formData.ora_imbarco}
                  onChange={(e) => setFormData(prev => ({ ...prev, ora_imbarco: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Formato 24h (es. 09:00, 14:30)
                </p>
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
                  id="attivo"
                  checked={formData.attivo}
                  onChange={(e) => setFormData(prev => ({ ...prev, attivo: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="attivo" className="text-sm font-medium text-gray-700">
                  Servizio attivo
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingId ? 'Aggiorna' : 'Crea'} Servizio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}