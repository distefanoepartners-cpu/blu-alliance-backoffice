'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import toast from 'react-hot-toast'

interface Fornitore {
  id: string
  ragione_sociale: string
  nome_referente: string | null
  email: string | null
  telefono: string | null
  pec: string | null
  partita_iva: string | null
  codice_fiscale: string | null
  codice_sdi: string | null
  indirizzo: string | null
  citta: string | null
  cap: string | null
  provincia: string | null
  iban: string | null
  banca: string | null
  percentuale_commissione: number
  note: string | null
  attivo: boolean
  created_at: string
  // Nuovi campi piattaforme esterne
  codice_fornitore: string | null
  api_key: string | null
  sistema_prenotazione_esterno: boolean
  piattaforma_esterna: string | null
  url_piattaforma: string | null
  note_integrazione: string | null
}

interface Imbarcazione {
  id: string
  nome: string
  fornitore_id: string | null
}

interface RiepilogoMensile {
  fornitore_id: string
  ragione_sociale: string
  mese: string
  numero_prenotazioni: number
  fatturato_lordo: number
  totale_incassato: number
  commissioni: number
  netto_fornitore: number
}

export default function FornitoriPage() {
  const [fornitori, setFornitori] = useState<Fornitore[]>([])
  const [imbarcazioni, setImbarcazioni] = useState<Imbarcazione[]>([])
  const [riepiloghiMensili, setRiepiloghiMensili] = useState<RiepilogoMensile[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showAssegnaModal, setShowAssegnaModal] = useState(false)
  const [showEstrattoModal, setShowEstrattoModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [fornitoreSelezionato, setFornitoreSelezionato] = useState<Fornitore | null>(null)
  const [meseSelezionato, setMeseSelezionato] = useState(format(new Date(), 'yyyy-MM'))
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [inviandoEmail, setInviandoEmail] = useState(false)
  
  const [formData, setFormData] = useState({
    ragione_sociale: '',
    nome_referente: '',
    email: '',
    telefono: '',
    pec: '',
    partita_iva: '',
    codice_fiscale: '',
    codice_sdi: '0000000',
    indirizzo: '',
    citta: '',
    cap: '',
    provincia: '',
    iban: '',
    banca: '',
    percentuale_commissione: 25,
    note: '',
    attivo: true,
    // Nuovi campi piattaforme esterne
    sistema_prenotazione_esterno: false,
    piattaforma_esterna: '',
    url_piattaforma: '',
    note_integrazione: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const { data: fornitoriData, error: fornitoriError } = await supabase
        .from('fornitori')
        .select('*')
        .order('ragione_sociale')

      if (fornitoriError) throw fornitoriError

      const { data: imbarcazioniData } = await supabase
        .from('imbarcazioni')
        .select('id, nome, fornitore_id')
        .eq('attiva', true)
        .order('nome')

      const { data: riepiloghiData } = await supabase
        .from('vista_riepilogo_mensile_fornitori')
        .select('*')
        .order('mese', { ascending: false })

      setFornitori(fornitoriData || [])
      setImbarcazioni(imbarcazioniData || [])
      setRiepiloghiMensili(riepiloghiData || [])
    } catch (error: any) {
      toast.error('Errore nel caricamento: ' + error.message)
      console.error('Errore:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    try {
      const dataToSave = {
        ragione_sociale: formData.ragione_sociale,
        nome_referente: formData.nome_referente || null,
        email: formData.email || null,
        telefono: formData.telefono || null,
        pec: formData.pec || null,
        partita_iva: formData.partita_iva || null,
        codice_fiscale: formData.codice_fiscale || null,
        codice_sdi: formData.codice_sdi || '0000000',
        indirizzo: formData.indirizzo || null,
        citta: formData.citta || null,
        cap: formData.cap || null,
        provincia: formData.provincia || null,
        iban: formData.iban || null,
        banca: formData.banca || null,
        percentuale_commissione: formData.percentuale_commissione,
        note: formData.note || null,
        attivo: formData.attivo,
        // Nuovi campi piattaforme esterne
        sistema_prenotazione_esterno: formData.sistema_prenotazione_esterno,
        piattaforma_esterna: formData.piattaforma_esterna || null,
        url_piattaforma: formData.url_piattaforma || null,
        note_integrazione: formData.note_integrazione || null
      }

      if (editingId) {
        const { error } = await supabase
          .from('fornitori')
          .update(dataToSave)
          .eq('id', editingId)

        if (error) throw error
        toast.success('Fornitore aggiornato!')
      } else {
        const { error } = await supabase
          .from('fornitori')
          .insert([dataToSave])

        if (error) throw error
        toast.success('Fornitore creato!')
      }

      resetForm()
      loadData()
    } catch (error: any) {
      toast.error('Errore: ' + error.message)
      console.error('Errore:', error)
    }
  }

  function handleEdit(fornitore: Fornitore) {
    setEditingId(fornitore.id)
    setFormData({
      ragione_sociale: fornitore.ragione_sociale,
      nome_referente: fornitore.nome_referente || '',
      email: fornitore.email || '',
      telefono: fornitore.telefono || '',
      pec: fornitore.pec || '',
      partita_iva: fornitore.partita_iva || '',
      codice_fiscale: fornitore.codice_fiscale || '',
      codice_sdi: fornitore.codice_sdi || '0000000',
      indirizzo: fornitore.indirizzo || '',
      citta: fornitore.citta || '',
      cap: fornitore.cap || '',
      provincia: fornitore.provincia || '',
      iban: fornitore.iban || '',
      banca: fornitore.banca || '',
      percentuale_commissione: fornitore.percentuale_commissione,
      note: fornitore.note || '',
      attivo: fornitore.attivo,
      // Nuovi campi piattaforme esterne
      sistema_prenotazione_esterno: fornitore.sistema_prenotazione_esterno || false,
      piattaforma_esterna: fornitore.piattaforma_esterna || '',
      url_piattaforma: fornitore.url_piattaforma || '',
      note_integrazione: fornitore.note_integrazione || ''
    })
    setShowModal(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Sei sicuro di voler eliminare questo fornitore?')) return

    try {
      const { error } = await supabase
        .from('fornitori')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Fornitore eliminato!')
      loadData()
    } catch (error: any) {
      toast.error('Errore: ' + error.message)
    }
  }

  async function handleAssegnaImbarcazione(imbarcazioneId: string, fornitoreId: string | null) {
    try {
      const { error } = await supabase
        .from('imbarcazioni')
        .update({ fornitore_id: fornitoreId })
        .eq('id', imbarcazioneId)

      if (error) throw error
      toast.success('Imbarcazione assegnata!')
      loadData()
    } catch (error: any) {
      toast.error('Errore: ' + error.message)
    }
  }

  function openEstrattoModal(fornitore: Fornitore) {
    setFornitoreSelezionato(fornitore)
    setMeseSelezionato(format(new Date(), 'yyyy-MM'))
    setShowEstrattoModal(true)
  }

  async function generaEstrattoConto() {
    if (!fornitoreSelezionato) return
    
    setGenerandoPdf(true)
    
    try {
      // Ottieni i dati delle prenotazioni per il mese selezionato
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

      // Calcola totali
      const totali = {
        fatturato: prenotazioni?.reduce((sum, p) => sum + Number(p.prezzo_totale || 0), 0) || 0,
        incassato: prenotazioni?.reduce((sum, p) => sum + Number(p.totale_incassato || 0), 0) || 0,
        commissioni: 0,
        netto: 0
      }
      totali.commissioni = totali.fatturato * (fornitoreSelezionato.percentuale_commissione / 100)
      totali.netto = totali.fatturato - totali.commissioni

      // Genera PDF
      const response = await fetch('/api/genera-estratto-conto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fornitore: fornitoreSelezionato,
          mese: meseSelezionato,
          prenotazioni: prenotazioni || [],
          totali
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Errore generazione PDF')
      }

      // Scarica il PDF
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `estratto-conto-${fornitoreSelezionato.ragione_sociale.replace(/\s+/g, '-')}-${meseSelezionato}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('PDF generato e scaricato!')
      setShowEstrattoModal(false)
    } catch (error: any) {
      toast.error('Errore: ' + error.message)
      console.error('Errore:', error)
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
      // Ottieni i dati delle prenotazioni per il mese selezionato
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

      // Calcola totali
      const totali = {
        fatturato: prenotazioni?.reduce((sum, p) => sum + Number(p.prezzo_totale || 0), 0) || 0,
        incassato: prenotazioni?.reduce((sum, p) => sum + Number(p.totale_incassato || 0), 0) || 0,
        commissioni: 0,
        netto: 0
      }
      totali.commissioni = totali.fatturato * (fornitoreSelezionato.percentuale_commissione / 100)
      totali.netto = totali.fatturato - totali.commissioni

      // Invia l'email
      const response = await fetch('/api/invia-estratto-conto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fornitore: fornitoreSelezionato,
          mese: meseSelezionato,
          prenotazioni: prenotazioni || [],
          totali
        })
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Errore invio email')
      }

      toast.success(`Email inviata a ${fornitoreSelezionato.email}!`)
      setShowEstrattoModal(false)
    } catch (error: any) {
      toast.error('Errore: ' + error.message)
      console.error('Errore:', error)
    } finally {
      setInviandoEmail(false)
    }
  }

  function resetForm() {
    setFormData({
      ragione_sociale: '',
      nome_referente: '',
      email: '',
      telefono: '',
      pec: '',
      partita_iva: '',
      codice_fiscale: '',
      codice_sdi: '0000000',
      indirizzo: '',
      citta: '',
      cap: '',
      provincia: '',
      iban: '',
      banca: '',
      percentuale_commissione: 25,
      note: '',
      attivo: true,
      // Nuovi campi piattaforme esterne
      sistema_prenotazione_esterno: false,
      piattaforma_esterna: '',
      url_piattaforma: '',
      note_integrazione: ''
    })
    setEditingId(null)
    setShowModal(false)
  }

  function getImbarcazioniFornitore(fornitoreId: string) {
    return imbarcazioni.filter(i => i.fornitore_id === fornitoreId)
  }

  function getRiepilogoFornitore(fornitoreId: string) {
    return riepiloghiMensili.filter(r => r.fornitore_id === fornitoreId)
  }

  if (loading) {
    return <div className="p-8"><div className="text-gray-600">Caricamento...</div></div>
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Fornitori</h1>
          <p className="text-gray-600 mt-1">
            {fornitori.length} fornitor{fornitori.length !== 1 ? 'i' : 'e'} registrat{fornitori.length !== 1 ? 'i' : 'o'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAssegnaModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            🚤 Assegna Imbarcazioni
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Nuovo Fornitore
          </button>
        </div>
      </div>

      {/* Statistiche Globali */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-600">Fornitori Attivi</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {fornitori.filter(f => f.attivo).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-600">Imbarcazioni Assegnate</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {imbarcazioni.filter(i => i.fornitore_id).length} / {imbarcazioni.length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-600">Fatturato Mese</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">
            €{riepiloghiMensili
              .filter(r => r.mese?.startsWith(format(new Date(), 'yyyy-MM')))
              .reduce((sum, r) => sum + Number(r.fatturato_lordo || 0), 0)
              .toFixed(0)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-600">Commissioni Mese</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">
            €{riepiloghiMensili
              .filter(r => r.mese?.startsWith(format(new Date(), 'yyyy-MM')))
              .reduce((sum, r) => sum + Number(r.commissioni || 0), 0)
              .toFixed(0)}
          </p>
        </div>
      </div>

      {/* Lista Fornitori */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {fornitori.map((fornitore) => {
          const imbarcazioniFornitore = getImbarcazioniFornitore(fornitore.id)
          const riepilogoMese = riepiloghiMensili.find(
            r => r.fornitore_id === fornitore.id && r.mese?.startsWith(format(new Date(), 'yyyy-MM'))
          )

          return (
            <div 
              key={fornitore.id} 
              className={`bg-white rounded-xl shadow-sm border ${fornitore.attivo ? 'border-gray-100' : 'border-red-200 bg-red-50'} overflow-hidden`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      {fornitore.ragione_sociale}
                      {!fornitore.attivo && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Inattivo</span>
                      )}
                    </h3>
                    {fornitore.nome_referente && (
                      <p className="text-sm text-gray-600">👤 {fornitore.nome_referente}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEstrattoModal(fornitore)}
                      className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                      title="Genera estratto conto"
                    >
                      📄
                    </button>
                    <button
                      onClick={() => handleEdit(fornitore)}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(fornitore.id)}
                      className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    {fornitore.email && <p className="text-gray-600">📧 {fornitore.email}</p>}
                    {fornitore.telefono && <p className="text-gray-600">📞 {fornitore.telefono}</p>}
                    {fornitore.partita_iva && <p className="text-gray-600">🏢 P.IVA: {fornitore.partita_iva}</p>}
                  </div>
                  <div>
                    <p className="text-gray-600">
                      💰 Commissione: <span className="font-semibold text-blue-600">{fornitore.percentuale_commissione}%</span>
                    </p>
                    {fornitore.iban && (
                      <p className="text-gray-600 text-xs">🏦 {fornitore.iban.substring(0, 10)}...</p>
                    )}
                    {fornitore.codice_fornitore && (
                      <p className="text-gray-600 text-xs">🔑 {fornitore.codice_fornitore}</p>
                    )}
                  </div>
                </div>

                {/* Alert Piattaforma Esterna */}
                {fornitore.sistema_prenotazione_esterno && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-600">⚠️</span>
                      <div>
                        <p className="text-sm font-medium text-amber-800">
                          Usa piattaforma esterna: {fornitore.piattaforma_esterna?.toUpperCase() || 'Non specificata'}
                        </p>
                        {fornitore.note_integrazione && (
                          <p className="text-xs text-amber-700 mt-1">{fornitore.note_integrazione}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Imbarcazioni associate */}
                <div className="border-t pt-4 mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">🚤 Imbarcazioni ({imbarcazioniFornitore.length})</p>
                  {imbarcazioniFornitore.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {imbarcazioniFornitore.map(imb => (
                        <span key={imb.id} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          {imb.nome}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic">Nessuna imbarcazione assegnata</p>
                  )}
                </div>

                {/* Riepilogo mese corrente */}
                {riepilogoMese && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-600 mb-2">📊 Riepilogo {format(new Date(), 'MMMM yyyy', { locale: it })}</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500">Prenotazioni</p>
                        <p className="font-semibold">{riepilogoMese.numero_prenotazioni}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Fatturato</p>
                        <p className="font-semibold">€{Number(riepilogoMese.fatturato_lordo).toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Netto Fornitore</p>
                        <p className="font-semibold text-green-600">€{Number(riepilogoMese.netto_fornitore).toFixed(0)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {fornitori.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="text-4xl mb-3">🏢</div>
          <p className="text-gray-500">Nessun fornitore registrato</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Aggiungi il primo fornitore
          </button>
        </div>
      )}

      {/* Modal Nuovo/Modifica Fornitore */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingId ? 'Modifica Fornitore' : 'Nuovo Fornitore'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ragione Sociale *</label>
                <input
                  type="text"
                  value={formData.ragione_sociale}
                  onChange={(e) => setFormData({ ...formData, ragione_sociale: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome Referente</label>
                  <input
                    type="text"
                    value={formData.nome_referente}
                    onChange={(e) => setFormData({ ...formData, nome_referente: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telefono</label>
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">PEC</label>
                  <input
                    type="email"
                    value={formData.pec}
                    onChange={(e) => setFormData({ ...formData, pec: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Partita IVA</label>
                  <input
                    type="text"
                    value={formData.partita_iva}
                    onChange={(e) => setFormData({ ...formData, partita_iva: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Codice Fiscale</label>
                  <input
                    type="text"
                    value={formData.codice_fiscale}
                    onChange={(e) => setFormData({ ...formData, codice_fiscale: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Codice SDI</label>
                  <input
                    type="text"
                    value={formData.codice_sdi}
                    onChange={(e) => setFormData({ ...formData, codice_sdi: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    maxLength={7}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Indirizzo</label>
                <input
                  type="text"
                  value={formData.indirizzo}
                  onChange={(e) => setFormData({ ...formData, indirizzo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Città</label>
                  <input
                    type="text"
                    value={formData.citta}
                    onChange={(e) => setFormData({ ...formData, citta: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">CAP</label>
                  <input
                    type="text"
                    value={formData.cap}
                    onChange={(e) => setFormData({ ...formData, cap: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    maxLength={5}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Provincia</label>
                  <input
                    type="text"
                    value={formData.provincia}
                    onChange={(e) => setFormData({ ...formData, provincia: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">IBAN</label>
                  <input
                    type="text"
                    value={formData.iban}
                    onChange={(e) => setFormData({ ...formData, iban: e.target.value.toUpperCase().replace(/\s/g, '') })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                    maxLength={34}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Banca</label>
                  <input
                    type="text"
                    value={formData.banca}
                    onChange={(e) => setFormData({ ...formData, banca: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Commissione %</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={formData.percentuale_commissione}
                    onChange={(e) => setFormData({ ...formData, percentuale_commissione: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.attivo}
                      onChange={(e) => setFormData({ ...formData, attivo: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Fornitore attivo</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                />
              </div>

              {/* Sezione Piattaforme Esterne */}
              <div className="border-t pt-4 mt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  🌐 Piattaforme Esterne
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="sistema_esterno"
                      checked={formData.sistema_prenotazione_esterno}
                      onChange={(e) => setFormData({ ...formData, sistema_prenotazione_esterno: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600"
                    />
                    <label htmlFor="sistema_esterno" className="text-sm font-medium text-gray-700">
                      Il fornitore usa piattaforme di prenotazione esterne
                    </label>
                  </div>

                  {formData.sistema_prenotazione_esterno && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
                      <div className="flex items-start gap-2 text-amber-800 text-sm">
                        <span>⚠️</span>
                        <span>Attenzione: sincronizzare manualmente le disponibilità per evitare overbooking</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Piattaforma</label>
                          <select
                            value={formData.piattaforma_esterna}
                            onChange={(e) => setFormData({ ...formData, piattaforma_esterna: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          >
                            <option value="">Seleziona...</option>
                            <option value="fareharbor">FareHarbor</option>
                            <option value="getyourguide">GetYourGuide</option>
                            <option value="viator">Viator</option>
                            <option value="bokun">Bokun</option>
                            <option value="civitatis">Civitatis</option>
                            <option value="musement">Musement</option>
                            <option value="altro">Altro</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">URL Profilo</label>
                          <input
                            type="url"
                            value={formData.url_piattaforma}
                            onChange={(e) => setFormData({ ...formData, url_piattaforma: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="https://..."
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Note Integrazione</label>
                        <textarea
                          value={formData.note_integrazione}
                          onChange={(e) => setFormData({ ...formData, note_integrazione: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          rows={2}
                          placeholder="Es: Comunicare disponibilità residue dopo vendite su FareHarbor"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Codice Fornitore (solo in modifica) */}
              {editingId && (
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    🔑 Codice Partner
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Codice Fornitore</label>
                        <p className="font-mono text-lg font-bold text-blue-600">
                          {(fornitori.find(f => f.id === editingId) as Fornitore)?.codice_fornitore || 'Non assegnato'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Codice per integrazione plugin partner</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                        <p className="font-mono text-xs text-gray-600 break-all">
                          {(fornitori.find(f => f.id === editingId) as Fornitore)?.api_key || 'Non generata'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
                  {editingId ? 'Aggiorna' : 'Crea Fornitore'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Assegna Imbarcazioni */}
      {showAssegnaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Assegna Imbarcazioni ai Fornitori</h2>
              <button onClick={() => setShowAssegnaModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <div className="p-6 space-y-4">
              {imbarcazioni.map((imbarcazione) => (
                <div key={imbarcazione.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">🚤 {imbarcazione.nome}</p>
                    {imbarcazione.fornitore_id && (
                      <p className="text-sm text-gray-600">
                        Assegnata a: {fornitori.find(f => f.id === imbarcazione.fornitore_id)?.ragione_sociale}
                      </p>
                    )}
                  </div>
                  <select
                    value={imbarcazione.fornitore_id || ''}
                    onChange={(e) => handleAssegnaImbarcazione(imbarcazione.id, e.target.value || null)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">-- Nessun fornitore --</option>
                    {fornitori.filter(f => f.attivo).map((fornitore) => (
                      <option key={fornitore.id} value={fornitore.id}>
                        {fornitore.ragione_sociale}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setShowAssegnaModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Genera Estratto Conto */}
      {showEstrattoModal && fornitoreSelezionato && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Genera Estratto Conto</h2>
              <button onClick={() => setShowEstrattoModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium text-gray-900">{fornitoreSelezionato.ragione_sociale}</p>
                <p className="text-sm text-gray-600">Commissione: {fornitoreSelezionato.percentuale_commissione}%</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mese di Competenza</label>
                <input
                  type="month"
                  value={meseSelezionato}
                  onChange={(e) => setMeseSelezionato(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEstrattoModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  onClick={generaEstrattoConto}
                  disabled={generandoPdf || inviandoEmail}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  {generandoPdf ? '⏳ Generazione...' : '📄 Scarica PDF'}
                </button>
              </div>
              
              {fornitoreSelezionato.email && (
                <div className="pt-3 border-t mt-3">
                  <button
                    onClick={inviaEstrattoConto}
                    disabled={generandoPdf || inviandoEmail}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                  >
                    {inviandoEmail ? (
                      <>⏳ Invio in corso...</>
                    ) : (
                      <>📧 Invia via Email a {fornitoreSelezionato.email}</>
                    )}
                  </button>
                </div>
              )}
              
              {!fornitoreSelezionato.email && (
                <p className="text-sm text-amber-600 mt-3 text-center">
                  ⚠️ Nessuna email configurata per questo fornitore
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}