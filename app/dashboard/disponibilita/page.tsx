'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, addDays, startOfMonth, endOfMonth, addMonths, subMonths, isToday, isBefore, startOfWeek } from 'date-fns'
import { it } from 'date-fns/locale'
import toast from 'react-hot-toast'

interface Fornitore {
  id: string
  ragione_sociale: string
  attivo: boolean
}

interface Imbarcazione {
  id: string
  nome: string
  tipo: string
  capacita_massima: number
  fornitore_id: string | null
  attiva: boolean
}

interface Disponibilita {
  id: string
  imbarcazione_id: string
  data: string
  ora_imbarco_default: string
  on_demand: boolean
  note: string | null
}

interface Prenotazione {
  id: string
  imbarcazione_id: string
  data_servizio: string
  stato: string
}

export default function DisponibilitaPage() {
  const [fornitori, setFornitori] = useState<Fornitore[]>([])
  const [imbarcazioni, setImbarcazioni] = useState<Imbarcazione[]>([])
  const [disponibilita, setDisponibilita] = useState<Disponibilita[]>([])
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [meseCorrente, setMeseCorrente] = useState(new Date())
  const [showModal, setShowModal] = useState(false)
  const [filtroFornitore, setFiltroFornitore] = useState<string>('')
  
  const [formData, setFormData] = useState({
    fornitore_id: '',
    imbarcazione_id: '',
    date_selezionate: [] as string[],
    ora_imbarco_default: '09:30',
    on_demand: false,
    note: ''
  })

  const inizioMese = startOfMonth(meseCorrente)
  const fineMese = endOfMonth(meseCorrente)
  
  // Calcola i giorni da mostrare (inclusi giorni del mese precedente/successivo per completare le settimane)
  const primoGiornoSettimana = startOfWeek(inizioMese, { weekStartsOn: 1 })
  const giorniCalendario: Date[] = []
  let giornoCorrente = primoGiornoSettimana
  
  // Genera 42 giorni (6 settimane) per coprire sempre tutto il mese
  for (let i = 0; i < 42; i++) {
    giorniCalendario.push(giornoCorrente)
    giornoCorrente = addDays(giornoCorrente, 1)
  }

  useEffect(() => {
    loadData()
  }, [meseCorrente])

  async function loadData() {
    try {
      setLoading(true)
      setError(null)
      
      // Carica fornitori
      const { data: fornitoriData, error: errFornitori } = await supabase
        .from('fornitori')
        .select('id, ragione_sociale, attivo')
        .eq('attivo', true)
        .order('ragione_sociale')

      if (errFornitori) throw new Error('Errore fornitori: ' + errFornitori.message)

      // Carica imbarcazioni
      const { data: imbarcazioniData, error: errImb } = await supabase
        .from('imbarcazioni')
        .select('id, nome, tipo, capacita_massima, fornitore_id, attiva')
        .eq('attiva', true)
        .order('nome')

      if (errImb) throw new Error('Errore imbarcazioni: ' + errImb.message)

      // Carica disponibilità per tutto il mese (con margine)
      const { data: disponibilitaData, error: errDisp } = await supabase
        .from('disponibilita_imbarcazioni')
        .select('id, imbarcazione_id, data, ora_imbarco_default, on_demand, note')
        .gte('data', format(primoGiornoSettimana, 'yyyy-MM-dd'))
        .lte('data', format(addDays(fineMese, 7), 'yyyy-MM-dd'))

      if (errDisp) throw new Error('Errore disponibilità: ' + errDisp.message)

      // Carica prenotazioni
      const { data: prenotazioniData, error: errPren } = await supabase
        .from('prenotazioni')
        .select('id, imbarcazione_id, data_servizio, stato')
        .gte('data_servizio', format(primoGiornoSettimana, 'yyyy-MM-dd'))
        .lte('data_servizio', format(addDays(fineMese, 7), 'yyyy-MM-dd'))
        .in('stato', ['confermata', 'completata'])

      if (errPren) throw new Error('Errore prenotazioni: ' + errPren.message)

      setFornitori(fornitoriData || [])
      setImbarcazioni(imbarcazioniData || [])
      setDisponibilita(disponibilitaData || [])
      setPrenotazioni(prenotazioniData || [])
    } catch (err: any) {
      console.error('Errore loadData:', err)
      setError(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  function isDisponibile(imbarcazioneId: string, data: string): Disponibilita | null {
    return disponibilita.find(d => d.imbarcazione_id === imbarcazioneId && d.data === data) || null
  }

  function isPrenotata(imbarcazioneId: string, data: string): boolean {
    return prenotazioni.some(p => p.imbarcazione_id === imbarcazioneId && p.data_servizio === data)
  }

  async function toggleDisponibilita(imbarcazione: Imbarcazione, data: string) {
    const dispEsistente = isDisponibile(imbarcazione.id, data)
    
    if (dispEsistente) {
      const { error } = await supabase
        .from('disponibilita_imbarcazioni')
        .delete()
        .eq('id', dispEsistente.id)
      if (error) {
        toast.error('Errore: ' + error.message)
        return
      }
      toast.success('Disponibilità rimossa')
    } else {
      const { error } = await supabase
        .from('disponibilita_imbarcazioni')
        .insert({
          imbarcazione_id: imbarcazione.id,
          data,
          ora_imbarco_default: '09:30',
          on_demand: false
        })
      if (error) {
        toast.error('Errore: ' + error.message)
        return
      }
      toast.success('Disponibilità aggiunta')
    }
    loadData()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (formData.date_selezionate.length === 0) {
      toast.error('Seleziona almeno una data')
      return
    }

    const inserimenti = formData.date_selezionate.map(data => ({
      imbarcazione_id: formData.imbarcazione_id,
      data,
      ora_imbarco_default: formData.ora_imbarco_default,
      on_demand: formData.on_demand,
      note: formData.note || null
    }))

    const { error } = await supabase
      .from('disponibilita_imbarcazioni')
      .upsert(inserimenti, { onConflict: 'imbarcazione_id,data' })

    if (error) {
      toast.error('Errore: ' + error.message)
      return
    }

    toast.success(`${formData.date_selezionate.length} disponibilità aggiunte!`)
    setFormData({ fornitore_id: '', imbarcazione_id: '', date_selezionate: [], ora_imbarco_default: '09:30', on_demand: false, note: '' })
    setShowModal(false)
    loadData()
  }

  // Filtra imbarcazioni
  const imbarcazioniFiltrate = filtroFornitore 
    ? imbarcazioni.filter(i => i.fornitore_id === filtroFornitore)
    : imbarcazioni

  const imbarcazioniFornitoreForm = formData.fornitore_id 
    ? imbarcazioni.filter(i => i.fornitore_id === formData.fornitore_id)
    : []

  // Conta disponibilità e prenotazioni per imbarcazione nel mese
  function getStatsMese(imbarcazioneId: string) {
    const dispCount = disponibilita.filter(d => {
      const dataDisp = new Date(d.data)
      return d.imbarcazione_id === imbarcazioneId && 
             dataDisp >= inizioMese && 
             dataDisp <= fineMese
    }).length

    const prenCount = prenotazioni.filter(p => {
      const dataPren = new Date(p.data_servizio)
      return p.imbarcazione_id === imbarcazioneId && 
             dataPren >= inizioMese && 
             dataPren <= fineMese
    }).length

    return { disponibili: dispCount, prenotate: prenCount }
  }

  if (loading) {
    return <div className="p-8"><div className="text-gray-600">Caricamento disponibilità...</div></div>
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-800">Errore</h3>
          <p className="text-red-700">{error}</p>
          <button onClick={loadData} className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            Riprova
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">📅 Disponibilità Mensile</h1>
          <p className="text-gray-600 mt-1">Gestisci le disponibilità delle imbarcazioni</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Aggiungi Disponibilità
        </button>
      </div>

      {/* Navigazione mese */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setMeseCorrente(subMonths(meseCorrente, 1))} className="p-2 hover:bg-gray-100 rounded-lg text-xl">←</button>
            <div className="text-center min-w-[200px]">
              <p className="font-semibold text-xl capitalize">{format(meseCorrente, 'MMMM yyyy', { locale: it })}</p>
            </div>
            <button onClick={() => setMeseCorrente(addMonths(meseCorrente, 1))} className="p-2 hover:bg-gray-100 rounded-lg text-xl">→</button>
            <button onClick={() => setMeseCorrente(new Date())} className="px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">Oggi</button>
          </div>
          <select
            value={filtroFornitore}
            onChange={(e) => setFiltroFornitore(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">Tutti i fornitori</option>
            {fornitori.map(f => (
              <option key={f.id} value={f.id}>{f.ragione_sociale}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2"><div className="w-6 h-6 bg-green-500 rounded"></div><span>Disponibile</span></div>
        <div className="flex items-center gap-2"><div className="w-6 h-6 bg-blue-500 rounded"></div><span>Prenotata</span></div>
        <div className="flex items-center gap-2"><div className="w-6 h-6 bg-gray-200 rounded"></div><span>Non disponibile</span></div>
      </div>

      {/* Lista Imbarcazioni con Calendario */}
      <div className="space-y-6">
        {imbarcazioniFiltrate.map(imbarcazione => {
          const fornitore = fornitori.find(f => f.id === imbarcazione.fornitore_id)
          const stats = getStatsMese(imbarcazione.id)
          
          return (
            <div key={imbarcazione.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {/* Header Imbarcazione */}
              <div className="bg-gray-50 px-4 py-3 border-b flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-lg">🚤 {imbarcazione.nome}</h3>
                  <p className="text-sm text-gray-500">
                    {imbarcazione.tipo} • Max {imbarcazione.capacita_massima} pax
                    {fornitore && <span> • {fornitore.ragione_sociale}</span>}
                  </p>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full">{stats.disponibili} disponibili</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">{stats.prenotate} prenotate</span>
                </div>
              </div>

              {/* Calendario Mensile */}
              <div className="p-4">
                {/* Header giorni settimana */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(giorno => (
                    <div key={giorno} className="text-center text-sm font-medium text-gray-500 py-2">
                      {giorno}
                    </div>
                  ))}
                </div>

                {/* Griglia giorni */}
                <div className="grid grid-cols-7 gap-1">
                  {giorniCalendario.map((giorno, index) => {
                    const dataStr = format(giorno, 'yyyy-MM-dd')
                    const disp = isDisponibile(imbarcazione.id, dataStr)
                    const prenotata = isPrenotata(imbarcazione.id, dataStr)
                    const passato = isBefore(giorno, new Date()) && !isToday(giorno)
                    const fuoriMese = giorno < inizioMese || giorno > fineMese
                    const oggi = isToday(giorno)

                    // Determina colore cella
                    let cellClass = 'bg-gray-100 hover:bg-gray-200'
                    if (fuoriMese) {
                      cellClass = 'bg-gray-50 text-gray-300'
                    } else if (prenotata) {
                      cellClass = 'bg-blue-500 text-white'
                    } else if (disp) {
                      cellClass = 'bg-green-500 text-white hover:bg-green-600'
                    } else if (passato) {
                      cellClass = 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }

                    return (
                      <button
                        key={dataStr + index}
                        onClick={() => !passato && !fuoriMese && !prenotata && toggleDisponibilita(imbarcazione, dataStr)}
                        disabled={passato || fuoriMese || prenotata}
                        className={`
                          aspect-square p-1 rounded-lg text-sm font-medium transition-colors
                          ${cellClass}
                          ${oggi ? 'ring-2 ring-blue-400 ring-offset-1' : ''}
                        `}
                        title={prenotata ? 'Prenotata' : disp ? `Disponibile - ${disp.ora_imbarco_default}` : 'Non disponibile'}
                      >
                        <span className="block">{format(giorno, 'd')}</span>
                        {disp && !prenotata && !fuoriMese && (
                          <span className="block text-xs opacity-80">{disp.ora_imbarco_default?.substring(0, 5)}</span>
                        )}
                        {prenotata && !fuoriMese && (
                          <span className="block text-xs">🔒</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {imbarcazioniFiltrate.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
          <div className="text-4xl mb-3">🚤</div>
          <p className="text-gray-500">Nessuna imbarcazione trovata</p>
        </div>
      )}

      {/* Modal Aggiungi Disponibilità */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">Aggiungi Disponibilità</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Fornitore *</label>
                <select
                  value={formData.fornitore_id}
                  onChange={(e) => setFormData({ ...formData, fornitore_id: e.target.value, imbarcazione_id: '' })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Seleziona fornitore</option>
                  {fornitori.map(f => <option key={f.id} value={f.id}>{f.ragione_sociale}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Imbarcazione *</label>
                <select
                  value={formData.imbarcazione_id}
                  onChange={(e) => setFormData({ ...formData, imbarcazione_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                  disabled={!formData.fornitore_id}
                >
                  <option value="">Seleziona imbarcazione</option>
                  {imbarcazioniFornitoreForm.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Date ({formData.date_selezionate.length} selezionate)</label>
                <div className="bg-gray-50 p-3 rounded-lg">
                  {/* Header giorni */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((g, i) => (
                      <div key={i} className="text-center text-xs font-medium text-gray-500">{g}</div>
                    ))}
                  </div>
                  {/* Griglia */}
                  <div className="grid grid-cols-7 gap-1">
                    {giorniCalendario.slice(0, 35).map((giorno, index) => {
                      const dataStr = format(giorno, 'yyyy-MM-dd')
                      const selezionata = formData.date_selezionate.includes(dataStr)
                      const passato = isBefore(giorno, new Date()) && !isToday(giorno)
                      const fuoriMese = giorno < inizioMese || giorno > fineMese

                      return (
                        <button
                          key={dataStr + index}
                          type="button"
                          disabled={passato || fuoriMese}
                          onClick={() => {
                            if (selezionata) {
                              setFormData({ ...formData, date_selezionate: formData.date_selezionate.filter(d => d !== dataStr) })
                            } else {
                              setFormData({ ...formData, date_selezionate: [...formData.date_selezionate, dataStr] })
                            }
                          }}
                          className={`
                            aspect-square rounded text-sm font-medium
                            ${fuoriMese ? 'text-gray-300' : ''}
                            ${passato ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : ''}
                            ${selezionata ? 'bg-blue-600 text-white' : !passato && !fuoriMese ? 'bg-white border hover:bg-blue-50' : ''}
                          `}
                        >
                          {format(giorno, 'd')}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Ora imbarco</label>
                  <input type="time" value={formData.ora_imbarco_default} onChange={(e) => setFormData({ ...formData, ora_imbarco_default: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.on_demand} onChange={(e) => setFormData({ ...formData, on_demand: e.target.checked })} className="w-5 h-5" />
                    <span className="text-sm">On Demand</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Note</label>
                <input type="text" value={formData.note} onChange={(e) => setFormData({ ...formData, note: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="Es: Solo mezza giornata" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Annulla</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Salva</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}