'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function SkipperPage() {
  const [skipper, setSkipper] = useState<any[]>([])
  const [skipperFiltrati, setSkipperFiltrati] = useState<any[]>([])
  const [fornitori, setFornitori] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroStato, setFiltroStato] = useState<string>('tutti')
  const [filtroFornitore, setFiltroFornitore] = useState<string>('tutti')

  const [formData, setFormData] = useState({
    fornitore_id: '',
    nome: '',
    cognome: '',
    numero_patente: '',
    scadenza_patente: '',
    telefono: '',
    email: '',
    attivo: true,
  })

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  useEffect(() => { loadData() }, [])

  useEffect(() => { applicaFiltri() }, [skipper, searchTerm, filtroStato, filtroFornitore])

  async function loadData() {
    try {
      setLoading(true)
      const [{ data: fornData }, { data: skipData }] = await Promise.all([
        supabase.from('fornitori').select('id, ragione_sociale').eq('attivo', true).order('ragione_sociale'),
        supabase.from('skipper')
          .select('*, fornitori(ragione_sociale)')
          .order('cognome')
      ])
      setFornitori(fornData || [])
      setSkipper(skipData || [])
    } catch (e) {
      console.error(e)
      toast.error('Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }

  function applicaFiltri() {
    let f = [...skipper]
    if (filtroStato !== 'tutti') f = f.filter(s => s.attivo === (filtroStato === 'attivo'))
    if (filtroFornitore !== 'tutti') f = f.filter(s => s.fornitore_id === filtroFornitore)
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase()
      f = f.filter(s =>
        s.nome?.toLowerCase().includes(t) ||
        s.cognome?.toLowerCase().includes(t) ||
        s.numero_patente?.toLowerCase().includes(t) ||
        s.telefono?.includes(t)
      )
    }
    setSkipperFiltrati(f)
  }

  function handleNew() {
    setEditingId(null)
    setFormData({ fornitore_id: '', nome: '', cognome: '', numero_patente: '', scadenza_patente: '', telefono: '', email: '', attivo: true })
    setFormErrors({})
    setShowModal(true)
  }

  function handleEdit(s: any) {
    setEditingId(s.id)
    setFormData({
      fornitore_id: s.fornitore_id || '',
      nome: s.nome || '',
      cognome: s.cognome || '',
      numero_patente: s.numero_patente || '',
      scadenza_patente: s.scadenza_patente || '',
      telefono: s.telefono || '',
      email: s.email || '',
      attivo: s.attivo,
    })
    setFormErrors({})
    setShowModal(true)
  }

  function validate() {
    const errors: Record<string, string> = {}
    if (!formData.fornitore_id) errors.fornitore_id = 'Obbligatorio'
    if (!formData.nome.trim()) errors.nome = 'Obbligatorio'
    if (!formData.cognome.trim()) errors.cognome = 'Obbligatorio'
    if (!formData.numero_patente.trim()) errors.numero_patente = 'Obbligatorio'
    if (!formData.scadenza_patente) errors.scadenza_patente = 'Obbligatorio'
    if (!formData.telefono.trim()) errors.telefono = 'Obbligatorio'
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Email non valida'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    try {
      setSaving(true)
      const data = {
        fornitore_id: formData.fornitore_id,
        nome: formData.nome.trim(),
        cognome: formData.cognome.trim(),
        numero_patente: formData.numero_patente.trim(),
        scadenza_patente: formData.scadenza_patente,
        telefono: formData.telefono.trim(),
        email: formData.email.trim() || null,
        attivo: formData.attivo,
      }
      if (editingId) {
        const { error } = await supabase.from('skipper').update(data).eq('id', editingId)
        if (error) throw error
        toast.success('Skipper aggiornato!')
      } else {
        const { error } = await supabase.from('skipper').insert([data])
        if (error) throw error
        toast.success('Skipper creato!')
      }
      setShowModal(false)
      loadData()
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, nome: string) {
    if (!confirm(`Eliminare lo skipper ${nome}?`)) return
    try {
      const { error } = await supabase.from('skipper').delete().eq('id', id)
      if (error) throw error
      toast.success('Skipper eliminato')
      loadData()
    } catch (e: any) {
      toast.error('Errore nell\'eliminazione')
    }
  }

  async function toggleAttivo(s: any) {
    try {
      const { error } = await supabase.from('skipper').update({ attivo: !s.attivo }).eq('id', s.id)
      if (error) throw error
      toast.success(s.attivo ? 'Skipper disattivato' : 'Skipper attivato')
      loadData()
    } catch {
      toast.error('Errore aggiornamento stato')
    }
  }

  // Calcola giorni alla scadenza patente
  function giorniScadenza(dataStr: string) {
    const oggi = new Date()
    const scad = new Date(dataStr)
    return Math.ceil((scad.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24))
  }

  function badgeScadenza(dataStr: string) {
    const giorni = giorniScadenza(dataStr)
    if (giorni < 0) return { label: 'SCADUTA', cls: 'bg-red-100 text-red-700 border-red-200' }
    if (giorni <= 30) return { label: `Scade in ${giorni}gg`, cls: 'bg-orange-100 text-orange-700 border-orange-200' }
    if (giorni <= 90) return { label: `Scade in ${giorni}gg`, cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' }
    return { label: new Date(dataStr).toLocaleDateString('it-IT'), cls: 'bg-green-100 text-green-700 border-green-200' }
  }

  const field = (label: string, key: keyof typeof formData, type = 'text', required = true) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={formData[key] as string}
        onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
        className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 ${
          formErrors[key] ? 'border-red-400 bg-red-50' : 'border-gray-300'
        }`}
      />
      {formErrors[key] && <p className="text-xs text-red-500 mt-0.5">{formErrors[key]}</p>}
    </div>
  )

  if (loading) {
    return <div className="p-8 text-gray-500">Caricamento skipper...</div>
  }

  const attivi = skipper.filter(s => s.attivo).length
  const scadutiOInScadenza = skipper.filter(s => s.scadenza_patente && giorniScadenza(s.scadenza_patente) <= 30).length

  return (
    <div className="p-4 md:p-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Skipper</h1>
          <p className="text-gray-500 mt-1 text-sm">Gestione skipper e patenti nautiche</p>
        </div>
        <button
          onClick={handleNew}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
        >
          + Nuovo Skipper
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Totale', val: skipper.length, color: 'text-gray-900', bg: 'bg-white' },
          { label: 'Attivi', val: attivi, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Non attivi', val: skipper.length - attivi, color: 'text-gray-500', bg: 'bg-white' },
          { label: 'Patenti in scadenza', val: scadutiOInScadenza, color: scadutiOInScadenza > 0 ? 'text-orange-600' : 'text-gray-400', bg: scadutiOInScadenza > 0 ? 'bg-orange-50' : 'bg-white' },
        ].map(({ label, val, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl border border-gray-200 p-4 text-center`}>
            <div className={`text-2xl font-bold ${color}`}>{val}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cerca</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nome, cognome, patente, telefono..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Stato</label>
            <select
              value={filtroStato}
              onChange={(e) => setFiltroStato(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="tutti">Tutti</option>
              <option value="attivo">Attivi</option>
              <option value="non_attivo">Non attivi</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fornitore</label>
            <select
              value={filtroFornitore}
              onChange={(e) => setFiltroFornitore(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="tutti">Tutti</option>
              {fornitori.map(f => (
                <option key={f.id} value={f.id}>{f.ragione_sociale}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabella */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {skipperFiltrati.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">⚓</div>
            <p className="text-gray-500">Nessuno skipper trovato</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Skipper', 'Fornitore', 'Patente Nautica', 'Scadenza', 'Telefono', 'Stato', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {skipperFiltrati.map((s) => {
                  const badge = s.scadenza_patente ? badgeScadenza(s.scadenza_patente) : null
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      {/* Nome */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{s.cognome} {s.nome}</div>
                        {s.email && <div className="text-xs text-gray-400 mt-0.5">{s.email}</div>}
                      </td>
                      {/* Fornitore */}
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                          {s.fornitori?.ragione_sociale || '—'}
                        </span>
                      </td>
                      {/* Patente */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                          {s.numero_patente}
                        </span>
                      </td>
                      {/* Scadenza */}
                      <td className="px-4 py-3">
                        {badge ? (
                          <span className={`text-xs px-2 py-1 rounded-full border font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        ) : '—'}
                      </td>
                      {/* Telefono */}
                      <td className="px-4 py-3">
                        <a href={`tel:${s.telefono}`} className="text-blue-600 hover:underline text-sm">
                          {s.telefono}
                        </a>
                      </td>
                      {/* Stato */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleAttivo(s)}
                          className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                            s.attivo
                              ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                          }`}
                        >
                          {s.attivo ? '✅ Attivo' : '⏸ Non attivo'}
                        </button>
                      </td>
                      {/* Azioni */}
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleEdit(s)}
                            className="px-3 py-1.5 text-xs border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                          >
                            ✏️ Modifica
                          </button>
                          <button
                            onClick={() => handleDelete(s.id, `${s.nome} ${s.cognome}`)}
                            className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header modal */}
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingId ? 'Modifica Skipper' : 'Nuovo Skipper'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">I campi con * sono obbligatori</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">

              {/* Fornitore */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fornitore <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.fornitore_id}
                  onChange={(e) => setFormData({ ...formData, fornitore_id: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 ${
                    formErrors.fornitore_id ? 'border-red-400 bg-red-50' : 'border-gray-300'
                  }`}
                >
                  <option value="">Seleziona fornitore...</option>
                  {fornitori.map(f => (
                    <option key={f.id} value={f.id}>{f.ragione_sociale}</option>
                  ))}
                </select>
                {formErrors.fornitore_id && <p className="text-xs text-red-500 mt-0.5">{formErrors.fornitore_id}</p>}
              </div>

              {/* Nome + Cognome */}
              <div className="grid grid-cols-2 gap-4">
                {field('Nome', 'nome')}
                {field('Cognome', 'cognome')}
              </div>

              {/* Patente + Scadenza */}
              <div className="grid grid-cols-2 gap-4">
                {field('N° Patente Nautica', 'numero_patente')}
                {field('Scadenza Patente', 'scadenza_patente', 'date')}
              </div>

              {/* Telefono + Email */}
              <div className="grid grid-cols-2 gap-4">
                {field('Telefono', 'telefono', 'tel')}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-gray-400 text-xs font-normal">(facoltativo)</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 ${
                      formErrors.email ? 'border-red-400 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="skipper@email.com"
                  />
                  {formErrors.email && <p className="text-xs text-red-500 mt-0.5">{formErrors.email}</p>}
                </div>
              </div>

              {/* Stato */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="attivo"
                  checked={formData.attivo}
                  onChange={(e) => setFormData({ ...formData, attivo: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="attivo" className="text-sm font-medium text-gray-700">
                  Skipper attivo
                </label>
              </div>

              {/* Azioni */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                  disabled={saving}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                  disabled={saving}
                >
                  {saving ? 'Salvataggio...' : editingId ? 'Aggiorna Skipper' : 'Crea Skipper'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}