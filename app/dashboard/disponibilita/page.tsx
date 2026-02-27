'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import toast from 'react-hot-toast'
import BookingModal from '@/components/BookingModal'
import { useUserContext } from '@/lib/user-context'

export default function PlanningMensile() {
  const { role, fornitoreId } = useUserContext()
  const isOperatore = role === 'operatore'

  // Dimensioni griglia responsive
  const [colSizes, setColSizes] = useState({ barca: 120, giorno: 38, altezza: 42 })

  useEffect(() => {
    function updateSizes() {
      const w = window.innerWidth
      if (w < 640) {
        setColSizes({ barca: 70, giorno: 26, altezza: 34 })       // mobile
      } else if (w < 1024) {
        setColSizes({ barca: 90, giorno: 32, altezza: 38 })        // tablet
      } else {
        setColSizes({ barca: 120, giorno: 38, altezza: 42 })       // desktop
      }
    }
    updateSizes()
    window.addEventListener('resize', updateSizes)
    return () => window.removeEventListener('resize', updateSizes)
  }, [])

  const [imbarcazioni, setImbarcazioni] = useState<any[]>([])
  const [imbarcazioniFiltrate, setImbarcazioniFiltrate] = useState<any[]>([])
  const [fornitori, setFornitori] = useState<any[]>([])
  const [prenotazioni, setPrenotazioni] = useState<any[]>([])
  const [blocchi, setBlocchi] = useState<any[]>([])
  const [currentMonthStart, setCurrentMonthStart] = useState(startOfMonth(new Date()))
  const [loading, setLoading] = useState(true)
  const [filtroFornitore, setFiltroFornitore] = useState<string>('tutti')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('tutti')
  const [showFiltri, setShowFiltri] = useState(false)

  // Modal Blocco
  const [showBloccoModal, setShowBloccoModal] = useState(false)
  const [selectedCell, setSelectedCell] = useState<{ imbarcazioneId: string; date: Date; imbarcazioneNome: string } | null>(null)
  const [motivoBlocco, setMotivoBlocco] = useState('')
  const [tipoBlocco, setTipoBlocco] = useState<'manutenzione' | 'prenotazione_esterna' | 'altro'>('altro')

  // Context Menu (click su cella disponibile)
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number
    imbarcazioneId: string; imbarcazioneNome: string; date: Date
  } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // Modal Nuova Prenotazione dal Planning
  const [showNewBookingModal, setShowNewBookingModal] = useState(false)
  const [newBookingInitialDate, setNewBookingInitialDate] = useState('')
  const [newBookingInitialImbarcazione, setNewBookingInitialImbarcazione] = useState('')

  // Modal Dettagli Prenotazione
  const [showDettagliModal, setShowDettagliModal] = useState(false)
  const [prenotazioneSelezionata, setPrenotazioneSelezionata] = useState<any>(null)
  const [loadingDettagli, setLoadingDettagli] = useState(false)

  // NS3000 Integration
  const [ns3000Boats, setNs3000Boats] = useState<any[]>([])
  const [ns3000Loading, setNs3000Loading] = useState(false)
  const [showNs3000, setShowNs3000] = useState(true)
  const [ns3000Bookings, setNs3000Bookings] = useState<any[]>([])
  const [showNs3000Dettagli, setShowNs3000Dettagli] = useState(false)
  const [ns3000BookingDetail, setNs3000BookingDetail] = useState<any>(null)

  // Mapping NS3000 boat_id → Blu Alliance imbarcazione_id
  const ns3000ToBaMap: Record<string, string> = {
    '4a222a73-304b-4945-813b-9548ba201675': 'b743d220-6200-49de-9324-68297e4eee75',
    'd03cfe13-bcb6-4f98-bda4-a18b8bf7957d': '64e06e82-ed6e-4f23-b06e-14533a0187c6',
    '00ce8828-ebf9-4aad-8ad8-8f6b4e90a1e3': '7e854592-bb5d-4971-98aa-ae66c2fa66ba',
    '2edce19e-3687-42b9-bb87-57e2aabfccd2': 'b2a20895-eeab-493d-a2fb-53ef5ba1d220',
    '937298ab-2a15-4ace-adb2-b63dd1b865b1': '4c4f4b54-4ee6-481f-94f9-a142b5d651b0',
    '6800721d-a8e9-4217-b7a2-8548359c6cfc': '9a6cc58f-bb70-440e-92a1-d2e2c2712e5b',
    'c35aefd0-6721-4f01-aeec-2d47bdf9f24f': '2d4995ec-35b3-4358-ace1-54621a9528ed',
    'fe759df8-5d8e-401f-8fb2-dfaa3642c33c': '51231c4f-b929-466c-aed3-9440639e0bd7',
    'd5bff230-0e6a-4211-b0ce-342e8fbace51': '8d4d1bd6-142f-4d0f-8854-333742eeeba3',
    '1365d4d3-0ffb-48a8-a8a6-d3c49dd22145': 'a079598f-b25d-49d6-90ce-b25146687a31',
  }
  const baIdsInNs3000 = new Set(Object.values(ns3000ToBaMap))

  const currentMonthEnd = endOfMonth(currentMonthStart)
  const monthDays = eachDayOfInterval({ start: currentMonthStart, end: currentMonthEnd })

  const monthNames = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO', 'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE']
  const currentMonth = currentMonthStart.getMonth()
  const currentYear = currentMonthStart.getFullYear()

  useEffect(() => {
    loadData()
    loadNs3000Data()
  }, [currentMonthStart])

  useEffect(() => {
    applicaFiltri()
  }, [imbarcazioni, filtroFornitore, filtroCategoria, showNs3000, ns3000Boats])

  // Chiudi context menu cliccando fuori
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [contextMenu])

  async function loadNs3000Data() {
    try {
      setNs3000Loading(true)
      const dateFrom = format(currentMonthStart, 'yyyy-MM-dd')
      const dateTo = format(currentMonthEnd, 'yyyy-MM-dd')

      const availRes = await fetch(`/api/ns3000/availability?date_from=${dateFrom}&date_to=${dateTo}`)
      if (availRes.ok) {
        const availData = await availRes.json()
        setNs3000Boats(availData.boats || [])
      }

      const bookRes = await fetch(`/api/ns3000/bookings?date_from=${dateFrom}&date_to=${dateTo}`)
      if (bookRes.ok) {
        const bookData = await bookRes.json()
        setNs3000Bookings(bookData.bookings || [])
      }
    } catch (error) {
      console.error('Errore caricamento NS3000:', error)
    } finally {
      setNs3000Loading(false)
    }
  }

  function getNs3000CellStatus(boatId: string, date: Date) {
    const dateStr = format(date, 'yyyy-MM-dd')
    const boat = ns3000Boats.find(b => b.boat_id === boatId)
    if (!boat) return { type: 'unknown' }

    const dayAvail = boat.availability?.[dateStr]
    if (!dayAvail) return { type: 'unknown' }

    const booking = ns3000Bookings.find(b => b.boat_id === boatId && b.booking_date === dateStr)

    if (!dayAvail.available && !dayAvail.slots?.morning && !dayAvail.slots?.afternoon) {
      return { type: 'occupato', reason: dayAvail.reason || 'Prenotata', booking }
    }
    if (dayAvail.available && (!dayAvail.slots?.morning || !dayAvail.slots?.afternoon)) {
      return { type: 'parziale', slots: dayAvail.slots, booking }
    }
    return { type: 'disponibile' }
  }

  const [newBookingInitialNs3000BoatId, setNewBookingInitialNs3000BoatId] = useState('')
  const [newBookingInitialNs3000BoatName, setNewBookingInitialNs3000BoatName] = useState('')

  function handleNs3000CellClick(boatId: string, boatName: string, date: Date) {
    const status = getNs3000CellStatus(boatId, date)
    if (status.booking) {
      // Cella occupata: mostra dettagli
      setNs3000BookingDetail(status.booking)
      setShowNs3000Dettagli(true)
    } else {
      // Cella libera: apri BookingModal preimpostato su NS3000
      setNewBookingInitialDate(format(date, 'yyyy-MM-dd'))
      setNewBookingInitialNs3000BoatId(String(boatId))
      setNewBookingInitialNs3000BoatName(boatName)
      setNewBookingInitialImbarcazione('')
      setShowNewBookingModal(true)
    }
  }

  async function loadData() {
    try {
      setLoading(true)

      const dateFrom = format(currentMonthStart, 'yyyy-MM-dd')
      const dateTo = format(currentMonthEnd, 'yyyy-MM-dd')

      const { data: fornitoriData } = await supabase
        .from('fornitori')
        .select('id, ragione_sociale')
        .eq('attivo', true)
        .order('ragione_sociale')

      const barcheQuery = supabase
        .from('imbarcazioni')
        .select('id, nome, tipo, categoria, fornitore_id')
        .eq('attiva', true)
        .order('categoria', { ascending: false })
        .order('nome')

      // Operatore vede solo le proprie imbarcazioni
      if (isOperatore && fornitoreId) {
        barcheQuery.eq('fornitore_id', fornitoreId)
      }

      const { data: barcheData } = await barcheQuery

      const { data: prenotazioniData } = await supabase
        .from('prenotazioni')
        .select('id, imbarcazione_id, data_servizio, stato, numero_persone, codice_prenotazione')
        .gte('data_servizio', dateFrom)
        .lte('data_servizio', dateTo)
        .in('stato', ['confermata', 'in_attesa', 'completata'])

      const { data: blocchiData } = await supabase
        .from('blocchi_imbarcazioni')
        .select('id, imbarcazione_id, data_inizio, data_fine, motivo, note')
        .lte('data_inizio', dateTo)
        .gte('data_fine', dateFrom)

      setFornitori(fornitoriData || [])
      setImbarcazioni(barcheData || [])
      setPrenotazioni(prenotazioniData || [])
      setBlocchi(blocchiData || [])
    } catch (error) {
      console.error('Errore:', error)
      toast.error('Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }

  function applicaFiltri() {
    let filtrate = [...imbarcazioni]
    // Operatore: re-applica il filtro per sicurezza
    if (isOperatore && fornitoreId) {
      filtrate = filtrate.filter(b => b.fornitore_id === fornitoreId)
    }
    // FIX: l'operatore non deve mai perdere le sue barche NS3000 dalla vista
    if (!isOperatore && showNs3000 && ns3000Boats.length > 0) {
      filtrate = filtrate.filter(b => !baIdsInNs3000.has(b.id))
    }
    if (filtroFornitore !== 'tutti') {
      filtrate = filtrate.filter(b => b.fornitore_id === filtroFornitore)
    }
    if (filtroCategoria !== 'tutti') {
      filtrate = filtrate.filter(b => b.categoria === filtroCategoria)
    }
    setImbarcazioniFiltrate(filtrate)
  }

  function goToPreviousMonth() {
    setCurrentMonthStart(subMonths(currentMonthStart, 1))
  }

  function goToNextMonth() {
    setCurrentMonthStart(addMonths(currentMonthStart, 1))
  }

  function goToToday() {
    setCurrentMonthStart(startOfMonth(new Date()))
  }

  function handleMonthChange(newMonth: number) {
    setCurrentMonthStart(startOfMonth(new Date(currentYear, newMonth, 1)))
  }

  function handleYearChange(newYear: number) {
    setCurrentMonthStart(startOfMonth(new Date(newYear, currentMonth, 1)))
  }

  function getCellStatus(imbarcazioneId: string, date: Date) {
    const dateStr = format(date, 'yyyy-MM-dd')

    const prenotazione = prenotazioni.find(
      p => p.imbarcazione_id === imbarcazioneId && p.data_servizio === dateStr
    )

    const blocco = blocchi.find(b => {
      if (b.imbarcazione_id !== imbarcazioneId) return false
      const dataInizio = parseISO(b.data_inizio)
      const dataFine = parseISO(b.data_fine)
      return date >= dataInizio && date <= dataFine
    })

    if (prenotazione) return { type: 'prenotazione', data: prenotazione }
    if (blocco) return { type: 'blocco', data: blocco }
    return { type: 'disponibile' }
  }

  function handleCellClick(imbarcazioneId: string, imbarcazioneNome: string, date: Date, e: React.MouseEvent) {
    const cellStatus = getCellStatus(imbarcazioneId, date)

    if (cellStatus.type === 'prenotazione') {
      // Operatore non vede i dettagli prenotazione
      if (isOperatore) return
      mostraDettagliPrenotazione(cellStatus.data.id)
      return
    }

    if (cellStatus.type === 'blocco') {
      if (confirm('Vuoi rimuovere questo blocco e rendere disponibile la barca?')) {
        rimuoviBlocco(cellStatus.data.id)
      }
      return
    }

    // Cella disponibile
    if (isOperatore) {
      // Operatore: apre direttamente il modal blocco (solo gestione disponibilità)
      setSelectedCell({ imbarcazioneId, date, imbarcazioneNome })
      setMotivoBlocco('')
      setTipoBlocco('altro')
      setShowBloccoModal(true)
    } else {
      // Admin: mostra context menu con scelta
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      setContextMenu({
        x: rect.left + window.scrollX,
        y: rect.bottom + window.scrollY + 4,
        imbarcazioneId,
        imbarcazioneNome,
        date
      })
    }
  }

  function openNewBooking() {
    if (!contextMenu) return
    setNewBookingInitialDate(format(contextMenu.date, 'yyyy-MM-dd'))
    setNewBookingInitialImbarcazione(contextMenu.imbarcazioneId)
    setContextMenu(null)
    setShowNewBookingModal(true)
  }

  function openBloccoFromMenu() {
    if (!contextMenu) return
    setSelectedCell({ imbarcazioneId: contextMenu.imbarcazioneId, date: contextMenu.date, imbarcazioneNome: contextMenu.imbarcazioneNome })
    setMotivoBlocco('')
    setTipoBlocco('altro')
    setContextMenu(null)
    setShowBloccoModal(true)
  }

  async function mostraDettagliPrenotazione(prenotazioneId: string) {
    try {
      setLoadingDettagli(true)
      const { data, error } = await supabase
        .from('prenotazioni')
        .select(`
          *,
          servizi (id, nome, tipo, prezzo_base),
          imbarcazioni (id, nome, tipo, categoria),
          clienti (id, nome, cognome, email, telefono, nazione)
        `)
        .eq('id', prenotazioneId)
        .single()

      if (error) throw error
      setPrenotazioneSelezionata(data)
      setShowDettagliModal(true)
    } catch (error) {
      console.error('Errore caricamento dettagli:', error)
      toast.error('Errore nel caricamento dei dettagli')
    } finally {
      setLoadingDettagli(false)
    }
  }

  async function creaBlocco() {
    if (!selectedCell) return
    try {
      const { error } = await supabase
        .from('blocchi_imbarcazioni')
        .insert([{
          imbarcazione_id: selectedCell.imbarcazioneId,
          data_inizio: format(selectedCell.date, 'yyyy-MM-dd'),
          data_fine: format(selectedCell.date, 'yyyy-MM-dd'),
          motivo: motivoBlocco || 'Indisponibilità',
          note: tipoBlocco
        }])

      if (error) throw error
      toast.success('Blocco creato!')
      setShowBloccoModal(false)
      loadData()
    } catch (error: any) {
      console.error('Errore creazione blocco:', error)
      toast.error('Errore nella creazione del blocco')
    }
  }

  async function rimuoviBlocco(bloccoId: string) {
    try {
      const { error } = await supabase
        .from('blocchi_imbarcazioni')
        .delete()
        .eq('id', bloccoId)

      if (error) throw error
      toast.success('Blocco rimosso!')
      loadData()
    } catch (error: any) {
      console.error('Errore rimozione blocco:', error)
      toast.error('Errore nella rimozione del blocco')
    }
  }

  const filtersActive = filtroFornitore !== 'tutti' || filtroCategoria !== 'tutti'

  // Calcolo occupancy sul mese
  const occupancyRate = imbarcazioniFiltrate.length > 0
    ? Math.round((prenotazioni.length / (imbarcazioniFiltrate.length * monthDays.length)) * 100)
    : 0

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="text-gray-600">Caricamento planning...</div>
      </div>
    )
  }

  return (
    <div className="p-1 md:p-2 lg:p-3 h-screen flex flex-col">

      {/* ── HEADER ── */}
      <div className="mb-3 bg-gray-50 rounded-xl p-3 md:p-5">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Planning Mensile</h1>
          {isOperatore && (
            <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full border border-green-200">
              👤 Vista Operatore — Solo le tue imbarcazioni
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Mese corrente + dropdowns */}
          <div className="flex items-center gap-3">
            <span className="text-base md:text-lg font-extrabold text-gray-900 tracking-wide">
              {monthNames[currentMonth]}
            </span>
            <select
              value={currentMonth}
              onChange={(e) => handleMonthChange(parseInt(e.target.value))}
              className="px-2 py-1.5 border border-blue-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 font-medium text-blue-700"
            >
              {['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'].map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
            <select
              value={currentYear}
              onChange={(e) => handleYearChange(parseInt(e.target.value))}
              className="px-2 py-1.5 border border-blue-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 font-medium text-blue-700"
            >
              {[2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Navigazione */}
          <div className="flex gap-2">
            <button
              onClick={goToPreviousMonth}
              className="px-3 md:px-4 py-1.5 md:py-2 border border-gray-300 rounded-lg hover:bg-white text-xs md:text-sm bg-white"
            >
              ◀ Prec
            </button>
            <button
              onClick={goToToday}
              className="px-4 md:px-5 py-1.5 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs md:text-sm font-semibold shadow-sm"
            >
              Oggi
            </button>
            <button
              onClick={goToNextMonth}
              className="px-3 md:px-4 py-1.5 md:py-2 border border-gray-300 rounded-lg hover:bg-white text-xs md:text-sm bg-white"
            >
              Succ ▶
            </button>
          </div>
        </div>
      </div>

      {/* ── LEGENDA ── */}
      <div className="mb-2 bg-white rounded-lg shadow-sm border border-gray-200 px-3 py-2">
        <div className="flex flex-wrap items-center gap-3 md:gap-5 text-xs md:text-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-amber-400 rounded-full"></div>
            <span className="text-gray-700">In Attesa</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
            <span className="text-gray-700">Confermata</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            <span className="text-gray-700">Da Recuperare</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-gray-700">Chiusa</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
            <span className="text-gray-700">Bloccata</span>
          </div>
          <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-gray-300">
            <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
            <span className="text-gray-700">NS3000</span>
          </div>
        </div>
      </div>

      {/* ── FILTRI + STATS ── */}
      <div className="mb-2 flex items-center gap-2">
        {!isOperatore && (
          <>
            <button
              onClick={() => setShowFiltri(!showFiltri)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                filtersActive
                  ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              🔍 Filtri {filtersActive && '●'}
            </button>

            <button
              onClick={() => setShowNs3000(!showNs3000)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                showNs3000
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-medium'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              ⛵ NS3000 {ns3000Boats.length > 0 && `(${ns3000Boats.length})`}
            </button>

            {filtersActive && (
              <button
                onClick={() => { setFiltroFornitore('tutti'); setFiltroCategoria('tutti') }}
                className="text-xs text-red-500 hover:text-red-700"
              >
                ✕ Reset
              </button>
            )}
          </>
        )}

        {/* Stats desktop */}
        <div className={`${isOperatore ? '' : 'hidden sm:flex'} flex items-center gap-3 ml-auto text-xs text-gray-500`}>
          <span>🚤 <strong className="text-gray-900">{imbarcazioniFiltrate.length}</strong> barche</span>
          {!isOperatore && (
            <>
              <span>📋 <strong className="text-blue-600">{prenotazioni.length}</strong> prenot.</span>
              <span>🚫 <strong className="text-red-600">{blocchi.length}</strong> blocchi</span>
              <span>📊 <strong className="text-purple-600">{occupancyRate}%</strong></span>
            </>
          )}
          {isOperatore && (
            <span>🚫 <strong className="text-red-600">{blocchi.length}</strong> blocchi attivi</span>
          )}
        </div>
      </div>

      {/* ── FILTRI ESPANSI ── */}
      {!isOperatore && showFiltri && (
        <div className="mb-2 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fornitore</label>
              <select
                value={filtroFornitore}
                onChange={(e) => setFiltroFornitore(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs md:text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="tutti">Tutti ({imbarcazioni.length})</option>
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
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs md:text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="tutti">Tutte</option>
                <option value="luxury">Luxury</option>
                <option value="premium">Premium</option>
                <option value="simple">Simple</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── STATS MOBILE ── */}
      {!isOperatore && (
      <div className="sm:hidden mb-2 grid grid-cols-4 gap-1.5 text-center">
        {[
          { val: imbarcazioniFiltrate.length, icon: '🚤', color: 'text-gray-900' },
          { val: prenotazioni.length, icon: '📋', color: 'text-blue-600' },
          { val: blocchi.length, icon: '🚫', color: 'text-red-600' },
          { val: `${occupancyRate}%`, icon: '📊', color: 'text-purple-600' },
        ].map(({ val, icon, color }, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 py-1.5 px-1">
            <div className={`text-sm font-bold ${color}`}>{val}</div>
            <div className="text-xs text-gray-500">{icon}</div>
          </div>
        ))}
      </div>
      )}

      {/* ── GRIGLIA MENSILE ── */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto h-full">
          <table className="border-collapse" style={{ tableLayout: 'fixed', minWidth: `${colSizes.barca + monthDays.length * colSizes.giorno}px` }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50">
                {/* Colonna nome barca */}
                <th
                  className="sticky left-0 z-20 bg-gray-100 border border-gray-200 px-2 py-2 text-left font-semibold text-gray-900 text-xs"
                  style={{ width: `${colSizes.barca}px`, minWidth: `${colSizes.barca}px` }}
                >
                  Flotta
                </th>
                {/* Colonne giorni */}
                {monthDays.map((day) => {
                  const isToday = isSameDay(day, new Date())
                  const isWeekend = [0, 6].includes(day.getDay())
                  return (
                    <th
                      key={day.toISOString()}
                      className={`border border-gray-200 py-1 text-center font-semibold ${
                        isToday
                          ? 'bg-blue-100 text-blue-700'
                          : isWeekend
                          ? 'bg-orange-50 text-gray-700'
                          : 'text-gray-700'
                      }`}
                      style={{ width: `${colSizes.giorno}px`, minWidth: `${colSizes.giorno}px` }}
                    >
                      <div className="flex flex-col leading-tight">
                        <span className="text-[9px] font-normal text-gray-400 uppercase">
                          {format(day, 'EEEEE', { locale: it })}
                        </span>
                        <span className={`text-xs ${isToday ? 'font-bold' : ''}`}>
                          {format(day, 'd')}
                        </span>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {imbarcazioniFiltrate.map((barca) => (
                <tr key={barca.id} className="hover:bg-gray-50/50">
                  {/* Nome barca */}
                  <td
                    className="sticky left-0 z-[5] bg-gray-50 border border-gray-200 px-2 py-1"
                    style={{ width: `${colSizes.barca}px`, minWidth: `${colSizes.barca}px` }}
                  >
                    <div className="text-xs font-semibold text-gray-900 truncate leading-tight" title={barca.nome}>{barca.nome}</div>
                    <div className="text-[10px] text-gray-400 truncate capitalize leading-tight hidden sm:block">{barca.categoria}</div>
                  </td>

                  {/* Celle giorni */}
                  {monthDays.map((day) => {
                    const cellStatus = getCellStatus(barca.id, day)
                    const isToday = isSameDay(day, new Date())
                    const isWeekend = [0, 6].includes(day.getDay())

                    let bgColor = isWeekend ? 'bg-orange-50/60 hover:bg-orange-100' : 'bg-green-50 hover:bg-green-100'
                    let borderColor = 'border-l-green-300'
                    let content = null

                    if (cellStatus.type === 'prenotazione') {
                      const stato = cellStatus.data.stato
                      if (stato === 'confermata') {
                        bgColor = 'bg-emerald-100 hover:bg-emerald-200'
                        borderColor = 'border-l-emerald-500'
                      } else if (stato === 'in_attesa') {
                        bgColor = 'bg-amber-100 hover:bg-amber-200'
                        borderColor = 'border-l-amber-500'
                      } else if (stato === 'completata') {
                        bgColor = 'bg-blue-100 hover:bg-blue-200'
                        borderColor = 'border-l-blue-500'
                      } else {
                        bgColor = 'bg-purple-100 hover:bg-purple-200'
                        borderColor = 'border-l-purple-500'
                      }
                      content = (
                        <span className="text-[9px] font-bold text-gray-700 leading-none">
                          {cellStatus.data.numero_persone}p
                        </span>
                      )
                    } else if (cellStatus.type === 'blocco') {
                      bgColor = 'bg-gray-200 hover:bg-gray-300'
                      borderColor = 'border-l-gray-500'
                      content = <span className="text-[9px] text-gray-500">🚫</span>
                    }

                    return (
                      <td
                        key={`${barca.id}-${day.toISOString()}`}
                        className="border border-gray-100 p-0"
                        style={{ width: `${colSizes.giorno}px`, minWidth: `${colSizes.giorno}px` }}
                      >
                        <button
                          onClick={(e) => handleCellClick(barca.id, barca.nome, day, e)}
                          className={`w-full flex flex-col items-center justify-center border-l-2 transition-all ${bgColor} ${borderColor} ${isToday ? 'ring-1 ring-inset ring-blue-300' : ''}`}
                          style={{ height: `${colSizes.altezza}px` }}
                          title={
                            cellStatus.type === 'prenotazione'
                              ? `${cellStatus.data.codice_prenotazione} · ${cellStatus.data.numero_persone} pax`
                              : cellStatus.type === 'blocco'
                              ? `Bloccata: ${cellStatus.data.motivo || 'Indisponibilità'}`
                              : 'Disponibile'
                          }
                        >
                          {content}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── GRIGLIA NS3000 ── */}
          {!isOperatore && showNs3000 && ns3000Boats.length > 0 && (
            <table className="border-collapse mt-0" style={{ tableLayout: 'fixed', minWidth: `${colSizes.barca + monthDays.length * colSizes.giorno}px` }}>
              <thead className="">
                <tr className="bg-indigo-50">
                  <th
                    className="sticky left-0 z-20 bg-indigo-100 border border-indigo-200 px-2 py-1.5 text-left font-semibold text-indigo-900 text-xs"
                    style={{ width: `${colSizes.barca}px`, minWidth: `${colSizes.barca}px` }}
                  >
                    <div className="flex items-center gap-1">⛵ NS3000</div>
                  </th>
                  {monthDays.map((day) => (
                    <th
                      key={`ns-h-${day.toISOString()}`}
                      className="border border-indigo-200 bg-indigo-50 py-1 text-center"
                      style={{ width: `${colSizes.giorno}px`, minWidth: `${colSizes.giorno}px` }}
                    >
                      <span className="text-[9px] text-indigo-400">{format(day, 'd')}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ns3000Boats.map((boat) => (
                  <tr key={`ns-${boat.boat_id}`} className="hover:bg-indigo-50">
                    <td
                      className="sticky left-0 z-[5] bg-indigo-50 border border-gray-200 px-2 py-1"
                      style={{ width: `${colSizes.barca}px`, minWidth: `${colSizes.barca}px` }}
                    >
                      <div className="text-xs font-semibold text-indigo-900 truncate leading-tight">{boat.name}</div>
                      <div className="text-[10px] text-indigo-400 truncate leading-tight">{boat.boat_type} · {boat.max_passengers}p</div>
                    </td>
                    {monthDays.map((day) => {
                      const cellStatus = getNs3000CellStatus(boat.boat_id, day)
                      const isToday = isSameDay(day, new Date())

                      let bgColor = 'bg-green-50 hover:bg-green-100'
                      let borderColor = 'border-l-green-300'
                      let content = null

                      if (cellStatus.type === 'occupato') {
                        bgColor = 'bg-indigo-100 hover:bg-indigo-200'
                        borderColor = 'border-l-indigo-500'
                        content = cellStatus.booking ? (
                          <span className="text-[9px] font-bold text-indigo-700 leading-none">
                            {cellStatus.booking.num_passengers}p
                          </span>
                        ) : null
                      } else if (cellStatus.type === 'parziale') {
                        bgColor = 'bg-amber-50 hover:bg-amber-100'
                        borderColor = 'border-l-amber-400'
                        const slots = cellStatus.slots
                        content = (
                          <span className="text-[9px] text-amber-700 leading-none">
                            {slots?.morning ? 'PM' : 'AM'}
                          </span>
                        )
                      } else if (cellStatus.type === 'unknown') {
                        bgColor = 'bg-gray-50'
                        borderColor = 'border-l-gray-200'
                      }

                      return (
                        <td
                          key={`ns-${boat.boat_id}-${day.toISOString()}`}
                          className="border border-gray-100 p-0"
                          style={{ width: `${colSizes.giorno}px`, minWidth: `${colSizes.giorno}px` }}
                        >
                          <button
                            onClick={() => handleNs3000CellClick(boat.boat_id, boat.name, day)}
                            className={`w-full flex flex-col items-center justify-center border-l-2 transition-all ${bgColor} ${borderColor} ${isToday ? 'ring-1 ring-inset ring-blue-300' : ''}`}
                            style={{ height: `${colSizes.altezza}px` }}
                            title={
                              cellStatus.type === 'occupato'
                                ? `Prenotata${cellStatus.booking ? ` · ${cellStatus.booking.customer_name} ${cellStatus.booking.customer_surname}` : ''}`
                                : cellStatus.type === 'parziale'
                                ? 'Parzialmente disponibile'
                                : 'Disponibile'
                            }
                          >
                            {content}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {ns3000Loading && (
            <div className="text-center py-3 text-xs text-indigo-500">Caricamento barche NS3000...</div>
          )}

          {imbarcazioniFiltrate.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {filtersActive
                ? 'Nessuna imbarcazione trovata con i filtri selezionati'
                : 'Nessuna imbarcazione attiva trovata'}
            </div>
          )}
        </div>
      </div>

      {/* ── HINT ── */}
      <div className="mt-2 text-xs text-gray-400 text-center">
        💡 Tocca una cella per vedere i dettagli · Cella vuota per bloccare · 🟠 Weekend
      </div>

      {/* ══════════════════════════════════════════
          MODAL CREA BLOCCO
      ══════════════════════════════════════════ */}
      {showBloccoModal && selectedCell && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {isOperatore ? '📅 Gestisci Disponibilità' : 'Blocca Disponibilità'}
                </h2>
                {isOperatore && (
                  <p className="text-xs text-gray-500 mt-0.5">Dichiara indisponibilità per questa data</p>
                )}
              </div>
              <button onClick={() => setShowBloccoModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="mb-4 bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-700"><strong>🚤 {selectedCell.imbarcazioneNome}</strong></p>
              <p className="text-sm text-gray-600">📅 {format(selectedCell.date, 'EEEE dd MMMM yyyy', { locale: it })}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo Blocco</label>
                <select
                  value={tipoBlocco}
                  onChange={(e) => setTipoBlocco(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="altro">Altro</option>
                  <option value="manutenzione">Manutenzione</option>
                  <option value="prenotazione_esterna">Prenotazione Esterna</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Motivo (opzionale)</label>
                <textarea
                  value={motivoBlocco}
                  onChange={(e) => setMotivoBlocco(e.target.value)}
                  placeholder="Es: Manutenzione motore, prenotazione diretta..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowBloccoModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Annulla
              </button>
              <button
                onClick={creaBlocco}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
              >
                🚫 Blocca
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          MODAL DETTAGLI PRENOTAZIONE BLU ALLIANCE
      ══════════════════════════════════════════ */}
      {showDettagliModal && prenotazioneSelezionata && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-5 my-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">📋 Dettagli Prenotazione</h2>
              <button onClick={() => setShowDettagliModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            {loadingDettagli ? (
              <div className="text-center py-8 text-gray-600">Caricamento dettagli...</div>
            ) : (
              <div className="space-y-4">
                {/* Codice */}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 text-center">
                  <div className="text-xs text-blue-600 font-medium mb-0.5">Codice Prenotazione</div>
                  <div className="text-2xl font-bold text-blue-900">{prenotazioneSelezionata.codice_prenotazione}</div>
                </div>

                {/* Servizio */}
                <div className="border-b pb-3">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">🚤 Servizio</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs md:text-sm">
                    {[
                      ['Imbarcazione', prenotazioneSelezionata.imbarcazioni?.nome],
                      ['Servizio', prenotazioneSelezionata.servizi?.nome],
                      ['Data', format(parseISO(prenotazioneSelezionata.data_servizio), 'dd MMM yyyy', { locale: it })],
                      ['Ora', prenotazioneSelezionata.ora_imbarco || 'N/A'],
                      ['Persone', `${prenotazioneSelezionata.numero_persone} pax`],
                      ['Porto', prenotazioneSelezionata.porto_imbarco || 'N/A'],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <span className="text-gray-500">{label}:</span>
                        <div className="font-medium text-gray-900">{val || 'N/A'}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cliente */}
                <div className="border-b pb-3">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">👤 Cliente</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs md:text-sm">
                    {[
                      ['Nome', `${prenotazioneSelezionata.clienti?.nome || ''} ${prenotazioneSelezionata.clienti?.cognome || ''}`],
                      ['Email', prenotazioneSelezionata.clienti?.email],
                      ['Telefono', prenotazioneSelezionata.clienti?.telefono],
                      ['Nazione', prenotazioneSelezionata.clienti?.nazione],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <span className="text-gray-500">{label}:</span>
                        <div className="font-medium text-gray-900 truncate">{val || 'N/A'}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pagamento */}
                <div className="border-b pb-3">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">💰 Pagamento</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs md:text-sm">
                    <div>
                      <span className="text-gray-500">Prezzo Totale:</span>
                      <div className="font-medium text-gray-900">€{parseFloat(prenotazioneSelezionata.prezzo_totale || 0).toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Importo Pagato:</span>
                      <div className="font-medium text-green-600">€{parseFloat(prenotazioneSelezionata.importo_pagato || 0).toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Tipo Pagamento:</span>
                      <div className="font-medium text-gray-900">
                        {prenotazioneSelezionata.tipo_pagamento === 'caparra' ? 'Caparra 50%' : 'Completo'}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Stato Pagamento:</span>
                      <div className={`font-medium ${
                        prenotazioneSelezionata.stato_pagamento === 'pagato' ? 'text-green-600' :
                        prenotazioneSelezionata.stato_pagamento === 'parzialmente_pagato' ? 'text-orange-600' :
                        'text-red-600'
                      }`}>
                        {prenotazioneSelezionata.stato_pagamento || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stato */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">📊 Stato</h3>
                  <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-medium ${
                    prenotazioneSelezionata.stato === 'confermata' ? 'bg-green-100 text-green-800' :
                    prenotazioneSelezionata.stato === 'in_attesa' ? 'bg-yellow-100 text-yellow-800' :
                    prenotazioneSelezionata.stato === 'completata' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {prenotazioneSelezionata.stato}
                  </span>
                </div>

                {/* Note */}
                {prenotazioneSelezionata.note_cliente && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">📝 Note Cliente</h3>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-xs md:text-sm text-gray-700">
                      {prenotazioneSelezionata.note_cliente}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-5">
              <button
                onClick={() => setShowDettagliModal(false)}
                className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          CONTEXT MENU CELLA DISPONIBILE
      ══════════════════════════════════════════ */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y, minWidth: '220px' }}
        >
          {/* Header */}
          <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {format(contextMenu.date, 'd MMM yyyy', { locale: it })}
            </p>
            <p className="text-sm font-bold text-gray-900 truncate mt-0.5">
              {contextMenu.imbarcazioneNome}
            </p>
          </div>

          {/* Opzioni */}
          <div className="p-1.5 space-y-0.5">
            {/* Nuova Prenotazione */}
            <button
              onClick={openNewBooking}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-blue-50 transition-colors text-left group"
            >
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors flex-shrink-0">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">Nuova Prenotazione</div>
                <div className="text-xs text-gray-500 truncate">
                  {contextMenu.imbarcazioneNome} · {format(contextMenu.date, 'd MMM', { locale: it })}
                </div>
              </div>
            </button>

            {/* Indisponibilità */}
            <button
              onClick={openBloccoFromMenu}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-50 transition-colors text-left group"
            >
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center group-hover:bg-red-200 transition-colors flex-shrink-0">
                <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">Indisponibilità</div>
                <div className="text-xs text-gray-500 truncate">
                  Blocca {contextMenu.imbarcazioneNome}
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          BOOKING MODAL (NUOVA PRENOTAZIONE DAL PLANNING)
      ══════════════════════════════════════════ */}
      <BookingModal
        isOpen={showNewBookingModal}
        onClose={() => setShowNewBookingModal(false)}
        onSave={() => {
          setShowNewBookingModal(false)
          loadData()
          toast.success('Prenotazione creata!')
        }}
        initialDate={newBookingInitialDate}
        initialImbarcazioneId={newBookingInitialImbarcazione}
        initialNs3000BoatId={newBookingInitialNs3000BoatId}
        initialNs3000BoatName={newBookingInitialNs3000BoatName}
        initialBoatSource={newBookingInitialNs3000BoatId ? 'ns3000' : 'locale'}
      />
      {showNs3000Dettagli && ns3000BookingDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3">
          <div className="bg-white rounded-xl max-w-lg w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-indigo-900">⛵ Prenotazione NS3000</h2>
              <button onClick={() => setShowNs3000Dettagli(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="space-y-3">
              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-3 text-center">
                <div className="text-xs text-indigo-600 font-medium mb-0.5">Codice</div>
                <div className="text-xl font-bold text-indigo-900">{ns3000BookingDetail.booking_number}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['Barca', ns3000BookingDetail.boats?.name],
                  ['Data', ns3000BookingDetail.booking_date],
                  ['Fascia', ns3000BookingDetail.time_slot?.replace('_', ' ')],
                  ['Passeggeri', `${ns3000BookingDetail.num_passengers} pax`],
                  ['Cliente', `${ns3000BookingDetail.customer_name} ${ns3000BookingDetail.customer_surname}`],
                  ['Email', ns3000BookingDetail.customer_email],
                  ['Prezzo', `€${parseFloat(ns3000BookingDetail.final_price || 0).toFixed(2)}`],
                  ['Origine', ns3000BookingDetail.source || 'ns3000'],
                ].map(([label, val]) => (
                  <div key={label}>
                    <span className="text-gray-500 text-xs">{label}:</span>
                    <div className={`font-medium truncate ${label === 'Prezzo' ? 'text-green-600' : ''}`}>{val || 'N/A'}</div>
                  </div>
                ))}
              </div>

              {ns3000BookingDetail.notes && (
                <div>
                  <span className="text-gray-500 text-xs">Note:</span>
                  <div className="bg-gray-50 rounded-lg p-2 text-sm text-gray-700 mt-1">{ns3000BookingDetail.notes}</div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowNs3000Dettagli(false)}
              className="w-full mt-4 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  )
}