'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import TourMap from '@/components/TourMap'

export default function TourMapsAdminPage() {
  const [tours, setTours] = useState<any[]>([])
  const [servizi, setServizi] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTour, setEditingTour] = useState<any>(null)
  const [previewTour, setPreviewTour] = useState<any>(null)

  const [formData, setFormData] = useState({
    servizio_id: '',
    nome: '',
    descrizione: '',
    durata_totale_minuti: 330,
    distanza_km: 45,
    punto_partenza: { lat: 40.6824, lng: 14.7577, nome: 'Porto di Salerno', indirizzo: 'Molo Manfredi' },
    punto_arrivo: { lat: 40.6824, lng: 14.7577, nome: 'Porto di Salerno', indirizzo: 'Molo Manfredi' },
    stile_mappa: 'satellite',
    colore_percorso: '#0066FF',
    attivo: true
  })

  const [tappe, setTappe] = useState<any[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      // Carica servizi
      const { data: serviziData } = await supabase
        .from('servizi')
        .select('id, nome, tipo')
        .eq('attivo', true)
        .order('nome')

      // Carica tour
      const { data: toursData } = await supabase
        .from('vista_tour_completi')
        .select('*')
        .order('tour_nome')

      setServizi(serviziData || [])
      setTours(toursData || [])
    } catch (error) {
      console.error('Errore caricamento:', error)
      toast.error('Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }

  function handleNew() {
    setEditingTour(null)
    setFormData({
      servizio_id: '',
      nome: '',
      descrizione: '',
      durata_totale_minuti: 330,
      distanza_km: 45,
      punto_partenza: { lat: 40.6824, lng: 14.7577, nome: 'Porto di Salerno', indirizzo: 'Molo Manfredi' },
      punto_arrivo: { lat: 40.6824, lng: 14.7577, nome: 'Porto di Salerno', indirizzo: 'Molo Manfredi' },
      stile_mappa: 'satellite',
      colore_percorso: '#0066FF',
      attivo: true
    })
    setTappe([])
    setShowModal(true)
  }

  function handleEdit(tour: any) {
    setEditingTour(tour)
    setFormData({
      servizio_id: tour.servizio_id,
      nome: tour.tour_nome,
      descrizione: tour.tour_descrizione,
      durata_totale_minuti: tour.durata_totale_minuti,
      distanza_km: tour.distanza_km,
      punto_partenza: tour.punto_partenza,
      punto_arrivo: tour.punto_arrivo,
      stile_mappa: tour.stile_mappa,
      colore_percorso: tour.colore_percorso,
      attivo: true
    })
    setTappe(tour.tappe || [])
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      if (editingTour) {
        // Update tour
        const { error: tourError } = await supabase
          .from('tour_percorsi')
          .update({
            servizio_id: formData.servizio_id,
            nome: formData.nome,
            descrizione: formData.descrizione,
            durata_totale_minuti: formData.durata_totale_minuti,
            distanza_km: formData.distanza_km,
            punto_partenza: formData.punto_partenza,
            punto_arrivo: formData.punto_arrivo,
            stile_mappa: formData.stile_mappa,
            colore_percorso: formData.colore_percorso,
            attivo: formData.attivo
          })
          .eq('id', editingTour.percorso_id)

        if (tourError) throw tourError

        // Delete old tappe
        await supabase
          .from('tour_tappe')
          .delete()
          .eq('percorso_id', editingTour.percorso_id)

        // Insert new tappe
        if (tappe.length > 0) {
          const { error: tappeError } = await supabase
            .from('tour_tappe')
            .insert(tappe.map((t, index) => ({
              percorso_id: editingTour.percorso_id,
              ordine: index + 1,
              nome: t.nome,
              descrizione: t.descrizione,
              coordinate: t.coordinate,
              tipo: t.tipo,
              durata_minuti: t.durata_minuti,
              icona: t.icona
            })))

          if (tappeError) throw tappeError
        }

        toast.success('Tour aggiornato!')
      } else {
        // Create new tour
        const { data: newTour, error: tourError } = await supabase
          .from('tour_percorsi')
          .insert([{
            servizio_id: formData.servizio_id,
            nome: formData.nome,
            descrizione: formData.descrizione,
            durata_totale_minuti: formData.durata_totale_minuti,
            distanza_km: formData.distanza_km,
            punto_partenza: formData.punto_partenza,
            punto_arrivo: formData.punto_arrivo,
            stile_mappa: formData.stile_mappa,
            colore_percorso: formData.colore_percorso,
            attivo: formData.attivo
          }])
          .select()
          .single()

        if (tourError) throw tourError

        // Insert tappe
        if (tappe.length > 0 && newTour) {
          const { error: tappeError } = await supabase
            .from('tour_tappe')
            .insert(tappe.map((t, index) => ({
              percorso_id: newTour.id,
              ordine: index + 1,
              nome: t.nome,
              descrizione: t.descrizione,
              coordinate: t.coordinate,
              tipo: t.tipo,
              durata_minuti: t.durata_minuti,
              icona: t.icona
            })))

          if (tappeError) throw tappeError
        }

        toast.success('Tour creato!')
      }

      setShowModal(false)
      loadData()
    } catch (error: any) {
      console.error('Errore salvataggio:', error)
      toast.error(error.message || 'Errore nel salvataggio')
    }
  }

  async function handleDelete(tourId: string) {
    if (!confirm('Sei sicuro di voler eliminare questo tour?')) return

    try {
      const { error } = await supabase
        .from('tour_percorsi')
        .delete()
        .eq('id', tourId)

      if (error) throw error

      toast.success('Tour eliminato!')
      loadData()
    } catch (error: any) {
      console.error('Errore eliminazione:', error)
      toast.error('Errore nell\'eliminazione')
    }
  }

  function addTappa() {
    setTappe([...tappe, {
      nome: '',
      descrizione: '',
      coordinate: { lat: 40.5472, lng: 14.2500 },
      tipo: 'punto_interesse',
      durata_minuti: 30,
      icona: '📍'
    }])
  }

  function removeTappa(index: number) {
    setTappe(tappe.filter((_, i) => i !== index))
  }

  function updateTappa(index: number, field: string, value: any) {
    const newTappe = [...tappe]
    newTappe[index] = { ...newTappe[index], [field]: value }
    setTappe(newTappe)
  }

  function handlePreview() {
    const previewData = {
      nome: formData.nome,
      descrizione: formData.descrizione,
      durata_totale_minuti: formData.durata_totale_minuti,
      distanza_km: formData.distanza_km,
      punto_partenza: formData.punto_partenza,
      punto_arrivo: formData.punto_arrivo,
      tappe: tappe,
      stile_mappa: formData.stile_mappa,
      colore_percorso: formData.colore_percorso
    }
    setPreviewTour(previewData)
  }

  if (loading) {
    return <div className="p-8"><div className="text-gray-600">Caricamento...</div></div>
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Tour Interattivi</h1>
          <p className="text-gray-600 mt-1">Gestisci le mappe e i percorsi dei tour</p>
        </div>
        <button
          onClick={handleNew}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Nuovo Tour
        </button>
      </div>

      {/* Lista Tour */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {tours.map((tour) => (
          <div key={tour.percorso_id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Preview Mappa */}
            <div className="h-64 bg-gray-100 relative">
              <TourMap
                tour={{
                  nome: tour.tour_nome,
                  descrizione: tour.tour_descrizione,
                  durata_totale_minuti: tour.durata_totale_minuti,
                  distanza_km: tour.distanza_km,
                  punto_partenza: tour.punto_partenza,
                  punto_arrivo: tour.punto_arrivo,
                  tappe: tour.tappe || [],
                  stile_mappa: tour.stile_mappa,
                  colore_percorso: tour.colore_percorso
                }}
                height="100%"
                showControls={false}
                animated={false}
              />
            </div>

            {/* Info */}
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{tour.tour_nome}</h3>
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">{tour.tour_descrizione}</p>

              <div className="flex flex-wrap gap-3 mb-4 text-sm text-gray-600">
                <span>⏱️ {Math.floor(tour.durata_totale_minuti / 60)}h {tour.durata_totale_minuti % 60}min</span>
                <span>📏 {tour.distanza_km} km</span>
                <span>📍 {tour.tappe?.length || 0} tappe</span>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-gray-600">Servizio:</span>
                <span className="px-2 py-1 bg-blue-50 text-blue-700 text-sm rounded">
                  {tour.servizio_nome}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(tour)}
                  className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm"
                >
                  Modifica
                </button>
                <button
                  onClick={() => handleDelete(tour.percorso_id)}
                  className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm"
                >
                  Elimina
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {tours.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
          <div className="text-4xl mb-3">🗺️</div>
          <p className="text-gray-500 mb-4">Nessun tour configurato</p>
          <button
            onClick={handleNew}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Crea il Primo Tour
          </button>
        </div>
      )}

      {/* Modal Crea/Modifica */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-4xl w-full my-8">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingTour ? 'Modifica Tour' : 'Nuovo Tour'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Info Base */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Servizio *</label>
                  <select
                    value={formData.servizio_id}
                    onChange={(e) => setFormData({ ...formData, servizio_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Seleziona servizio</option>
                    {servizi.map(s => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome Tour *</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Es: Tour Capri Completo"
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
                  placeholder="Descrizione del tour..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Durata (minuti)</label>
                  <input
                    type="number"
                    value={formData.durata_totale_minuti}
                    onChange={(e) => setFormData({ ...formData, durata_totale_minuti: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Distanza (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.distanza_km}
                    onChange={(e) => setFormData({ ...formData, distanza_km: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stile Mappa</label>
                  <select
                    value={formData.stile_mappa}
                    onChange={(e) => setFormData({ ...formData, stile_mappa: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="satellite">Satellite</option>
                    <option value="streets">Strade</option>
                    <option value="outdoors">Outdoor</option>
                    <option value="navigation-day">Navigazione</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Colore Percorso</label>
                  <input
                    type="color"
                    value={formData.colore_percorso}
                    onChange={(e) => setFormData({ ...formData, colore_percorso: e.target.value })}
                    className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Tappe */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Tappe del Tour</h3>
                  <button
                    type="button"
                    onClick={addTappa}
                    className="px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 text-sm"
                  >
                    + Aggiungi Tappa
                  </button>
                </div>

                <div className="space-y-4">
                  {tappe.map((tappa, index) => (
                    <div key={index} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">Tappa {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeTappa(index)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Rimuovi
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Nome tappa"
                          value={tappa.nome}
                          onChange={(e) => updateTappa(index, 'nome', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />

                        <select
                          value={tappa.tipo}
                          onChange={(e) => updateTappa(index, 'tipo', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="punto_interesse">Punto Interesse</option>
                          <option value="sosta">Sosta</option>
                          <option value="foto_stop">Foto Stop</option>
                          <option value="pranzo">Pranzo</option>
                          <option value="bagno">Bagno</option>
                        </select>

                        <input
                          type="text"
                          placeholder="Latitudine"
                          value={tappa.coordinate.lat}
                          onChange={(e) => updateTappa(index, 'coordinate', { ...tappa.coordinate, lat: parseFloat(e.target.value) || 0 })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />

                        <input
                          type="text"
                          placeholder="Longitudine"
                          value={tappa.coordinate.lng}
                          onChange={(e) => updateTappa(index, 'coordinate', { ...tappa.coordinate, lng: parseFloat(e.target.value) || 0 })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />

                        <input
                          type="number"
                          placeholder="Durata (min)"
                          value={tappa.durata_minuti}
                          onChange={(e) => updateTappa(index, 'durata_minuti', parseInt(e.target.value) || 0)}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />

                        <input
                          type="text"
                          placeholder="Icona (emoji)"
                          value={tappa.icona}
                          onChange={(e) => updateTappa(index, 'icona', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>

                      <textarea
                        placeholder="Descrizione tappa"
                        value={tappa.descrizione}
                        onChange={(e) => updateTappa(index, 'descrizione', e.target.value)}
                        className="w-full mt-3 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        rows={2}
                      />
                    </div>
                  ))}
                </div>

                {tappe.length === 0 && (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-500 text-sm">Nessuna tappa aggiunta</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={handlePreview}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  👁️ Anteprima
                </button>
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
                  {editingTour ? 'Aggiorna' : 'Crea Tour'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Preview */}
      {previewTour && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-gray-900">Anteprima Tour</h2>
              <button onClick={() => setPreviewTour(null)} className="text-gray-400 hover:text-gray-600 text-2xl">
                ×
              </button>
            </div>
            <div className="p-6">
              <TourMap
                tour={previewTour}
                height="600px"
                showControls={true}
                animated={true}
                autoStart={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}