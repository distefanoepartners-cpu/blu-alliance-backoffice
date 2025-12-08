'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function ImbarcazioniPage() {
  const [imbarcazioni, setImbarcazioni] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  
  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'gommone',
    capacita_massima: 6,
    descrizione: '',
    caratteristiche: '',
    immagine_principale: '',
    attiva: true
  })

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  useEffect(() => {
    loadImbarcazioni()
  }, [])

  async function loadImbarcazioni() {
    try {
      const { data, error } = await supabase
        .from('imbarcazioni')
        .select('*')
        .order('nome')

      if (error) throw error
      setImbarcazioni(data || [])
    } catch (error: any) {
      toast.error('Errore nel caricamento')
      console.error('Errore:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Verifica tipo file
    if (!file.type.startsWith('image/')) {
      toast.error('Seleziona un file immagine valido')
      return
    }

    // Verifica dimensione (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Immagine troppo grande (max 5MB)')
      return
    }

    setImageFile(file)

    // Crea preview
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

      // Genera nome file unico
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      // Upload su Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('imbarcazioni')
        .upload(filePath, imageFile)

      if (uploadError) throw uploadError

      // Ottieni URL pubblico
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
      // Estrai il nome file dall'URL
      const urlParts = imageUrl.split('/')
      const fileName = urlParts[urlParts.length - 1]

      // Elimina da Storage
      const { error } = await supabase.storage
        .from('imbarcazioni')
        .remove([fileName])

      if (error) throw error
    } catch (error: any) {
      console.error('Errore eliminazione immagine:', error)
      // Non bloccare l'operazione se l'immagine non esiste più
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      let imageUrl = formData.immagine_principale

      // Se c'è una nuova immagine, fai upload
      if (imageFile) {
        const uploadedUrl = await uploadImage()
        if (!uploadedUrl) throw new Error('Errore upload immagine')
        
        // Se stiamo modificando e c'era già un'immagine, elimina la vecchia
        if (editingId && formData.immagine_principale) {
          await deleteImage(formData.immagine_principale)
        }
        
        imageUrl = uploadedUrl
      }

      const dataToSave = {
        ...formData,
        caratteristiche: formData.caratteristiche 
          ? formData.caratteristiche.split(',').map(c => c.trim()).filter(c => c)
          : [],
        immagine_principale: imageUrl || null
      }

      if (editingId) {
        // Update
        const { error } = await supabase
          .from('imbarcazioni')
          .update(dataToSave)
          .eq('id', editingId)

        if (error) throw error
        toast.success('Imbarcazione aggiornata!')
      } else {
        // Insert
        const { error } = await supabase
          .from('imbarcazioni')
          .insert([dataToSave])

        if (error) throw error
        toast.success('Imbarcazione creata!')
      }

      resetForm()
      loadImbarcazioni()
    } catch (error: any) {
      console.error('Errore:', error)
      toast.error(error.message || 'Errore nel salvataggio')
    }
  }

  async function handleDelete(id: string, imageUrl: string | null) {
    if (!confirm('Sei sicuro di voler eliminare questa imbarcazione?')) return

    try {
      // Elimina immagine se esiste
      if (imageUrl) {
        await deleteImage(imageUrl)
      }

      // Elimina record
      const { error } = await supabase
        .from('imbarcazioni')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Imbarcazione eliminata!')
      loadImbarcazioni()
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
      capacita_massima: imbarcazione.capacita_massima,
      descrizione: imbarcazione.descrizione || '',
      caratteristiche: Array.isArray(imbarcazione.caratteristiche) 
        ? imbarcazione.caratteristiche.join(', ')
        : '',
      immagine_principale: imbarcazione.immagine_principale || '',
      attiva: imbarcazione.attiva
    })
    setImagePreview(imbarcazione.immagine_principale)
    setShowModal(true)
  }

  function resetForm() {
    setFormData({
      nome: '',
      tipo: 'gommone',
      capacita_massima: 6,
      descrizione: '',
      caratteristiche: '',
      immagine_principale: '',
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

  if (loading) {
    return <div className="p-8"><div className="text-gray-600">Caricamento...</div></div>
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Imbarcazioni</h1>
          <p className="text-gray-600 mt-1">{imbarcazioni.length} imbarcazioni registrate</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Nuova Imbarcazione
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {imbarcazioni.map((imbarcazione) => (
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
              <div className="absolute top-2 right-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  imbarcazione.attiva 
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
              <p className="text-sm text-gray-600 capitalize mb-1">{imbarcazione.tipo}</p>
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
        ))}
      </div>

      {/* Modal */}
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                  <select
                  value={formData.tipo}
                   onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
>
                 <option value="gommone">Gommone</option>
                 <option value="barca">Barca</option>
                 <option value="gozzo">Gozzo</option>
                 <option value="yacht">Yacht</option>
                 <option value="catamarano">Catamarano</option>
                 <option value="motoscafo">Motoscafo</option>
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
    </div>
  )
}