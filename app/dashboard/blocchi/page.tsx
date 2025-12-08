'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import toast from 'react-hot-toast'

export default function BlocchiPage() {
  const [blocchi, setBlocchi] = useState<any[]>([])
  const [imbarcazioni, setImbarcazioni] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    imbarcazione_id: '',
    data_inizio: '',
    data_fine: '',
    motivo: '',
    note: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      // Carica blocchi con dettagli imbarcazione
      const { data: blocchiData } = await supabase
        .from('blocchi_imbarcazioni')
        .select(`
          *,
          imbarcazioni (nome)
        `)
        .order('data_inizio', { ascending: false })

      const { data: imbarcazioniData } = await supabase
        .from('imbarcazioni')
        .select('id, nome')
        .eq('attiva', true)
        .order('nome')

      setBlocchi(blocchiData || [])
      setImbarcazioni(imbarcazioniData || [])
    } catch (error: any) {
      toast.error('Errore nel caricamento')
      console.error('Errore:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      // Validazione date
      const inizio = new Date(formData.data_inizio)
      const fine = new Date(formData.data_fine)

      if (fine < inizio) {
        toast.error('La data fine deve essere successiva alla data inizio')
        return
      }

      const dataToSave = {
        imbarcazione_id: formData.imbarcazione_id,
        data_inizio: formData.data_inizio,
        data_fine: formData.data_fine,
        motivo: formData.motivo,
        note: formData.note || null
      }

      if (editingId) {
        // Modifica blocco esistente
        const { error } = await supabase
          .from('blocchi_imbarcazioni')
          .update(dataToSave)
          .eq('id', editingId)

        if (error) throw error
        toast.success('Blocco aggiornato!')
      } else {
        // Crea nuovo blocco
        const { error } = await supabase
          .from('blocchi_imbarcazioni')
          .insert([dataToSave])

        if (error) throw error
        toast.success('✅ Blocco creato! Imbarcazione non prenotabile nel periodo.')
      }

      resetForm()
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Errore nel salvataggio')
      console.error('Errore:', error)
    }
  }

  function handleEdit(blocco: any) {
    setEditingId(blocco.id)
    setFormData({
      imbarcazione_id: blocco.imbarcazione_id,
      data_inizio: blocco.data_inizio,
      data_fine: blocco.data_fine,
      motivo: blocco.motivo,
      note: blocco.note || ''
    })
    setShowModal(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Sei sicuro di voler eliminare questo blocco? L&apos;imbarcazione tornerà disponibile per prenotazioni.')) return

    try {
      const { error } = await supabase
        .from('blocchi_imbarcazioni')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Blocco eliminato!')
      loadData()
    } catch (error: any) {
      toast.error('Errore nell&apos;eliminazione')
      console.error('Errore:', error)
    }
  }

  function resetForm() {
    setFormData({
      imbarcazione_id: '',
      data_inizio: '',
      data_fine: '',
      motivo: '',
      note: ''
    })
    setEditingId(null)
    setShowModal(false)
  }

  function isAttivo(blocco: any) {
    const oggi = new Date()
    oggi.setHours(0, 0, 0, 0)
    const inizio = new Date(blocco.data_inizio)
    const fine = new Date(blocco.data_fine)
    inizio.setHours(0, 0, 0, 0)
    fine.setHours(0, 0, 0, 0)
    
    return oggi >= inizio && oggi <= fine
  }

  function isScaduto(blocco: any) {
    const oggi = new Date()
    oggi.setHours(0, 0, 0, 0)
    const fine = new Date(blocco.data_fine)
    fine.setHours(0, 0, 0, 0)
    
    return oggi > fine
  }

  if (loading) {
    return <div className="p-8"><div className="text-gray-600">Caricamento...</div></div>
  }

  // Filtra blocchi
  const blocchiAttivi = blocchi.filter(b => isAttivo(b))
  const blocchiFuturi = blocchi.filter(b => !isAttivo(b) && !isScaduto(b))
  const blocchiScaduti = blocchi.filter(b => isScaduto(b))

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Blocchi Imbarcazioni</h1>
          <p className="text-gray-600 mt-1">
            Gestione manutenzione e fermi tecnici
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Nuovo Blocco
        </button>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">Blocchi Attivi</p>
              <p className="text-2xl font-bold text-red-700 mt-1">{blocchiAttivi.length}</p>
            </div>
            <span className="text-3xl">🔒</span>
          </div>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Blocchi Programmati</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">{blocchiFuturi.length}</p>
            </div>
            <span className="text-3xl">📅</span>
          </div>
        </div>

        <div className="bg-gray-50 border-l-4 border-gray-500 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Blocchi Scaduti</p>
              <p className="text-2xl font-bold text-gray-700 mt-1">{blocchiScaduti.length}</p>
            </div>
            <span className="text-3xl">✅</span>
          </div>
        </div>
      </div>

      {/* Blocchi Attivi */}
      {blocchiAttivi.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">🔒 Blocchi Attivi</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-red-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Imbarcazione</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periodo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Azioni</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {blocchiAttivi.map((blocco) => (
                    <tr key={blocco.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-lg mr-2">🚤</span>
                          <span className="text-sm font-medium text-gray-900">
                            {blocco.imbarcazioni?.nome || 'N/D'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div>
                          <div>{format(new Date(blocco.data_inizio), 'dd MMM yyyy', { locale: it })}</div>
                          <div className="text-xs text-gray-500">
                            → {format(new Date(blocco.data_fine), 'dd MMM yyyy', { locale: it })}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                          {blocco.motivo}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {blocco.note || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleEdit(blocco)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          Modifica
                        </button>
                        <button
                          onClick={() => handleDelete(blocco.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Elimina
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Blocchi Programmati */}
      {blocchiFuturi.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">📅 Blocchi Programmati</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Imbarcazione</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periodo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Azioni</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {blocchiFuturi.map((blocco) => (
                    <tr key={blocco.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-lg mr-2">🚤</span>
                          <span className="text-sm font-medium text-gray-900">
                            {blocco.imbarcazioni?.nome || 'N/D'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div>
                          <div>{format(new Date(blocco.data_inizio), 'dd MMM yyyy', { locale: it })}</div>
                          <div className="text-xs text-gray-500">
                            → {format(new Date(blocco.data_fine), 'dd MMM yyyy', { locale: it })}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          {blocco.motivo}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {blocco.note || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleEdit(blocco)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          Modifica
                        </button>
                        <button
                          onClick={() => handleDelete(blocco.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Elimina
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Blocchi Scaduti */}
      {blocchiScaduti.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">✅ Blocchi Scaduti (Storico)</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Imbarcazione</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periodo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Azioni</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {blocchiScaduti.slice(0, 10).map((blocco) => (
                    <tr key={blocco.id} className="hover:bg-gray-50 opacity-60">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-lg mr-2">🚤</span>
                          <span className="text-sm font-medium text-gray-900">
                            {blocco.imbarcazioni?.nome || 'N/D'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div>
                          <div>{format(new Date(blocco.data_inizio), 'dd MMM yyyy', { locale: it })}</div>
                          <div className="text-xs text-gray-500">
                            → {format(new Date(blocco.data_fine), 'dd MMM yyyy', { locale: it })}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                          {blocco.motivo}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {blocco.note || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleDelete(blocco.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Elimina
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {blocchiScaduti.length > 10 && (
              <div className="px-6 py-3 bg-gray-50 text-sm text-gray-500 text-center">
                Mostrando 10 di {blocchiScaduti.length} blocchi scaduti
              </div>
            )}
          </div>
        </div>
      )}

      {blocchi.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-6xl mb-4">🔧</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nessun blocco programmato</h3>
          <p className="text-gray-600 mb-4">
            Crea un blocco per rendere un&apos;imbarcazione non prenotabile durante manutenzione o fermo tecnico.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Crea Primo Blocco
          </button>
        </div>
      )}

      {/* Modal Nuovo/Modifica Blocco */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingId ? 'Modifica Blocco' : 'Nuovo Blocco'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Imbarcazione *</label>
                <select
                  value={formData.imbarcazione_id}
                  onChange={(e) => setFormData({ ...formData, imbarcazione_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Seleziona imbarcazione</option>
                  {imbarcazioni.map((imb) => (
                    <option key={imb.id} value={imb.id}>
                      {imb.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data Inizio *</label>
                  <input
                    type="date"
                    value={formData.data_inizio}
                    onChange={(e) => setFormData({ ...formData, data_inizio: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data Fine *</label>
                  <input
                    type="date"
                    value={formData.data_fine}
                    onChange={(e) => setFormData({ ...formData, data_fine: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Motivo *</label>
                <select
                  value={formData.motivo}
                  onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Seleziona motivo</option>
                  <option value="Manutenzione ordinaria">Manutenzione ordinaria</option>
                  <option value="Manutenzione straordinaria">Manutenzione straordinaria</option>
                  <option value="Revisione motori">Revisione motori</option>
                  <option value="Revisione carena">Revisione carena</option>
                  <option value="Fermo tecnico">Fermo tecnico</option>
                  <option value="Fermo amministrativo">Fermo amministrativo</option>
                  <option value="Riparazioni">Riparazioni</option>
                  <option value="Altro">Altro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Dettagli aggiuntivi, officina, costi..."
                />
              </div>

              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                <div className="flex items-start">
                  <span className="text-2xl mr-3">⚠️</span>
                  <div>
                    <p className="text-sm text-yellow-800 font-medium">Attenzione</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      L&apos;imbarcazione non sarà prenotabile durante questo periodo. 
                      Verifica che non ci siano prenotazioni esistenti.
                    </p>
                  </div>
                </div>
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
                  {editingId ? 'Aggiorna Blocco' : 'Crea Blocco'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}