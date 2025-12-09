'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

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
  const [serviziAssociati, setServiziAssociati] = useState<string[]>([])
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

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    applicaFiltri()
  }, [imbarcazioni, filtroFornitore, filtroCategoria, searchTerm])

  async function loadData() {
    try {
      // Carica fornitori
      const { data: fornitoriData, error: fornitoriError } = await supabase
        .from('fornitori')
        .select('id, ragione_sociale')
        .eq('attivo', true)
        .order('ragione_sociale')

      if (fornitoriError) throw fornitoriError

      // Carica imbarcazioni
      const { data: imbarcazioniData, error: imbarcazioniError } = await supabase
        .from('imbarcazioni')
        .select('*')
        .order('nome')

      if (imbarcazioniError) throw imbarcazioniError

      // Carica servizi
      const { data: serviziData, error: serviziError } = await supabase
        .from('servizi')
        .select('id, nome, tipo, prezzo_base')
        .eq('attivo', true)
        .order('nome')

      if (serviziError) throw serviziError

      // Carica relazioni imbarcazioni-servizi
      const { data: relazioniData, error: relazioniError } = await supabase
        .from('imbarcazioni_servizi')
        .select('imbarcazione_id, servizio_id')
        .eq('attivo', true)

      if (relazioniError) throw relazioniError

      // Aggiungi servizi associati ad ogni imbarcazione
      const imbarcazioniConServizi = imbarcazioniData?.map(imb => {
        const serviziIds = relazioniData
          ?.filter(r => r.imbarcazione_id === imb.id)
          .map(r => r.servizio_id) || []

        const serviziAssegnati = serviziData?.filter(s => serviziIds.includes(s.id)) || []

        return { ...imb, servizi_associati: serviziAssegnati }
      }) || []

      setFornitori(fornitoriData || [])
      setImbarcazioni(imbarcazioniConServizi)
      setServizi(serviziData || [])
    } catch (error: any) {
      toast.error('Errore nel caricamento')
      console.error('Errore:', error)
    } finally {
      setLoading(false)
    }
  }

  function applicaFiltri() {
    let filtrate = [...imbarcazioni]

    // Filtro fornitore
    if (filtroFornitore !== 'tutti') {
      filtrate = filtrate.filter(b => b.fornitore_id === filtroFornitore)
    }

    // Filtro categoria
    if (filtroCategoria !== 'tutti') {
      filtrate = filtrate.filter(b => b.categoria === filtroCategoria)
    }

    // Ricerca per nome
    if (searchTerm) {
      filtrate = filtrate.filter(b =>
        b.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.tipo.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setImbarcazioniFiltrate(filtrate)
  }

  async function loadServiziAssociati(imbarcazioneId: string) {
    try {
      const { data, error } = await supabase
        .from('imbarcazioni_servizi')
        .select('servizio_id')
        .eq('imbarcazione_id', imbarcazioneId)
        .eq('attivo', true)

      if (error) throw error

      setServiziAssociati(data?.map(r => r.servizio_id) || [])
    } catch (error: any) {
      console.error('Errore caricamento servizi associati:', error)
      setServiziAssociati([])
    }
  }

  async function handleToggleServizio(servizioId: string) {
    if (!selectedImbarcazione) return

    const isAssociato = serviziAssociati.includes(servizioId)

    try {
      if (isAssociato) {
        // Rimuovi associazione
        const { error } = await supabase
          .from('imbarcazioni_servizi')
          .delete()
          .eq('imbarcazione_id', selectedImbarcazione.id)
          .eq('servizio_id', servizioId)

        if (error) throw error

        setServiziAssociati(serviziAssociati.filter(id => id !== servizioId))
        toast.success('Servizio rimosso')
      } else {
        // Aggiungi associazione
        const { error } = await supabase
          .from('imbarcazioni_servizi')
          .insert([{
            imbarcazione_id: selectedImbarcazione.id,
            servizio_id: servizioId,
            attivo: true
          }])

        if (error) throw error

        setServiziAssociati([...serviziAssociati, servizioId])
        toast.success('Servizio aggiunto')
      }
    } catch (error: any) {
      console.error('Errore:', error)
      toast.error('Errore nell\'aggiornamento')
    }
  }

  function openServiziModal(imbarcazione: any) {
    setSelectedImbarcazione(imbarcazione)
    loadServiziAssociati(imbarcazione.id)
    setShowServiziModal(true)
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Seleziona un file immagine valido')
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

  async function uploadImage() {
    if (!imageFile) return null

    try {
      setUploadingImage(true)

      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('imbarcazioni')
        .upload(filePath, imageFile)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('imbarcazioni')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error: any) {
      console.error('Errore upload:', error)
      toast.error('Errore nel caricamento immagine')
      return null
    } finally {
      setUploadingImage(false)
    }
  }

  async function deleteImage(imageUrl: string) {
    try {
      const urlParts = imageUrl.split('/')
      const fileName = urlParts[urlParts.length - 1]

      const { error } = await supabase.storage
        .from('imbarcazioni')
        .remove([fileName])

      if (error) throw error
    } catch (error: any) {
      console.error('Errore eliminazione immagine:', error)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      let imageUrl = formData.immagine_principale

      if (imageFile) {
        const uploadedUrl = await uploadImage()
        if (!uploadedUrl) throw new Error('Errore upload immagine')

        if (editingId && formData.immagine_principale) {
          await deleteImage(formData.immagine_principale)
        }

        imageUrl = uploadedUrl
      }

      const dataToSave = {
        nome: formData.nome,
        tipo: formData.tipo,
        categoria: formData.categoria,
        capacita_massima: formData.capacita_massima,
        descrizione: formData.descrizione || null,
        caratteristiche: formData.caratteristiche
          ? formData.caratteristiche.split(',').map(c => c.trim()).filter(c => c)
          : [],
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

      resetForm()
      loadData()
    } catch (error: any) {
      console.error('Errore:', error)
      toast.error(error.message || 'Errore nel salvataggio')
    }
  }

  async function handleDelete(id: string, imageUrl: string | null) {
    if (!confirm('Sei sicuro di voler eliminare questa imbarcazione?')) return

    try {
      if (imageUrl) {
        await deleteImage(imageUrl)
      }

      // Elimina prima le associazioni con i servizi
      await supabase
        .from('imbarcazioni_servizi')
        .delete()
        .eq('imbarcazione_id', id)

      const { error } = await supabase
        .from('imbarcazioni')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Imbarcazione eliminata!')
      loadData()
    } catch (error: any) {
      console.error('Errore:', error)
      toast.error('Errore nell\'eliminazione')
    }
  }

  function handleEdit(imbarcazione: any) {
    setEditingId(imbarcazione.id)
    setFormData({
      nome: imbarcazione.nome,
      tipo: imbarcazione.tipo,
      categoria: imbarcazione.categoria || 'simple',
      capacita_massima: imbarcazione.capacita_massima,
      descrizione: imbarcazione.descrizione || '',
      caratteristiche: Array.isArray(imbarcazione.caratteristiche)
        ? imbarcazione.caratteristiche.join(', ')
        : '',
      immagine_principale: imbarcazione.immagine_principale || '',
      fornitore_id: imbarcazione.fornitore_id || '',
      attiva: imbarcazione.attiva
    })
    setImagePreview(imbarcazione.immagine_principale)
    setShowModal(true)
  }

  function resetForm() {
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
    setEditingId(null)
    setShowModal(false)
    setImageFile(null)
    setImagePreview(null)
  }

  function removeImagePreview() {
    setImageFile(null)
    setImagePreview(null)
    if (!editingId) {
      setFormData({ ...formData, immagine_principale: '' })
    }
  }

  function getCategoriaLabel(categoria: string) {
    switch (categoria) {
      case 'luxury': return { label: '🟣 Luxury', bg: 'bg-purple-100', text: 'text-purple-700' }
      case 'premium': return { label: '🟡 Premium', bg: 'bg-yellow-100', text: 'text-yellow-700' }
      default: return { label: '🔵 Simple', bg: 'bg-blue-100', text: 'text-blue-700' }
    }
  }

  if (loading) {
    return <div className="p-8"><div className="text-gray-600">Caricamento...</div></div>
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Imbarcazioni</h1>
          <p className="text-gray-600 mt-1">
            {imbarcazioniFiltrate.length} di {imbarcazioni.length} imbarcazioni
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Nuova Imbarcazione
        </button>
      </div>

      {/* Filtri */}
      <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Ricerca */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cerca
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nome o tipo..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filtro Fornitore */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fornitore
            </label>
            <select
              value={filtroFornitore}
              onChange={(e) => setFiltroFornitore(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="tutti">Tutti i fornitori</option>
              {fornitori.map(f => {
                const count = imbarcazioni.filter(b => b.fornitore_id === f.id).length
                return (
                  <option key={f.id} value={f.id}>
                    {f.ragione_sociale} ({count})
                  </option>
                )
              })}
            </select>
          </div>

          {/* Filtro Categoria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoria
            </label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="tutti">Tutte le categorie</option>
              <option value="luxury">🟣 Luxury</option>
              <option value="premium">🟡 Premium</option>
              <option value="simple">🔵 Simple</option>
            </select>
          </div>

          {/* Reset Filtri */}
          <div className="flex items-end">
            {(filtroFornitore !== 'tutti' || filtroCategoria !== 'tutti' || searchTerm) && (
              <button
                onClick={() => {
                  setFiltroFornitore('tutti')
                  setFiltroCategoria('tutti')
                  setSearchTerm('')
                }}
                className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                ✕ Rimuovi filtri
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {imbarcazioniFiltrate.map((imbarcazione) => {
          const cat = getCategoriaLabel(imbarcazione.categoria)
          return (
            <div key={imbarcazione.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Immagine */}
              <div className="h-48 bg-gray-100 relative">
                {imbarcazione.immagine_principale ? (
                  <img
                    src={imbarcazione.immagine_principale}
                    alt={imbarcazione.nome}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${cat.bg} ${cat.text}`}>
                    {cat.label}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${imbarcazione.attiva
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                    }`}>
                    {imbarcazione.attiva ? 'Attiva' : 'Non Attiva'}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{imbarcazione.nome}</h3>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-gray-600 capitalize">{imbarcazione.tipo}</span>
                </div>
                {imbarcazione.fornitore_id && (
                  <p className="text-xs text-gray-500 mb-2">
                    🏢 {fornitori.find(f => f.id === imbarcazione.fornitore_id)?.ragione_sociale || 'Fornitore'}
                  </p>
                )}
                <p className="text-sm text-gray-600 mb-3">
                  Capacità: {imbarcazione.capacita_massima} persone
                </p>

                {imbarcazione.descrizione && (
                  <p className="text-sm text-gray-700 mb-4 line-clamp-2">{imbarcazione.descrizione}</p>
                )}

                {Array.isArray(imbarcazione.caratteristiche) && imbarcazione.caratteristiche.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {imbarcazione.caratteristiche.map((car: string, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                        {car}
                      </span>
                    ))}
                  </div>
                )}

                {/* Servizi Associati */}
                {imbarcazione.servizi_associati && imbarcazione.servizi_associati.length > 0 && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs font-semibold text-blue-700 mb-2">📋 Servizi Disponibili:</p>
                    <div className="space-y-1">
                      {imbarcazione.servizi_associati.map((servizio: any) => (
                        <div key={servizio.id} className="flex justify-between items-center text-xs">
                          <span className="text-gray-700">{servizio.nome}</span>
                          <span className="text-blue-600 font-medium">€{Number(servizio.prezzo_base).toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => openServiziModal(imbarcazione)}
                    className="w-full px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 text-sm font-medium"
                  >
                    🎯 Gestisci Servizi
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(imbarcazione)}
                      className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm"
                    >
                      Modifica
                    </button>
                    <button
                      onClick={() => handleDelete(imbarcazione.id, imbarcazione.immagine_principale)}
                      className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm"
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {imbarcazioniFiltrate.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
          <div className="text-4xl mb-3">🚤</div>
          <p className="text-gray-500">
            {filtroFornitore !== 'tutti' || filtroCategoria !== 'tutti' || searchTerm
              ? 'Nessuna imbarcazione trovata con i filtri selezionati'
              : 'Nessuna imbarcazione trovata'
            }
          </p>
        </div>
      )}

      {/* Modal Imbarcazione */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingId ? 'Modifica Imbarcazione' : 'Nuova Imbarcazione'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-2xl">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Upload Immagine */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Immagine Principale
                </label>

                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-64 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={removeImagePreview}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                      ✕ Rimuovi
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                      id="image-upload"
                    />
                    <label htmlFor="image-upload" className="cursor-pointer">
                      <div className="text-gray-400 mb-2">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-600">
                        Clicca per caricare un&apos;immagine
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        PNG, JPG, WEBP fino a 5MB
                      </p>
                    </label>
                  </div>
                )}
              </div>

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

              {/* Fornitore */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fornitore
                </label>
                <select
                  value={formData.fornitore_id}
                  onChange={(e) => setFormData({ ...formData, fornitore_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Nessun fornitore</option>
                  {fornitori.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.ragione_sociale}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Seleziona il fornitore proprietario dell'imbarcazione
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="gommone">Gommone</option>
                    <option value="barca">Barca</option>
                    <option value="barca_vela">Barca a Vela</option>
                    <option value="gozzo">Gozzo</option>
                    <option value="yacht">Yacht</option>
                    <option value="catamarano">Catamarano</option>
                    <option value="motoscafo">Motoscafo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Categoria *</label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="simple">🔵 Simple</option>
                    <option value="premium">🟡 Premium</option>
                    <option value="luxury">🟣 Luxury</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Capacità *</label>
                  <input
                    type="number"
                    value={formData.capacita_massima}
                    onChange={(e) => setFormData({ ...formData, capacita_massima: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione</label>
                <textarea
                  value={formData.descrizione}
                  onChange={(e) => setFormData({ ...formData, descrizione: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Descrizione dell'imbarcazione..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Caratteristiche
                </label>
                <input
                  type="text"
                  value={formData.caratteristiche}
                  onChange={(e) => setFormData({ ...formData, caratteristiche: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Cabina, bagno, aria condizionata (separati da virgola)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Separa le caratteristiche con virgole
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.attiva}
                    onChange={(e) => setFormData({ ...formData, attiva: e.target.checked })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-700">Imbarcazione attiva</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={uploadingImage}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploadingImage ? 'Caricamento...' : editingId ? 'Aggiorna' : 'Crea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Gestione Servizi */}
      {showServiziModal && selectedImbarcazione && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Gestisci Servizi</h2>
                <p className="text-sm text-gray-600 mt-1">{selectedImbarcazione.nome}</p>
              </div>
              <button
                onClick={() => setShowServiziModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Seleziona i servizi che questa imbarcazione può erogare:
              </p>

              <div className="space-y-2">
                {servizi.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Nessun servizio disponibile</p>
                ) : (
                  servizi.map((servizio) => {
                    const isAssociato = serviziAssociati.includes(servizio.id)
                    return (
                      <div
                        key={servizio.id}
                        onClick={() => handleToggleServizio(servizio.id)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${isAssociato
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{servizio.nome}</h4>
                            <p className="text-sm text-gray-500">
                              {servizio.tipo} • €{Number(servizio.prezzo_base).toFixed(2)}
                            </p>
                          </div>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isAssociato ? 'bg-green-500 text-white' : 'bg-gray-200'
                            }`}>
                            {isAssociato && '✓'}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="mt-6 pt-4 border-t flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {serviziAssociati.length} servizi associati
                </p>
                <button
                  onClick={() => setShowServiziModal(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Fatto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}