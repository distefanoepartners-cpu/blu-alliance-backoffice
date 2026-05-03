'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import toast from 'react-hot-toast'
import BookingModal from '@/components/BookingModal'
import { useAuth } from '@/contexts/AuthContext'
import { trackAction } from '@/lib/useActivityTracker'

const NS3000_FORNITORE_ID = '2d78fca2-f474-4c44-8443-44c75924d5c3'

const ns3000ToBaMap: Record<string, string> = {
  '4a222a73-304b-4945-813b-9548ba201675': 'b743d220-6200-49de-9324-68297e4eee75',
  'd03cfe13-bcb6-4f98-bda4-a18b8bf7957d': '64e06e82-ed6e-4f23-b06e-14533a0187c6',
  '00ce8828-ebf9-4aad-8ad8-8f6b4e90a1e3': '7e854592-bb5d-4971-98aa-ae66c2fa66ba',
  '2edce19e-3687-42b9-bb87-57e2aabfccd2': 'b2a20895-eeab-493d-a2fb-53ef5ba1d220',
  '937298ab-2a15-4ace-adb2-b63dd1b865b1': '4c4f4b54-4ee6-481f-94f9-a142b5d651b0',
  '6800721d-a8e9-4217-b7a2-8548359c6cfc': '9a6cc58f-bb70-440e-92a1-d2e2c2712e5b',
  '52a7e9d0-444e-4801-a095-afcbba7ceed5': 'b2c15f7e-ffb2-4afa-bf19-d53f8d26902b',
  '180dd752-b2b4-4318-beed-8bc15b3877c2': '557ecf08-2e88-4914-a1d9-da5ec5bf5845',
  '8c1b5b3d-d4a2-441c-8f8e-71b88ff6c966': '07673392-e08c-4d53-a128-e9d6c405917d',
  '42d4c904-f2e1-4436-931b-3e7b651bd7a6': '2f4f1a71-5037-4fb0-bbd1-ef6c6acf8dc5',
  'c35aefd0-6721-4f01-aeec-2d47bdf9f24f': '2d4995ec-35b3-4358-ace1-54621a9528ed',
  'fe759df8-5d8e-401f-8fb2-dfaa3642c33c': '51231c4f-b929-466c-aed3-9440639e0bd7',
  'd5bff230-0e6a-4211-b0ce-342e8fbace51': '8d4d1bd6-142f-4d0f-8854-333742eeeba3',
  '636cb5d4-1316-4382-90db-fa6c16deb1f4': '31d0ac07-57a9-472d-b07a-f9a26b2ba89e',
  '1365d4d3-0ffb-48a8-a8a6-d3c49dd22145': 'a079598f-b25d-49d6-90ce-b25146687a31',
  '7b039929-1af2-46ab-9a91-f051497161e7': 'c8638c23-cd35-4c11-8333-4316f1ca4726',
  '02ffd51e-da3f-45fa-b2a5-92acc254e2a6': 'd8262b01-07d0-4795-ba31-e64c6eaf6f0f',
  '3b967967-d7de-48bb-9f03-5e779aa15a27': '43d0b751-da8d-4181-aabc-ba3b217142bc',
}
const baToNs3000Map: Record<string, string> = Object.fromEntries(
  Object.entries(ns3000ToBaMap).map(([k, v]) => [v, k])
)

const TIPO_LABELS: Record<string, string> = {
  'yacht': '🛥️ Yacht',
  'gozzo': '⛵ Gozzi',
  'gommone': '🚤 Gommoni',
  'barca': '🚢 Barche',
  'barca_vela': '⛵ Barche a Vela',
}
const TIPO_ORDER = ['yacht', 'gozzo', 'gommone', 'barca', 'barca_vela']

