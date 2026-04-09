'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

interface Affiliato {
  id: string
  codice: string
  attivo: boolean
  ragione_sociale: string
  tipo_affiliato: string
  referente_nome?: string
  referente_cognome?: string
  email: string
  telefono?: string
  sito_web?: string
  piva?: string
  codice_fiscale?: string
  indirizzo?: string
  citta?: string
  cap?: string
  provincia?: string
  paese?: string
  codice_sdi?: string
  pec?: string
  commissione_percentuale: number
  note_interne?: string
  totale_prenotazioni?: number
  totale_generato?: number
  created_at?: string
}

interface CommissioneRiga {
  codice: string
  ragione_sociale: string
  email: string
  commissione_percentuale: number
  mese: string
  n_prenotazioni: number
  fatturato_generato: number
  commissione_dovuta: number
}

const TIPO_OPTIONS = ['struttura', 'agenzia', 'guida', 'altro']

const emptyForm: Omit<Affiliato, 'id' | 'codice'> = {
  attivo: false,
  ragione_sociale: '',
  tipo_affiliato: 'struttura',
  referente_nome: '',
  referente_cognome: '',
  email: '',
  telefono: '',
  sito_web: '',
  piva: '',
  codice_fiscale: '',
  indirizzo: '',
  citta: '',
  cap: '',
  provincia: '',
  paese: 'IT',
  codice_sdi: '',
  pec: '',
  commissione_percentuale: 12.5,
  note_interne: '',
}

