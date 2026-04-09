'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

interface Fornitore {
  id: string
  ragione_sociale: string
  nome_referente?: string
  email?: string
  telefono?: string
  telefono_2?: string
  telefono_2_nome?: string
  pec?: string
  partita_iva?: string
  codice_fiscale?: string
  codice_sdi?: string
  indirizzo?: string
  citta?: string
  cap?: string
  provincia?: string
  iban?: string
  banca?: string
  percentuale_commissione?: number
  note?: string
  base_nautica?: string
  data_inizio_attivita?: string
  capitaneria_porto?: string
  art_68?: boolean
  num_dipendenti?: number
  attivo: boolean
  created_at?: string
  imbarcazioni?: any[]
  skipper?: any[]
}

export default function FornitoriPage() {
  const [loading, setLoading] = useState(true)
  const [fornitori, setFornitori] = useState<Fornitore[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroStato, setFiltroStato] = useState<string>('tutti')
  const [showEstrattoModal, setShowEstrattoModal] = useState(false)
  const [fornitoreSelezionato, setFornitoreSelezionato] = useState<any>(null)
  const [meseSelezionato, setMeseSelezionato] = useState(format(new Date(), 'yyyy-MM'))
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [inviandoEmail, setInviandoEmail] = useState(false)
  const emptyForm: Fornitore = {
    id: '',
    ragione_sociale: '',
    nome_referente: '',
    email: '',
    telefono: '',
    telefono_2: '',
    telefono_2_nome: '',
    pec: '',
    partita_iva: '',
    codice_fiscale: '',
    codice_sdi: '',
    indirizzo: '',
    citta: '',
    cap: '',
    provincia: '',
    iban: '',
    banca: '',
    percentuale_commissione: 25,
    note: '',
    base_nautica: '',
    data_inizio_attivita: '',
    capitaneria_porto: '',
    art_68: false,
    num_dipendenti: 0,
    attivo: true
  }

  const [formData, setFormData] = useState<Fornitore>(emptyForm)

  useEffect(() => { loadFornitori() }, [])

  async function loadFornitori() {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('fornitori')
        .select(`
          *,
          imbarcazioni(
            id, nome, tipo, categoria,
            prenotazioni!prenotazioni_imbarcazione_id_fkey(
              id, prezzo_totale, caparra_ricevuta, saldo_ricevuto, stato, data_servizio
            )
          ),
          skipper(id, nome, cognome, numero_patente, scadenza_patente, telefono, attivo)
        `)
        .order('ragione_sociale')

      if (error) throw error

      // ⭐ Carica prenotazioni NS3000 (imbarcazione_id = null, source = 'ns3000')
      const { data: ns3000Prenotazioni } = await supabase
        .from('prenotazioni')
        .select('id, prezzo_totale, caparra_ricevuta, saldo_ricevuto, stato, data_servizio')
        .is('imbarcazione_id', null)
        .eq('source', 'ns3000')
        .neq('stato', 'cancellata')

      // ⭐ Aggiungi le prenotazioni NS3000 al fornitore NS3000
      const NS3000_FORNITORE_ID = '2d78fca2-f474-4c44-8443-44c75924d5c3'
      const fornitoriConNs3000 = (data || []).map(f => {
        if (f.id === NS3000_FORNITORE_ID && ns3000Prenotazioni?.length) {
          // Aggiungi una imbarcazione virtuale con le prenotazioni NS3000
          const imbarcazioneVirtuale = {
            id: 'ns3000-virtual',
            nome: 'Barche NS3000',
            tipo: 'ns3000',
            categoria: 'ns3000',
            prenotazioni: ns3000Prenotazioni
          }
          return {
            ...f,
            imbarcazioni: [...(f.imbarcazioni || []), imbarcazioneVirtuale]
          }
        }
        return f
      })

      setFornitori(fornitoriConNs3000)
    } catch (error: any) {
      console.error('Errore:', error)
      toast.error('Errore nel caricamento dei fornitori')
    } finally {
      setLoading(false)
    }
  }

  function handleNew() {
    setEditingId(null)
    setFormData({ ...emptyForm })
    setShowModal(true)
  }

  function handleEdit(f: Fornitore) {
    setEditingId(f.id)
    setFormData({
      ...emptyForm,
      ...f,
      nome_referente: f.nome_referente || '',
      email: f.email || '',
      telefono: f.telefono || '',
      telefono_2: f.telefono_2 || '',
      telefono_2_nome: f.telefono_2_nome || '',
      pec: f.pec || '',
      partita_iva: f.partita_iva || '',
      codice_fiscale: f.codice_fiscale || '',
      codice_sdi: f.codice_sdi || '',
      indirizzo: f.indirizzo || '',
      citta: f.citta || '',
      cap: f.cap || '',
      provincia: f.provincia || '',
      iban: f.iban || '',
      banca: f.banca || '',
      percentuale_commissione: f.percentuale_commissione ?? 25,
      note: f.note || '',
      base_nautica: f.base_nautica || '',
      data_inizio_attivita: f.data_inizio_attivita || '',
      capitaneria_porto: f.capitaneria_porto || '',
      art_68: f.art_68 || false,
      num_dipendenti: f.num_dipendenti || 0,
    })
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const dataToSave = {
        ragione_sociale: formData.ragione_sociale,
        nome_referente: formData.nome_referente || null,
        email: formData.email || null,
        telefono: formData.telefono || null,
        telefono_2: formData.telefono_2 || null,
        telefono_2_nome: formData.telefono_2_nome || null,
        pec: formData.pec || null,
        partita_iva: formData.partita_iva || null,
        codice_fiscale: formData.codice_fiscale || null,
        codice_sdi: formData.codice_sdi || null,
        indirizzo: formData.indirizzo || null,
        citta: formData.citta || null,
        cap: formData.cap || null,
        provincia: formData.provincia || null,
        iban: formData.iban || null,
        banca: formData.banca || null,
        percentuale_commissione: formData.percentuale_commissione || null,
        note: formData.note || null,
        base_nautica: formData.base_nautica || null,
        data_inizio_attivita: formData.data_inizio_attivita || null,
        capitaneria_porto: formData.capitaneria_porto || null,
        art_68: formData.art_68 || false,
        num_dipendenti: formData.num_dipendenti || null,
        attivo: formData.attivo
      }

      if (editingId) {
        const { error } = await supabase.from('fornitori').update(dataToSave).eq('id', editingId)
        if (error) throw error
        toast.success('Fornitore aggiornato!')
      } else {
        const { error } = await supabase.from('fornitori').insert([dataToSave])
        if (error) throw error
        toast.success('Fornitore creato!')
      }

      setShowModal(false)
      loadFornitori()
    } catch (error: any) {
      console.error('Errore salvataggio:', error)
      toast.error(error.message || 'Errore nel salvataggio')
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from('fornitori').delete().eq('id', id)
      if (error) throw error
      toast.success('Fornitore eliminato!')
      setShowDeleteConfirm(null)
      loadFornitori()
    } catch (error: any) {
      toast.error('Errore nell\'eliminazione')
    }
  }