export default function PlanningMensile() {
  const { isOperatore, fornitoreId, loading: authLoading } = useAuth()

  const [colSizes, setColSizes] = useState({ barca: 140, giorno: 38, altezza: 42 })
  useEffect(() => {
    function updateSizes() {
      const w = window.innerWidth
      if (w < 640) setColSizes({ barca: 80, giorno: 26, altezza: 34 })
      else if (w < 1024) setColSizes({ barca: 100, giorno: 32, altezza: 38 })
      else setColSizes({ barca: 140, giorno: 38, altezza: 42 })
    }
    updateSizes()
    window.addEventListener('resize', updateSizes)
    return () => window.removeEventListener('resize', updateSizes)
  }, [])

  const [imbarcazioni, setImbarcazioni] = useState<any[]>([])
  const [servizi, setServizi] = useState<any[]>([])
  const [prezziMap, setPrezziMap] = useState<Record<string, number>>({})
  const [prenotazioni, setPrenotazioni] = useState<any[]>([])
  const [blocchi, setBlocchi] = useState<any[]>([])
  const [postiEsterni, setPostiEsterni] = useState<any[]>([])
  const [currentMonthStart, setCurrentMonthStart] = useState(startOfMonth(new Date()))
  const [loading, setLoading] = useState(true)
  const [filtroTour, setFiltroTour] = useState<string>('tutti')
  const [filtroTipo, setFiltroTipo] = useState<string>('tutti')
  const [filtroPax, setFiltroPax] = useState<number>(0)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  // NS3000
  const [ns3000Availability, setNs3000Availability] = useState<Record<string, any>>({})
  const [ns3000Bookings, setNs3000Bookings] = useState<any[]>([])

  // Modals
  const [showBloccoModal, setShowBloccoModal] = useState(false)
  const [selectedCell, setSelectedCell] = useState<any>(null)
  const [motivoBlocco, setMotivoBlocco] = useState('')
  const [tipoBlocco, setTipoBlocco] = useState<'manutenzione' | 'prenotazione_esterna' | 'altro'>('altro')
  const [contextMenu, setContextMenu] = useState<any>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const [showNewBookingModal, setShowNewBookingModal] = useState(false)
  const [newBookingInitialDate, setNewBookingInitialDate] = useState('')
  const [newBookingInitialImbarcazione, setNewBookingInitialImbarcazione] = useState('')
  const [newBookingInitialNs3000BoatId, setNewBookingInitialNs3000BoatId] = useState('')
  const [newBookingInitialNs3000BoatName, setNewBookingInitialNs3000BoatName] = useState('')
  const [showDettagliModal, setShowDettagliModal] = useState(false)
  const [prenotazioneSelezionata, setPrenotazioneSelezionata] = useState<any>(null)
  const [loadingDettagli, setLoadingDettagli] = useState(false)
  const [showNs3000Dettagli, setShowNs3000Dettagli] = useState(false)
  const [ns3000BookingDetail, setNs3000BookingDetail] = useState<any>(null)
  const [syncing, setSyncing] = useState(false)

  const currentMonthEnd = endOfMonth(currentMonthStart)
  const monthDays = eachDayOfInterval({ start: currentMonthStart, end: currentMonthEnd })
  const monthNames = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO', 'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE']
  const currentMonth = currentMonthStart.getMonth()
  const currentYear = currentMonthStart.getFullYear()

  // ═══ LOAD ═══
  useEffect(() => {
    if (authLoading) return
    loadData()
  }, [currentMonthStart, authLoading, isOperatore, fornitoreId])

  useEffect(() => {
    if (filtroTour !== 'tutti') loadPrezziPerTour(filtroTour)
    else setPrezziMap({})
  }, [filtroTour, imbarcazioni])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) setContextMenu(null)
    }
    if (contextMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [contextMenu])

  // Auto-scroll al giorno corrente
  useEffect(() => {
    if (loading) return
    setTimeout(() => {
      const todayCell = document.querySelector('th.bg-blue-100') as HTMLElement
      const scrollContainer = todayCell?.closest('.overflow-x-auto') as HTMLElement
      if (todayCell && scrollContainer) {
        const cellLeft = todayCell.offsetLeft
        scrollContainer.scrollLeft = cellLeft - colSizes.barca - 20
      }
    }, 150)
  }, [loading, currentMonthStart])

  async function loadData() {
    try {
      setLoading(true)
      const dateFrom = format(currentMonthStart, 'yyyy-MM-dd')
      const dateTo = format(currentMonthEnd, 'yyyy-MM-dd')

      const { data: serviziData } = await supabase.from('servizi').select('id, nome, tipo, prezzo_base, prezzo_per_persona').eq('attivo', true).order('nome')
      setServizi(serviziData || [])

      const barcheQuery = supabase.from('imbarcazioni').select('id, nome, tipo, categoria, fornitore_id, capacita_massima').eq('attiva', true).order('ordine').order('nome')
      if (isOperatore && fornitoreId) barcheQuery.eq('fornitore_id', fornitoreId)
      else if (isOperatore) { setImbarcazioni([]); setLoading(false); return }
      const { data: barcheData } = await barcheQuery
      setImbarcazioni(barcheData || [])

      const { data: prenotazioniData } = await supabase.from('prenotazioni')
        .select('id, imbarcazione_id, data_servizio, stato, numero_persone, codice_prenotazione, tipo_tour')
        .gte('data_servizio', dateFrom).lte('data_servizio', dateTo)
        .in('stato', ['confermata', 'in_attesa', 'completata'])
      setPrenotazioni(prenotazioniData || [])

      const { data: blocchiData } = await supabase.from('blocchi_imbarcazioni')
        .select('id, imbarcazione_id, data_inizio, data_fine, motivo, note')
        .lte('data_inizio', dateTo).gte('data_fine', dateFrom)
      setBlocchi(blocchiData || [])

      // Posti esterni (collettivi armatore)
      const { data: postiEsterniData } = await supabase
        .from('posti_esterni')
        .select('imbarcazione_id, data, posti_occupati')
        .gte('data', dateFrom)
        .lte('data', dateTo)
      setPostiEsterni(postiEsterniData || [])

      // NS3000
      try {
        const availRes = await fetch(`/api/ns3000/availability?date_from=${dateFrom}&date_to=${dateTo}`)
        if (availRes.ok) {
          const availData = await availRes.json()
          const avMap: Record<string, any> = {}
          ;(availData.boats || []).forEach((boat: any) => {
            const baId = ns3000ToBaMap[boat.boat_id]
            if (baId) avMap[baId] = boat.availability
          })
          setNs3000Availability(avMap)
        }
        const bookRes = await fetch(`/api/ns3000/bookings?date_from=${dateFrom}&date_to=${dateTo}`)
        if (bookRes.ok) {
          const bookData = await bookRes.json()
          setNs3000Bookings(bookData.bookings || [])
        }
      } catch (e) { console.error('NS3000 error:', e) }
    } catch (error) {
      console.error('Errore:', error)
      toast.error('Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }

  async function loadPrezziPerTour(servizioId: string) {
    try {
      const { data: relazioni } = await supabase.from('imbarcazioni_servizi')
        .select('imbarcazione_id, prezzo_personalizzato').eq('servizio_id', servizioId)
      const { data: prezziCat } = await supabase.from('servizi_prezzi_categoria')
        .select('categoria, prezzo').eq('servizio_id', servizioId)

      const catMap: Record<string, number> = {}
      ;(prezziCat || []).forEach(pc => { catMap[pc.categoria] = pc.prezzo })

      const servizio = servizi.find(s => s.id === servizioId)
      const prezzoBase = servizio?.prezzo_base || 0

      const map: Record<string, number> = {}
      ;(relazioni || []).forEach(rel => {
        const barca = imbarcazioni.find(b => b.id === rel.imbarcazione_id)
        if (rel.prezzo_personalizzato) map[rel.imbarcazione_id] = rel.prezzo_personalizzato
        else if (barca && catMap[barca.categoria]) map[rel.imbarcazione_id] = catMap[barca.categoria]
        else map[rel.imbarcazione_id] = prezzoBase
      })
      setPrezziMap(map)
    } catch (e) { console.error('Errore prezzi:', e) }
  }

  // ═══ FILTERED & GROUPED ═══
  const filteredBoats = imbarcazioni.filter(b => {
    if (isOperatore && fornitoreId && b.fornitore_id !== fornitoreId) return false
    if (filtroTour !== 'tutti' && !prezziMap[b.id]) return false
    if (filtroTipo !== 'tutti' && (b.tipo || '').toLowerCase() !== filtroTipo) return false
    if (filtroPax > 0 && (b.capacita_massima || 0) < filtroPax) return false
    return true
  })

  const groupedBoats: { tipo: string; label: string; boats: any[] }[] = TIPO_ORDER
    .map(tipo => ({
      tipo, label: TIPO_LABELS[tipo] || tipo,
      boats: filteredBoats
        .filter(b => (b.tipo || '').toLowerCase() === tipo)
        .sort((a, b) => (prezziMap[a.id] || 0) - (prezziMap[b.id] || 0))
    }))
    .filter(g => g.boats.length > 0)

  const mappedTipos = new Set(TIPO_ORDER)
  const unmapped = filteredBoats.filter(b => !mappedTipos.has((b.tipo || '').toLowerCase()))
  if (unmapped.length > 0) {
    groupedBoats.push({ tipo: 'altro', label: '📋 Altro', boats: unmapped.sort((a, b) => (prezziMap[a.id] || 0) - (prezziMap[b.id] || 0)) })
  }

  const totalBoats = groupedBoats.reduce((s, g) => s + g.boats.length, 0)
  const isCollettivo = servizi.find(s => s.id === filtroTour)?.prezzo_per_persona

  // ═══ CELL STATUS ═══
  function getCellStatus(imbarcazioneId: string, date: Date) {
    const dateStr = format(date, 'yyyy-MM-dd')
    const isNs3000 = imbarcazioni.find(b => b.id === imbarcazioneId)?.fornitore_id === NS3000_FORNITORE_ID && !!baToNs3000Map[imbarcazioneId] && !!baToNs3000Map[imbarcazioneId]

    if (isNs3000) {
      const ns3000BoatId = baToNs3000Map[imbarcazioneId]
      if (ns3000BoatId) {
        const booking = ns3000Bookings.find(b => {
          if (b.boat_id !== ns3000BoatId) return false
          const end = b.booking_end_date || b.booking_date
          return dateStr >= b.booking_date && dateStr <= end
        })
        if (booking) return { type: 'ns3000_booking', data: booking }
      }
      const avail = ns3000Availability[imbarcazioneId]?.[dateStr]
      if (avail && !avail.available && !avail.slots?.morning && !avail.slots?.afternoon)
        return { type: 'ns3000_occupato', reason: avail.reason || 'Occupata' }
      if (avail && avail.available && (!avail.slots?.morning || !avail.slots?.afternoon))
        return { type: 'ns3000_parziale', slots: avail.slots }
      return { type: 'disponibile' }
    }

    const pren = prenotazioni.find(p => p.imbarcazione_id === imbarcazioneId && p.data_servizio === dateStr)
    if (pren) return { type: 'prenotazione', data: pren }
    const blocco = blocchi.find(b => {
      if (b.imbarcazione_id !== imbarcazioneId) return false
      return date >= parseISO(b.data_inizio) && date <= parseISO(b.data_fine)
    })
    if (blocco) return { type: 'blocco', data: blocco }

    // Collettivo in corso (posti esterni dall'armatore)
    const postoEsterno = postiEsterni.find(p =>
      p.imbarcazione_id === imbarcazioneId && p.data === dateStr && p.posti_occupati > 0
    )
    if (postoEsterno) {
      const barca = imbarcazioni.find(b => b.id === imbarcazioneId)
      const capienza = barca?.capacita_massima || 0
      const liberi = Math.max(0, capienza - postoEsterno.posti_occupati)
      return { type: 'collettivo', data: { posti_occupati: postoEsterno.posti_occupati, posti_liberi: liberi, capienza } }
    }

    return { type: 'disponibile' }
  }

  // ═══ HANDLERS ═══
  function handleCellClick(barca: any, date: Date, e: React.MouseEvent) {
    const cs = getCellStatus(barca.id, date)
    const isNs = barca.fornitore_id === NS3000_FORNITORE_ID && !!baToNs3000Map[barca.id]

    if (cs.type === 'prenotazione') { if (!isOperatore) mostraDettagliPrenotazione(cs.data.id); return }
    if (cs.type === 'ns3000_booking') { setNs3000BookingDetail(cs.data); setShowNs3000Dettagli(true); return }
    if (cs.type === 'blocco') { if (confirm('Rimuovere il blocco?')) rimuoviBlocco(cs.data.id); return }
    if (cs.type === 'ns3000_occupato') return
    if (cs.type === 'collettivo') {
      toast(`Collettivo in corso: ${cs.data.posti_occupati}/${cs.data.capienza} occupati, ${cs.data.posti_liberi} liberi`, { icon: '👥' })
      return
    }

    if (isOperatore) {
      setSelectedCell({ imbarcazioneId: barca.id, date, imbarcazioneNome: barca.nome })
      setMotivoBlocco(''); setTipoBlocco('altro'); setShowBloccoModal(true)
    } else if (isNs) {
      setNewBookingInitialDate(format(date, 'yyyy-MM-dd'))
      setNewBookingInitialNs3000BoatId(baToNs3000Map[barca.id] || '')
      setNewBookingInitialNs3000BoatName(barca.nome)
      setNewBookingInitialImbarcazione(''); setShowNewBookingModal(true)
    } else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      setContextMenu({ x: rect.left + window.scrollX, y: rect.bottom + window.scrollY + 4, imbarcazioneId: barca.id, imbarcazioneNome: barca.nome, date })
    }
  }

  function openNewBooking() {
    if (!contextMenu) return
    setNewBookingInitialDate(format(contextMenu.date, 'yyyy-MM-dd'))
    setNewBookingInitialImbarcazione(contextMenu.imbarcazioneId)
    setNewBookingInitialNs3000BoatId(''); setNewBookingInitialNs3000BoatName('')
    setContextMenu(null); setShowNewBookingModal(true)
  }
  function openBloccoFromMenu() {
    if (!contextMenu) return
    setSelectedCell({ imbarcazioneId: contextMenu.imbarcazioneId, date: contextMenu.date, imbarcazioneNome: contextMenu.imbarcazioneNome })
    setMotivoBlocco(''); setTipoBlocco('altro'); setContextMenu(null); setShowBloccoModal(true)
  }

  async function mostraDettagliPrenotazione(id: string) {
    try {
      setLoadingDettagli(true)
      const { data, error } = await supabase.from('prenotazioni')
        .select('*, servizi(id,nome,tipo,prezzo_base), imbarcazioni(id,nome,tipo,categoria), clienti(id,nome,cognome,email,telefono,nazione)')
        .eq('id', id).single()
      if (error) throw error
      setPrenotazioneSelezionata(data); setShowDettagliModal(true)
    } catch (e) { toast.error('Errore caricamento dettagli') }
    finally { setLoadingDettagli(false) }
  }

  async function creaBlocco() {
    if (!selectedCell) return
    try {
      const { error } = await supabase.from('blocchi_imbarcazioni').insert([{
        imbarcazione_id: selectedCell.imbarcazioneId,
        data_inizio: format(selectedCell.date, 'yyyy-MM-dd'),
        data_fine: format(selectedCell.date, 'yyyy-MM-dd'),
        motivo: motivoBlocco || 'Indisponibilità', note: tipoBlocco
      }])
      if (error) throw error
      toast.success('Blocco creato!'); setShowBloccoModal(false); loadData()
      trackAction('disponibilita', 'blocco', { barca: selectedCell.imbarcazioneNome, data: format(selectedCell.date, 'yyyy-MM-dd'), motivo: motivoBlocco || tipoBlocco })
    } catch (e) { toast.error('Errore creazione blocco') }
  }

  async function syncNs3000() {
    try {
      setSyncing(true)
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/ns3000/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          date_from: format(currentMonthStart, 'yyyy-MM-dd'),
          date_to: format(currentMonthEnd, 'yyyy-MM-dd')
        })
      })
      const result = await res.json()
      if (result.success) {
        toast.success(`Sync completata: ${result.summary.created} nuove, ${result.summary.updated} aggiornate`)
        loadData()
        trackAction('disponibilita', 'sync_ns3000', { created: result.summary.created, updated: result.summary.updated })
      } else {
        toast.error('Errore sync: ' + (result.error || result.message || 'Sconosciuto'))
      }
    } catch (error) {
      toast.error('Errore connessione sync NS3000')
    } finally {
      setSyncing(false)
    }
  }

  async function rimuoviBlocco(id: string) {
    try {
      const { error } = await supabase.from('blocchi_imbarcazioni').delete().eq('id', id)
      if (error) throw error
      toast.success('Blocco rimosso!'); loadData()
      trackAction('disponibilita', 'sblocco', { blocco_id: id })
    } catch (e) { toast.error('Errore rimozione blocco') }
  }

  // ═══ RENDER CELL ═══
  function renderCell(barca: any, day: Date) {
    const cs = getCellStatus(barca.id, day)
    const isToday = isSameDay(day, new Date())
    const isWeekend = [0, 6].includes(day.getDay())

    let bg = isWeekend ? 'bg-orange-50/60 hover:bg-orange-100' : 'bg-green-50 hover:bg-green-100'
    let border = 'border-l-green-300'
    let content = null

    if (cs.type === 'prenotazione') {
      const st = cs.data.stato
      if (st === 'confermata') { bg = 'bg-emerald-100 hover:bg-emerald-200'; border = 'border-l-emerald-500' }
      else if (st === 'in_attesa') { bg = 'bg-amber-100 hover:bg-amber-200'; border = 'border-l-amber-500' }
      else if (st === 'completata') { bg = 'bg-blue-100 hover:bg-blue-200'; border = 'border-l-blue-500' }
      else { bg = 'bg-purple-100 hover:bg-purple-200'; border = 'border-l-purple-500' }
      content = <span className="text-[9px] font-bold text-gray-700">{cs.data.numero_persone}p</span>
    } else if (cs.type === 'blocco') {
      bg = 'bg-gray-200 hover:bg-gray-300'; border = 'border-l-gray-500'
      content = <span className="text-[9px] text-gray-500">🚫</span>
    } else if (cs.type === 'ns3000_booking') {
      bg = 'bg-red-100 hover:bg-red-200'; border = 'border-l-red-400'
      content = <span className="text-[10px] text-red-600">🚫</span>
    } else if (cs.type === 'ns3000_occupato') {
      bg = 'bg-red-100 hover:bg-red-200'; border = 'border-l-red-400'
      content = <span className="text-[10px] text-red-600">🚫</span>
    } else if (cs.type === 'ns3000_parziale') {
      bg = 'bg-amber-50 hover:bg-amber-100'; border = 'border-l-amber-400'
      content = <span className="text-[9px] text-amber-700">{cs.slots?.morning ? 'PM' : 'AM'}</span>
    } else if (cs.type === 'collettivo') {
      const liberi = cs.data.posti_liberi
      if (liberi <= 0) {
        bg = 'bg-red-100 hover:bg-red-200'; border = 'border-l-red-500'
        content = <span className="text-[9px] font-bold text-red-600">0p</span>
      } else {
        bg = 'bg-teal-50 hover:bg-teal-100'; border = 'border-l-teal-500'
        content = <span className="text-[9px] font-bold text-teal-700">{liberi}p</span>
      }
    }

    return (
      <td key={`${barca.id}-${day.toISOString()}`} className="border border-gray-100 p-0" style={{ width: `${colSizes.giorno}px`, minWidth: `${colSizes.giorno}px` }}>
        <button onClick={(e) => handleCellClick(barca, day, e)}
          className={`w-full flex items-center justify-center border-l-2 transition-all ${bg} ${border} ${isToday ? 'ring-1 ring-inset ring-blue-300' : ''} ${selectedDay === format(day, 'yyyy-MM-dd') ? 'brightness-90 shadow-inner' : ''}`}
          style={{ height: `${colSizes.altezza}px` }}>
          {content}
        </button>
      </td>
    )
  }

  if (loading) return <div className="p-4 md:p-8 text-gray-600">Caricamento planning...</div>

  return (
    <div className="p-1 md:p-2 lg:p-3 h-screen flex flex-col">

      {/* HEADER */}
      <div className="mb-2 bg-gray-50 rounded-xl p-3 md:p-4">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-lg md:text-2xl font-bold text-gray-900">Planning</h1>
          <span className="text-sm md:text-base font-extrabold text-gray-900">{monthNames[currentMonth]} {currentYear}</span>
          {isOperatore && (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-semibold rounded-full border border-green-200">👤 Operatore</span>
          )}
          <div className="flex gap-1 ml-auto">
            <button onClick={() => setCurrentMonthStart(subMonths(currentMonthStart, 1))} className="px-2 py-1 border border-gray-300 rounded text-xs bg-white hover:bg-gray-50">◀</button>
            <button onClick={() => setCurrentMonthStart(startOfMonth(new Date()))} className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold">Oggi</button>
            <button onClick={() => setCurrentMonthStart(addMonths(currentMonthStart, 1))} className="px-2 py-1 border border-gray-300 rounded text-xs bg-white hover:bg-gray-50">▶</button>
            {!isOperatore && (
              <button
                onClick={syncNs3000}
                disabled={syncing}
                className={`px-3 py-1 rounded text-xs font-semibold ml-2 ${syncing ? 'bg-gray-300 text-gray-500' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
              >
                {syncing ? '⏳ Sync...' : '🔄 Sync NS3000'}
              </button>
            )}
          </div>
        </div>

        {/* FILTRI TOUR */}
        {!isOperatore && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filtroTour}
                onChange={(e) => setFiltroTour(e.target.value)}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 font-medium text-gray-700 max-w-[200px] sm:max-w-none"
              >
                <option value="tutti">🚤 Tutti i tour</option>
                {servizi.filter(s => !s.nome.includes('Sunset') && !s.nome.includes('Taxi')).map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nome.replace(/^\d+\s*-\s*/, '')}{s.prezzo_per_persona ? ' (👤/pax)' : ''}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400">Pax:</span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={filtroPax || ''}
                  onChange={(e) => setFiltroPax(parseInt(e.target.value) || 0)}
                  placeholder="—"
                  className="w-14 text-xs px-2 py-1.5 border border-gray-300 rounded-lg bg-white text-center focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {(filtroTour !== 'tutti' || filtroPax > 0) && (
                <button onClick={() => { setFiltroTour('tutti'); setFiltroPax(0) }} className="text-xs text-red-500 hover:text-red-700">✕ Reset</button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] text-gray-400 self-center mr-1">Tipo:</span>
              <button onClick={() => setFiltroTipo('tutti')}
                className={`text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors ${filtroTipo === 'tutti' ? 'bg-gray-700 text-white border-gray-700 font-semibold' : 'border-gray-300 text-gray-600 hover:bg-gray-50 bg-white'}`}>
                Tutti
              </button>
              {TIPO_ORDER.map(tipo => (
                <button key={tipo} onClick={() => setFiltroTipo(tipo)}
                  className={`text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors ${filtroTipo === tipo ? 'bg-gray-700 text-white border-gray-700 font-semibold' : 'border-gray-300 text-gray-600 hover:bg-gray-50 bg-white'}`}>
                  {TIPO_LABELS[tipo]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* LEGENDA */}
      <div className="mb-1 flex flex-wrap items-center gap-2 md:gap-4 text-[10px] md:text-xs text-gray-600 px-1">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-400 rounded-full inline-block"></span>Attesa</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block"></span>Confermata</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-indigo-500 rounded-full inline-block"></span>NS3000</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-gray-300 rounded-full inline-block"></span>Bloccata</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-teal-500 rounded-full inline-block"></span>Collettivo</span>
        <span className="ml-auto text-gray-400">🚤 {totalBoats} barche</span>
      </div>

      {/* GRIGLIA */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto h-full" style={{ scrollBehavior: 'smooth' }}>
          <table className="border-collapse" style={{ tableLayout: 'fixed', minWidth: `${colSizes.barca + monthDays.length * colSizes.giorno}px` }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50">
                <th className="sticky left-0 z-20 bg-gray-100 border border-gray-200 px-1 py-2 text-left font-semibold text-gray-900 text-[10px] sm:text-xs"
                  style={{ width: `${colSizes.barca}px` }}>
                  Barca {filtroTour !== 'tutti' && <span className="text-green-600 font-normal">/ €</span>}
                </th>
                {monthDays.map(day => {
                  const isToday = isSameDay(day, new Date())
                  const isWeekend = [0, 6].includes(day.getDay())
                  return (
                    <th key={day.toISOString()}
                      onClick={() => setSelectedDay(prev => prev === format(day, 'yyyy-MM-dd') ? null : format(day, 'yyyy-MM-dd'))}
                      className={`border border-gray-200 py-1 text-center cursor-pointer transition-colors ${
                        selectedDay === format(day, 'yyyy-MM-dd') ? 'bg-blue-200 text-blue-900 font-bold' : isToday ? 'bg-blue-100 text-blue-700' : isWeekend ? 'bg-orange-50 text-gray-700' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      style={{ width: `${colSizes.giorno}px` }}>
                      <div className="flex flex-col leading-tight">
                        <span className="text-[8px] font-normal text-gray-400 uppercase">{format(day, 'EEEEE', { locale: it })}</span>
                        <span className={`text-[10px] ${isToday ? 'font-bold' : ''}`}>{format(day, 'd')}</span>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {groupedBoats.map(group => (
                <>{/* Group header */}
                  <tr key={`gh-${group.tipo}`}>
                    <td colSpan={monthDays.length + 1} className="bg-gray-100 border border-gray-200 px-2 py-1 sticky left-0 z-[5]">
                      <span className="text-xs font-bold text-gray-700">{group.label}</span>
                      <span className="text-[10px] text-gray-400 ml-1.5">({group.boats.length})</span>
                    </td>
                  </tr>
                  {group.boats.map(barca => {
                    const prezzo = prezziMap[barca.id]
                    const isNs = barca.fornitore_id === NS3000_FORNITORE_ID
                    return (
                      <tr key={barca.id} className="hover:bg-gray-50/50">
                        <td className={`sticky left-0 z-[5] border border-gray-200 px-1 py-0.5 overflow-hidden ${isNs ? 'bg-indigo-50' : 'bg-gray-50'}`}
                          style={{ width: `${colSizes.barca}px` }}>
                          <div className={`text-[10px] sm:text-xs font-semibold leading-tight overflow-hidden text-ellipsis whitespace-nowrap ${isNs ? 'text-indigo-900' : 'text-gray-900'}`}
                            style={{ maxWidth: `${colSizes.barca - 6}px` }} title={barca.nome}>
                            {isNs && <span className="text-indigo-400 mr-0.5">⛵</span>}{barca.nome}
                          </div>
                          {prezzo ? (
                            <div className="text-[9px] font-bold text-green-600 leading-tight">
                              €{prezzo}{isCollettivo ? '/pax' : ''}
                            </div>
                          ) : (
                            <div className="text-[9px] text-gray-400 capitalize leading-tight hidden sm:block">{barca.categoria}</div>
                          )}
                        </td>
                        {monthDays.map(day => renderCell(barca, day))}
                      </tr>
                    )
                  })}
                </>
              ))}
            </tbody>
          </table>

          {totalBoats === 0 && (
            <div className="text-center py-12 text-gray-500">
              {filtroTour !== 'tutti' ? 'Nessuna barca disponibile per questo tour' : 'Nessuna imbarcazione attiva'}
            </div>
          )}
        </div>
      </div>

      <div className="mt-1 text-[10px] text-gray-400 text-center">Tocca cella per dettagli · Cella vuota per prenotare/bloccare · 🟠 Weekend · 🟢 Collettivo = posti liberi</div>

      {/* MODAL BLOCCO */}
      {showBloccoModal && selectedCell && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{isOperatore ? '📅 Gestisci Disponibilità' : 'Blocca Disponibilità'}</h2>
              <button onClick={() => setShowBloccoModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <div className="mb-4 bg-gray-50 rounded-lg p-3">
              <p className="text-sm"><strong>🚤 {selectedCell.imbarcazioneNome}</strong></p>
              <p className="text-sm text-gray-600">📅 {format(selectedCell.date, 'EEEE dd MMMM yyyy', { locale: it })}</p>
            </div>
            <div className="space-y-3 mb-4">
              <select value={tipoBlocco} onChange={e => setTipoBlocco(e.target.value as any)} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="altro">Altro</option>
                <option value="manutenzione">Manutenzione</option>
                <option value="prenotazione_esterna">Prenotazione Esterna</option>
              </select>
              <textarea value={motivoBlocco} onChange={e => setMotivoBlocco(e.target.value)} placeholder="Motivo (opzionale)..." className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowBloccoModal(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Annulla</button>
              <button onClick={creaBlocco} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium">🚫 Blocca</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETTAGLI */}
      {showDettagliModal && prenotazioneSelezionata && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-5 my-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">📋 Dettagli Prenotazione</h2>
              <button onClick={() => setShowDettagliModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <div className="space-y-3">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 text-center">
                <div className="text-xs text-blue-600">Codice</div>
                <div className="text-2xl font-bold text-blue-900">{prenotazioneSelezionata.codice_prenotazione}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['Barca', prenotazioneSelezionata.imbarcazioni?.nome],
                  ['Servizio', prenotazioneSelezionata.servizi?.nome],
                  ['Data', format(parseISO(prenotazioneSelezionata.data_servizio), 'dd MMM yyyy', { locale: it })],
                  ['Pax', `${prenotazioneSelezionata.numero_persone}`],
                  ['Cliente', `${prenotazioneSelezionata.clienti?.nome || ''} ${prenotazioneSelezionata.clienti?.cognome || ''}`],
                  ['Email', prenotazioneSelezionata.clienti?.email],
                  ['Telefono', prenotazioneSelezionata.clienti?.telefono],
                  ['Prezzo', `€${parseFloat(prenotazioneSelezionata.prezzo_totale || 0).toFixed(2)}`],
                  ['Stato', prenotazioneSelezionata.stato],
                  ['Pagamento', prenotazioneSelezionata.stato_pagamento || 'N/A'],
                ].map(([l, v]) => (<div key={l}><span className="text-gray-500 text-xs">{l}:</span><div className="font-medium">{v || 'N/A'}</div></div>))}
              </div>
            </div>
            <button onClick={() => setShowDettagliModal(false)} className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Chiudi</button>
          </div>
        </div>
      )}

      {/* MODAL NS3000 DETTAGLI */}
      {showNs3000Dettagli && ns3000BookingDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3">
          <div className="bg-white rounded-xl max-w-lg w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-indigo-900">⛵ Prenotazione NS3000</h2>
              <button onClick={() => setShowNs3000Dettagli(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <div className="space-y-3">
              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-3 text-center">
                <div className="text-xs text-indigo-600">Codice</div>
                <div className="text-xl font-bold text-indigo-900">{ns3000BookingDetail.booking_number}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['Barca', ns3000BookingDetail.boats?.name],
                  ['Data', ns3000BookingDetail.booking_date],
                  ['Fascia', ns3000BookingDetail.time_slot?.replace('_', ' ')],
                  ['Pax', `${ns3000BookingDetail.num_passengers}`],
                  ['Cliente', `${ns3000BookingDetail.customer_name} ${ns3000BookingDetail.customer_surname}`],
                  ['Email', ns3000BookingDetail.customer_email],
                  ['Prezzo', `€${parseFloat(ns3000BookingDetail.final_price || 0).toFixed(2)}`],
                ].map(([l, v]) => (<div key={l}><span className="text-gray-500 text-xs">{l}:</span><div className="font-medium truncate">{v || 'N/A'}</div></div>))}
              </div>
            </div>
            <button onClick={() => setShowNs3000Dettagli(false)} className="w-full mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">Chiudi</button>
          </div>
        </div>
      )}

      {/* CONTEXT MENU */}
      {contextMenu && (
        <div ref={contextMenuRef} className="fixed z-[9999] bg-white rounded-xl shadow-2xl border overflow-hidden" style={{ left: contextMenu.x, top: contextMenu.y, minWidth: '200px' }}>
          <div className="bg-gray-50 px-3 py-2 border-b">
            <p className="text-xs font-semibold text-gray-500">{format(contextMenu.date, 'd MMM yyyy', { locale: it })}</p>
            <p className="text-sm font-bold text-gray-900 truncate">{contextMenu.imbarcazioneNome}</p>
          </div>
          <div className="p-1">
            <button onClick={openNewBooking} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 text-sm">📅 <span className="font-semibold">Nuova Prenotazione</span></button>
            <button onClick={openBloccoFromMenu} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 text-sm">🚫 <span className="font-semibold">Blocca</span></button>
          </div>
        </div>
      )}

      {/* BOOKING MODAL */}
      <BookingModal isOpen={showNewBookingModal} onClose={() => setShowNewBookingModal(false)}
        onSave={() => { setShowNewBookingModal(false); loadData(); toast.success('Prenotazione creata!') }}
        initialDate={newBookingInitialDate} initialImbarcazioneId={newBookingInitialImbarcazione}
        initialNs3000BoatId={newBookingInitialNs3000BoatId} initialNs3000BoatName={newBookingInitialNs3000BoatName}
        initialBoatSource={newBookingInitialNs3000BoatId ? 'ns3000' : 'locale'} />
    </div>
  )
}