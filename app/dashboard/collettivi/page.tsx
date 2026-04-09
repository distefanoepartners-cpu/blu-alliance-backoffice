'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay } from 'date-fns'
import { it } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'

// ─────────────────────────────────────────────
// COSTANTI
// ─────────────────────────────────────────────
const NS3000_FORNITORE_ID = '2d78fca2-f474-4c44-8443-44c75924d5c3'

const NS3000_TO_BA_MAP: Record<string, string> = {
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

const NS3000_BA_IDS = Object.values(NS3000_TO_BA_MAP)

// ─────────────────────────────────────────────
// TIPI
// ─────────────────────────────────────────────
interface Imbarcazione {
  id: string; nome: string; capacita_massima: number
  capacita_collettiva_override: number | null
  tour_collettivi_attivi: boolean; ordine: number
  fornitore_id: string; prezzi_servizi?: Record<string, number>
}

interface PrenotazioneCollettiva {
  id: string; codice_prenotazione: string; imbarcazione_id: string
  data_servizio: string; numero_persone: number; stato: string; tipo_tour: string
  clienti?: { nome: string; cognome: string; email: string }
  servizi?: { nome: string }
}

// Servizio collettivo NS3000 associato a una barca
interface Ns3000Service {
  service_id: string
  service_name: string
  price_per_person: number
}

// Barca NS3000 con tutti i suoi servizi collettivi
interface Ns3000CollectiveBoat {
  boat_id: string
  boat_name: string
  capacity: number
  // Servizio principale (per default nel modal)
  service_name: string
  service_id: string
  price_per_person: number
  // Tutti i servizi disponibili per questa barca
  all_services: Ns3000Service[]
}

interface Ns3000CellData {
  passengers_booked: number
  passengers_available: number
  capacity: number
  occupancy_percent: number
  service_name: string
  bookings: {
    id: string; booking_number: string; num_passengers: number
    customer_name: string; customer_phone: string
    final_price: number; status: string; status_name: string
  }[]
}

interface CellInfoBA {
  pax: number; capienza: number
  prenotazioni: PrenotazioneCollettiva[]
  bloccata_da_privato: boolean
}

// ─────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────
export default function TourCollettivi() {
  const { isOperatore, fornitoreId, loading: authLoading } = useAuth()

  const [imbarcazioni, setImbarcazioni] = useState<Imbarcazione[]>([])
  const [prenotazioni, setPrenotazioni] = useState<PrenotazioneCollettiva[]>([])
  const [prenotazioniPrivate, setPrenotazioniPrivate] = useState<any[]>([])
  const [blocchi, setBlocchi] = useState<any[]>([])

  const [ns3000Loading, setNs3000Loading] = useState(false)
  const [showNs3000, setShowNs3000] = useState(true)
  const [ns3000CollectiveBoats, setNs3000CollectiveBoats] = useState<Ns3000CollectiveBoat[]>([])
  const [ns3000CellMap, setNs3000CellMap] = useState<Record<string, Ns3000CellData>>({})
  const [showNs3000CellModal, setShowNs3000CellModal] = useState(false)
  const [ns3000CellModalData, setNs3000CellModalData] = useState<{
    boat: Ns3000CollectiveBoat; date: string; cell: Ns3000CellData
  } | null>(null)

  const [currentMonthStart, setCurrentMonthStart] = useState(startOfMonth(new Date()))
  const [loading, setLoading] = useState(true)

  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [selectedBarca, setSelectedBarca] = useState<Imbarcazione | null>(null)
  const [overrideInput, setOverrideInput] = useState<string>('')
  const [savingSettings, setSavingSettings] = useState(false)

  const [showCellModal, setShowCellModal] = useState(false)
  const [cellModalData, setCellModalData] = useState<{ barca: Imbarcazione; date: Date; info: CellInfoBA } | null>(null)

  const [showNewModal, setShowNewModal] = useState(false)
  const [newBookingSource, setNewBookingSource] = useState<'ba' | 'ns3000'>('ba')
  const [newBooking, setNewBooking] = useState({
    imbarcazione_id: '', ns3000_boat_id: '', ns3000_boat_name: '',
    ns3000_service_id: '', ns3000_service_name: '', ns3000_price_per_person: 0,
    data_servizio: '', numero_persone: 1, prezzo_totale: 0,
    caparra_ricevuta: 0, saldo_ricevuto: 0, metodo_pagamento: '',
    note: '', nome_cliente: '', cognome_cliente: '', email_cliente: '',
    telefono_cliente: '', servizio_id: '', stato: 'confermata',
    lingua: 'it', porto_imbarco: '', ora_imbarco: '',
  })
  // Servizi disponibili per la barca NS3000 selezionata nel modal
  const [ns3000AvailableServices, setNs3000AvailableServices] = useState<Ns3000Service[]>([])

  const [servizi, setServizi] = useState<any[]>([])
  const [savingBooking, setSavingBooking] = useState(false)
  const [clienti, setClienti] = useState<any[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([])
  const [selectedClienteId, setSelectedClienteId] = useState('')
  const [selectedClienteData, setSelectedClienteData] = useState<any>(null)

  const currentMonthEnd = endOfMonth(currentMonthStart)
  const monthDays = eachDayOfInterval({ start: currentMonthStart, end: currentMonthEnd })
  const monthNames = ['GENNAIO','FEBBRAIO','MARZO','APRILE','MAGGIO','GIUGNO','LUGLIO','AGOSTO','SETTEMBRE','OTTOBRE','NOVEMBRE','DICEMBRE']
  const currentMonth = currentMonthStart.getMonth()
  const currentYear = currentMonthStart.getFullYear()
  const daRicevere = Math.max(0, (newBooking.prezzo_totale || 0) - (newBooking.caparra_ricevuta || 0) - (newBooking.saldo_ricevuto || 0))

  // ─────────────────────────────────────────────
  // EFFECTS
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return
    loadData()
    loadNs3000Data()
  }, [currentMonthStart, authLoading, isOperatore, fornitoreId])

  // Ricalcola prezzo quando cambiano pax o servizio NS3000
  useEffect(() => {
    if (newBookingSource === 'ns3000' && newBooking.ns3000_price_per_person > 0) {
      setNewBooking(prev => ({
        ...prev,
        prezzo_totale: prev.ns3000_price_per_person * (prev.numero_persone || 1)
      }))
    }
  }, [newBooking.ns3000_price_per_person, newBooking.numero_persone, newBookingSource])

  // Ricalcola prezzo BA
  useEffect(() => {
    if (newBookingSource !== 'ba') return
    if (!newBooking.imbarcazione_id || !newBooking.servizio_id) return
    const barca = imbarcazioni.find(b => b.id === newBooking.imbarcazione_id)
    const servizio = servizi.find(s => s.id === newBooking.servizio_id)
    if (!barca?.prezzi_servizi) return
    const pu = barca.prezzi_servizi[newBooking.servizio_id] ?? barca.prezzi_servizi[servizio?.tipo] ?? null
    if (pu && pu > 0) setNewBooking(prev => ({ ...prev, prezzo_totale: pu * (prev.numero_persone || 1) }))
  }, [newBooking.imbarcazione_id, newBooking.servizio_id, newBooking.numero_persone, newBookingSource, imbarcazioni, servizi])

  useEffect(() => {
    if (customerSearch.trim()) {
      const term = customerSearch.toLowerCase()
      setFilteredCustomers(clienti.filter(c =>
        c.nome?.toLowerCase().includes(term) || c.cognome?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) || c.telefono?.includes(term)
      ))
    } else {
      setFilteredCustomers(clienti.slice(0, 20))
    }
  }, [customerSearch, clienti])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('.customer-search-container')) setShowCustomerDropdown(false)
    }
    if (showCustomerDropdown) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showCustomerDropdown])

  // ─────────────────────────────────────────────
  // LOAD DATA BA
  // ─────────────────────────────────────────────
  async function loadData() {
    try {
      setLoading(true)
      const dateFrom = format(currentMonthStart, 'yyyy-MM-dd')
      const dateTo = format(currentMonthEnd, 'yyyy-MM-dd')

      let barcheQuery = supabase
        .from('imbarcazioni')
        .select('id, nome, capacita_massima, capacita_collettiva_override, tour_collettivi_attivi, ordine, fornitore_id')
        .eq('attiva', true).eq('tour_collettivi_attivi', true)
        .neq('fornitore_id', NS3000_FORNITORE_ID)
        .not('id', 'in', `(${NS3000_BA_IDS.join(',')})`)
        .order('capacita_massima', { ascending: true }).order('ordine', { ascending: true })

      if (isOperatore && fornitoreId) barcheQuery = barcheQuery.eq('fornitore_id', fornitoreId)

      const { data: barcheData, error: barcheError } = await barcheQuery
      if (barcheError) throw barcheError

      const { data: prezziData } = await supabase
        .from('vista_imbarcazioni_servizi_con_prezzi')
        .select('imbarcazione_id, servizio_id, servizio_tipo, prezzo_finale')

      const barcheConPrezzi = (barcheData || []).map((b: any) => ({
        ...b,
        prezzi_servizi: (prezziData || []).filter((p: any) => p.imbarcazione_id === b.id)
          .reduce((acc: any, p: any) => {
            if (p.prezzo_finale) { acc[p.servizio_id] = p.prezzo_finale; acc[p.servizio_tipo] = p.prezzo_finale }
            return acc
          }, {})
      }))

      let prenCollQuery = supabase
        .from('prenotazioni')
        .select(`id, codice_prenotazione, imbarcazione_id, data_servizio, numero_persone, stato, tipo_tour,
          clienti (nome, cognome, email), servizi (nome)`)
        .gte('data_servizio', dateFrom).lte('data_servizio', dateTo)
        .eq('tipo_tour', 'collettivo').not('stato', 'in', '("cancellata","rifiutata")')

      if (isOperatore && barcheConPrezzi.length > 0) {
        prenCollQuery = prenCollQuery.in('imbarcazione_id', barcheConPrezzi.map((b: Imbarcazione) => b.id))
      }
      const { data: prenCollData } = await prenCollQuery

      const { data: prenPrivData } = await supabase
        .from('prenotazioni').select('id, imbarcazione_id, data_servizio, stato, tipo_tour')
        .gte('data_servizio', dateFrom).lte('data_servizio', dateTo)
        .eq('tipo_tour', 'privato').not('stato', 'in', '("cancellata","rifiutata")')

      // ⭐ Carica anche i blocchi indisponibilità
      const { data: blocchiData } = await supabase
        .from('blocchi_imbarcazioni')
        .select('imbarcazione_id, data_inizio, data_fine')
        .lte('data_inizio', dateTo)
        .gte('data_fine', dateFrom)

      const { data: serviziData } = await supabase
        .from('servizi').select('id, nome, tipo').eq('attivo', true).eq('tipo', 'tour_collettivo').order('nome')

      const { data: clientiData } = await supabase
        .from('clienti').select('id, nome, cognome, email, telefono').order('cognome')

      setImbarcazioni(barcheConPrezzi)
      setPrenotazioni((prenCollData as any) || [])
      setPrenotazioniPrivate(prenPrivData || [])
      setBlocchi(blocchiData || [])
      setServizi(serviziData || [])
      setClienti(clientiData || [])
    } catch (error) {
      console.error('Errore caricamento collettivi:', error)
      toast.error('Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────
  // LOAD NS3000 DATA
  // Fonte unica: /api/ns3000/collective-tours
  // Prima chiamata: singolo giorno → lista barche con TUTTI i servizi (anche senza pax)
  // Seconda chiamata: range mese → celle con prenotazioni
  // ─────────────────────────────────────────────
  async function loadNs3000Data() {
    if (isOperatore) return
    try {
      setNs3000Loading(true)
      const dateFrom = format(currentMonthStart, 'yyyy-MM-dd')
      const dateTo = format(currentMonthEnd, 'yyyy-MM-dd')

      // boat_id → { name, capacity, services[] }
      type BoatInfo = {
        name: string; capacity: number
        services: Ns3000Service[]
      }
      const boatInfoMap: Record<string, BoatInfo> = {}
      const cellMap: Record<string, Ns3000CellData> = {}

      // 1. Singolo giorno → lista barche configurate per collettivi
      //    include boats[] (disponibili) + excluded_boats[] (servizio ma non disponibili)
      try {
        const singleRes = await fetch(`/api/ns3000/collective-tours?date=${dateFrom}`)
        if (singleRes.ok) {
          const singleData: any[] = await singleRes.json()
          for (const tourDay of singleData) {
            const svc: Ns3000Service = {
              service_id: tourDay.service_id,
              service_name: tourDay.service_name,
              price_per_person: tourDay.price_per_person || 0,
            }
            for (const boat of [...(tourDay.boats || []), ...(tourDay.excluded_boats || [])]) {
              const boatId = boat.boat_id
              if (!boatId) continue
              if (!boatInfoMap[boatId]) {
                boatInfoMap[boatId] = { name: boat.boat_name, capacity: boat.capacity || 0, services: [] }
              }
              // Aggiungi servizio se non già presente
              if (!boatInfoMap[boatId].services.find(s => s.service_id === svc.service_id)) {
                boatInfoMap[boatId].services.push(svc)
              }
              if (boat.capacity) boatInfoMap[boatId].capacity = boat.capacity
            }
          }
        }
      } catch (e) { console.warn('NS3000 collective-tours (singolo giorno):', e) }

      // 2. Range mese → celle con prenotazioni
      try {
        const res = await fetch(`/api/ns3000/collective-tours?start=${dateFrom}&end=${dateTo}`)
        if (res.ok) {
          const data: any[] = await res.json()
          for (const tourDay of data) {
            const svc: Ns3000Service = {
              service_id: tourDay.service_id,
              service_name: tourDay.service_name,
              price_per_person: tourDay.price_per_person || 0,
            }
            for (const boat of tourDay.boats || []) {
              const boatId = boat.boat_id
              if (!boatId) continue

              // Aggiorna info barca se non già presente
              if (!boatInfoMap[boatId]) {
                boatInfoMap[boatId] = { name: boat.boat_name, capacity: boat.capacity || 0, services: [] }
              }
              if (!boatInfoMap[boatId].services.find(s => s.service_id === svc.service_id)) {
                boatInfoMap[boatId].services.push(svc)
              }
              if (boat.capacity) boatInfoMap[boatId].capacity = boat.capacity

              // Costruisci mappa celle
              const key = `${boatId}|${tourDay.date}`
              const existing = cellMap[key]
              const newBooked = (existing?.passengers_booked || 0) + (boat.passengers_booked || 0)
              const capacity = boat.capacity || boatInfoMap[boatId].capacity || 0

              cellMap[key] = {
                passengers_booked: newBooked,
                // ⭐ Ricalcola sempre da capacity - booked, non fidarsi del valore API
                passengers_available: Math.max(0, capacity - newBooked),
                capacity,
                occupancy_percent: capacity > 0 ? Math.round((newBooked / capacity) * 100) : 0,
                // ⭐ Usa il servizio del tourDay corrente (quello con le prenotazioni)
                service_name: tourDay.service_name,
                bookings: [
                  ...(existing?.bookings || []),
                  ...(boat.bookings || []).map((b: any) => ({
                    id: b.id,
                    booking_number: b.booking_number,
                    num_passengers: b.num_passengers,
                    customer_name: b.customer_name,
                    customer_phone: b.customer_phone || '',
                    final_price: b.final_price,
                    status: b.status,
                    status_name: b.status_name,
                  }))
                ]
              }
            }
          }
        }
      } catch (e) { console.warn('NS3000 collective-tours (mese):', e) }

      // 3. Costruisci lista barche
      const boats: Ns3000CollectiveBoat[] = Object.entries(boatInfoMap)
        .filter(([, v]) => v.name && v.services.length > 0)
        .map(([boat_id, v]) => ({
          boat_id,
          boat_name: v.name,
          capacity: v.capacity,
          // Primo servizio come default
          service_id: v.services[0].service_id,
          service_name: v.services[0].service_name,
          price_per_person: v.services[0].price_per_person,
          all_services: v.services,
        }))
        .sort((a, b) => a.boat_name.localeCompare(b.boat_name))

      setNs3000CollectiveBoats(boats)
      setNs3000CellMap(cellMap)
    } catch (e) {
      console.warn('Errore NS3000:', e)
    } finally {
      setNs3000Loading(false)
    }
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────
  function getCellInfoBA(barca: Imbarcazione, date: Date): CellInfoBA {
    const dateStr = format(date, 'yyyy-MM-dd')
    const capienza = barca.capacita_collettiva_override ?? barca.capacita_massima
    const prenCell = prenotazioni.filter(p => p.imbarcazione_id === barca.id && p.data_servizio === dateStr)
    const pax = prenCell.reduce((sum, p) => sum + p.numero_persone, 0)
    const bloccata = prenotazioniPrivate.some(p => p.imbarcazione_id === barca.id && p.data_servizio === dateStr)
    // ⭐ Controlla anche i blocchi indisponibilità
    const bloccataDaBlocco = blocchi.some(b =>
      b.imbarcazione_id === barca.id &&
      b.data_inizio <= dateStr &&
      b.data_fine >= dateStr
    )
    return { pax, capienza, prenotazioni: prenCell, bloccata_da_privato: bloccata || bloccataDaBlocco }
  }

  function getCellColorBA(info: CellInfoBA): string {
    if (info.bloccata_da_privato) return 'bg-purple-100 border-l-purple-500'
    if (info.pax === 0) return 'bg-green-50 hover:bg-green-100 border-l-green-300'
    if (info.pax >= info.capienza) return 'bg-red-100 hover:bg-red-200 border-l-red-500'
    if (info.pax >= info.capienza * 0.75) return 'bg-orange-100 hover:bg-orange-200 border-l-orange-500'
    return 'bg-amber-50 hover:bg-amber-100 border-l-amber-400'
  }

  function getCellColorNs3000(cell: Ns3000CellData | undefined): string {
    if (!cell || cell.passengers_booked === 0) return 'bg-green-50 hover:bg-green-100 border-l-green-300'
    if (cell.occupancy_percent >= 100) return 'bg-red-100 hover:bg-red-200 border-l-red-500'
    if (cell.occupancy_percent >= 75) return 'bg-orange-100 hover:bg-orange-200 border-l-orange-500'
    return 'bg-amber-50 hover:bg-amber-100 border-l-amber-400'
  }

  function selectCustomer(cliente: any) {
    setSelectedClienteId(cliente.id); setSelectedClienteData(cliente)
    setCustomerSearch(`${cliente.nome} ${cliente.cognome}`); setShowCustomerDropdown(false)
  }

  // ─────────────────────────────────────────────
  // SETTINGS BA
  // ─────────────────────────────────────────────
  function openSettings(barca: Imbarcazione) {
    setSelectedBarca(barca); setOverrideInput(barca.capacita_collettiva_override?.toString() ?? '')
    setShowSettingsModal(true)
  }

  async function saveSettings() {
    if (!selectedBarca) return
    try {
      setSavingSettings(true)
      const override = overrideInput === '' ? null : parseInt(overrideInput)
      if (override !== null && (override <= 0 || override > selectedBarca.capacita_massima)) {
        toast.error(`La capienza deve essere tra 1 e ${selectedBarca.capacita_massima}`); return
      }
      const { error } = await supabase.from('imbarcazioni').update({ capacita_collettiva_override: override }).eq('id', selectedBarca.id)
      if (error) throw error
      toast.success('Impostazioni salvate!'); setShowSettingsModal(false); loadData()
    } catch { toast.error('Errore nel salvataggio') } finally { setSavingSettings(false) }
  }

  async function toggleCollettivi(barca: Imbarcazione) {
    try {
      const { error } = await supabase.from('imbarcazioni').update({ tour_collettivi_attivi: !barca.tour_collettivi_attivi }).eq('id', barca.id)
      if (error) throw error
      toast.success(barca.tour_collettivi_attivi ? 'Disattivati' : 'Attivati'); loadData()
    } catch { toast.error('Errore aggiornamento') }
  }

  // ─────────────────────────────────────────────
  // APRI MODAL PRENOTAZIONE
  // ─────────────────────────────────────────────
  function openNewBookingBA(barca: Imbarcazione, date: Date) {
    setNewBookingSource('ba')
    setNewBooking({
      imbarcazione_id: barca.id, ns3000_boat_id: '', ns3000_boat_name: '',
      ns3000_service_id: '', ns3000_service_name: '', ns3000_price_per_person: 0,
      data_servizio: format(date, 'yyyy-MM-dd'), numero_persone: 1,
      prezzo_totale: 0, caparra_ricevuta: 0, saldo_ricevuto: 0,
      metodo_pagamento: '', note: '', nome_cliente: '', cognome_cliente: '',
      email_cliente: '', telefono_cliente: '', servizio_id: '',
      stato: 'confermata', lingua: 'it', porto_imbarco: '', ora_imbarco: '',
    })
    setNs3000AvailableServices([])
    setSelectedClienteId(''); setSelectedClienteData(null); setCustomerSearch('')
    setShowNewModal(true)
  }

  function openNewBookingNs3000(boat: Ns3000CollectiveBoat, date: Date) {
    setNewBookingSource('ns3000')
    // Usa il primo servizio come default — utente può cambiare nel dropdown
    const defaultService = boat.all_services[0] || { service_id: boat.service_id, service_name: boat.service_name, price_per_person: boat.price_per_person }
    setNewBooking({
      imbarcazione_id: '', ns3000_boat_id: boat.boat_id, ns3000_boat_name: boat.boat_name,
      ns3000_service_id: defaultService.service_id,
      ns3000_service_name: defaultService.service_name,
      ns3000_price_per_person: defaultService.price_per_person,
      data_servizio: format(date, 'yyyy-MM-dd'), numero_persone: 1,
      prezzo_totale: defaultService.price_per_person,
      caparra_ricevuta: 0, saldo_ricevuto: 0,
      metodo_pagamento: '', note: '', nome_cliente: '', cognome_cliente: '',
      email_cliente: '', telefono_cliente: '', servizio_id: '',
      stato: 'confermata', lingua: 'it', porto_imbarco: '', ora_imbarco: '',
    })
    setNs3000AvailableServices(boat.all_services)
    setSelectedClienteId(''); setSelectedClienteData(null); setCustomerSearch('')
    setShowNewModal(true)
  }

  // Quando l'utente cambia il servizio NS3000 nel modal
  function handleNs3000ServiceChange(serviceId: string) {
    const svc = ns3000AvailableServices.find(s => s.service_id === serviceId)
    if (!svc) return
    setNewBooking(prev => ({
      ...prev,
      ns3000_service_id: svc.service_id,
      ns3000_service_name: svc.service_name,
      ns3000_price_per_person: svc.price_per_person,
      prezzo_totale: svc.price_per_person * (prev.numero_persone || 1),
    }))
  }

  // ─────────────────────────────────────────────
  // SALVA PRENOTAZIONE
  // ─────────────────────────────────────────────
  async function saveNewBooking() {
    if (!newBooking.metodo_pagamento) { toast.error('Seleziona un metodo di pagamento'); return }
    try {
      setSavingBooking(true)

      let clienteId: string | null = selectedClienteId || null
      const clienteNome = selectedClienteData?.nome || newBooking.nome_cliente
      const clienteCognome = selectedClienteData?.cognome || newBooking.cognome_cliente
      const clienteEmail = selectedClienteData?.email || newBooking.email_cliente
      const clienteTelefono = selectedClienteData?.telefono || newBooking.telefono_cliente

      if (!clienteId && newBooking.email_cliente) {
        const { data: ex } = await supabase.from('clienti').select('id').eq('email', newBooking.email_cliente).single()
        if (ex) { clienteId = ex.id }
        else if (newBooking.nome_cliente || newBooking.cognome_cliente) {
          const { data: nc, error: ce } = await supabase.from('clienti')
            .insert({ nome: newBooking.nome_cliente, cognome: newBooking.cognome_cliente, email: newBooking.email_cliente })
            .select('id').single()
          if (ce) throw ce; clienteId = nc.id
        }
      }

      if (newBookingSource === 'ns3000') {
        const res = await fetch('/api/ns3000/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            boat_id: newBooking.ns3000_boat_id,
            boat_name: newBooking.ns3000_boat_name,
            service_id: newBooking.ns3000_service_id,
            service_name: newBooking.ns3000_service_name,
            booking_date: newBooking.data_servizio,
            time_slot: 'full_day',
            customer_name: clienteNome,
            customer_surname: clienteCognome,
            customer_email: clienteEmail,
            customer_phone: clienteTelefono,
            num_passengers: newBooking.numero_persone,
            price: newBooking.prezzo_totale,
            notes: newBooking.note || null,
            cliente_id: clienteId,
            metodo_pagamento: newBooking.metodo_pagamento,
            lingua: newBooking.lingua,
            porto_imbarco: newBooking.porto_imbarco || null,
            ora_imbarco: newBooking.ora_imbarco || null,
            booking_type: 'collective',
          })
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.message || 'Errore NS3000')
        if (result.local_booking?.id) {
          await supabase.from('prenotazioni').update({ tipo_tour: 'collettivo' }).eq('id', result.local_booking.id)
        }
        toast.success(`Prenotazione NS3000 ${result.ns3000_booking?.booking_number || ''} creata!`)
        loadNs3000Data()
      } else {
        const { data: availData, error: availError } = await supabase.rpc('get_collective_boat_for_date', {
          p_date: newBooking.data_servizio, p_pax: newBooking.numero_persone,
        })
        if (availError) throw availError
        if (!availData?.find((b: any) => b.imbarcazione_id === newBooking.imbarcazione_id)) {
          toast.error('Posti insufficienti su questa barca per la data selezionata'); return
        }
        const codice = `COL-${Date.now().toString(36).toUpperCase()}`
        const { error } = await supabase.from('prenotazioni').insert({
          codice_prenotazione: codice, imbarcazione_id: newBooking.imbarcazione_id,
          data_servizio: newBooking.data_servizio, numero_persone: newBooking.numero_persone,
          tipo_tour: 'collettivo', stato: newBooking.stato, prezzo_totale: newBooking.prezzo_totale,
          caparra_ricevuta: newBooking.caparra_ricevuta || 0, saldo_ricevuto: newBooking.saldo_ricevuto || 0,
          metodo_pagamento: newBooking.metodo_pagamento, cliente_id: clienteId,
          servizio_id: newBooking.servizio_id || null, note_interne: newBooking.note || null,
          lingua: newBooking.lingua, porto_imbarco: newBooking.porto_imbarco || null,
          ora_imbarco: newBooking.ora_imbarco || null, source: 'blualliance',
        })
        if (error) throw error
        toast.success(`Prenotazione ${codice} creata!`)
        loadData()
      }
      setShowNewModal(false)
    } catch (error: any) {
      toast.error(error.message || 'Errore nella creazione')
    } finally { setSavingBooking(false) }
  }

  // ─────────────────────────────────────────────
  // STATS
  // ─────────────────────────────────────────────
  const totalPaxBA = prenotazioni.reduce((sum, p) => sum + p.numero_persone, 0)
  const totalPaxNs3000 = Object.values(ns3000CellMap).reduce((sum, v) => sum + v.passengers_booked, 0)
  const giornateOccupate = new Set(prenotazioni.map(p => `${p.imbarcazione_id}-${p.data_servizio}`)).size

  if (loading) return <div className="p-4 md:p-8"><div className="text-gray-600">Caricamento tour collettivi...</div></div>

  function renderDayHeaders(variant: 'ba' | 'ns3000' = 'ba') {
    return monthDays.map((day) => {
      const isToday = isSameDay(day, new Date())
      const isWeekend = [0, 6].includes(day.getDay())
      const borderClass = variant === 'ns3000' ? 'border border-indigo-200' : 'border border-gray-200'
      const colorClass = isToday ? 'bg-blue-100 text-blue-700' : isWeekend ? 'bg-orange-50 text-gray-700' : 'text-gray-700'
      return (
        <th key={day.toISOString()} className={`${borderClass} ${colorClass} py-1 text-center font-semibold`}
          style={{ width: '42px', minWidth: '42px' }}>
          <div className="flex flex-col leading-tight">
            <span className="text-[9px] font-normal text-gray-400 uppercase">{format(day, 'EEEEE', { locale: it })}</span>
            <span className={`text-xs ${isToday ? 'font-bold' : ''}`}>{format(day, 'd')}</span>
          </div>
        </th>
      )
    })
  }

  return (
    <div className="p-1 md:p-2 lg:p-3 h-screen flex flex-col">

      {/* HEADER */}
      <div className="mb-3 bg-gray-50 rounded-xl p-3 md:p-5">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">🚢 Tour Collettivi — Small Group</h1>
          {isOperatore && <span className="px-2.5 py-1 bg-teal-100 text-teal-700 text-xs font-semibold rounded-full border border-teal-200">👤 Vista Operatore</span>}
          {ns3000Loading && <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-200 animate-pulse">⛵ Sync NS3000...</span>}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-base md:text-lg font-extrabold text-gray-900 tracking-wide">{monthNames[currentMonth]}</span>
            <select value={currentMonth} onChange={(e) => setCurrentMonthStart(startOfMonth(new Date(currentYear, parseInt(e.target.value), 1)))}
              className="px-2 py-1.5 border border-blue-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 font-medium text-blue-700">
              {['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'].map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={currentYear} onChange={(e) => setCurrentMonthStart(startOfMonth(new Date(parseInt(e.target.value), currentMonth, 1)))}
              className="px-2 py-1.5 border border-blue-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 font-medium text-blue-700">
              {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCurrentMonthStart(subMonths(currentMonthStart, 1))} className="px-3 md:px-4 py-1.5 md:py-2 border border-gray-300 rounded-lg hover:bg-white text-xs md:text-sm bg-white">◀ Prec</button>
            <button onClick={() => setCurrentMonthStart(startOfMonth(new Date()))} className="px-4 md:px-5 py-1.5 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs md:text-sm font-semibold shadow-sm">Oggi</button>
            <button onClick={() => setCurrentMonthStart(addMonths(currentMonthStart, 1))} className="px-3 md:px-4 py-1.5 md:py-2 border border-gray-300 rounded-lg hover:bg-white text-xs md:text-sm bg-white">Succ ▶</button>
          </div>
        </div>
      </div>

      {/* LEGENDA + STATS */}
      <div className="mb-2 bg-white rounded-lg shadow-sm border border-gray-200 px-3 py-2">
        <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-400 rounded-full"></div><span>Libera</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-amber-400 rounded-full"></div><span>Parziale</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-orange-500 rounded-full"></div><span>Quasi piena</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-500 rounded-full"></div><span>Piena</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-purple-500 rounded-full"></div><span>Bloccata</span></div>
          <div className="ml-auto flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            <span>🔵 <strong className="text-gray-900">{totalPaxBA}</strong> pax BA</span>
            {!isOperatore && totalPaxNs3000 > 0 && <span>⛵ <strong className="text-indigo-700">{totalPaxNs3000}</strong> pax NS3000</span>}
            <span>📅 <strong className="text-blue-600">{giornateOccupate}</strong> giornate</span>
          </div>
        </div>
      </div>

      {/* GRIGLIA */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto h-full">

          {/* SEZIONE BA */}
          <div className="bg-blue-600 px-3 py-1.5 flex items-center gap-2">
            <span className="text-xs font-bold text-white">🚢 Blu Alliance — Barche Locali</span>
            <span className="text-xs text-blue-200">{imbarcazioni.length} barche</span>
          </div>

          <table className="border-collapse" style={{ tableLayout: 'fixed', minWidth: `${180 + monthDays.length * 42}px` }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50">
                <th className="sticky left-0 z-20 bg-gray-100 border border-gray-200 px-2 py-2 text-left font-semibold text-gray-900 text-xs" style={{ width: '180px', minWidth: '180px' }}>Barca · Capienza</th>
                {renderDayHeaders('ba')}
              </tr>
            </thead>
            <tbody>
              {imbarcazioni.map((barca) => (
                <tr key={barca.id} className="hover:bg-gray-50/50">
                  <td className="sticky left-0 z-[5] bg-gray-50 border border-gray-200 px-2 py-1" style={{ width: '180px', minWidth: '180px' }}>
                    <div className="flex items-center justify-between gap-1">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-gray-900 truncate" title={barca.nome}>{barca.nome}</div>
                        <span className="text-[10px] text-gray-500">
                          {barca.capacita_collettiva_override
                            ? (<><span className="line-through text-gray-300">{barca.capacita_massima}</span>{' '}<span className="text-orange-600 font-semibold">{barca.capacita_collettiva_override}</span></>)
                            : <span className="font-medium text-gray-700">{barca.capacita_massima}</span>} pax
                        </span>
                      </div>
                      {!isOperatore && (
                        <button onClick={() => openSettings(barca)}
                          className="flex-shrink-0 w-6 h-6 rounded-md bg-gray-100 hover:bg-blue-100 flex items-center justify-center text-gray-500 hover:text-blue-600 transition-colors" title="Impostazioni">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {(() => {
                      const pct = Math.round((monthDays.filter(d => getCellInfoBA(barca, d).pax > 0).length / monthDays.length) * 100)
                      return (
                        <div className="mt-1">
                          <div className="w-full bg-gray-200 rounded-full h-1"><div className="bg-blue-500 h-1 rounded-full" style={{ width: `${pct}%` }}></div></div>
                          <div className="text-[9px] text-gray-400 mt-0.5">{pct}% utilizzo</div>
                        </div>
                      )
                    })()}
                  </td>
                  {monthDays.map((day) => {
                    const info = getCellInfoBA(barca, day)
                    const isToday = isSameDay(day, new Date())
                    const cellColor = getCellColorBA(info)
                    const pct = Math.round((info.pax / info.capienza) * 100)
                    return (
                      <td key={`ba-${barca.id}-${day.toISOString()}`} className="border border-gray-100 p-0" style={{ width: '42px', minWidth: '42px' }}>
                        <button
                          onClick={() => {
                            if (info.bloccata_da_privato) { toast.error(`${barca.nome} impegnata con tour privato il ${format(day, 'd MMM', { locale: it })}`); return }
                            if (info.prenotazioni.length > 0) { setCellModalData({ barca, date: day, info }); setShowCellModal(true) }
                            else openNewBookingBA(barca, day)
                          }}
                          className={`w-full flex flex-col items-center justify-center border-l-2 transition-all ${cellColor} ${isToday ? 'ring-1 ring-inset ring-blue-300' : ''}`}
                          style={{ height: '52px' }}
                          title={info.bloccata_da_privato ? 'Bloccata' : `${info.pax}/${info.capienza} pax`}
                        >
                          {info.bloccata_da_privato ? <span className="text-[10px] text-purple-600">🔒</span>
                            : info.pax > 0 ? (
                              <>
                                <span className="text-[10px] font-bold text-gray-700 leading-none">{info.pax}/{info.capienza}</span>
                                <div className="w-6 bg-gray-200 rounded-full h-0.5 mt-1">
                                  <div className={`h-0.5 rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-orange-500' : 'bg-amber-400'}`} style={{ width: `${Math.min(pct, 100)}%` }}></div>
                                </div>
                              </>
                            ) : null}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {imbarcazioni.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              {isOperatore ? 'Nessuna delle tue imbarcazioni è abilitata ai tour collettivi' : 'Nessuna barca BA abilitata ai tour collettivi'}
            </div>
          )}

          {/* SEZIONE NS3000 */}
          {!isOperatore && (
            <>
              <div className="bg-indigo-600 px-3 py-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">⛵ NS3000 — Tour Collettivi Esterni</span>
                  <span className="text-xs text-indigo-200">{ns3000CollectiveBoats.length} barche</span>
                  {ns3000Loading && <span className="text-xs text-indigo-300 animate-pulse">· sync...</span>}
                </div>
                <button onClick={() => setShowNs3000(!showNs3000)} className="text-xs text-indigo-200 hover:text-white px-2 py-0.5 rounded hover:bg-indigo-700">
                  {showNs3000 ? '▲ Nascondi' : '▼ Mostra'}
                </button>
              </div>
              {showNs3000 && (
                ns3000CollectiveBoats.length > 0 ? (
                  <table className="border-collapse" style={{ tableLayout: 'fixed', minWidth: `${180 + monthDays.length * 42}px` }}>
                    <thead>
                      <tr className="bg-indigo-50">
                        <th className="sticky left-0 z-20 bg-indigo-100 border border-indigo-200 px-2 py-1.5 text-left font-semibold text-indigo-900 text-xs" style={{ width: '180px', minWidth: '180px' }}>Barca NS3000</th>
                        {renderDayHeaders('ns3000')}
                      </tr>
                    </thead>
                    <tbody>
                      {ns3000CollectiveBoats.map((boat) => {
                        const utilizzo = Math.round((monthDays.filter(d => (ns3000CellMap[`${boat.boat_id}|${format(d, 'yyyy-MM-dd')}`]?.passengers_booked || 0) > 0).length / monthDays.length) * 100)
                        return (
                          <tr key={`ns-${boat.boat_id}`} className="hover:bg-indigo-50/50">
                            <td className="sticky left-0 z-[5] bg-indigo-50 border border-gray-200 px-2 py-1" style={{ width: '180px', minWidth: '180px' }}>
                              <div className="text-xs font-semibold text-indigo-900 truncate" title={boat.boat_name}>{boat.boat_name}</div>
                              <div className="text-[10px] text-indigo-500">
                                {boat.capacity > 0 ? `${boat.capacity} pax` : ''}
                                {/* Mostra tutti i servizi disponibili */}
                                {boat.all_services.length > 0 && (
                                  <span className="ml-1 text-indigo-400">
                                    · {boat.all_services.map(s => `€${s.price_per_person}`).filter((v, i, a) => a.indexOf(v) === i).join('/')}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1">
                                <div className="w-full bg-indigo-200 rounded-full h-1"><div className="bg-indigo-500 h-1 rounded-full" style={{ width: `${utilizzo}%` }}></div></div>
                                <div className="text-[9px] text-indigo-400 mt-0.5">{utilizzo}% utilizzo</div>
                              </div>
                            </td>
                            {monthDays.map((day) => {
                              const dateStr = format(day, 'yyyy-MM-dd')
                              const cell = ns3000CellMap[`${boat.boat_id}|${dateStr}`]
                              const isToday = isSameDay(day, new Date())
                              const cellColor = getCellColorNs3000(cell)
                              const paxBooked = cell?.passengers_booked || 0
                              const capienza = cell?.capacity || boat.capacity
                              const cellPct = capienza > 0 ? Math.round((paxBooked / capienza) * 100) : 0
                              return (
                                <td key={`ns-${boat.boat_id}-${day.toISOString()}`} className="border border-gray-100 p-0" style={{ width: '42px', minWidth: '42px' }}>
                                  <button
                                    onClick={() => {
                                      if (cell && cell.passengers_booked > 0) {
                                        setNs3000CellModalData({ boat, date: dateStr, cell })
                                        setShowNs3000CellModal(true)
                                      } else {
                                        openNewBookingNs3000(boat, day)
                                      }
                                    }}
                                    className={`w-full flex flex-col items-center justify-center border-l-2 transition-all ${cellColor} ${isToday ? 'ring-1 ring-inset ring-blue-300' : ''}`}
                                    style={{ height: '52px' }}
                                    title={cell ? `${paxBooked}/${capienza} pax · ${cell.service_name}` : `Disponibile`}
                                  >
                                    {paxBooked > 0 ? (
                                      <>
                                        <span className="text-[10px] font-bold text-indigo-700 leading-none">{paxBooked}/{capienza}</span>
                                        <div className="w-6 bg-indigo-200 rounded-full h-0.5 mt-1">
                                          <div className={`h-0.5 rounded-full ${cellPct >= 100 ? 'bg-red-500' : cellPct >= 75 ? 'bg-orange-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(cellPct, 100)}%` }}></div>
                                        </div>
                                      </>
                                    ) : null}
                                  </button>
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-6 text-indigo-400 text-xs bg-indigo-50">
                    {ns3000Loading ? 'Caricamento barche NS3000...' : 'Nessuna barca NS3000 con tour collettivi configurati (verifica connessione API)'}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-400 text-center">
        💡 BA: cella vuota → nuova prenotazione · cella occupata → dettagli{!isOperatore && ' · ⚙️ → capienza'} · NS3000: cella vuota → nuova prenotazione con sync
      </div>

      {/* MODAL IMPOSTAZIONI BA */}
      {showSettingsModal && selectedBarca && !isOperatore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">⚙️ Capienza Collettivi</h2>
              <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="mb-4 bg-blue-50 rounded-lg p-3">
              <p className="text-sm font-semibold text-blue-900">🚤 {selectedBarca.nome}</p>
              <p className="text-xs text-blue-600 mt-0.5">Capienza massima: {selectedBarca.capacita_massima} pax</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Capienza collettiva personalizzata</label>
                <input type="number" min={1} max={selectedBarca.capacita_massima} value={overrideInput}
                  onChange={(e) => setOverrideInput(e.target.value)} placeholder={`Max ${selectedBarca.capacita_massima}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <div><div className="text-sm font-medium text-gray-700">Tour collettivi attivi</div><div className="text-xs text-gray-500">Disattiva per escludere</div></div>
                <button onClick={() => { toggleCollettivi(selectedBarca); setShowSettingsModal(false) }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${selectedBarca.tour_collettivi_attivi ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${selectedBarca.tour_collettivi_attivi ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowSettingsModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">Annulla</button>
              <button onClick={saveSettings} disabled={savingSettings} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
                {savingSettings ? 'Salvataggio...' : '💾 Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETTAGLI CELLA BA */}
      {showCellModal && cellModalData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">👥 Tour Collettivo BA</h2>
              <button onClick={() => setShowCellModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="mb-4 bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-semibold text-gray-900">🚤 {cellModalData.barca.nome}</p>
              <p className="text-sm text-gray-600">📅 {format(cellModalData.date, 'EEEE dd MMMM yyyy', { locale: it })}</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div className={`h-2 rounded-full ${cellModalData.info.pax >= cellModalData.info.capienza ? 'bg-red-500' : 'bg-amber-400'}`}
                    style={{ width: `${Math.min((cellModalData.info.pax / cellModalData.info.capienza) * 100, 100)}%` }}></div>
                </div>
                <span className="text-sm font-bold text-gray-900 whitespace-nowrap">{cellModalData.info.pax}/{cellModalData.info.capienza} pax</span>
              </div>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {cellModalData.info.prenotazioni.map((p) => (
                <div key={p.id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-blue-700">{p.codice_prenotazione}</div>
                    <div className="text-sm text-gray-900">{p.clienti?.nome} {p.clienti?.cognome}</div>
                    <div className="text-xs text-gray-500">{p.servizi?.nome}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-gray-900">{p.numero_persone}</span>
                    <div className="text-xs text-gray-500">pax</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.stato === 'confermata' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{p.stato}</span>
                  </div>
                </div>
              ))}
            </div>
            {cellModalData.info.pax < cellModalData.info.capienza && (
              <button onClick={() => { setShowCellModal(false); openNewBookingBA(cellModalData.barca, cellModalData.date) }}
                className="w-full mt-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                + Aggiungi ({cellModalData.info.capienza - cellModalData.info.pax} posti liberi)
              </button>
            )}
            {cellModalData.info.pax >= cellModalData.info.capienza && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 text-center">🚫 Barca al completo</div>
            )}
            <button onClick={() => setShowCellModal(false)} className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Chiudi</button>
          </div>
        </div>
      )}

      {/* MODAL DETTAGLI CELLA NS3000 */}
      {showNs3000CellModal && ns3000CellModalData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-indigo-900">⛵ Tour Collettivo NS3000</h2>
              <button onClick={() => setShowNs3000CellModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="mb-4 bg-indigo-50 rounded-lg p-3">
              <p className="text-sm font-semibold text-indigo-900">🚤 {ns3000CellModalData.boat.boat_name}</p>
              <p className="text-sm text-indigo-700">📅 {ns3000CellModalData.date} · 🎫 {ns3000CellModalData.cell.service_name}</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 bg-indigo-200 rounded-full h-2">
                  <div className={`h-2 rounded-full ${ns3000CellModalData.cell.occupancy_percent >= 100 ? 'bg-red-500' : 'bg-indigo-500'}`}
                    style={{ width: `${Math.min(ns3000CellModalData.cell.occupancy_percent, 100)}%` }}></div>
                </div>
                <span className="text-sm font-bold text-indigo-900 whitespace-nowrap">
                  {ns3000CellModalData.cell.passengers_booked}/{ns3000CellModalData.cell.capacity} pax
                </span>
              </div>
            </div>
            {ns3000CellModalData.cell.bookings.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
                {ns3000CellModalData.cell.bookings.map((b) => (
                  <div key={b.id} className="border border-indigo-200 bg-indigo-50 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-indigo-700">{b.booking_number}</div>
                      <div className="text-sm text-gray-900">{b.customer_name}</div>
                      {b.customer_phone && <div className="text-xs text-gray-500">{b.customer_phone}</div>}
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-gray-900">{b.num_passengers}</span>
                      <div className="text-xs text-gray-500">pax</div>
                      <div className="text-xs text-green-600 font-medium">€{b.final_price?.toFixed(0)}</div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${b.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{b.status_name}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mb-4 text-sm text-indigo-400 text-center py-4">Nessuna prenotazione NS3000</div>
            )}
            {ns3000CellModalData.cell.passengers_available > 0 && (
              <button onClick={() => { setShowNs3000CellModal(false); openNewBookingNs3000(ns3000CellModalData.boat, new Date(ns3000CellModalData.date + 'T12:00:00')) }}
                className="w-full mt-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
                + Aggiungi su NS3000 ({ns3000CellModalData.cell.passengers_available} posti liberi)
              </button>
            )}
            {ns3000CellModalData.cell.passengers_available <= 0 && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 text-center">🚫 Barca al completo</div>
            )}
            <button onClick={() => setShowNs3000CellModal(false)} className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Chiudi</button>
          </div>
        </div>
      )}

      {/* MODAL NUOVA PRENOTAZIONE */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl my-4">
            <div className={`p-4 border-b flex items-center justify-between ${newBookingSource === 'ns3000' ? 'bg-indigo-50' : ''}`}>
              <div>
                <h2 className="text-lg font-bold text-gray-900">➕ Nuova Prenotazione Collettiva</h2>
                {newBookingSource === 'ns3000'
                  ? <p className="text-xs text-indigo-700 mt-0.5">⛵ {newBooking.ns3000_boat_name} → sincronizzazione NS3000</p>
                  : <p className="text-xs text-blue-700 mt-0.5">🚢 Barca Blu Alliance</p>}
              </div>
              <button onClick={() => setShowNewModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Imbarcazione</label>
                  {newBookingSource === 'ns3000' ? (
                    <div className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-indigo-50 text-indigo-800 font-medium">⛵ {newBooking.ns3000_boat_name}</div>
                  ) : isOperatore ? (
                    <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700">
                      {imbarcazioni.find(b => b.id === newBooking.imbarcazione_id)?.nome ?? '—'}
                    </div>
                  ) : (
                    <select value={newBooking.imbarcazione_id} onChange={(e) => setNewBooking({ ...newBooking, imbarcazione_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                      <option value="">Seleziona barca...</option>
                      {imbarcazioni.map(b => <option key={b.id} value={b.id}>{b.nome} (max {b.capacita_collettiva_override ?? b.capacita_massima} pax)</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Data servizio</label>
                  <input type="date" value={newBooking.data_servizio}
                    onChange={(e) => setNewBooking({ ...newBooking, data_servizio: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">N° persone</label>
                  <input type="number" min={1} value={newBooking.numero_persone}
                    onChange={(e) => setNewBooking({ ...newBooking, numero_persone: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* ⭐ Selettore servizio: BA → dropdown servizi BA, NS3000 → dropdown servizi NS3000 della barca */}
              {newBookingSource === 'ba' ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Servizio/Tour</label>
                  <select value={newBooking.servizio_id} onChange={(e) => setNewBooking({ ...newBooking, servizio_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="">Seleziona servizio...</option>
                    {servizi.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </div>
              ) : ns3000AvailableServices.length > 1 ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Servizio/Tour NS3000</label>
                  <select value={newBooking.ns3000_service_id} onChange={(e) => handleNs3000ServiceChange(e.target.value)}
                    className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-indigo-50">
                    {ns3000AvailableServices.map(s => (
                      <option key={s.service_id} value={s.service_id}>{s.service_name} — €{s.price_per_person}/pax</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="bg-indigo-50 rounded-lg px-3 py-2 text-xs text-indigo-700">
                  🎫 {newBooking.ns3000_service_name} — €{newBooking.ns3000_price_per_person}/pax
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Porto Imbarco</label>
                  <select value={newBooking.porto_imbarco} onChange={(e) => setNewBooking({ ...newBooking, porto_imbarco: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="">Seleziona porto...</option>
                    <option value="Porto Turistico Marina d'Arechi">Marina d'Arechi</option>
                    <option value="Molo Manfredi - Porto di Salerno">Molo Manfredi</option>
                    <option value="Porto di Amalfi">Porto di Amalfi</option>
                    <option value="Porto di Positano">Porto di Positano</option>
                    <option value="Porto di Cetara">Porto di Cetara</option>
                    <option value="Porto di Maiori">Porto di Maiori</option>
                    <option value="Porto di Agropoli">Porto di Agropoli</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ora Imbarco</label>
                  <input type="time" value={newBooking.ora_imbarco}
                    onChange={(e) => setNewBooking({ ...newBooking, ora_imbarco: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="relative customer-search-container">
                <label className="block text-xs font-medium text-gray-700 mb-1">Cliente (opzionale)</label>
                <input type="text" value={customerSearch}
                  onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); if (!e.target.value) { setSelectedClienteId(''); setSelectedClienteData(null) } }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  placeholder="Cerca nome, cognome, email..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                {selectedClienteId && <p className="text-xs text-green-600 mt-0.5">✅ Cliente selezionato</p>}
                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredCustomers.slice(0, 10).map((c) => (
                      <button key={c.id} type="button" onClick={() => selectCustomer(c)}
                        className="w-full px-3 py-2 text-left hover:bg-blue-50 text-sm border-b border-gray-100">
                        <div className="font-medium text-gray-900">{c.nome} {c.cognome}</div>
                        <div className="text-xs text-gray-500">{c.email}{c.email && c.telefono && ' · '}{c.telefono}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {!selectedClienteId && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Oppure inserisci nuovo cliente</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Nome" value={newBooking.nome_cliente}
                      onChange={(e) => setNewBooking({ ...newBooking, nome_cliente: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    <input type="text" placeholder="Cognome" value={newBooking.cognome_cliente}
                      onChange={(e) => setNewBooking({ ...newBooking, cognome_cliente: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input type="email" placeholder="Email" value={newBooking.email_cliente}
                      onChange={(e) => setNewBooking({ ...newBooking, email_cliente: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    <input type="tel" placeholder="Telefono" value={newBooking.telefono_cliente}
                      onChange={(e) => setNewBooking({ ...newBooking, telefono_cliente: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              )}

              <div className={`rounded-lg p-3 border ${newBookingSource === 'ns3000' ? 'bg-indigo-50 border-indigo-200' : 'bg-blue-50 border-blue-200'}`}>
                <h3 className="font-semibold text-gray-900 mb-3 text-sm">💰 Prezzi e Pagamenti</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Prezzo Totale (€)</label>
                    <input type="number" step="0.01" min="0" value={newBooking.prezzo_totale}
                      onChange={(e) => setNewBooking({ ...newBooking, prezzo_totale: parseFloat(e.target.value) || 0 })}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500" />
                    {newBooking.prezzo_totale > 0 && <p className="text-xs text-green-600 mt-0.5">✅ {newBooking.ns3000_price_per_person > 0 ? `€${newBooking.ns3000_price_per_person} × ${newBooking.numero_persone} pax` : 'Calcolato automaticamente'}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Metodo Pagamento *</label>
                    <select value={newBooking.metodo_pagamento}
                      onChange={(e) => setNewBooking({ ...newBooking, metodo_pagamento: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 ${!newBooking.metodo_pagamento ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}>
                      <option value="">⚠️ Seleziona...</option>
                      <option value="stripe">💳 Stripe</option>
                      <option value="contanti">💵 Contanti</option>
                      <option value="pos">💳 POS</option>
                      <option value="bonifico">🏦 Bonifico</option>
                      <option value="altro">📋 Altro</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Caparra Ricevuta (€)</label>
                    <input type="number" step="0.01" min="0" value={newBooking.caparra_ricevuta}
                      onChange={(e) => setNewBooking({ ...newBooking, caparra_ricevuta: parseFloat(e.target.value) || 0 })}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    {newBooking.prezzo_totale > 0 && (
                      <div className="flex gap-1 mt-1">
                        <button type="button" onClick={() => setNewBooking({ ...newBooking, caparra_ricevuta: Math.round(newBooking.prezzo_totale * 0.3 * 100) / 100 })}
                          className="px-2 py-0.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-medium">30%</button>
                        <button type="button" onClick={() => setNewBooking({ ...newBooking, caparra_ricevuta: Math.round(newBooking.prezzo_totale * 0.5 * 100) / 100 })}
                          className="px-2 py-0.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-medium">50%</button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Saldo Ricevuto (€)</label>
                    <input type="number" step="0.01" min="0" value={newBooking.saldo_ricevuto}
                      onChange={(e) => setNewBooking({ ...newBooking, saldo_ricevuto: parseFloat(e.target.value) || 0 })}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className={`p-2 rounded border ${daRicevere > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Da Ricevere:</span>
                    <span className={`text-lg font-bold ${daRicevere > 0 ? 'text-red-600' : 'text-green-600'}`}>€{daRicevere.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Stato</label>
                  <select value={newBooking.stato} onChange={(e) => setNewBooking({ ...newBooking, stato: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="confermata">✅ Confermata</option>
                    <option value="in_attesa">⏳ In Attesa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Lingua</label>
                  <select value={newBooking.lingua} onChange={(e) => setNewBooking({ ...newBooking, lingua: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="it">🇮🇹 Italiano</option>
                    <option value="en">🇬🇧 English</option>
                    <option value="es">🇪🇸 Español</option>
                    <option value="fr">🇫🇷 Français</option>
                    <option value="de">🇩🇪 Deutsch</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Note interne</label>
                <textarea value={newBooking.note} onChange={(e) => setNewBooking({ ...newBooking, note: e.target.value })}
                  rows={2} placeholder="Note opzionali..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowNewModal(false)} className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-white text-sm">Annulla</button>
              <button onClick={saveNewBooking}
                disabled={savingBooking || (!newBooking.imbarcazione_id && !newBooking.ns3000_boat_id) || !newBooking.data_servizio || !newBooking.metodo_pagamento}
                className={`flex-1 px-4 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-50 ${newBookingSource === 'ns3000' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {savingBooking ? 'Salvataggio...' : newBookingSource === 'ns3000' ? '⛵ Crea e sincronizza NS3000' : '✅ Crea prenotazione BA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}