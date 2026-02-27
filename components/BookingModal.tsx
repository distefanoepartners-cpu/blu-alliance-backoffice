'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import toast from 'react-hot-toast'
import CreateCustomerModal from './CreateCustomerModal'

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  prenotazione?: any // Se presente = modifica, altrimenti = nuova
  initialDate?: string            // Data preselezionata (dal planning)
  initialImbarcazioneId?: string  // Imbarcazione preselezionata (dal planning)
  initialNs3000BoatId?: string    // Barca NS3000 preselezionata (dal planning)
  initialNs3000BoatName?: string  // Nome barca NS3000 (dal planning)
  initialBoatSource?: 'locale' | 'ns3000'
}

function generateCodice(): string {
  const dateStr = format(new Date(), 'yyyyMMdd')
  const rand = String(Math.floor(Math.random() * 9999)).padStart(4, '0')
  return `BA${dateStr}-${rand}`
}

// Helper: invia email di conferma + notifica booking@ e fornitore
async function inviaNotifiche(prenotazioneId: string, lingua: string) {
  try {
    const res = await fetch('/api/send-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prenotazioneId, lingua, tipo: 'conferma', notificaFornitore: true })
    })
    if (!res.ok) {
      const err = await res.json()
      console.warn('⚠️ Notifica email fallita:', err)
    }
  } catch (e) {
    console.warn('⚠️ Errore invio notifiche:', e)
  }
}

