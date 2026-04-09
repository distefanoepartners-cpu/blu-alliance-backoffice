'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import Image from 'next/image'

export default function ImbarcazioniPage() {
  const [imbarcazioni, setImbarcazioni] = useState<any[]>([])
  const [imbarcazioniFiltrate, setImbarcazioniFiltrate] = useState<any[]>([])
  const [fornitori, setFornitori] = useState<any[]>([])
  const [servizi, setServizi] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showServiziModal, setShowServiziModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedImbarcazione, setSelectedImbarcazione] = useState<any>(null)
  const [serviziSelezionati, setServiziSelezionati] = useState<{[key: string]: boolean}>({})
  // Prezzi specifici per barca, per servizio
  const [prezziServizi, setPrezziServizi] = useState<{[key: string]: number | string}>({})
  const [uploadingImage, setUploadingImage] = useState(false)
  const [filtroFornitore, setFiltroFornitore] = useState<string>('tutti')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('tutti')
  const [searchTerm, setSearchTerm] = useState('')

  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'gommone',
    categoria: 'simple',
    capacita_massima: 6,
    descrizione: '',
    caratteristiche: '',
    immagine_principale: '',
    fornitore_id: '',
    attiva: true
  })

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // 🆕 FUNZIONE HELPER: Converti tipo DB in label visualizzato
  const getTipoLabel = (tipo: string): string => {
    const labels: {[key: string]: string} = {
      'gommone': 'Gommone',
      'barca': 'Barca',
      'barca_vela': 'Barca a Vela',
      'yacht': 'Yacht',
      'catamarano': 'Catamarano',
      'gozzo': 'Gozzo'
    }
    return labels[tipo] || tipo
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    applicaFiltri()
  }, [imbarcazioni, filtroFornitore, filtroCategoria, searchTerm])

  async function loadData() {
    try {
      setLoading(true)

      // Carica fornitori
      const { data: fornitoriData } = await supabase
        .from('fornitori')
        .select('id, ragione_sociale')
        .eq('attivo', true)
        .order('ragione_sociale')

      // Carica imbarcazioni
      const { data: imbarcazioniData } = await supabase
        .from('imbarcazioni')
        .select('*')
        .order('ordine').order('nome')

      // Carica servizi CON prezzi per categoria
      const { data: serviziData } = await supabase
        .from('servizi')
        .select('id, nome, tipo, prezzo_base')
        .eq('attivo', true)
        .order('nome')

      // Carica prezzi per categoria
      const { data: prezziCategoriaData } = await supabase
        .from('servizi_prezzi_categoria')
        .select('*')

      // Carica servizi associati con prezzi dinamici DALLA VIEW
      const { data: serviziAssociatiData } = await supabase
        .from('vista_imbarcazioni_servizi_con_prezzi')
        .select('*')

      // Combina servizi con prezzi per categoria
      const serviziConPrezzi = (serviziData || []).map(servizio => {
        const prezzi = (prezziCategoriaData || []).filter(p => p.servizio_id === servizio.id)
        return {
          ...servizio,
          prezzi_categoria: {
            simple: prezzi.find(p => p.categoria === 'simple')?.prezzo || null,
            premium: prezzi.find(p => p.categoria === 'premium')?.prezzo || null,
            luxury: prezzi.find(p => p.categoria === 'luxury')?.prezzo || null
          }
        }
      })

      // Combina imbarcazioni con servizi e prezzi dinamici
      const imbarcazioniConServizi = (imbarcazioniData || []).map(imb => {
        const serviziDellImbarcazione = (serviziAssociatiData || [])
          .filter(sa => sa.imbarcazione_id === imb.id)
          .map(sa => ({
            id: sa.servizio_id,
            nome: sa.servizio_nome,
            tipo: sa.servizio_tipo,
            prezzo_base: sa.servizio_prezzo_base,
            prezzo_finale: sa.prezzo_finale,
            prezzo_personalizzato: sa.prezzo_personalizzato
          }))

        return { 
          ...imb, 
          servizi_associati: serviziDellImbarcazione 
        }
      })

      setFornitori(fornitoriData || [])
      setImbarcazioni(imbarcazioniConServizi)
      setServizi(serviziConPrezzi)
    } catch (error: any) {
      toast.error('Errore nel caricamento')
      console.error('Errore:', error)
    } finally {
      setLoading(false)
    }
  }

  function applicaFiltri() {
    let filtrate = [...imbarcazioni]

    if (filtroFornitore !== 'tutti') {
      filtrate = filtrate.filter(i => i.fornitore_id === filtroFornitore)
    }

    if (filtroCategoria !== 'tutti') {
      filtrate = filtrate.filter(i => i.categoria === filtroCategoria)
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtrate = filtrate.filter(i =>
        i.nome.toLowerCase().includes(term) ||
        i.tipo.toLowerCase().includes(term) ||
        i.descrizione?.toLowerCase().includes(term)
      )
    }

    setImbarcazioniFiltrate(filtrate)
  }

  function handleNew() {
    setEditingId(null)
    setFormData({
      nome: '',
      tipo: 'gommone',
      categoria: 'simple',
      capacita_massima: 6,
      descrizione: '',
      caratteristiche: '',
      immagine_principale: '',
      fornitore_id: '',
      attiva: true
    })
    setImageFile(null)
    setImagePreview(null)
    setShowModal(true)
  }

  function handleEdit(imbarcazione: any) {
    setEditingId(imbarcazione.id)
    
    // Converti array caratteristiche in stringa per il form
    let caratteristicheString = ''
    if (imbarcazione.caratteristiche) {
      if (Array.isArray(imbarcazione.caratteristiche)) {
        caratteristicheString = imbarcazione.caratteristiche.join(', ')
      } else {
        caratteristicheString = imbarcazione.caratteristiche
      }
    }
    
    setFormData({
      nome: imbarcazione.nome,
      tipo: imbarcazione.tipo,
      categoria: imbarcazione.categoria,
      capacita_massima: imbarcazione.capacita_massima,
      descrizione: imbarcazione.descrizione || '',
      caratteristiche: caratteristicheString,
      immagine_principale: imbarcazione.immagine_principale || '',
      fornitore_id: imbarcazione.fornitore_id || '',
      attiva: imbarcazione.attiva
    })
    setImageFile(null)
    setImagePreview(imbarcazione.immagine_principale || null)
    setShowModal(true)
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validazione
    if (!file.type.startsWith('image/')) {
      toast.error('Il file deve essere un\'immagine')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Immagine troppo grande (max 5MB)')
      return
    }

    setImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  async function uploadImage(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `${fileName}`

    const { data, error } = await supabase.storage
      .from('imbarcazioni')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) throw error

    const { data: { publicUrl } } = supabase.storage
      .from('imbarcazioni')
      .getPublicUrl(filePath)

    return publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      let imageUrl = formData.immagine_principale

      if (imageFile) {
        setUploadingImage(true)
        imageUrl = await uploadImage(imageFile)
      }

      // 🔧 FIX: Converti caratteristiche in array o null
      const caratteristicheArray = (() => {
        if (!formData.caratteristiche || formData.caratteristiche.trim() === '') {
          return null
        }
        if (Array.isArray(formData.caratteristiche)) {
          return formData.caratteristiche
        }
        return formData.caratteristiche
          .split(/[,\n]/)
          .map((c: string) => c.trim())
          .filter((c: string) => c.length > 0)
      })()

      const dataToSave = {
        nome: formData.nome,
        tipo: formData.tipo,
        categoria: formData.categoria,
        capacita_massima: formData.capacita_massima || null,
        descrizione: formData.descrizione || null,
        caratteristiche: caratteristicheArray,
        immagine_principale: imageUrl || null,
        fornitore_id: formData.fornitore_id || null,
        attiva: formData.attiva
      }

      if (editingId) {
        const { error } = await supabase
          .from('imbarcazioni')
          .update(dataToSave)
          .eq('id', editingId)

        if (error) throw error
        toast.success('Imbarcazione aggiornata!')
      } else {
        const { error } = await supabase
          .from('imbarcazioni')
          .insert([dataToSave])

        if (error) throw error
        toast.success('Imbarcazione creata!')
      }

      setShowModal(false)
      loadData()
    } catch (error: any) {
      console.error('Errore salvataggio:', error)
      toast.error(error.message || 'Errore nel salvataggio')
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Sei sicuro di voler eliminare questa imbarcazione?')) return

    try {
      const { error } = await supabase
        .from('imbarcazioni')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Imbarcazione eliminata!')
      loadData()
    } catch (error: any) {
      console.error('Errore eliminazione:', error)
      toast.error('Errore nell\'eliminazione')
    }
  }

  function openServiziModal(imbarcazione: any) {
    setSelectedImbarcazione(imbarcazione)
    
    const stati: {[key: string]: boolean} = {}
    const prezzi: {[key: string]: number | string} = {}
    imbarcazione.servizi_associati.forEach((s: any) => {
      stati[s.id] = true
      // Usa prezzo_personalizzato se presente, altrimenti prezzo_finale (calcolato per categoria)
      prezzi[s.id] = s.prezzo_personalizzato ?? s.prezzo_finale ?? ''
    })
    setServiziSelezionati(stati)
    setPrezziServizi(prezzi)
    
    setShowServiziModal(true)
  }

  function toggleServizio(servizioId: string) {
    setServiziSelezionati(prev => ({
      ...prev,
      [servizioId]: !prev[servizioId]
    }))
  }

  function getPrezzoServizioPerCategoria(servizio: any, categoria: string): number | null {
    return servizio.prezzi_categoria?.[categoria] || servizio.prezzo_base || null
  }

  async function handleSalvaServizi() {
    if (!selectedImbarcazione) return

    try {
      await supabase
        .from('imbarcazioni_servizi')
        .delete()
        .eq('imbarcazione_id', selectedImbarcazione.id)

      const serviziDaInserire = Object.entries(serviziSelezionati)
        .filter(([_, isSelected]) => isSelected)
        .map(([servizioId]) => {
          const prezzo = prezziServizi[servizioId]
          return {
            imbarcazione_id: selectedImbarcazione.id,
            servizio_id: servizioId,
            attivo: true,
            prezzo_personalizzato: prezzo !== '' && prezzo !== null && prezzo !== undefined
              ? parseFloat(String(prezzo))
              : null
          }
        })

      if (serviziDaInserire.length > 0) {
        const { error } = await supabase
          .from('imbarcazioni_servizi')
          .insert(serviziDaInserire)

        if (error) throw error
      }

      toast.success('Servizi aggiornati!')
      setShowServiziModal(false)
      loadData()
    } catch (error: any) {
      console.error('Errore salvataggio servizi:', error)
      toast.error('Errore nel salvataggio')
    }
  }

  const getCategoriaColor = (categoria: string) => {
    switch (categoria) {
      case 'simple': return 'bg-green-100 text-green-700'
      case 'premium': return 'bg-yellow-100 text-yellow-700'
      case 'luxury': return 'bg-purple-100 text-purple-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getCategoriaLabel = (categoria: string) => {
    switch (categoria) {
      case 'simple': return 'Simple'
      case 'premium': return 'Premium'
      case 'luxury': return 'Luxury'
      default: return categoria
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-gray-600">Caricamento imbarcazioni...</div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Imbarcazioni</h1>
          <p className="text-gray-600 mt-1">Gestisci la flotta disponibile</p>
        </div>
        <button
          onClick={handleNew}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Nuova Imbarcazione
        </button>
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
              placeholder="Nome, tipo, descrizione..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fornitore</label>
            <select
              value={filtroFornitore}
              onChange={(e) => setFiltroFornitore(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="tutti">Tutti i fornitori</option>
              {fornitori.map(f => (
                <option key={f.id} value={f.id}>{f.ragione_sociale}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="tutti">Tutte le categorie</option>
              <option value="simple">Simple</option>
              <option value="premium">Premium</option>
              <option value="luxury">Luxury</option>
            </select>
          </div>
        </div>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-sm text-gray-600">Totale</div>
          <div className="text-2xl font-bold text-gray-900">{imbarcazioni.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-sm text-gray-600">Simple</div>
          <div className="text-2xl font-bold text-green-600">
            {imbarcazioni.filter(i => i.categoria === 'simple').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-sm text-gray-600">Premium</div>
          <div className="text-2xl font-bold text-yellow-600">
            {imbarcazioni.filter(i => i.categoria === 'premium').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-sm text-gray-600">Luxury</div>
          <div className="text-2xl font-bold text-purple-600">
            {imbarcazioni.filter(i => i.categoria === 'luxury').length}
          </div>
        </div>
      </div>

      {/* Lista Imbarcazioni */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {imbarcazioniFiltrate.map((imbarcazione) => {
          const fornitore = fornitori.find(f => f.id === imbarcazione.fornitore_id)
          
          return (
            <div key={imbarcazione.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              {/* Immagine */}
              {imbarcazione.immagine_principale && (
                <div className="relative h-48 bg-gray-100">
                  <Image
                    src={imbarcazione.immagine_principale}
                    alt={imbarcazione.nome}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute top-3 right-3 flex gap-2">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getCategoriaColor(imbarcazione.categoria)}`}>
                      {getCategoriaLabel(imbarcazione.categoria)}
                    </span>
                    <span className={`px-3 py-1 text-xs rounded-full ${
                      imbarcazione.attiva ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {imbarcazione.attiva ? 'Attiva' : 'Inattiva'}
                    </span>
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="p-6">
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{imbarcazione.nome}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    {/* 🆕 USA getTipoLabel invece di capitalize */}
                    <span>{getTipoLabel(imbarcazione.tipo)}</span>
                    {fornitore && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <span>🏢</span>
                          {fornitore.ragione_sociale}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Capacità: {imbarcazione.capacita_massima} persone
                  </div>
                </div>

                {imbarcazione.descrizione && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {imbarcazione.descrizione}
                  </p>
                )}

                {/* Servizi Associati */}
                {imbarcazione.servizi_associati?.length > 0 && (
                  <div className="mb-4 bg-blue-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-blue-900">📋 Servizi Disponibili:</span>
                    </div>
                    <div className="space-y-1">
                      {imbarcazione.servizi_associati.map((servizio: any) => (
                        <div key={servizio.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{servizio.nome}</span>
                          <span className="font-semibold text-blue-600">
                            €{servizio.prezzo_finale?.toLocaleString() || servizio.prezzo_base?.toLocaleString() || '0'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => openServiziModal(imbarcazione)}
                    className="px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 text-sm font-medium"
                  >
                    🎯 Servizi
                  </button>
                  <button
                    onClick={() => handleEdit(imbarcazione)}
                    className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm font-medium"
                  >
                    Modifica
                  </button>
                  <button
                    onClick={() => handleDelete(imbarcazione.id)}
                    className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium"
                  >
                    Elimina
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {imbarcazioniFiltrate.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
          <div className="text-4xl mb-3">🚤</div>
          <p className="text-gray-500 mb-4">
            {searchTerm || filtroFornitore !== 'tutti' || filtroCategoria !== 'tutti'
              ? 'Nessuna imbarcazione trovata con i filtri selezionati'
              : 'Nessuna imbarcazione configurata'}
          </p>
          {!searchTerm && filtroFornitore === 'tutti' && filtroCategoria === 'tutti' && (
            <button
              onClick={handleNew}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Crea Prima Imbarcazione
            </button>
          )}
        </div>
      )}

      {/* Modal Crea/Modifica - FIX HEADER */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* FIX: Header sticky con sfondo bianco e z-index */}
            <div className="sticky top-0 z-10 bg-white p-6 border-b flex items-center justify-between rounded-t-xl">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingId ? 'Modifica Imbarcazione' : 'Nuova Imbarcazione'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Immagine */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Immagine</label>
                {imagePreview ? (
                  <div className="relative mb-3">
                    <div className="relative h-48 w-full rounded-lg overflow-hidden bg-gray-100">
                      <Image
                        src={imagePreview}
                        alt="Preview"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null)
                        setImagePreview(null)
                        setFormData(prev => ({ ...prev, immagine_principale: '' }))
                      }}
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
                      onChange={handleImageSelect}
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

              {/* Info Base */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>

                {/* 🆕 FIX: "Barca" → "Natante" e aggiunto "Barca a Vela" */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="gommone">Gommone</option>
                    <option value="barca">Natante</option>
                    <option value="barca_vela">Barca a Vela</option>
                    <option value="yacht">Yacht</option>
                    <option value="catamarano">Catamarano</option>
                    <option value="gozzo">Gozzo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Categoria *</label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="simple">Simple</option>
                    <option value="premium">Premium</option>
                    <option value="luxury">Luxury</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Capacità Max</label>
                  <input
                    type="number"
                    value={formData.capacita_massima}
                    onChange={(e) => setFormData({ ...formData, capacita_massima: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="1"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fornitore</label>
                  <select
                    value={formData.fornitore_id}
                    onChange={(e) => setFormData({ ...formData, fornitore_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Seleziona fornitore</option>
                    {fornitori.map(f => (
                      <option key={f.id} value={f.id}>{f.ragione_sociale}</option>
                    ))}
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
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Caratteristiche</label>
                <textarea
                  value={formData.caratteristiche}
                  onChange={(e) => setFormData({ ...formData, caratteristiche: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                  placeholder="Separa con virgole: Tendalino, doccetta, igloo con ghiaccio"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Separa le caratteristiche con virgole
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="attiva"
                  checked={formData.attiva}
                  onChange={(e) => setFormData({ ...formData, attiva: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="attiva" className="text-sm font-medium text-gray-700">
                  Imbarcazione attiva
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={uploadingImage}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
                  disabled={uploadingImage}
                >
                  {uploadingImage ? 'Caricamento...' : editingId ? 'Aggiorna' : 'Crea Imbarcazione'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Gestione Servizi con Prezzi per Barca */}
      {showServiziModal && selectedImbarcazione && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Servizi & Prezzi</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedImbarcazione.nome} • <span className={`font-semibold ${getCategoriaColor(selectedImbarcazione.categoria).replace('bg-', 'text-').replace('-100', '-600')}`}>
                    {getCategoriaLabel(selectedImbarcazione.categoria)}
                  </span>
                </p>
              </div>
              <button onClick={() => setShowServiziModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">
                ×
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-900">
                  💡 Attiva i servizi offerti da questa barca e imposta il <strong>prezzo specifico</strong> per ognuno. Il prezzo verrà proposto automaticamente al momento della prenotazione.
                </p>
              </div>

              <div className="space-y-3">
                {servizi.map(servizio => {
                  const isSelected = serviziSelezionati[servizio.id] || false

                  return (
                    <div
                      key={servizio.id}
                      className={`border-2 rounded-lg transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      {/* Riga principale: checkbox + nome */}
                      <div
                        className="flex items-center gap-3 p-4 cursor-pointer"
                        onClick={() => toggleServizio(servizio.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 text-blue-600 rounded flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900">{servizio.nome}</div>
                          <div className="text-xs text-gray-500 capitalize mt-0.5">{servizio.tipo}</div>
                        </div>
                        {/* Badge stato */}
                        {isSelected && prezziServizi[servizio.id] ? (
                          <span className="text-sm font-bold text-blue-700">
                            €{parseFloat(String(prezziServizi[servizio.id])).toLocaleString('it-IT')}
                          </span>
                        ) : isSelected ? (
                          <span className="text-xs text-amber-600 font-medium">⚠️ Prezzo mancante</span>
                        ) : null}
                      </div>

                      {/* Input prezzo — visibile solo se selezionato */}
                      {isSelected && (
                        <div
                          className="px-4 pb-4 pt-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-gray-600 whitespace-nowrap">
                              Prezzo per questa barca (€)
                            </label>
                            <div className="relative flex-1 max-w-[180px]">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">€</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={prezziServizi[servizio.id] ?? ''}
                                onChange={(e) => setPrezziServizi(prev => ({
                                  ...prev,
                                  [servizio.id]: e.target.value
                                }))}
                                placeholder="0.00"
                                className="w-full pl-7 pr-3 py-2 border border-blue-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button
                onClick={() => setShowServiziModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white"
              >
                Annulla
              </button>
              <button
                onClick={handleSalvaServizi}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Salva Servizi & Prezzi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}