function openEstrattoModal(fornitore: any) {
    setFornitoreSelezionato(fornitore)
    setMeseSelezionato(format(new Date(), 'yyyy-MM'))
    setShowEstrattoModal(true)
  }

  async function generaEstrattoConto() {
    if (!fornitoreSelezionato) return
    setGenerandoPdf(true)
    try {
      const inizioMese = meseSelezionato + '-01'
      const dataInizio = new Date(inizioMese)
      const dataFine = new Date(dataInizio.getFullYear(), dataInizio.getMonth() + 1, 0)
      const fineMese = format(dataFine, 'yyyy-MM-dd')

      const { data: prenotazioni, error } = await supabase
        .from('vista_vendite_fornitori')
        .select('*')
        .eq('fornitore_id', fornitoreSelezionato.id)
        .gte('data_servizio', inizioMese)
        .lte('data_servizio', fineMese)
        .order('data_servizio')

      if (error) throw error

      const totali = {
        fatturato: prenotazioni?.reduce((sum: number, p: any) => sum + Number(p.prezzo_totale || 0), 0) || 0,
        commissioni: 0,
        netto: 0
      }
      totali.commissioni = totali.fatturato * ((fornitoreSelezionato.percentuale_commissione || 25) / 100)
      totali.netto = totali.fatturato - totali.commissioni

      const response = await fetch('/api/genera-estratto-conto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fornitore: fornitoreSelezionato, mese: meseSelezionato, prenotazioni: prenotazioni || [], totali })
      })

      if (!response.ok) throw new Error('Errore generazione PDF')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `estratto-conto-${fornitoreSelezionato.ragione_sociale.replace(/\s+/g, '-')}-${meseSelezionato}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success('PDF generato e scaricato!')
    } catch (error: any) {
      toast.error('Errore: ' + error.message)
    } finally {
      setGenerandoPdf(false)
    }
  }

  async function inviaEstrattoConto() {
    if (!fornitoreSelezionato) return
    if (!fornitoreSelezionato.email) {
      toast.error('Il fornitore non ha un indirizzo email configurato')
      return
    }
    setInviandoEmail(true)
    try {
      const inizioMese = meseSelezionato + '-01'
      const dataInizio = new Date(inizioMese)
      const dataFine = new Date(dataInizio.getFullYear(), dataInizio.getMonth() + 1, 0)
      const fineMese = format(dataFine, 'yyyy-MM-dd')

      const { data: prenotazioni, error } = await supabase
        .from('vista_vendite_fornitori')
        .select('*')
        .eq('fornitore_id', fornitoreSelezionato.id)
        .gte('data_servizio', inizioMese)
        .lte('data_servizio', fineMese)
        .order('data_servizio')

      if (error) throw error

      const totali = {
        fatturato: prenotazioni?.reduce((sum: number, p: any) => sum + Number(p.prezzo_totale || 0), 0) || 0,
        commissioni: 0,
        netto: 0
      }
      totali.commissioni = totali.fatturato * ((fornitoreSelezionato.percentuale_commissione || 25) / 100)
      totali.netto = totali.fatturato - totali.commissioni

      const response = await fetch('/api/invia-estratto-conto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fornitore: fornitoreSelezionato, mese: meseSelezionato, prenotazioni: prenotazioni || [], totali })
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Errore invio email')

      toast.success(`Email inviata a ${fornitoreSelezionato.email}!`)
      setShowEstrattoModal(false)
    } catch (error: any) {
      toast.error('Errore: ' + error.message)
    } finally {
      setInviandoEmail(false)
    }
  }
  function calcolaStatistiche(fornitore: Fornitore) {
    const imbarcazioni = fornitore.imbarcazioni || []
    const prenotazioniValide = imbarcazioni.flatMap(imb =>
      (imb.prenotazioni || []).filter((p: any) => p.stato !== 'cancellata')
    )
    const totaleRevenue = prenotazioniValide.reduce((sum, p: any) => sum + (parseFloat(p.prezzo_totale) || 0), 0)
    const totaleIncassato = prenotazioniValide.reduce((sum, p: any) => sum + (parseFloat(p.caparra_ricevuta) || 0) + (parseFloat(p.saldo_ricevuto) || 0), 0)
    return {
      numImbarcazioni: imbarcazioni.length,
      numPrenotazioni: prenotazioniValide.length,
      totaleRevenue,
      totaleIncassato,
      daIncassare: totaleRevenue - totaleIncassato,
      percentualeIncassato: totaleRevenue > 0 ? (totaleIncassato / totaleRevenue * 100) : 0
    }
  }

  function giorniScadenza(dataStr: string) {
    return Math.ceil((new Date(dataStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  }

  // Filtri
  const fornitoriFiltrati = fornitori.filter(f => {
    if (filtroStato === 'attivi' && !f.attivo) return false
    if (filtroStato === 'inattivi' && f.attivo) return false
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase()
      return f.ragione_sociale.toLowerCase().includes(t) ||
        f.email?.toLowerCase().includes(t) ||
        f.nome_referente?.toLowerCase().includes(t) ||
        f.base_nautica?.toLowerCase().includes(t)
    }
    return true
  })

  // Helper per i campi form
  const field = (label: string, key: keyof Fornitore, type = 'text', opts?: { required?: boolean; maxLength?: number; placeholder?: string; className?: string }) => (
    <div className={opts?.className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {opts?.required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={(formData[key] as string) || ''}
        onChange={(e) => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        required={opts?.required}
        maxLength={opts?.maxLength}
        placeholder={opts?.placeholder}
      />
    </div>
  )

  if (loading) {
    return <div className="p-8 text-gray-500">Caricamento fornitori...</div>
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Fornitori</h1>
          <p className="text-gray-500 mt-1 text-sm">Gestione fornitori, performance e skipper</p>
        </div>
        <button onClick={handleNew} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
          + Nuovo Fornitore
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Totale', val: fornitori.length, color: 'text-gray-900', bg: 'bg-white' },
          { label: 'Attivi', val: fornitori.filter(f => f.attivo).length, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Imbarcazioni', val: fornitori.reduce((s, f) => s + (f.imbarcazioni?.length || 0), 0), color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Skipper', val: fornitori.reduce((s, f) => s + (f.skipper?.length || 0), 0), color: 'text-purple-700', bg: 'bg-purple-50' },
        ].map(({ label, val, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl border border-gray-200 p-4 text-center`}>
            <div className={`text-2xl font-bold ${color}`}>{val}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cerca ragione sociale, email, referente, base nautica..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <select
            value={filtroStato}
            onChange={(e) => setFiltroStato(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="tutti">Tutti</option>
            <option value="attivi">Solo attivi</option>
            <option value="inattivi">Solo inattivi</option>
          </select>
        </div>
      </div>

      {/* Lista Fornitori */}
      {fornitoriFiltrati.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <div className="text-4xl mb-3">🏢</div>
          <p className="text-gray-500">Nessun fornitore trovato</p>
        </div>
      ) : (
        <div className="space-y-4">
          {fornitoriFiltrati.map((fornitore) => {
            const stats = calcolaStatistiche(fornitore)
            const isExpanded = expandedId === fornitore.id
            const skipperList = fornitore.skipper || []

            return (
              <div key={fornitore.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Header Card — click per espandere */}
                <div
                  className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : fornitore.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold text-gray-900 truncate">{fornitore.ragione_sociale}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${fornitore.attivo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {fornitore.attivo ? '✅ Attivo' : '⏸ Inattivo'}
                        </span>
                        {fornitore.art_68 && (
                          <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full flex-shrink-0">Art. 68</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                        {fornitore.nome_referente && <span>👤 {fornitore.nome_referente}</span>}
                        {fornitore.email && <span>📧 {fornitore.email}</span>}
                        {fornitore.telefono && <span>📱 {fornitore.telefono}</span>}
                        {fornitore.telefono_2 && (
                        <span>📱 {fornitore.telefono_2}{fornitore.telefono_2_nome ? ` (${fornitore.telefono_2_nome})` : ''}</span>
                      )}
                        {fornitore.base_nautica && <span>⚓ {fornitore.base_nautica}</span>}
                        {fornitore.capitaneria_porto && <span>🏛️ C.P. {fornitore.capitaneria_porto}</span>}
                      </div>
                    </div>

                    {/* Mini stats a destra */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-900">{stats.numImbarcazioni}</div>
                        <div className="text-xs text-gray-500">Barche</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-900">{skipperList.length}</div>
                        <div className="text-xs text-gray-500">Skipper</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">€{stats.totaleIncassato.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</div>
                        <div className="text-xs text-gray-500">Incassato</div>
                      </div>
                      <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                  </div>
                </div>

                {/* Dettaglio espandibile */}
                {isExpanded && (
                  <div className="border-t border-gray-200">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 lg:divide-x divide-gray-200">

                      {/* Colonna 1: Dati Aziendali */}
                      <div className="p-5">
                        <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">🏢 Dati Aziendali</h4>
                        <div className="space-y-2 text-sm">
                          {fornitore.partita_iva && <div><span className="text-gray-500">P.IVA:</span> <span className="font-mono">{fornitore.partita_iva}</span></div>}
                          {fornitore.codice_fiscale && <div><span className="text-gray-500">C.F.:</span> <span className="font-mono">{fornitore.codice_fiscale}</span></div>}
                          {fornitore.codice_sdi && <div><span className="text-gray-500">SDI:</span> <span className="font-mono">{fornitore.codice_sdi}</span></div>}
                          {fornitore.pec && <div><span className="text-gray-500">PEC:</span> {fornitore.pec}</div>}
                          {fornitore.indirizzo && <div><span className="text-gray-500">Indirizzo:</span> {fornitore.indirizzo}, {fornitore.cap} {fornitore.citta} ({fornitore.provincia})</div>}
                          {fornitore.iban && <div><span className="text-gray-500">IBAN:</span> <span className="font-mono text-xs">{fornitore.iban}</span></div>}
                          {fornitore.banca && <div><span className="text-gray-500">Banca:</span> {fornitore.banca}</div>}
                          {fornitore.percentuale_commissione && <div><span className="text-gray-500">Commissione:</span> <span className="font-semibold text-blue-600">{fornitore.percentuale_commissione}%</span></div>}
                        </div>

                        <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mt-5 mb-3">⚓ Dati Nautici</h4>
                        <div className="space-y-2 text-sm">
                          {fornitore.base_nautica && <div><span className="text-gray-500">Base Nautica:</span> {fornitore.base_nautica}</div>}
                          {fornitore.data_inizio_attivita && <div><span className="text-gray-500">Inizio Attività:</span> {new Date(fornitore.data_inizio_attivita).toLocaleDateString('it-IT')}</div>}
                          {fornitore.capitaneria_porto && <div><span className="text-gray-500">Capitaneria:</span> {fornitore.capitaneria_porto}</div>}
                          <div><span className="text-gray-500">Art. 68:</span> {fornitore.art_68 ? <span className="text-green-600 font-semibold">Sì</span> : <span className="text-gray-400">No</span>}</div>
                          {fornitore.num_dipendenti != null && fornitore.num_dipendenti > 0 && <div><span className="text-gray-500">Dipendenti:</span> {fornitore.num_dipendenti}</div>}
                        </div>
                        {fornitore.note && (
                          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                            📝 {fornitore.note}
                          </div>
                        )}
                      </div>

                      {/* Colonna 2: Skipper */}
                      <div className="p-5">
                        <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                          👨‍✈️ Skipper ({skipperList.length})
                        </h4>
                        {skipperList.length === 0 ? (
                          <p className="text-sm text-gray-400 italic">Nessuno skipper associato</p>
                        ) : (
                          <div className="space-y-2">
                            {skipperList.map((s: any) => {
                              const scadGiorni = s.scadenza_patente ? giorniScadenza(s.scadenza_patente) : null
                              return (
                                <div key={s.id} className={`p-3 rounded-lg border text-sm ${s.attivo ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                                  <div className="flex items-center justify-between">
                                    <div className="font-semibold text-gray-900">{s.cognome} {s.nome}</div>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.attivo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                      {s.attivo ? 'Attivo' : 'Inattivo'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 text-gray-500 text-xs">
                                    <span>🪪 {s.numero_patente}</span>
                                    {s.telefono && <a href={`tel:${s.telefono}`} className="text-blue-600 hover:underline">📱 {s.telefono}</a>}
                                  </div>
                                  {scadGiorni != null && (
                                    <div className="mt-1">
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        scadGiorni < 0 ? 'bg-red-100 text-red-700' :
                                        scadGiorni <= 30 ? 'bg-orange-100 text-orange-700' :
                                        scadGiorni <= 90 ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-green-100 text-green-700'
                                      }`}>
                                        {scadGiorni < 0 ? 'SCADUTA' : `Patente scade in ${scadGiorni}gg`}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* Colonna 3: Statistiche */}
                      <div className="p-5">
                        <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">📊 Performance</h4>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="bg-blue-50 rounded-lg p-3 text-center">
                            <div className="text-xl font-bold text-blue-700">{stats.numImbarcazioni}</div>
                            <div className="text-xs text-gray-500">Barche</div>
                          </div>
                          <div className="bg-purple-50 rounded-lg p-3 text-center">
                            <div className="text-xl font-bold text-purple-700">{stats.numPrenotazioni}</div>
                            <div className="text-xs text-gray-500">Prenotazioni</div>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Revenue Totale</span>
                            <span className="font-semibold">€{stats.totaleRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Incassato</span>
                            <span className="font-semibold text-green-600">€{stats.totaleIncassato.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Da Incassare</span>
                            <span className="font-semibold text-orange-600">€{stats.daIncassare.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                        {/* Progress Bar */}
                        <div className="mt-4">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Incasso</span>
                            <span>{stats.percentualeIncassato.toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(stats.percentualeIncassato, 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Azioni */}
                    <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex gap-2 justify-end">
                      <button onClick={() => openEstrattoModal(fornitore)} className="px-4 py-2 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 font-medium">
                        📄 Estratto Conto
                      </button>
                      <button onClick={() => handleEdit(fornitore)} className="px-4 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium">
                        ✏️ Modifica
                      </button>
                      <button onClick={() => setShowDeleteConfirm(fornitore.id)} className="px-4 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
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

      {/* ═══ MODAL FORM ═══ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white p-6 border-b flex items-center justify-between rounded-t-xl">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{editingId ? 'Modifica Fornitore' : 'Nuovo Fornitore'}</h2>
                <p className="text-xs text-gray-500 mt-0.5">I campi con * sono obbligatori</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">

              {/* ─── SEZIONE: ANAGRAFICA ─── */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Anagrafica</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {field('Ragione Sociale', 'ragione_sociale', 'text', { required: true })}
                  {field('Nome Referente', 'nome_referente')}
                  {field('Email', 'email', 'email')}
                  {field('Telefono', 'telefono', 'tel')}
                  {/* Secondo numero di telefono */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Secondo Telefono <span className="text-xs text-gray-400">(es. Skipper, Armatore)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="tel"
                      value={formData.telefono_2 || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, telefono_2: e.target.value }))}
                      placeholder="Numero telefono"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={formData.telefono_2_nome || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, telefono_2_nome: e.target.value }))}
                      placeholder="Es: Skipper Mario / Armatore"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                  {field('PEC', 'pec', 'email')}
                  {field('PEC', 'pec', 'email')}
                </div>
              </div>

              {/* ─── SEZIONE: FISCALE ─── */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Dati Fiscali</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {field('Partita IVA', 'partita_iva')}
                  {field('Codice Fiscale', 'codice_fiscale')}
                  {field('Codice SDI', 'codice_sdi', 'text', { maxLength: 7 })}
                </div>
              </div>

              {/* ─── SEZIONE: INDIRIZZO ─── */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Indirizzo</h3>
                {field('Indirizzo', 'indirizzo')}
                <div className="grid grid-cols-3 gap-4 mt-3">
                  {field('Città', 'citta')}
                  {field('CAP', 'cap', 'text', { maxLength: 5 })}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
                    <input
                      type="text"
                      value={formData.provincia || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, provincia: e.target.value.toUpperCase() }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      maxLength={2}
                    />
                  </div>
                </div>
              </div>

              {/* ─── SEZIONE: BANCARIA ─── */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Dati Bancari</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {field('IBAN', 'iban')}
                  {field('Banca', 'banca')}
                </div>
              </div>

              {/* ─── SEZIONE: DATI NAUTICI ─── */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">⚓ Dati Nautici</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {field('Base Nautica', 'base_nautica', 'text', { placeholder: 'Es: Porto Turistico Marina d\'Arechi' })}
                  {field('Data Inizio Attività', 'data_inizio_attivita', 'date')}
                  {field('Capitaneria di Porto', 'capitaneria_porto', 'text', { placeholder: 'Es: Salerno' })}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">N° Dipendenti</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.num_dipendenti || 0}
                      onChange={(e) => setFormData(prev => ({ ...prev, num_dipendenti: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <input
                    type="checkbox"
                    id="art68"
                    checked={formData.art_68 || false}
                    onChange={(e) => setFormData(prev => ({ ...prev, art_68: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label htmlFor="art68" className="text-sm font-medium text-gray-700">Art. 68 — Iscritto</label>
                </div>
              </div>

              {/* ─── SEZIONE: COMMISSIONE & NOTE ─── */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Commissione & Note</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Commissione %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={formData.percentuale_commissione || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, percentuale_commissione: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                    <textarea
                      value={formData.note || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Stato */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="attivo-forn"
                  checked={formData.attivo}
                  onChange={(e) => setFormData(prev => ({ ...prev, attivo: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="attivo-forn" className="text-sm font-medium text-gray-700">Fornitore attivo</label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
                  Annulla
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                  {editingId ? 'Salva Modifiche' : 'Crea Fornitore'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Conferma Eliminazione</h3>
            <p className="text-gray-600 mb-6">Sei sicuro di voler eliminare questo fornitore? Questa azione non può essere annullata.</p>
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
      {/* Modal Estratto Conto */}
      {showEstrattoModal && fornitoreSelezionato && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">📄 Estratto Conto</h2>
                <p className="text-sm text-gray-500 mt-0.5">{fornitoreSelezionato.ragione_sociale}</p>
              </div>
              <button onClick={() => setShowEstrattoModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Mese</label>
              <input
                type="month"
                value={meseSelezionato}
                onChange={(e) => setMeseSelezionato(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {fornitoreSelezionato.email && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm">
                <span className="text-blue-700">📧 Email: <strong>{fornitoreSelezionato.email}</strong></span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={generaEstrattoConto}
                disabled={generandoPdf}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                {generandoPdf ? '⏳ Generazione...' : '📥 Scarica PDF'}
              </button>
              <button
                onClick={inviaEstrattoConto}
                disabled={inviandoEmail || !fornitoreSelezionato.email}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
              >
                {inviandoEmail ? '⏳ Invio...' : '📧 Invia Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}