export default function BookingModal({ isOpen, onClose, onSave, prenotazione, initialDate, initialImbarcazioneId, initialNs3000BoatId, initialNs3000BoatName, initialBoatSource }: BookingModalProps) {
  const isEdit = !!prenotazione

  // ID delle imbarcazioni locali già gestite da NS3000 → escluse dal dropdown locale
  const BA_IDS_IN_NS3000 = new Set([
    'b743d220-6200-49de-9324-68297e4eee75', // Salpa Soleil 20 - 01
    '64e06e82-ed6e-4f23-b06e-14533a0187c6', // Salpa Soleil 20 - 02
    '7e854592-bb5d-4971-98aa-ae66c2fa66ba', // Salpa Soleil 20 - 03
    'b2a20895-eeab-493d-a2fb-53ef5ba1d220', // Salpa Soleil 20 - 04
    '4c4f4b54-4ee6-481f-94f9-a142b5d651b0', // Cayman 585 - 05
    '9a6cc58f-bb70-440e-92a1-d2e2c2712e5b', // Cayman 585 - 06
    '2d4995ec-35b3-4358-ace1-54621a9528ed', // Cab Dorado 10
    '51231c4f-b929-466c-aed3-9440639e0bd7', // Manò 24 Sport
    '8d4d1bd6-142f-4d0f-8854-333742eeeba3', // Clubman 26
    'a079598f-b25d-49d6-90ce-b25146687a31', // Manò 25 Sport
  ])

  // Options from DB
  const [clienti, setClienti] = useState<any[]>([])
  const [servizi, setServizi] = useState<any[]>([])
  const [imbarcazioni, setImbarcazioni] = useState<any[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)

  // NS3000
  const [boatSource, setBoatSource] = useState<'locale' | 'ns3000'>(initialBoatSource || 'locale')
  const [ns3000Boats, setNs3000Boats] = useState<any[]>([])
  const [ns3000BoatId, setNs3000BoatId] = useState(initialNs3000BoatId || '')
  const [ns3000TimeSlot, setNs3000TimeSlot] = useState<'full_day' | 'morning' | 'afternoon'>('full_day')
  const [ns3000Availability, setNs3000Availability] = useState<any>(null)
  const [checkingAvailability, setCheckingAvailability] = useState(false)

  // Customer search
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([])
  const [showCreateCustomer, setShowCreateCustomer] = useState(false)

  // Form
  const [formData, setFormData] = useState({
    codice_prenotazione: '',
    cliente_id: '',
    servizio_id: '',
    imbarcazione_id: '',
    data_servizio: '',
    ora_inizio: '',
    numero_persone: 1,
    stato: 'in_attesa',
    prezzo_totale: 0,
    caparra_ricevuta: 0,
    saldo_ricevuto: 0,
    metodo_pagamento: '',
    metodo_pagamento_caparra: '',
    metodo_pagamento_saldo: '',
    lingua: 'it',
    note_cliente: '',
    note_interne: ''
  })

  const [saving, setSaving] = useState(false)

  // Da ricevere calcolato
  const daRicevere = Math.max(0,
    (formData.prezzo_totale || 0) - (formData.caparra_ricevuta || 0) - (formData.saldo_ricevuto || 0)
  )

  // Load options
  useEffect(() => {
    if (isOpen) {
      loadOptions()
    }
  }, [isOpen])

  // Populate form for edit
  useEffect(() => {
    if (isOpen && prenotazione) {
      setFormData({
        codice_prenotazione: prenotazione.codice_prenotazione || '',
        cliente_id: prenotazione.cliente_id || '',
        servizio_id: prenotazione.servizio_id || '',
        imbarcazione_id: prenotazione.imbarcazione_id || '',
        data_servizio: prenotazione.data_servizio || '',
        ora_inizio: prenotazione.ora_inizio || '',
        numero_persone: prenotazione.numero_persone || 1,
        stato: prenotazione.stato || 'in_attesa',
        prezzo_totale: prenotazione.prezzo_totale || 0,
        caparra_ricevuta: prenotazione.caparra_ricevuta || 0,
        saldo_ricevuto: prenotazione.saldo_ricevuto || 0,
        metodo_pagamento: prenotazione.metodo_pagamento || '',
        metodo_pagamento_caparra: prenotazione.metodo_pagamento_caparra || '',
        metodo_pagamento_saldo: prenotazione.metodo_pagamento_saldo || '',
        lingua: prenotazione.lingua || 'it',
        note_cliente: prenotazione.note_cliente || '',
        note_interne: prenotazione.note_interne || ''
      })
      // Set customer search name
      if (prenotazione.clienti) {
        setCustomerSearch(`${prenotazione.clienti.nome} ${prenotazione.clienti.cognome}`)
      }
    } else if (isOpen && !prenotazione) {
      // Reset for new
      setFormData({
        codice_prenotazione: generateCodice(),
        cliente_id: '',
        servizio_id: '',
        imbarcazione_id: initialImbarcazioneId || '',
        data_servizio: initialDate || '',
        ora_inizio: '',
        numero_persone: 1,
        stato: 'in_attesa',
        prezzo_totale: 0,
        caparra_ricevuta: 0,
        saldo_ricevuto: 0,
        metodo_pagamento: '',
        metodo_pagamento_caparra: '',
        metodo_pagamento_saldo: '',
        lingua: 'it',
        note_cliente: '',
        note_interne: ''
      })
      setCustomerSearch('')
      setBoatSource('locale')
      setNs3000BoatId('')
      setNs3000TimeSlot('full_day')
      setNs3000Availability(null)
    }
  }, [isOpen, prenotazione])

  async function loadOptions() {
    try {
      setLoadingOptions(true)

      const [clientiRes, serviziRes, imbarcazioniRes, serviziAssociatiRes] = await Promise.all([
        supabase.from('clienti').select('id, nome, cognome, email, telefono').order('cognome'),
        // Servizi solo descrittivi — senza prezzo_base
        supabase.from('servizi').select('id, nome, tipo').eq('attivo', true).order('nome'),
        supabase.from('imbarcazioni').select('id, nome, tipo, categoria, fornitore_id').eq('attiva', true).order('nome'),
        // Prezzi per barca: dalla view che include prezzo_personalizzato
        supabase.from('vista_imbarcazioni_servizi_con_prezzi').select('imbarcazione_id, servizio_id, servizio_tipo, prezzo_finale')
      ])

      setClienti(clientiRes.data || [])
      setServizi(serviziRes.data || [])
      // Arricchisce ogni imbarcazione con mappa tipo→prezzo per auto-fill
      const serviziAssociati = serviziAssociatiRes.data || []
      const imbarcazioniConPrezzi = (imbarcazioniRes.data || []).map(imb => ({
        ...imb,
        prezzi_servizi: serviziAssociati
          .filter(sa => sa.imbarcazione_id === imb.id)
          .reduce((acc: any, sa: any) => {
            // Indicizza per servizio_id E per tipo per flessibilità
            if (sa.prezzo_finale) {
              acc[sa.servizio_id] = sa.prezzo_finale
              acc[sa.servizio_tipo] = sa.prezzo_finale
            }
            return acc
          }, {})
      }))
      setImbarcazioni(imbarcazioniConPrezzi)

      // Carica barche NS3000
      try {
        const ns3000Res = await fetch('/api/ns3000/availability?date=' + (formData.data_servizio || new Date().toISOString().split('T')[0]))
        if (ns3000Res.ok) {
          const ns3000Data = await ns3000Res.json()
          setNs3000Boats(ns3000Data.boats || [])
        }
      } catch (err) {
        console.error('Errore caricamento barche NS3000:', err)
      }
    } catch (error) {
      console.error('Errore caricamento opzioni:', error)
      toast.error('Errore nel caricamento')
    } finally {
      setLoadingOptions(false)
    }
  }

  // Check disponibilità NS3000 quando cambia data o barca
  useEffect(() => {
    if (boatSource === 'ns3000' && ns3000BoatId && formData.data_servizio) {
      checkNs3000Availability()
    }
  }, [ns3000BoatId, formData.data_servizio, boatSource])

  async function checkNs3000Availability() {
    try {
      setCheckingAvailability(true)
      const res = await fetch(`/api/ns3000/availability?date=${formData.data_servizio}&boat_id=${ns3000BoatId}`)
      if (res.ok) {
        const data = await res.json()
        const boat = data.boats?.[0]
        if (boat) {
          setNs3000Availability(boat.availability?.[formData.data_servizio] || null)
        }
      }
    } catch (err) {
      console.error('Errore check disponibilità:', err)
    } finally {
      setCheckingAvailability(false)
    }
  }

  // Customer search filter
  useEffect(() => {
    if (customerSearch.trim()) {
      const term = customerSearch.toLowerCase()
      const filtered = clienti.filter((c) =>
        c.nome?.toLowerCase().includes(term) ||
        c.cognome?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.telefono?.includes(term)
      )
      setFilteredCustomers(filtered)
    } else {
      setFilteredCustomers(clienti.slice(0, 20))
    }
  }, [customerSearch, clienti])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (!target.closest('.customer-search-container')) {
        setShowCustomerDropdown(false)
      }
    }
    if (showCustomerDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCustomerDropdown])

  function selectCustomer(cliente: any) {
    setFormData(prev => ({ ...prev, cliente_id: cliente.id }))
    setCustomerSearch(`${cliente.nome} ${cliente.cognome}`)
    setShowCustomerDropdown(false)
  }

  // Auto-set prezzo da barca + servizio
  useEffect(() => {
    // Solo in locale mode, non in ns3000 (lì il prezzo è libero)
    if (!isEdit && boatSource === 'locale' && formData.imbarcazione_id && formData.servizio_id) {
      const barca = imbarcazioni.find(i => i.id === formData.imbarcazione_id)
      const servizio = servizi.find(s => s.id === formData.servizio_id)
      if (barca?.prezzi_servizi) {
        // Cerca prima per servizio_id, poi per tipo
        const prezzo = barca.prezzi_servizi[formData.servizio_id]
          ?? barca.prezzi_servizi[servizio?.tipo]
          ?? null
        if (prezzo && prezzo > 0) {
          setFormData(prev => ({ ...prev, prezzo_totale: prezzo }))
        }
      }
    }
  }, [formData.imbarcazione_id, formData.servizio_id, boatSource, imbarcazioni, servizi, isEdit])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validazione
    if (!formData.cliente_id) {
      toast.error('Seleziona un cliente')
      return
    }
    if (boatSource === 'locale' && !formData.imbarcazione_id) {
      toast.error('Seleziona un\'imbarcazione')
      return
    }
    if (boatSource === 'ns3000' && !ns3000BoatId) {
      toast.error('Seleziona una barca NS3000')
      return
    }
    if (!formData.data_servizio) {
      toast.error('Seleziona una data')
      return
    }
    if (!formData.metodo_pagamento) {
      toast.error('Seleziona un metodo di pagamento')
      return
    }

    try {
      setSaving(true)

      if (isEdit) {
        // UPDATE
        const { error } = await supabase
          .from('prenotazioni')
          .update({
            cliente_id: formData.cliente_id,
            servizio_id: formData.servizio_id,
            imbarcazione_id: formData.imbarcazione_id,
            data_servizio: formData.data_servizio,
            ora_inizio: formData.ora_inizio || null,
            numero_persone: formData.numero_persone,
            stato: formData.stato,
            prezzo_totale: formData.prezzo_totale,
            caparra_ricevuta: formData.caparra_ricevuta,
            saldo_ricevuto: formData.saldo_ricevuto,
            metodo_pagamento: formData.metodo_pagamento,
            metodo_pagamento_caparra: formData.metodo_pagamento_caparra || null,
            metodo_pagamento_saldo: formData.metodo_pagamento_saldo || null,
            lingua: formData.lingua,
            note_cliente: formData.note_cliente || null,
            note_interne: formData.note_interne || null
          })
          .eq('id', prenotazione.id)

        if (error) throw error
        toast.success('Prenotazione aggiornata!')
      } else {
        // INSERT
        if (boatSource === 'ns3000') {
          // Prenotazione su barca NS3000 → chiama API sync
          const selectedBoat = ns3000Boats.find(b => b.boat_id === ns3000BoatId)
          const cliente = clienti.find(c => c.id === formData.cliente_id)

          const ns3000Payload = {
            boat_id: ns3000BoatId,
            boat_name: selectedBoat?.name || '',
            booking_date: formData.data_servizio,
            time_slot: ns3000TimeSlot,
            customer_name: cliente?.nome || '',
            customer_surname: cliente?.cognome || '',
            customer_email: cliente?.email || '',
            customer_phone: cliente?.telefono || '',
            num_passengers: formData.numero_persone,
            price: formData.prezzo_totale,
            notes: formData.note_interne || '',
            cliente_id: formData.cliente_id,
            servizio_id: formData.servizio_id || null,
            ora_inizio: formData.ora_inizio || null,
            metodo_pagamento: formData.metodo_pagamento || 'contanti',
            lingua: formData.lingua
          }

          const res = await fetch('/api/ns3000/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ns3000Payload)
          })

          const result = await res.json()

          if (!res.ok) {
            throw new Error(result.message || 'Errore creazione prenotazione NS3000')
          }

          toast.success(`Prenotazione NS3000 creata! ${result.ns3000_booking?.booking_number || ''}`)
          // Invia email conferma + notifica booking@ e fornitore
          if (result.local_booking?.id) {
            inviaNotifiche(result.local_booking.id, formData.lingua || 'it')
          }
        } else {
          // Prenotazione locale (originale)
          const { error } = await supabase
            .from('prenotazioni')
            .insert([{
              codice_prenotazione: formData.codice_prenotazione,
              cliente_id: formData.cliente_id,
              servizio_id: formData.servizio_id,
              imbarcazione_id: formData.imbarcazione_id,
              data_servizio: formData.data_servizio,
              ora_inizio: formData.ora_inizio || null,
              numero_persone: formData.numero_persone,
              stato: formData.stato,
              prezzo_totale: formData.prezzo_totale,
              caparra_dovuta: formData.prezzo_totale * 0.3,
              caparra_ricevuta: formData.caparra_ricevuta,
              saldo_ricevuto: formData.saldo_ricevuto,
              metodo_pagamento: formData.metodo_pagamento,
              metodo_pagamento_caparra: formData.metodo_pagamento_caparra || null,
              metodo_pagamento_saldo: formData.metodo_pagamento_saldo || null,
              lingua: formData.lingua,
              note_cliente: formData.note_cliente || null,
              note_interne: formData.note_interne || null
            }])

          if (error) throw error
          toast.success('Prenotazione creata!')
          // Recupera l'id appena inserito e invia notifiche
          const { data: nuova } = await supabase
            .from('prenotazioni')
            .select('id')
            .eq('codice_prenotazione', formData.codice_prenotazione)
            .single()
          if (nuova?.id) {
            inviaNotifiche(nuova.id, formData.lingua || 'it')
          }
        }
      }

      onSave()
      onClose()
    } catch (error: any) {
      console.error('Errore salvataggio:', error)
      toast.error(error.message || 'Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[95vh] flex flex-col mx-2 md:mx-0">
        {/* Header */}
        <div className="p-3 md:p-4 border-b flex items-center justify-between bg-white rounded-t-xl flex-shrink-0">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900">
              {isEdit ? 'Modifica Prenotazione' : 'Nuova Prenotazione'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{formData.codice_prenotazione}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-2">×</button>
        </div>

        {/* Form scrollable */}
        <div className="overflow-y-auto flex-1">
          <form id="booking-form" onSubmit={handleSubmit} className="p-3 md:p-4">
            {loadingOptions ? (
              <div className="text-center py-8 text-gray-600">Caricamento opzioni...</div>
            ) : (
              <div className="space-y-3 md:space-y-4">

                {/* Riga 1: Cliente + Imbarcazione */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Cliente - Ricerca */}
                  <div className="relative customer-search-container">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Cliente *</label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={customerSearch}
                          onChange={(e) => {
                            setCustomerSearch(e.target.value)
                            setShowCustomerDropdown(true)
                            // Se cancella, resetta ID
                            if (!e.target.value) {
                              setFormData(prev => ({ ...prev, cliente_id: '' }))
                            }
                          }}
                          onFocus={() => setShowCustomerDropdown(true)}
                          placeholder="Cerca nome, cognome, email..."
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                        />
                        {showCustomerDropdown && filteredCustomers.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {filteredCustomers.slice(0, 10).map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => selectCustomer(c)}
                                className="w-full px-3 py-2 text-left hover:bg-blue-50 text-sm border-b border-gray-100"
                              >
                                <div className="font-medium text-gray-900">{c.nome} {c.cognome}</div>
                                <div className="text-xs text-gray-500">
                                  {c.email && <span>{c.email}</span>}
                                  {c.email && c.telefono && <span> • </span>}
                                  {c.telefono && <span>{c.telefono}</span>}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCreateCustomer(true)}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-bold"
                        title="Crea nuovo cliente"
                      >
                        ➕
                      </button>
                    </div>
                    {formData.cliente_id && (
                      <p className="text-xs text-green-600 mt-0.5">✅ Cliente selezionato</p>
                    )}
                  </div>

                  {/* Imbarcazione */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Imbarcazione *</label>
                    {!isEdit && (
                      <div className="flex gap-1 mb-1.5">
                        <button
                          type="button"
                          onClick={() => { setBoatSource('locale'); setNs3000BoatId(''); setNs3000Availability(null) }}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                            boatSource === 'locale' 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          🚤 Locale
                        </button>
                        <button
                          type="button"
                          onClick={() => { setBoatSource('ns3000'); setFormData(prev => ({ ...prev, imbarcazione_id: '' })) }}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                            boatSource === 'ns3000' 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          ⛵ NS3000
                        </button>
                      </div>
                    )}
                    {boatSource === 'locale' ? (
                      <select
                        value={formData.imbarcazione_id}
                        onChange={(e) => setFormData({ ...formData, imbarcazione_id: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                        required={boatSource === 'locale'}
                      >
                        <option value="">Seleziona...</option>
                        {imbarcazioni
                          .filter(b => !BA_IDS_IN_NS3000.has(b.id))
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.nome} ({b.categoria})
                            </option>
                          ))
                        }
                      </select>
                    ) : (
                      <div>
                        <select
                          value={ns3000BoatId}
                          onChange={(e) => setNs3000BoatId(e.target.value)}
                          className="w-full px-2 py-1.5 border border-indigo-300 rounded text-sm h-[34px] bg-indigo-50"
                        >
                          <option value="">Seleziona barca NS3000...</option>
                          {ns3000Boats.map((b) => (
                            <option key={b.boat_id} value={b.boat_id}>
                              {b.name} ({b.boat_type} · max {b.max_passengers}p)
                            </option>
                          ))}
                        </select>
                        {/* Disponibilità e Time Slot */}
                        {ns3000BoatId && (
                          <div className="mt-1.5">
                            <div className="flex gap-1.5 items-center">
                              <select
                                value={ns3000TimeSlot}
                                onChange={(e) => setNs3000TimeSlot(e.target.value as any)}
                                className="px-2 py-1 border border-indigo-300 rounded text-xs bg-white"
                              >
                                <option value="full_day">Giornata Intera</option>
                                <option value="morning">Solo Mattina</option>
                                <option value="afternoon">Solo Pomeriggio</option>
                              </select>
                              {checkingAvailability && (
                                <span className="text-xs text-indigo-500">Verifica...</span>
                              )}
                              {ns3000Availability && !checkingAvailability && (
                                <span className={`text-xs font-medium ${
                                  ns3000Availability.slots?.[ns3000TimeSlot] 
                                    ? 'text-green-600' 
                                    : 'text-red-600'
                                }`}>
                                  {ns3000Availability.slots?.[ns3000TimeSlot] ? '✅ Disponibile' : '❌ Non disponibile'}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Riga 2: Servizio + Pax */}
                <div className="grid grid-cols-[1fr_80px] md:grid-cols-[1fr_100px] gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Servizio *</label>
                    <select
                      value={formData.servizio_id}
                      onChange={(e) => setFormData({ ...formData, servizio_id: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                      required
                    >
                      <option value="">Seleziona...</option>
                      {servizi.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Pax</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.numero_persone}
                      onChange={(e) => setFormData({ ...formData, numero_persone: parseInt(e.target.value) || 1 })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                    />
                  </div>
                </div>

                {/* Riga 3: Data + Ora + Stato + Lingua */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Data *</label>
                    <input
                      type="date"
                      value={formData.data_servizio}
                      onChange={(e) => setFormData({ ...formData, data_servizio: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Ora Inizio</label>
                    <input
                      type="time"
                      value={formData.ora_inizio}
                      onChange={(e) => setFormData({ ...formData, ora_inizio: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Stato</label>
                    <select
                      value={formData.stato}
                      onChange={(e) => setFormData({ ...formData, stato: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                    >
                      <option value="in_attesa">⏳ In Attesa</option>
                      <option value="confermata">✅ Confermata</option>
                      <option value="completata">🏁 Completata</option>
                      <option value="cancellata">❌ Cancellata</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Lingua</label>
                    <select
                      value={formData.lingua}
                      onChange={(e) => setFormData({ ...formData, lingua: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                    >
                      <option value="it">🇮🇹 Italiano</option>
                      <option value="en">🇬🇧 English</option>
                      <option value="fr">🇫🇷 Français</option>
                      <option value="de">🇩🇪 Deutsch</option>
                      <option value="es">🇪🇸 Español</option>
                    </select>
                  </div>
                </div>

                {/* Sezione Prezzi e Pagamenti */}
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <h3 className="font-semibold text-gray-900 mb-3 text-sm">💰 Prezzi e Pagamenti</h3>

                  {/* Prezzo + Metodo Principale */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Prezzo Totale (€) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.prezzo_totale}
                        onChange={(e) => setFormData({ ...formData, prezzo_totale: parseFloat(e.target.value) || 0 })}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px] font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Metodo Pagamento *</label>
                      <select
                        value={formData.metodo_pagamento}
                        onChange={(e) => setFormData({ ...formData, metodo_pagamento: e.target.value })}
                        className={`w-full px-2 py-1.5 border rounded text-sm h-[34px] ${
                          !formData.metodo_pagamento ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                        required
                      >
                        <option value="">⚠️ Seleziona...</option>
                        <option value="stripe">💳 Stripe (Online)</option>
                        <option value="contanti">💵 Contanti</option>
                        <option value="pos">💳 POS / Carta</option>
                        <option value="bonifico">🏦 Bonifico</option>
                        <option value="altro">📋 Altro</option>
                      </select>
                      {!formData.metodo_pagamento && (
                        <p className="text-xs text-red-500 mt-0.5">⚠️ Obbligatorio</p>
                      )}
                    </div>
                  </div>

                  {/* Caparra + Metodo */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Caparra Ricevuta (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.caparra_ricevuta}
                        onChange={(e) => setFormData({ ...formData, caparra_ricevuta: parseFloat(e.target.value) || 0 })}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                      />
                      {/* Quick buttons */}
                      {formData.prezzo_totale > 0 && (
                        <div className="flex gap-1 mt-1">
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, caparra_ricevuta: Math.round(formData.prezzo_totale * 0.3 * 100) / 100 })}
                            className="px-2 py-0.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-medium"
                          >
                            30%
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, caparra_ricevuta: Math.round(formData.prezzo_totale * 0.5 * 100) / 100 })}
                            className="px-2 py-0.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-medium"
                          >
                            50%
                          </button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Metodo Caparra</label>
                      <select
                        value={formData.metodo_pagamento_caparra}
                        onChange={(e) => setFormData({ ...formData, metodo_pagamento_caparra: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                      >
                        <option value="">Usa principale</option>
                        <option value="stripe">💳 Stripe</option>
                        <option value="contanti">💵 Contanti</option>
                        <option value="pos">💳 POS</option>
                        <option value="bonifico">🏦 Bonifico</option>
                        <option value="altro">📋 Altro</option>
                      </select>
                    </div>
                  </div>

                  {/* Saldo + Metodo */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Saldo Ricevuto (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.saldo_ricevuto}
                        onChange={(e) => setFormData({ ...formData, saldo_ricevuto: parseFloat(e.target.value) || 0 })}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Metodo Saldo</label>
                      <select
                        value={formData.metodo_pagamento_saldo}
                        onChange={(e) => setFormData({ ...formData, metodo_pagamento_saldo: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                      >
                        <option value="">Usa principale</option>
                        <option value="stripe">💳 Stripe</option>
                        <option value="contanti">💵 Contanti</option>
                        <option value="pos">💳 POS</option>
                        <option value="bonifico">🏦 Bonifico</option>
                        <option value="altro">📋 Altro</option>
                      </select>
                    </div>
                  </div>

                  {/* Da Ricevere */}
                  <div className={`p-2 rounded border ${daRicevere > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Da Ricevere:</span>
                      <span className={`text-lg font-bold ${daRicevere > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        €{daRicevere.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Note */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Note Cliente</label>
                    <textarea
                      value={formData.note_cliente}
                      onChange={(e) => setFormData({ ...formData, note_cliente: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      rows={2}
                      placeholder="Note visibili al cliente..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Note Interne</label>
                    <textarea
                      value={formData.note_interne}
                      onChange={(e) => setFormData({ ...formData, note_interne: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      rows={2}
                      placeholder="Note interne (non visibili al cliente)..."
                    />
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex gap-2 md:gap-3 p-3 md:p-4 border-t bg-gray-50 rounded-b-xl flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-white text-sm"
            disabled={saving}
          >
            Annulla
          </button>
          <button
            type="submit"
            form="booking-form"
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm"
            disabled={saving || loadingOptions}
          >
            {saving ? 'Salvataggio...' : (isEdit ? 'Aggiorna' : 'Crea Prenotazione')}
          </button>
        </div>
      </div>

      {/* Modal Crea Cliente */}
      <CreateCustomerModal
        isOpen={showCreateCustomer}
        onClose={() => setShowCreateCustomer(false)}
        onCustomerCreated={async (clienteId) => {
          // Ricarica clienti e seleziona il nuovo
          const { data } = await supabase
            .from('clienti')
            .select('id, nome, cognome, email, telefono')
            .order('cognome')
          setClienti(data || [])
          
          const newClient = data?.find(c => c.id === clienteId)
          if (newClient) {
            selectCustomer(newClient)
          }
        }}
      />
    </div>
  )
}