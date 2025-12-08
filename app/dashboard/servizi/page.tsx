'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function ServiziPage() {
  const [servizi, setServizi] = useState<any[]>([])
  const [imbarcazioni, setImbarcazioni] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    nome: '',
    descrizione: '',
    tipo: '',
    prezzo_base: '',
    caparra_percentuale: '30',
    durata_ore: '',
    include: '',
    imbarcazione_id: '',
    prezzo_per_persona: false,
    min_persone: '',
    max_persone: '',
    luogo_imbarco: '',
    ora_imbarco: '',
    attivo: true,
    immagine_principale: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const { data: serviziData, error: serviziError } = await supabase
        .from('servizi')
        .select(`
          *,
          imbarcazioni (nome)
        `)
        .order('nome')

      if (serviziError) throw serviziError

      const { data: imbarcazioniData, error: imbarcazioniError } = await supabase
        .from('imbarcazioni')
        .select('id, nome')
        .eq('attiva', true)
        .order('nome')

      if (imbarcazioniError) throw imbarcazioniError

      setServizi(serviziData || [])
      setImbarcazioni(imbarcazioniData || [])
    } catch (error: any) {
      toast.error('Errore nel caricamento dei dati')
      console.error('Errore:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `servizi/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('immagini')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('immagini')
        .getPublicUrl(fileName)

      setFormData({ ...formData, immagine_principale: publicUrl })
      toast.success('Immagine caricata!')
    } catch (error: any) {
      toast.error('Errore upload immagine')
      console.error('Errore:', error)
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    try {
      const durataMinuti = Math.round(Number(formData.durata_ore) * 60)
      
      const includeArray = formData.include 
        ? formData.include.split(',').map(item => item.trim()).filter(item => item)
        : []

      const dataToSave = {
        nome: formData.nome,
        descrizione: formData.descrizione || null,
        tipo: formData.tipo || null,
        prezzo_base: Number(formData.prezzo_base),
        caparra_percentuale: Number(formData.caparra_percentuale),
        durata_minuti: durataMinuti,
        include: includeArray,
        imbarcazione_id: formData.imbarcazione_id || null,
        prezzo_per_persona: formData.prezzo_per_persona,
        min_persone: formData.min_persone ? Number(formData.min_persone) : null,
        max_persone: formData.max_persone ? Number(formData.max_persone) : null,
        luogo_imbarco: formData.luogo_imbarco || null,
        ora_imbarco: formData.ora_imbarco || null,
        attivo: formData.attivo,
        immagine_principale: formData.immagine_principale || null
      }

      if (editingId) {
        const { error } = await supabase
          .from('servizi')
          .update(dataToSave)
          .eq('id', editingId)

        if (error) throw error
        toast.success('Servizio aggiornato con successo!')
      } else {
        const { error } = await supabase
          .from('servizi')
          .insert([dataToSave])

        if (error) throw error
        toast.success('Servizio creato con successo!')
      }

      resetForm()
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Errore nel salvataggio')
      console.error('Errore:', error)
    }
  }

  function handleEdit(servizio: any) {
    setEditingId(servizio.id)
    setFormData({
      nome: servizio.nome,
      descrizione: servizio.descrizione || '',
      tipo: servizio.tipo || '',
      prezzo_base: servizio.prezzo_base.toString(),
      caparra_percentuale: servizio.caparra_percentuale.toString(),
      durata_ore: (servizio.durata_minuti / 60).toString(),
      include: Array.isArray(servizio.include) ? servizio.include.join(', ') : '',
      imbarcazione_id: servizio.imbarcazione_id || '',
      prezzo_per_persona: servizio.prezzo_per_persona || false,
      min_persone: servizio.min_persone?.toString() || '',
      max_persone: servizio.max_persone?.toString() || '',
      luogo_imbarco: servizio.luogo_imbarco || '',
      ora_imbarco: servizio.ora_imbarco || '',
      attivo: servizio.attivo,
      immagine_principale: servizio.immagine_principale || ''
    })
    setShowModal(true)
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
      toast.error('Errore nell\'eliminazione')
      console.error('Errore:', error)
    }
  }

  function resetForm() {
    setFormData({
      nome: '',
      descrizione: '',
      tipo: '',
      prezzo_base: '',
      caparra_percentuale: '30',
      durata_ore: '',
      include: '',
      imbarcazione_id: '',
      prezzo_per_persona: false,
      min_persone: '',
      max_persone: '',
      luogo_imbarco: '',
      ora_imbarco: '',
      attivo: true,
      immagine_principale: ''
    })
    setEditingId(null)
    setShowModal(false)
  }

  if (loading) {
    return <div className="p-8"><div className="text-gray-600">Caricamento...</div></div>
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Servizi</h1>
          <p className="text-gray-600 mt-1">{servizi.length} servizi disponibili</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Nuovo Servizio
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Immagine</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prezzo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durata</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Caparra</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Imbarcazione</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stato</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {servizi.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    <div className="text-4xl mb-3">🚢</div>
                    <p>Nessun servizio disponibile</p>
                  </td>
                </tr>
              ) : (
                servizi.map((servizio) => (
                  <tr key={servizio.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {servizio.immagine_principale ? (
                        <img 
                          src={servizio.immagine_principale} 
                          alt={servizio.nome}
                          className="w-12 h-12 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xl">
                          🚤
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{servizio.nome}</div>
                      {servizio.descrizione && (
                        <div className="text-xs text-gray-500 line-clamp-1">{servizio.descrizione}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {servizio.tipo || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        €{Number(servizio.prezzo_base).toFixed(2)}
                      </div>
                      {servizio.prezzo_per_persona && (
                        <div className="text-xs text-gray-500">per persona</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {(() => {
                        const ore = Math.floor(servizio.durata_minuti / 60)
                        const minuti = servizio.durata_minuti % 60
                        return ore > 0 
                          ? `${ore}h${minuti > 0 ? ` ${minuti}m` : ''}`
                          : `${minuti}m`
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {servizio.caparra_percentuale}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {servizio.imbarcazioni?.nome || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        servizio.attivo 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {servizio.attivo ? 'Attivo' : 'Disattivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleEdit(servizio)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Modifica
                      </button>
                      <button
                        onClick={() => handleDelete(servizio.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Elimina
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingId ? 'Modifica Servizio' : 'Nuovo Servizio'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-2xl">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome Servizio *</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>

                <div>
  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
  <select
    value={formData.tipo}
    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
    required
  >
    <option value="">Seleziona tipo</option>
    <option value="tour">Tour</option>
    <option value="tour_collettivo">Tour Collettivo</option>
    <option value="taxi_boat">Taxi Boat</option>
    <option value="locazione">Locazione</option>
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

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prezzo Base * (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.prezzo_base}
                    onChange={(e) => setFormData({ ...formData, prezzo_base: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Caparra % *</label>
                  <input
                    type="number"
                    value={formData.caparra_percentuale}
                    onChange={(e) => setFormData({ ...formData, caparra_percentuale: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="0"
                    max="100"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Percentuale suggerita (informativa)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Durata (ore) *</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.durata_ore}
                    onChange={(e) => setFormData({ ...formData, durata_ore: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="prezzo_per_persona"
                  checked={formData.prezzo_per_persona}
                  onChange={(e) => setFormData({ ...formData, prezzo_per_persona: e.target.checked })}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <label htmlFor="prezzo_per_persona" className="ml-2 text-sm text-gray-700">
                  Prezzo per persona
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min Persone</label>
                  <input
                    type="number"
                    value={formData.min_persone}
                    onChange={(e) => setFormData({ ...formData, min_persone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Persone</label>
                  <input
                    type="number"
                    value={formData.max_persone}
                    onChange={(e) => setFormData({ ...formData, max_persone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Luogo Imbarco</label>
                  <input
                    type="text"
                    value={formData.luogo_imbarco}
                    onChange={(e) => setFormData({ ...formData, luogo_imbarco: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="es. Porto di Salerno, Molo Manfredi"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ora Imbarco</label>
                  <input
                    type="time"
                    value={formData.ora_imbarco}
                    onChange={(e) => setFormData({ ...formData, ora_imbarco: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Immagine Principale */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Immagine Principale</label>
                {formData.immagine_principale && (
                  <div className="mb-2">
                    <img 
                      src={formData.immagine_principale} 
                      alt="Anteprima" 
                      className="w-32 h-32 object-cover rounded-lg"
                    />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                {uploading && (
                  <p className="text-sm text-blue-600 mt-1">Caricamento in corso...</p>
                )}
                {formData.immagine_principale && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, immagine_principale: '' })}
                    className="mt-2 text-sm text-red-600 hover:text-red-800"
                  >
                    Rimuovi immagine
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cosa Include</label>
                <textarea
                  value={formData.include}
                  onChange={(e) => setFormData({ ...formData, include: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Inserisci gli elementi separati da virgola (es. Skipper, Carburante, Snack)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Imbarcazione</label>
                <select
                  value={formData.imbarcazione_id}
                  onChange={(e) => setFormData({ ...formData, imbarcazione_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Nessuna imbarcazione specifica</option>
                  {imbarcazioni.map((imb) => (
                    <option key={imb.id} value={imb.id}>
                      {imb.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="attivo"
                  checked={formData.attivo}
                  onChange={(e) => setFormData({ ...formData, attivo: e.target.checked })}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <label htmlFor="attivo" className="ml-2 text-sm text-gray-700">
                  Servizio attivo
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
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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