export default function AffiliatiPage() {
  const [loading, setLoading] = useState(true)
  const [affiliati, setAffiliati] = useState<Affiliato[]>([])
  const [commissioni, setCommissioni] = useState<CommissioneRiga[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroStato, setFiltroStato] = useState<string>('tutti')
  const [filtroTipo, setFiltroTipo] = useState<string>('tutti')
  const [activeTab, setActiveTab] = useState<'lista' | 'commissioni'>('lista')
  const [meseCommissioni, setMeseCommissioni] = useState(format(new Date(), 'yyyy-MM'))
  const [formData, setFormData] = useState<Omit<Affiliato, 'id' | 'codice'>>(emptyForm)
  const [copiato, setCopiato] = useState<string | null>(null)

  useEffect(() => { loadAffiliati() }, [])
  useEffect(() => { if (activeTab === 'commissioni') loadCommissioni() }, [activeTab, meseCommissioni])

  async function loadAffiliati() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('affiliati')
        .select('*')
        .order('ragione_sociale')
      if (error) throw error
      setAffiliati(data || [])
    } catch (e: any) {
      toast.error('Errore nel caricamento affiliati')
    } finally {
      setLoading(false)
    }
  }

  async function loadCommissioni() {
    try {
      const inizioMese = meseCommissioni + '-01'
      const dataInizio = new Date(inizioMese)
      const dataFine = new Date(dataInizio.getFullYear(), dataInizio.getMonth() + 1, 0)
      const fineMese = format(dataFine, 'yyyy-MM-dd')

      const { data, error } = await supabase
        .from('v_commissioni_affiliati')
        .select('*')
        .gte('mese', meseCommissioni + '-01')
        .lte('mese', meseCommissioni + '-31')
      if (error) throw error
      setCommissioni(data || [])
    } catch (e: any) {
      toast.error('Errore nel caricamento commissioni')
    }
  }

  function handleNew() {
    setEditingId(null)
    setFormData({ ...emptyForm })
    setShowModal(true)
  }

  function handleEdit(a: Affiliato) {
    setEditingId(a.id)
    setFormData({
      attivo: a.attivo,
      ragione_sociale: a.ragione_sociale,
      tipo_affiliato: a.tipo_affiliato || 'struttura',
      referente_nome: a.referente_nome || '',
      referente_cognome: a.referente_cognome || '',
      email: a.email,
      telefono: a.telefono || '',
      sito_web: a.sito_web || '',
      piva: a.piva || '',
      codice_fiscale: a.codice_fiscale || '',
      indirizzo: a.indirizzo || '',
      citta: a.citta || '',
      cap: a.cap || '',
      provincia: a.provincia || '',
      paese: a.paese || 'IT',
      codice_sdi: a.codice_sdi || '',
      pec: a.pec || '',
      commissione_percentuale: a.commissione_percentuale ?? 12.5,
      note_interne: a.note_interne || '',
    })
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const dataToSave = {
        ragione_sociale: formData.ragione_sociale,
        tipo_affiliato: formData.tipo_affiliato,
        referente_nome: formData.referente_nome || null,
        referente_cognome: formData.referente_cognome || null,
        email: formData.email,
        telefono: formData.telefono || null,
        sito_web: formData.sito_web || null,
        piva: formData.piva || null,
        codice_fiscale: formData.codice_fiscale || null,
        indirizzo: formData.indirizzo || null,
        citta: formData.citta || null,
        cap: formData.cap || null,
        provincia: formData.provincia || null,
        paese: formData.paese || 'IT',
        codice_sdi: formData.codice_sdi || null,
        pec: formData.pec || null,
        commissione_percentuale: formData.commissione_percentuale,
        note_interne: formData.note_interne || null,
        attivo: formData.attivo,
      }

      if (editingId) {
        const { error } = await supabase.from('affiliati').update(dataToSave).eq('id', editingId)
        if (error) throw error
        toast.success('Affiliato aggiornato!')
      } else {
        const { error } = await supabase.from('affiliati').insert([dataToSave])
        if (error) throw error
        toast.success('Affiliato creato!')
      }
      setShowModal(false)
      loadAffiliati()
    } catch (e: any) {
      toast.error(e.message || 'Errore nel salvataggio')
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from('affiliati').delete().eq('id', id)
      if (error) throw error
      toast.success('Affiliato eliminato')
      setShowDeleteConfirm(null)
      loadAffiliati()
    } catch (e: any) {
      toast.error('Errore nell\'eliminazione')
    }
  }

  async function toggleAttivo(affiliato: Affiliato) {
    try {
      const { error } = await supabase
        .from('affiliati')
        .update({ attivo: !affiliato.attivo })
        .eq('id', affiliato.id)
      if (error) throw error
      toast.success(affiliato.attivo ? 'Affiliato disattivato' : 'Affiliato attivato!')
      loadAffiliati()
    } catch (e: any) {
      toast.error('Errore aggiornamento stato')
    }
  }

  function copiaLink(affiliato: Affiliato) {
    const link = `https://blualliancegroup.com/?ref=${affiliato.codice}`
    navigator.clipboard.writeText(link)
    setCopiato(affiliato.id)
    toast.success('Link copiato!')
    setTimeout(() => setCopiato(null), 2000)
  }

  function copiaCodice(affiliato: Affiliato) {
    navigator.clipboard.writeText(affiliato.codice)
    setCopiato(affiliato.id + '-cod')
    toast.success('Codice copiato!')
    setTimeout(() => setCopiato(null), 2000)
  }

  const affiliatiFiltrati = affiliati.filter(a => {
    if (filtroStato === 'attivi' && !a.attivo) return false
    if (filtroStato === 'inattivi' && a.attivo) return false
    if (filtroStato === 'in_attesa' && a.attivo) return false
    if (filtroTipo !== 'tutti' && a.tipo_affiliato !== filtroTipo) return false
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase()
      return a.ragione_sociale.toLowerCase().includes(t) ||
        a.email?.toLowerCase().includes(t) ||
        a.codice?.toLowerCase().includes(t) ||
        a.referente_nome?.toLowerCase().includes(t) ||
        a.referente_cognome?.toLowerCase().includes(t) ||
        a.citta?.toLowerCase().includes(t)
    }
    return true
  })

  const totaleCommissioni = commissioni.reduce((s, c) => s + Number(c.commissione_dovuta), 0)
  const totaleFatturato = commissioni.reduce((s, c) => s + Number(c.fatturato_generato), 0)

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  if (loading) return (
    <div className="p-8 text-gray-500 flex items-center gap-2">
      <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
      Caricamento affiliati...
    </div>
  )

  return (
    <div className="p-4 md:p-8">

      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Programma Affiliati</h1>
          <p className="text-gray-500 mt-1 text-sm">Strutture ricettive, agenzie e guide che portano prenotazioni</p>
        </div>
        <button onClick={handleNew} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
          + Nuovo Affiliato
        </button>
      </div>

      {/* ── STATS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Totale', val: affiliati.length, color: 'text-gray-900', bg: 'bg-white' },
          { label: 'Attivi', val: affiliati.filter(a => a.attivo).length, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'In Attesa', val: affiliati.filter(a => !a.attivo).length, color: 'text-orange-700', bg: 'bg-orange-50' },
          { label: 'Comm. Default', val: '12,5%', color: 'text-blue-700', bg: 'bg-blue-50' },
        ].map(({ label, val, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl border border-gray-200 p-4 text-center`}>
            <div className={`text-2xl font-bold ${color}`}>{val}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* ── TABS ── */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {(['lista', 'commissioni'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab === 'lista' ? '👥 Lista Affiliati' : '💰 Commissioni'}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════
          TAB: LISTA
      ══════════════════════════════════════════ */}
      {activeTab === 'lista' && (
        <>
          {/* Filtri */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Cerca per nome, email, codice, città..."
                className={inputClass}
              />
              <select value={filtroStato} onChange={e => setFiltroStato(e.target.value)} className={inputClass}>
                <option value="tutti">Tutti gli stati</option>
                <option value="attivi">Solo attivi</option>
                <option value="inattivi">In attesa approvazione</option>
              </select>
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className={inputClass}>
                <option value="tutti">Tutti i tipi</option>
                {TIPO_OPTIONS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {affiliatiFiltrati.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border">
              <div className="text-5xl mb-3">🤝</div>
              <p className="text-gray-500 font-medium">Nessun affiliato trovato</p>
              <p className="text-gray-400 text-sm mt-1">Aggiungi la prima struttura al programma</p>
            </div>
          ) : (
            <div className="space-y-4">
              {affiliatiFiltrati.map(affiliato => {
                const isExpanded = expandedId === affiliato.id
                return (
                  <div key={affiliato.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

                    {/* Card Header */}
                    <div
                      className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : affiliato.id)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="text-lg font-bold text-gray-900 truncate">{affiliato.ragione_sociale}</h3>
                            {/* Badge codice */}
                            <span className="px-2 py-0.5 text-xs font-mono bg-blue-50 text-blue-700 border border-blue-200 rounded-full flex-shrink-0">
                              {affiliato.codice}
                            </span>
                            {/* Badge stato */}
                            <span className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${
                              affiliato.attivo
                                ? 'bg-green-100 text-green-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {affiliato.attivo ? '✅ Attivo' : '⏳ In attesa'}
                            </span>
                            {/* Badge tipo */}
                            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full flex-shrink-0">
                              {affiliato.tipo_affiliato}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                            {(affiliato.referente_nome || affiliato.referente_cognome) && (
                              <span>👤 {[affiliato.referente_nome, affiliato.referente_cognome].filter(Boolean).join(' ')}</span>
                            )}
                            {affiliato.email && <span>📧 {affiliato.email}</span>}
                            {affiliato.telefono && <span>📱 {affiliato.telefono}</span>}
                            {affiliato.citta && <span>📍 {affiliato.citta} {affiliato.provincia && `(${affiliato.provincia})`}</span>}
                          </div>
                        </div>

                        {/* Mini stats */}
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-center hidden sm:block">
                            <div className="text-lg font-bold text-blue-700">{affiliato.commissione_percentuale}%</div>
                            <div className="text-xs text-gray-500">Commissione</div>
                          </div>
                          <div className="text-center hidden sm:block">
                            <div className="text-lg font-bold text-gray-900">{affiliato.totale_prenotazioni ?? 0}</div>
                            <div className="text-xs text-gray-500">Prenotazioni</div>
                          </div>
                          <div className="text-center hidden sm:block">
                            <div className="text-lg font-bold text-green-600">€{Number(affiliato.totale_generato ?? 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })}</div>
                            <div className="text-xs text-gray-500">Generato</div>
                          </div>
                          <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                        </div>
                      </div>
                    </div>

                    {/* Dettaglio espandibile */}
                    {isExpanded && (
                      <div className="border-t border-gray-200">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 lg:divide-x divide-gray-200">

                          {/* Col 1: Dati */}
                          <div className="p-5">
                            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">🏢 Dati Aziendali</h4>
                            <div className="space-y-2 text-sm">
                              {affiliato.piva && <div><span className="text-gray-500">P.IVA:</span> <span className="font-mono">{affiliato.piva}</span></div>}
                              {affiliato.codice_fiscale && <div><span className="text-gray-500">C.F.:</span> <span className="font-mono">{affiliato.codice_fiscale}</span></div>}
                              {affiliato.codice_sdi && <div><span className="text-gray-500">SDI:</span> <span className="font-mono">{affiliato.codice_sdi}</span></div>}
                              {affiliato.pec && <div><span className="text-gray-500">PEC:</span> {affiliato.pec}</div>}
                              {affiliato.indirizzo && (
                                <div><span className="text-gray-500">Indirizzo:</span> {affiliato.indirizzo}, {affiliato.cap} {affiliato.citta} {affiliato.provincia && `(${affiliato.provincia})`}</div>
                              )}
                              {affiliato.sito_web && (
                                <div><span className="text-gray-500">Sito:</span> <a href={affiliato.sito_web} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{affiliato.sito_web}</a></div>
                              )}
                            </div>
                            {affiliato.note_interne && (
                              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                                📝 {affiliato.note_interne}
                              </div>
                            )}
                          </div>

                          {/* Col 2: Codice e Link */}
                          <div className="p-5">
                            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">🔗 Codice & Link Affiliato</h4>
                            <div className="space-y-3">
                              {/* Codice */}
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Codice univoco</p>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-lg font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 flex-1 text-center">
                                    {affiliato.codice}
                                  </span>
                                  <button
                                    onClick={() => copiaCodice(affiliato)}
                                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                                  >
                                    {copiato === affiliato.id + '-cod' ? '✅' : '📋'}
                                  </button>
                                </div>
                              </div>

                              {/* Link tracking */}
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Link tracciato (da inviare alla struttura)</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-gray-600 bg-gray-50 px-2 py-1.5 rounded-lg border flex-1 truncate">
                                    blualliancegroup.com/?ref={affiliato.codice}
                                  </span>
                                  <button
                                    onClick={() => copiaLink(affiliato)}
                                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-sm flex-shrink-0"
                                  >
                                    {copiato === affiliato.id ? '✅' : '🔗 Copia'}
                                  </button>
                                </div>
                              </div>

                              {/* Commissione */}
                              <div className="bg-blue-50 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-600">Commissione applicata</span>
                                  <span className="text-xl font-bold text-blue-700">{affiliato.commissione_percentuale}%</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">pagata mensilmente su valore netto prenotazioni</p>
                              </div>
                            </div>
                          </div>

                          {/* Col 3: Performance */}
                          <div className="p-5">
                            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">📊 Performance</h4>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                              <div className="bg-purple-50 rounded-lg p-3 text-center">
                                <div className="text-xl font-bold text-purple-700">{affiliato.totale_prenotazioni ?? 0}</div>
                                <div className="text-xs text-gray-500">Prenotazioni</div>
                              </div>
                              <div className="bg-green-50 rounded-lg p-3 text-center">
                                <div className="text-xl font-bold text-green-700">€{Number(affiliato.totale_generato ?? 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })}</div>
                                <div className="text-xs text-gray-500">Fatturato</div>
                              </div>
                            </div>
                            {Number(affiliato.totale_generato ?? 0) > 0 && (
                              <div className="bg-orange-50 rounded-lg p-3 text-center">
                                <div className="text-xl font-bold text-orange-700">
                                  €{(Number(affiliato.totale_generato ?? 0) * affiliato.commissione_percentuale / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                </div>
                                <div className="text-xs text-gray-500">Commissioni totali maturate</div>
                              </div>
                            )}
                            <p className="text-xs text-gray-400 mt-3">
                              Registrato il {affiliato.created_at ? format(new Date(affiliato.created_at), 'dd/MM/yyyy', { locale: it }) : '—'}
                            </p>
                          </div>
                        </div>

                        {/* Azioni */}
                        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex gap-2 justify-end flex-wrap">
                          <button
                            onClick={() => toggleAttivo(affiliato)}
                            className={`px-4 py-2 text-sm rounded-lg font-medium ${
                              affiliato.attivo
                                ? 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                                : 'bg-green-50 text-green-600 hover:bg-green-100'
                            }`}
                          >
                            {affiliato.attivo ? '⏸ Disattiva' : '✅ Approva & Attiva'}
                          </button>
                          <button onClick={() => handleEdit(affiliato)} className="px-4 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium">
                            ✏️ Modifica
                          </button>
                          <button onClick={() => setShowDeleteConfirm(affiliato.id)} className="px-4 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                            🗑️ Elimina
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════
          TAB: COMMISSIONI
      ══════════════════════════════════════════ */}
      {activeTab === 'commissioni' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
            <div>
              <label className={labelClass}>Mese di riferimento</label>
              <input
                type="month"
                value={meseCommissioni}
                onChange={e => setMeseCommissioni(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {commissioni.length > 0 && (
              <div className="flex gap-3 sm:ml-auto">
                <div className="bg-blue-50 rounded-lg px-4 py-2 text-center">
                  <div className="text-lg font-bold text-blue-700">€{totaleFatturato.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                  <div className="text-xs text-gray-500">Fatturato generato</div>
                </div>
                <div className="bg-orange-50 rounded-lg px-4 py-2 text-center">
                  <div className="text-lg font-bold text-orange-700">€{totaleCommissioni.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                  <div className="text-xs text-gray-500">Commissioni da pagare</div>
                </div>
              </div>
            )}
          </div>

          {commissioni.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border">
              <div className="text-5xl mb-3">📊</div>
              <p className="text-gray-500 font-medium">Nessuna commissione per questo mese</p>
              <p className="text-gray-400 text-sm mt-1">Le commissioni appaiono quando ci sono prenotazioni tracciate con codice affiliato</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-900 text-white">
                    <th className="text-left px-4 py-3 font-medium">Affiliato</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Email</th>
                    <th className="text-center px-4 py-3 font-medium">Prenotazioni</th>
                    <th className="text-right px-4 py-3 font-medium">Fatturato</th>
                    <th className="text-center px-4 py-3 font-medium">Comm. %</th>
                    <th className="text-right px-4 py-3 font-medium">Da Pagare</th>
                  </tr>
                </thead>
                <tbody>
                  {commissioni.map((c, i) => (
                    <tr key={c.codice} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{c.ragione_sociale}</div>
                        <div className="text-xs font-mono text-blue-600">{c.codice}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{c.email}</td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-900">{c.n_prenotazioni}</td>
                      <td className="px-4 py-3 text-right text-gray-700">€{Number(c.fatturato_generato).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">{c.commissione_percentuale}%</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-orange-600">
                        €{Number(c.commissione_dovuta).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                    <td className="px-4 py-3 text-gray-700" colSpan={2}>TOTALE MESE</td>
                    <td className="px-4 py-3 text-center text-gray-900">{commissioni.reduce((s, c) => s + Number(c.n_prenotazioni), 0)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">€{totaleFatturato.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
                    <td />
                    <td className="px-4 py-3 text-right text-orange-700 text-base">€{totaleCommissioni.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          MODAL FORM
      ══════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white p-6 border-b flex items-center justify-between rounded-t-xl">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{editingId ? 'Modifica Affiliato' : 'Nuovo Affiliato'}</h2>
                <p className="text-xs text-gray-500 mt-0.5">Il codice BLU-XXXX viene assegnato automaticamente</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">

              {/* ANAGRAFICA */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Anagrafica</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Ragione Sociale <span className="text-red-500">*</span></label>
                    <input type="text" value={formData.ragione_sociale} onChange={e => setFormData(p => ({ ...p, ragione_sociale: e.target.value }))} className={inputClass} required />
                  </div>
                  <div>
                    <label className={labelClass}>Tipo Affiliato</label>
                    <select value={formData.tipo_affiliato} onChange={e => setFormData(p => ({ ...p, tipo_affiliato: e.target.value }))} className={inputClass}>
                      {TIPO_OPTIONS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Email <span className="text-red-500">*</span></label>
                    <input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} className={inputClass} required />
                  </div>
                  <div>
                    <label className={labelClass}>Referente Nome</label>
                    <input type="text" value={formData.referente_nome || ''} onChange={e => setFormData(p => ({ ...p, referente_nome: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Referente Cognome</label>
                    <input type="text" value={formData.referente_cognome || ''} onChange={e => setFormData(p => ({ ...p, referente_cognome: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Telefono</label>
                    <input type="tel" value={formData.telefono || ''} onChange={e => setFormData(p => ({ ...p, telefono: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Sito Web</label>
                    <input type="url" value={formData.sito_web || ''} onChange={e => setFormData(p => ({ ...p, sito_web: e.target.value }))} className={inputClass} placeholder="https://" />
                  </div>
                </div>
              </div>

              {/* DATI FISCALI */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Dati Fiscali</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Partita IVA</label>
                    <input type="text" value={formData.piva || ''} onChange={e => setFormData(p => ({ ...p, piva: e.target.value }))} className={inputClass} maxLength={11} />
                  </div>
                  <div>
                    <label className={labelClass}>Codice Fiscale</label>
                    <input type="text" value={formData.codice_fiscale || ''} onChange={e => setFormData(p => ({ ...p, codice_fiscale: e.target.value.toUpperCase() }))} className={inputClass} maxLength={16} />
                  </div>
                  <div>
                    <label className={labelClass}>Codice SDI</label>
                    <input type="text" value={formData.codice_sdi || ''} onChange={e => setFormData(p => ({ ...p, codice_sdi: e.target.value.toUpperCase() }))} className={inputClass} maxLength={7} />
                  </div>
                  <div className="md:col-span-3">
                    <label className={labelClass}>PEC</label>
                    <input type="email" value={formData.pec || ''} onChange={e => setFormData(p => ({ ...p, pec: e.target.value }))} className={inputClass} />
                  </div>
                </div>
              </div>

              {/* INDIRIZZO */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Indirizzo</h3>
                <div className="space-y-3">
                  <input type="text" value={formData.indirizzo || ''} onChange={e => setFormData(p => ({ ...p, indirizzo: e.target.value }))} className={inputClass} placeholder="Via / Piazza..." />
                  <div className="grid grid-cols-3 gap-3">
                    <input type="text" value={formData.citta || ''} onChange={e => setFormData(p => ({ ...p, citta: e.target.value }))} className={inputClass} placeholder="Città" />
                    <input type="text" value={formData.cap || ''} onChange={e => setFormData(p => ({ ...p, cap: e.target.value }))} className={inputClass} placeholder="CAP" maxLength={5} />
                    <input type="text" value={formData.provincia || ''} onChange={e => setFormData(p => ({ ...p, provincia: e.target.value.toUpperCase() }))} className={inputClass} placeholder="PR" maxLength={2} />
                  </div>
                </div>
              </div>

              {/* COMMISSIONE & NOTE */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Commissione & Note</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Commissione %</label>
                    <input
                      type="number" min="0" max="100" step="0.5"
                      value={formData.commissione_percentuale}
                      onChange={e => setFormData(p => ({ ...p, commissione_percentuale: parseFloat(e.target.value) || 0 }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Note Interne</label>
                    <textarea value={formData.note_interne || ''} onChange={e => setFormData(p => ({ ...p, note_interne: e.target.value }))} className={inputClass} rows={2} />
                  </div>
                </div>
              </div>

              {/* STATO */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox" id="attivo-aff"
                  checked={formData.attivo}
                  onChange={e => setFormData(p => ({ ...p, attivo: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="attivo-aff" className="text-sm font-medium text-gray-700">
                  Affiliato approvato e attivo
                </label>
              </div>

              {/* ACTIONS */}
              <div className="flex gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
                  Annulla
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                  {editingId ? 'Salva Modifiche' : 'Crea Affiliato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Conferma Eliminazione</h3>
            <p className="text-gray-600 mb-6 text-sm">Sei sicuro di voler eliminare questo affiliato? Le prenotazioni già tracciate manterranno il codice ma non saranno più associate a nessun affiliato.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
                Annulla
              </button>
              <button onClick={() => handleDelete(showDeleteConfirm)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}