'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/api-client'  // ← AGGIUNGI
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { trackAction } from '@/lib/useActivityTracker'

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  prenotazione?: any
  initialDate?: string
  initialImbarcazioneId?: string
  initialNs3000BoatId?: string
  initialNs3000BoatName?: string
  initialBoatSource?: 'locale' | 'ns3000'
}

function generateCodice(): string {
  const dateStr = format(new Date(), 'yyyyMMdd')
  const rand = String(Math.floor(Math.random() * 9999)).padStart(4, '0')
  return `BA${dateStr}-${rand}`
}

async function inviaNotifiche(prenotazioneId: string, lingua: string) {
  try {
    const res = await fetch('/api/send-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prenotazioneId, lingua, tipo: 'conferma', notificaFornitore: true })
    })
    if (!res.ok) console.warn('⚠️ Notifica email fallita')
  } catch (e) { console.warn('⚠️ Errore invio notifiche:', e) }
}

export default function BookingModal({
  isOpen, onClose, onSave, prenotazione,
  initialDate, initialImbarcazioneId,
  initialNs3000BoatId, initialNs3000BoatName, initialBoatSource
}: BookingModalProps) {
  const isEdit = !!prenotazione
  const [sendingReview, setSendingReview] = useState(false)
  const [reviewSentAt, setReviewSentAt] = useState<string | null>((prenotazione as any)?.google_review_sent_at || null)

  const BA_IDS_IN_NS3000 = new Set([
    'b743d220-6200-49de-9324-68297e4eee75', '64e06e82-ed6e-4f23-b06e-14533a0187c6',
    '7e854592-bb5d-4971-98aa-ae66c2fa66ba', 'b2a20895-eeab-493d-a2fb-53ef5ba1d220',
    '4c4f4b54-4ee6-481f-94f9-a142b5d651b0', '9a6cc58f-bb70-440e-92a1-d2e2c2712e5b',
    '2f4f1a71-5037-4fb0-bbd1-ef6c6acf8dc5', 'b2c15f7e-ffb2-4afa-bf19-d53f8d26902b',
    '557ecf08-2e88-4914-a1d9-da5ec5bf5845', '07673392-e08c-4d53-a128-e9d6c405917d',
    '2d4995ec-35b3-4358-ace1-54621a9528ed', '51231c4f-b929-466c-aed3-9440639e0bd7',
    '8d4d1bd6-142f-4d0f-8854-333742eeeba3', '31d0ac07-57a9-472d-b07a-f9a26b2ba89e',
    'a079598f-b25d-49d6-90ce-b25146687a31', 'c8638c23-cd35-4c11-8333-4316f1ca4726',
    'd8262b01-07d0-4795-ba31-e64c6eaf6f0f', '43d0b751-da8d-4181-aabc-ba3b217142bc',
    'd37bd3b0-35a0-48be-81b9-9816686137b1',
    'e27ce151-0cd0-444e-b5f9-040b09859377',  // ⭐ 2026-05-11 — Mito 45 (ex Cab Dorado NS3000)
  ])

  const BA_TO_NS3000_MAP: Record<string, string> = {
    'b743d220-6200-49de-9324-68297e4eee75': '4a222a73-304b-4945-813b-9548ba201675',
    '64e06e82-ed6e-4f23-b06e-14533a0187c6': 'd03cfe13-bcb6-4f98-bda4-a18b8bf7957d',
    '7e854592-bb5d-4971-98aa-ae66c2fa66ba': '00ce8828-ebf9-4aad-8ad8-8f6b4e90a1e3',
    'b2a20895-eeab-493d-a2fb-53ef5ba1d220': '2edce19e-3687-42b9-bb87-57e2aabfccd2',
    '4c4f4b54-4ee6-481f-94f9-a142b5d651b0': '937298ab-2a15-4ace-adb2-b63dd1b865b1',
    '9a6cc58f-bb70-440e-92a1-d2e2c2712e5b': '6800721d-a8e9-4217-b7a2-8548359c6cfc',
    '2f4f1a71-5037-4fb0-bbd1-ef6c6acf8dc5': '42d4c904-f2e1-4436-931b-3e7b651bd7a6',
    'b2c15f7e-ffb2-4afa-bf19-d53f8d26902b': '52a7e9d0-444e-4801-a095-afcbba7ceed5',
    '557ecf08-2e88-4914-a1d9-da5ec5bf5845': '180dd752-b2b4-4318-beed-8bc15b3877c2',
    '07673392-e08c-4d53-a128-e9d6c405917d': '8c1b5b3d-d4a2-441c-8f8e-71b88ff6c966',
   // ⭐ 2026-05-11 — Domar F8 BA ora punta alla NUOVA scheda NS3000 (la vecchia c35aefd0 è diventata Mito 45)
    '2d4995ec-35b3-4358-ace1-54621a9528ed': '0e705ad6-bcaf-445f-b640-2c4b0a9166ff',
    'e27ce151-0cd0-444e-b5f9-040b09859377': 'c35aefd0-6721-4f01-aeec-2d47bdf9f24f',  // Mito 45 BA → Mito 45 NS3000 (ex Cab Dorado)
    '51231c4f-b929-466c-aed3-9440639e0bd7': 'fe759df8-5d8e-401f-8fb2-dfaa3642c33c',
    '8d4d1bd6-142f-4d0f-8854-333742eeeba3': 'd5bff230-0e6a-4211-b0ce-342e8fbace51',
    'a079598f-b25d-49d6-90ce-b25146687a31': '1365d4d3-0ffb-48a8-a8a6-d3c49dd22145',
    '31d0ac07-57a9-472d-b07a-f9a26b2ba89e': '636cb5d4-1316-4382-90db-fa6c16deb1f4',
    'c8638c23-cd35-4c11-8333-4316f1ca4726': '7b039929-1af2-46ab-9a91-f051497161e7',
    'd8262b01-07d0-4795-ba31-e64c6eaf6f0f': '02ffd51e-da3f-45fa-b2a5-92acc254e2a6',
    '43d0b751-da8d-4181-aabc-ba3b217142bc': '3b967967-d7de-48bb-9f03-5e779aa15a27',
    'd37bd3b0-35a0-48be-81b9-9816686137b1': 'fa08fd1a-43af-4f4d-9f52-8eb0b5abf1ca',
  }
// ⭐ 2026-05-11 — Mapping servizi collettivi BA → NS3000
  // Necessario perché il proxy /api/ns3000/bookings non sa convertire
  // da soli gli UUID dei servizi tra i due DB.
  // Espandi questo map quando aggiungi nuovi servizi BA con corrispondente NS3000.
  const BA_TO_NS3000_SERVICE_MAP: Record<string, string> = {
    'ad5bf90a-14f1-4211-851a-a6bcb4900f5f': 'ee21f2a6-51e2-483c-97b9-e45da67be9fb', // 04 - Tour Amalfi-Positano Collettivo → NS3000 Amalfi e Positano Collettivo FD
    '4357c28f-a028-4f8f-8a0f-8a9c0c5a5526': '9799c07d-d9bb-490a-8ba1-df9481396ec8', // 06 - Tour Collettivo Capri → NS3000 Capri Collettivo FD
    '896ac71f-0b00-4180-a064-2cd939a37dcd': 'a34a2cc9-544a-40f5-8d96-5ea00ab93435', // 02 - Privato Amalfi → NS3000 Tour Privato Amalfi FD e HD
    'bfdb6dd4-2548-4dcd-a643-15c7724fd12f': 'c051043e-d3b3-407c-98db-bb9f08c2c437', // 03 - Privato Amalfi-Positano → NS3000 Tour Privato Amalfi e Positano FD
    'ac8e2bce-157c-4d92-b55a-7f89b5f7aad8': '68d4b6b6-d31b-45af-a76d-9ab1dc1fd54b', // 05 - Privato Capri → NS3000 Tour Privato Capri Full Day
    '9d75d2c1-4981-41a5-9199-01df2a2cb358': '79983c13-ab97-46bb-8b72-39365afa2bbf', // 07 - Locazione → NS3000 Locazione Self Drive
    '1a6534b7-0efc-4d7f-93e3-cbb45e1998a7': '96ae1f15-19fd-413f-885b-99670a08dba8', // 09 - Transfer → NS3000 Taxi Boat
  }
  const [servizi, setServizi] = useState<any[]>([])
  const [imbarcazioni, setImbarcazioni] = useState<any[]>([])
  const [fornitori, setFornitori] = useState<any[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)

  const [boatSource, setBoatSource] = useState<'locale' | 'ns3000' | 'esterna'>(initialBoatSource || 'locale')
  const [ns3000Boats, setNs3000Boats] = useState<any[]>([])
  const [ns3000BoatId, setNs3000BoatId] = useState(initialNs3000BoatId || '')
  const [ns3000TimeSlot, setNs3000TimeSlot] = useState<'full_day' | 'morning' | 'afternoon'>('full_day')
  const [ns3000Availability, setNs3000Availability] = useState<any>(null)
  const [checkingAvailability, setCheckingAvailability] = useState(false)

  // ⭐ Navi da crociera in scalo nella data selezionata
  const [naviInScalo, setNaviInScalo] = useState<Array<{ id: number; nome_nave: string; capienza_pax: number }>>([])
  const [loadingNavi, setLoadingNavi] = useState(false)

  // Cliente inline
  const [clienteForm, setClienteForm] = useState({
    nome: '', cognome: '', email: '', telefono: '', nazione: 'IT',
    tipo_documento: '', numero_documento: '', scadenza_documento: '',
    patente_nautica: '', scadenza_patente_nautica: ''
  })
  const [clienteEsistente, setClienteEsistente] = useState(false)
  const [nazioneManuale, setNazioneManuale] = useState(false)
  

  const [formData, setFormData] = useState({
    codice_prenotazione: '', cliente_id: '', servizio_id: '', imbarcazione_id: '',
    barca_esterna_nome: '', fornitore_id: '', percentuale_commissione_override: '',
    data_servizio: '', ora_inizio: '', numero_persone: 1,
    bambini_over_3: 0, bambini_under_3: 0,
    stato: 'in_attesa',
    prezzo_totale: 0, caparra_ricevuta: 0, saldo_ricevuto: 0,
    metodo_pagamento: '', metodo_pagamento_caparra: '', metodo_pagamento_saldo: '',
    payment_lines: [] as Array<{amount: number, method: string, date: string}>,
    lingua: 'it', note_cliente: '', note_interne: '', porto_imbarco: '', ora_imbarco: '',
    nave_id: '' as string | number
  })

  const [saving, setSaving] = useState(false)
  const daRicevere = Math.max(0, (formData.prezzo_totale || 0) - (formData.caparra_ricevuta || 0) - (formData.saldo_ricevuto || 0) - (formData.payment_lines || []).reduce((s: number, l: any) => s + (Number(l.amount) || 0), 0))

  // ⭐ REGIME FORFETTARIO: se la barca appartiene a un fornitore forfettario,
  // il socio incassa direttamente dal cliente e BA fattura solo la commissione.
  // Il fornitore si ricava dalla barca locale (imbarcazioni.fornitore_id) o dal
  // fornitore_id diretto (barche esterne/ns3000).
  const fornitoreCorrente = (() => {
    // barca locale → fornitore della barca
    if (formData.imbarcazione_id) {
      const barca = imbarcazioni.find(i => i.id === formData.imbarcazione_id)
      if (barca?.fornitore_id) return fornitori.find(f => f.id === barca.fornitore_id)
    }
    // fornitore_id diretto (esterna/ns3000)
    if (formData.fornitore_id) return fornitori.find(f => f.id === formData.fornitore_id)
    return null
  })()
  const isForfettario = !!fornitoreCorrente?.forfettario
  const commissionePerc = fornitoreCorrente?.percentuale_commissione != null
    ? Number(fornitoreCorrente.percentuale_commissione)
    : 18
  const commissioneForfettaria = isForfettario
    ? Math.round((formData.prezzo_totale || 0) * commissionePerc) / 100
    : 0


  useEffect(() => { if (isOpen) loadOptions() }, [isOpen])

  // ⭐ Forfettario: azzera i campi di pagamento cliente (BA non incassa dal cliente,
  // il socio incassa direttamente). Il prezzo_totale resta come base per la commissione.
  useEffect(() => {
    if (isForfettario) {
      setFormData(prev => {
        if ((prev.caparra_ricevuta || 0) === 0 && (prev.saldo_ricevuto || 0) === 0 && (!prev.payment_lines || prev.payment_lines.length === 0) && prev.metodo_pagamento === 'forfettario') {
          return prev // già normalizzato, evita loop
        }
        return { ...prev, caparra_ricevuta: 0, saldo_ricevuto: 0, payment_lines: [], metodo_pagamento: 'forfettario' }
      })
    }
  }, [isForfettario])

  useEffect(() => {
    if (isOpen && prenotazione) {
      setReviewSentAt((prenotazione as any)?.google_review_sent_at || null)
      setFormData({
        codice_prenotazione: prenotazione.codice_prenotazione || '',
        cliente_id: prenotazione.cliente_id || '',
        servizio_id: prenotazione.servizio_id || '',
        imbarcazione_id: prenotazione.imbarcazione_id || '',
        barca_esterna_nome: prenotazione.barca_esterna_nome || '',
        fornitore_id: prenotazione.fornitore_id || '',
        percentuale_commissione_override: prenotazione.percentuale_commissione_override ?? '',
        data_servizio: prenotazione.data_servizio || '',
        ora_inizio: prenotazione.ora_inizio || '',
       numero_persone: prenotazione.numero_persone || 1,
        bambini_over_3: prenotazione.bambini_over_3 || 0,
        bambini_under_3: prenotazione.bambini_under_3 || 0,
        stato: prenotazione.stato || 'in_attesa',
        prezzo_totale: prenotazione.prezzo_totale || 0,
        caparra_ricevuta: prenotazione.caparra_ricevuta || 0,
        saldo_ricevuto: prenotazione.saldo_ricevuto || 0,
        metodo_pagamento: prenotazione.metodo_pagamento || '',
        metodo_pagamento_caparra: prenotazione.metodo_pagamento_caparra || '',
        metodo_pagamento_saldo: prenotazione.metodo_pagamento_saldo || '',
        payment_lines: (prenotazione as any).payment_lines || [],
        lingua: prenotazione.lingua || 'it',
        note_cliente: prenotazione.note_cliente || '',
        note_interne: prenotazione.note_interne || '',
        porto_imbarco: prenotazione.porto_imbarco || '',
        ora_imbarco: prenotazione.ora_imbarco || '',
        nave_id: prenotazione.nave_id ?? ''
      })

      // ← FIX: ripristina stato NS3000 se la prenotazione viene da NS3000
      const isNs3000 =
        prenotazione.source === 'ns3000' ||
        !!prenotazione.ns3000_booking_id ||
        !!prenotazione.ns3000_booking_number
      if (prenotazione.barca_esterna_nome && !prenotazione.imbarcazione_id) {
        // Barca fuori flotta: nome libero salvato sulla prenotazione
        setBoatSource('esterna')
        setNs3000BoatId('')
      } else if (isNs3000) {
        setBoatSource('ns3000')
        const mappedNs3000Id = prenotazione.imbarcazione_id
          ? BA_TO_NS3000_MAP[prenotazione.imbarcazione_id]
          : null
        setNs3000BoatId(mappedNs3000Id || prenotazione.ns3000_boat_id || '')
        setNs3000TimeSlot(prenotazione.ns3000_time_slot || 'full_day')
      } else {
        setBoatSource('locale')
        setNs3000BoatId('')
      }

      if (prenotazione.clienti) {
        const c = prenotazione.clienti
        setClienteForm({
          nome: c.nome || '', cognome: c.cognome || '', email: c.email || '',
          telefono: c.telefono || '', nazione: c.nazione || 'IT',
          tipo_documento: c.tipo_documento || '', numero_documento: c.numero_documento || '',
          scadenza_documento: c.scadenza_documento || '', patente_nautica: c.patente_nautica || '',
          scadenza_patente_nautica: c.scadenza_patente_nautica || ''
        })
        setClienteEsistente(true)
        setNazioneManuale(!['IT','GB','US','FR','DE','ES','NL','CH'].includes(c.nazione || 'IT'))
      }
    } else if (isOpen && !prenotazione) {
 setFormData({
        codice_prenotazione: generateCodice(), cliente_id: '', servizio_id: '',
        imbarcazione_id: initialImbarcazioneId || '', barca_esterna_nome: '', fornitore_id: '', percentuale_commissione_override: '', data_servizio: initialDate || '',
        ora_inizio: '', numero_persone: 1,
        bambini_over_3: 0, bambini_under_3: 0,
        stato: 'in_attesa', prezzo_totale: 0,
        caparra_ricevuta: 0, saldo_ricevuto: 0, metodo_pagamento: '',
        metodo_pagamento_caparra: '', metodo_pagamento_saldo: '', payment_lines: [], lingua: 'it',
       note_cliente: '', note_interne: '', porto_imbarco: '', ora_imbarco: '',
        nave_id: ''
      })
      setNaviInScalo([])
      setBoatSource(initialBoatSource || 'locale')
      setNs3000BoatId(initialNs3000BoatId || '')
      setNs3000TimeSlot('full_day')
      setNs3000Availability(null)
      setClienteForm({ nome: '', cognome: '', email: '', telefono: '', nazione: 'IT', tipo_documento: '', numero_documento: '', scadenza_documento: '', patente_nautica: '', scadenza_patente_nautica: '' })
      setClienteEsistente(false)
      setNazioneManuale(false)
    }
  }, [isOpen, prenotazione?.id])

  async function loadOptions() {
    try {
      setLoadingOptions(true)
      const [serviziRes, imbarcazioniRes, serviziAssociatiRes, fornitoriRes] = await Promise.all([
        supabase.from('servizi').select('id, nome, tipo').eq('attivo', true).order('nome'),
       supabase.from('imbarcazioni').select('id, nome, tipo, categoria, fornitore_id, minimo_pax_collettivo').eq('attiva', true).order('nome'),
        supabase.from('vista_imbarcazioni_servizi_con_prezzi').select('imbarcazione_id, servizio_id, servizio_tipo, prezzo_finale'),
        supabase.from('fornitori').select('id, ragione_sociale, percentuale_commissione, forfettario').eq('attivo', true).order('ragione_sociale')
      ])
      setFornitori(fornitoriRes.data || [])
      setServizi(serviziRes.data || [])
      const serviziAssociati = serviziAssociatiRes.data || []
      const imbConPrezzi = (imbarcazioniRes.data || []).map(imb => ({
        ...imb,
        prezzi_servizi: serviziAssociati.filter(sa => sa.imbarcazione_id === imb.id)
          .reduce((acc: any, sa: any) => { if (sa.prezzo_finale) { acc[sa.servizio_id] = sa.prezzo_finale; acc[sa.servizio_tipo] = sa.prezzo_finale } return acc }, {})
      }))
      setImbarcazioni(imbConPrezzi)
      try {
        const ns3000Res = await fetch('/api/ns3000/availability?date=' + (formData.data_servizio || new Date().toISOString().split('T')[0]))
        if (ns3000Res.ok) { const d = await ns3000Res.json(); setNs3000Boats(d.boats || []) }
      } catch (err) { console.error('NS3000 load error:', err) }
    } catch (error) { console.error('Errore:', error); toast.error('Errore nel caricamento') }
    finally { setLoadingOptions(false) }
  }

  useEffect(() => {
    if (boatSource === 'ns3000' && ns3000BoatId && formData.data_servizio) checkNs3000Availability()
  }, [ns3000BoatId, formData.data_servizio, boatSource])

  // ⭐ Carica le navi da crociera in scalo nella data selezionata
  useEffect(() => {
    if (!isOpen) return
    if (!formData.data_servizio) { setNaviInScalo([]); return }

    let annullato = false
    setLoadingNavi(true)

    fetch(`/api/arrivi-navi?data=${formData.data_servizio}`)
      .then(res => res.ok ? res.json() : [])
      .then((navi: any) => {
        if (annullato) return
        const lista = Array.isArray(navi) ? navi : []
        setNaviInScalo(lista)

        // Nave unica in scalo: preseleziona (zero click per l'operatore)
        // SOLO per prenotazioni NUOVE: in modifica va rispettata la scelta salvata,
        // inclusa "non crocierista" (nave_id vuoto), che altrimenti verrebbe
        // sovrascritta con la nave del giorno alla riapertura.
        if (!isEdit && lista.length === 1 && !formData.nave_id) {
          setFormData(prev => ({ ...prev, nave_id: lista[0].id }))
          return
        }
        // La nave selezionata non è in scalo in questa data: azzera.
        // Anche questo solo per nuove prenotazioni o se l'utente cambia data:
        // in apertura di una modifica non deve azzerare la scelta salvata.
        if (formData.nave_id && !lista.some((n: any) => n.id === Number(formData.nave_id))) {
          setFormData(prev => ({ ...prev, nave_id: '' }))
        }
      })
      .catch(() => { if (!annullato) setNaviInScalo([]) })
      .finally(() => { if (!annullato) setLoadingNavi(false) })

    return () => { annullato = true }
  }, [isOpen, formData.data_servizio])

  async function checkNs3000Availability() {
    try {
      setCheckingAvailability(true)
      const res = await fetch(`/api/ns3000/availability?date=${formData.data_servizio}&boat_id=${ns3000BoatId}`)
      if (res.ok) { const d = await res.json(); const boat = d.boats?.[0]; if (boat) setNs3000Availability(boat.availability?.[formData.data_servizio] || null) }
    } catch (err) { console.error('Check disponibilità:', err) }
    finally { setCheckingAvailability(false) }
  }

  async function cercaClientePerEmail(email: string) {
    if (!email || email.length < 5) return
    try {
      const res = await authFetch(`/api/clienti?email=${encodeURIComponent(email)}&limit=1`)
      if (!res.ok) return
      const { clienti } = await res.json()
      if (clienti && clienti.length > 0) {
        const c = clienti[0]
        setFormData(prev => ({ ...prev, cliente_id: c.id }))
        setClienteForm({
          nome: c.nome || '', cognome: c.cognome || '', email: c.email || '',
          telefono: c.telefono || '', nazione: c.nazione || 'IT',
          tipo_documento: c.tipo_documento || '', numero_documento: c.numero_documento || '',
          scadenza_documento: c.scadenza_documento || '', patente_nautica: c.patente_nautica || '',
          scadenza_patente_nautica: c.scadenza_patente_nautica || ''
        })
        setClienteEsistente(true)
        setNazioneManuale(!['IT','GB','US','FR','DE','ES','NL','CH'].includes(c.nazione || 'IT'))
        toast.success(`Cliente trovato: ${c.nome} ${c.cognome}`)
      }
    } catch (e) { console.error('Errore ricerca cliente:', e) }
  }
  // Auto-set prezzo
  useEffect(() => {
    if (isEdit) return
    if (boatSource === 'locale' && formData.imbarcazione_id && formData.servizio_id) {
      const barca = imbarcazioni.find(i => i.id === formData.imbarcazione_id)
      const servizio = servizi.find(s => s.id === formData.servizio_id)
      if (barca?.prezzi_servizi) {
        const prezzoUnitario = barca.prezzi_servizi[formData.servizio_id] ?? barca.prezzi_servizi[servizio?.tipo] ?? null
        if (prezzoUnitario && prezzoUnitario > 0) {
          const isTourCollettivo = servizio?.tipo === 'tour_collettivo' || servizio?.tipo === 'taxi_boat'
          // Bambini <3 anni non pagano sui tour collettivi (occupano comunque il posto)
          const paganti = Math.max(0, (formData.numero_persone || 1) - (formData.bambini_under_3 || 0))
          const prezzoTotale = isTourCollettivo ? prezzoUnitario * paganti : prezzoUnitario
          setFormData(prev => ({ ...prev, prezzo_totale: prezzoTotale }))
        }
      }
    }
    if (boatSource === 'ns3000' && ns3000BoatId) {
      const selectedBoat = ns3000Boats.find((b: any) => b.boat_id === ns3000BoatId)
      let prezzoTrovato = 0

      // 1. Prova pricing NS3000
      if (selectedBoat?.pricing && formData.data_servizio) {
        const month = new Date(formData.data_servizio).getMonth() + 1
        let season = 'apr_may_oct'
        if (month === 6) season = 'june'
        else if (month === 7 || month === 9) season = 'july_sept'
        else if (month === 8) season = 'august'
        const slotKey = ns3000TimeSlot === 'full_day' ? 'full_day' : 'half_day'
        const pricing = selectedBoat.pricing
        prezzoTrovato = pricing.charter?.[season]?.[slotKey] || pricing.rental?.[season]?.[slotKey] || 0
        if (!prezzoTrovato) {
          for (const s of ['apr_may_oct', 'june', 'july_sept', 'august']) {
            const p = pricing.charter?.[s]?.[slotKey] || pricing.rental?.[s]?.[slotKey]
            if (p && p > 0) { prezzoTrovato = p; break }
          }
        }
      }

      // 2. Fallback: cerca prezzo locale via reverse map
      if (!prezzoTrovato && formData.servizio_id) {
        const baBoatId = Object.entries(BA_TO_NS3000_MAP).find(([_, ns]) => ns === ns3000BoatId)?.[0]
        if (baBoatId) {
          const barca = imbarcazioni.find(i => i.id === baBoatId)
          const servizio = servizi.find(s => s.id === formData.servizio_id)
          if (barca?.prezzi_servizi) {
            const prezzoUnitario = barca.prezzi_servizi[formData.servizio_id] ?? barca.prezzi_servizi[servizio?.tipo] ?? 0
            if (prezzoUnitario > 0) {
              const isTourCollettivo = servizio?.tipo === 'tour_collettivo' || servizio?.tipo === 'taxi_boat'
              // Bambini <3 anni non pagano sui tour collettivi (occupano comunque il posto)
              const paganti = Math.max(0, (formData.numero_persone || 1) - (formData.bambini_under_3 || 0))
              prezzoTrovato = isTourCollettivo ? prezzoUnitario * paganti : prezzoUnitario
            }
          }
        }
      }

      if (prezzoTrovato > 0) setFormData(prev => ({ ...prev, prezzo_totale: prezzoTrovato }))
    }
  }, [formData.imbarcazione_id, formData.servizio_id, formData.numero_persone, formData.bambini_under_3, boatSource, ns3000BoatId, ns3000TimeSlot, ns3000Boats, imbarcazioni, servizi, isEdit])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clienteForm.nome || !clienteForm.cognome) { toast.error('Nome e cognome cliente obbligatori'); return }
    if (boatSource === 'locale' && !formData.imbarcazione_id) { toast.error('Seleziona un\'imbarcazione'); return }
    if (boatSource === 'esterna' && !formData.barca_esterna_nome.trim()) { toast.error('Inserisci il nome della barca esterna'); return }
    if (boatSource === 'esterna' && !formData.fornitore_id) { toast.error('Seleziona il fornitore per la barca esterna'); return }
    if (boatSource === 'ns3000' && !ns3000BoatId) { toast.error('Seleziona una barca NS3000'); return }
    if (!formData.data_servizio) { toast.error('Seleziona una data'); return }
    if (boatSource === 'ns3000' && !clienteForm.email) { toast.error('Email cliente obbligatoria per prenotazioni NS3000'); return }
    if ((formData.bambini_over_3 + formData.bambini_under_3) > formData.numero_persone) {
      toast.error('I bambini totali non possono superare il numero di passeggeri totali')
      return
    }

    const servizioSelezionato = servizi.find(s => s.id === formData.servizio_id)
    const tipoTour = servizioSelezionato?.tipo === 'tour_collettivo' ? 'collettivo' : 'privato'
    // Validazione minimo pax collettivo
    if (servizioSelezionato?.tipo === 'tour_collettivo' && boatSource === 'locale' && formData.imbarcazione_id) {
      const barcaSel = imbarcazioni.find(i => i.id === formData.imbarcazione_id)
      if (barcaSel?.minimo_pax_collettivo && formData.numero_persone < barcaSel.minimo_pax_collettivo) {
        toast.error(`Minimo ${barcaSel.minimo_pax_collettivo} passeggeri per tour collettivo su ${barcaSel.nome}`)
        return
      }
    }

    try {
      setSaving(true)

      // ── Crea o aggiorna cliente ──
      let clienteId = formData.cliente_id
      const clienteData: any = {
        nome: clienteForm.nome.trim(), cognome: clienteForm.cognome.trim(),
        email: clienteForm.email.trim() || null, telefono: clienteForm.telefono.trim() || null,
        nazione: clienteForm.nazione || 'IT',
        tipo_documento: clienteForm.tipo_documento || null,
        numero_documento: clienteForm.numero_documento || null,
        scadenza_documento: clienteForm.scadenza_documento || null,
        patente_nautica: clienteForm.patente_nautica || null,
        scadenza_patente_nautica: clienteForm.scadenza_patente_nautica || null,
      }

      if (clienteId && clienteEsistente) {
        // Cliente già selezionato: aggiorna i dati
        const resPut = await authFetch(`/api/clienti/${clienteId}`, {
          method: 'PUT',
          body: JSON.stringify(clienteData),
        })
        if (!resPut.ok) {
          const err = await resPut.json().catch(() => ({}))
          throw new Error(err.error || 'Errore aggiornamento cliente')
        }
      } else {
        // Nuovo cliente: POST. L'API fa dedup automatica per email
        const resPost = await authFetch('/api/clienti', {
          method: 'POST',
          body: JSON.stringify(clienteData),
        })
        if (!resPost.ok) {
          const err = await resPost.json().catch(() => ({}))
          throw new Error(err.error || 'Errore creazione cliente')
        }
        const { cliente, existing } = await resPost.json()
        clienteId = cliente.id
        // Se il cliente esisteva già con questa email, allinea i dati col form
        if (existing) {
          const resPut = await authFetch(`/api/clienti/${clienteId}`, {
            method: 'PUT',
            body: JSON.stringify(clienteData),
          })
          if (!resPut.ok) console.warn('Update cliente esistente fallito')
        }
      }
      if (!clienteId) { toast.error('Errore creazione cliente'); return }

      // ── Prenotazione ──
      if (isEdit) {
        // FIX 2026-05-24 EDIT NS3000: se utente ha selezionato barca NS3000, risolvi imbarcazione_id BA
        let imbarcazioneIdResolved = formData.imbarcazione_id
        if (boatSource === 'ns3000' && ns3000BoatId) {
          const baMapped = Object.entries(BA_TO_NS3000_MAP).find(([, ns]) => ns === ns3000BoatId)?.[0]
          if (baMapped) {
            imbarcazioneIdResolved = baMapped
            console.log('🔍 EDIT NS3000: ns3000BoatId', ns3000BoatId, '-> imbarcazione_id BA:', baMapped)
          } else {
            console.warn('⚠️ Barca NS3000 senza mapping BA:', ns3000BoatId)
          }
        }
        const updateBody = {
          cliente_id: clienteId,
          servizio_id: formData.servizio_id,
          imbarcazione_id: boatSource === 'esterna' ? null : imbarcazioneIdResolved,
          barca_esterna_nome: boatSource === 'esterna' ? (formData.barca_esterna_nome.trim() || null) : null,
          fornitore_id: boatSource === 'esterna' ? (formData.fornitore_id || null) : null,
          percentuale_commissione_override: (() => {
            if (boatSource !== 'esterna') return null
            const val = formData.percentuale_commissione_override
            if (val === '' || val == null) return null
            const num = parseFloat(String(val))
            if (isNaN(num)) return null
            const forn = fornitori.find(f => f.id === formData.fornitore_id)
            if (forn && Number(forn.percentuale_commissione) === num) return null
            return num
          })(),
          data_servizio: formData.data_servizio,
          ora_inizio: formData.ora_inizio || null,
          numero_persone: formData.numero_persone,
          bambini_over_3: formData.bambini_over_3 || 0,
          bambini_under_3: formData.bambini_under_3 || 0,
          stato: formData.stato,
          prezzo_totale: formData.prezzo_totale,
          caparra_ricevuta: formData.caparra_ricevuta,
          saldo_ricevuto: formData.saldo_ricevuto,
          metodo_pagamento: formData.metodo_pagamento,
          metodo_pagamento_caparra: formData.metodo_pagamento_caparra || null,
          metodo_pagamento_saldo: formData.metodo_pagamento_saldo || null,
          payment_lines: formData.payment_lines || [],
          lingua: formData.lingua,
          note_cliente: formData.note_cliente || null,
          note_interne: formData.note_interne || null,
          porto_imbarco: formData.porto_imbarco || null,
          ora_imbarco: formData.ora_imbarco || null,
          nave_id: formData.nave_id === '' ? null : Number(formData.nave_id),
          tipo_tour: tipoTour,
        }
        console.log('🔍 BA SAVE DEBUG | formData.imbarcazione_id:', formData.imbarcazione_id)
        console.log('🔍 BA SAVE DEBUG | updateBody:', JSON.stringify(updateBody))
        const res = await authFetch(`/api/prenotazioni/${prenotazione.id}`, {
          method: 'PUT',
          body: JSON.stringify(updateBody),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Errore aggiornamento prenotazione')
        }
        toast.success('Prenotazione aggiornata!')
        trackAction('prenotazioni', 'modifica', { id: prenotazione.id })

        // ── SYNC NS3000 (fix collettivi 2026-05-30, bloccante con rollback) ──
        const baBoatMapped = BA_TO_NS3000_MAP[imbarcazioneIdResolved]
        if (baBoatMapped) {
          try {
            if (prenotazione.ns3000_booking_id) {
              const patchRes = await fetch('/api/ns3000/bookings/' + prenotazione.ns3000_booking_id, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  boat_id: baBoatMapped,
                  num_passengers: formData.numero_persone,
                  price: formData.prezzo_totale,
                  stato: formData.stato,
                  notes: formData.note_cliente || null,
                  internal_notes: formData.note_interne || null,
                  booking_date: formData.data_servizio,
                  lang: formData.lingua,
                  caparra_ricevuta: formData.caparra_ricevuta,
                  saldo_ricevuto: formData.saldo_ricevuto,
                  boarding_port: formData.porto_imbarco || null,
                  service_id: BA_TO_NS3000_SERVICE_MAP[formData.servizio_id] || null,
                }),
              })
              if (!patchRes.ok) {
                const pErr = await patchRes.json().catch(() => ({}))
                throw new Error('NS3000: ' + (pErr.message || pErr.error || 'sync modifica fallita'))
              }
            } else {
              const postRes = await fetch('/api/ns3000/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  boat_id: baBoatMapped,
                  boat_name: imbarcazioni.find(b => b.id === imbarcazioneIdResolved)?.nome || '',
                  ba_imbarcazione_id: imbarcazioneIdResolved,
                  booking_date: formData.data_servizio,
                  time_slot: 'full_day',
                  customer_name: clienteForm.nome,
                  customer_surname: clienteForm.cognome,
                  customer_email: clienteForm.email || '',
                  customer_phone: clienteForm.telefono || '',
                  num_passengers: formData.numero_persone,
                  price: formData.prezzo_totale,
                  final_price: formData.prezzo_totale,
                  notes: formData.note_cliente || null,
                  internal_notes: formData.note_interne || null,
                  external_ref: formData.codice_prenotazione,
                  service_id: BA_TO_NS3000_SERVICE_MAP[formData.servizio_id] || null,
                  servizio_id: formData.servizio_id || null,
                  porto_imbarco: formData.porto_imbarco || null,
                  service_type: tipoTour === 'collettivo' ? 'collective' : 'charter',
                  booking_type: tipoTour === 'collettivo' ? 'collective' : 'tour',
                  skip_local: true,
                  stato: formData.stato,
                  lingua: formData.lingua,
                }),
              })
              const postResult = await postRes.json().catch(() => ({}))
              if (!postRes.ok) {
                throw new Error('NS3000: ' + (postResult.message || postResult.error || 'creazione fallita'))
              }
              const nuovoNsId = postResult.ns3000_booking?.id || null
              if (nuovoNsId) {
                await authFetch('/api/prenotazioni/' + prenotazione.id, {
                  method: 'PUT',
                  body: JSON.stringify({ ns3000_booking_id: nuovoNsId }),
                })
              }
            }
          } catch (nsErr: any) {
            // ROLLBACK BA: ripristina i valori originali della prenotazione
            await authFetch('/api/prenotazioni/' + prenotazione.id, {
              method: 'PUT',
              body: JSON.stringify({
                numero_persone: prenotazione.numero_persone,
                prezzo_totale: prenotazione.prezzo_totale,
                stato: prenotazione.stato,
              }),
            }).catch(() => {})
            throw new Error((nsErr.message || 'Errore sync NS3000') + ' — modifica annullata.')
          }
        }
      } else if (boatSource === 'ns3000') {
        const selectedBoat = ns3000Boats.find(b => b.boat_id === ns3000BoatId)
        // Risolvi BA-id dalla NS3000-id selezionata (se la barca è mappata)
        const baImbarcazioneId = Object.entries(BA_TO_NS3000_MAP).find(([, ns]) => ns === ns3000BoatId)?.[0] || null

        const ns3000Payload = {
          boat_id: ns3000BoatId,
          boat_name: selectedBoat?.name || '',
          ba_imbarcazione_id: baImbarcazioneId,
          booking_date: formData.data_servizio,
          time_slot: ns3000TimeSlot,
          customer_name: clienteForm.nome,
          customer_surname: clienteForm.cognome,
          customer_email: clienteForm.email || '',
          customer_phone: clienteForm.telefono || '',
          num_passengers: formData.numero_persone,
          price: formData.prezzo_totale,
          notes: formData.note_cliente || '',
          internal_notes: formData.note_interne || '',
          cliente_id: clienteId,
          servizio_id: formData.servizio_id || null,
          // ⭐ 2026-05-11 — Mappa il servizio BA al corrispondente NS3000 (se mappato)
          service_id: BA_TO_NS3000_SERVICE_MAP[formData.servizio_id] || null,
          service_type: tipoTour === 'collettivo' ? 'collective' : 'charter',
          ora_inizio: formData.ora_inizio || null,
          lingua: formData.lingua,
          porto_imbarco: formData.porto_imbarco || null,
          ora_imbarco: formData.ora_imbarco || null,
          booking_type: tipoTour,
          // ← FIX: campi pagamento + stato
          stato: formData.stato,
          metodo_pagamento: formData.metodo_pagamento || 'contanti',
          caparra_ricevuta: formData.caparra_ricevuta || 0,
          saldo_ricevuto: formData.saldo_ricevuto || 0,
          metodo_pagamento_caparra: formData.metodo_pagamento_caparra || null,
          metodo_pagamento_saldo: formData.metodo_pagamento_saldo || null,
          payment_lines: formData.payment_lines || [],
         caparra_dovuta: (formData.prezzo_totale || 0) * 0.3,
          // ⭐ 2026-05-14 — Documento cliente
          tipo_documento: clienteForm.tipo_documento || null,
          numero_documento: clienteForm.numero_documento || null,
          scadenza_documento: clienteForm.scadenza_documento || null,
          patente_nautica: clienteForm.patente_nautica || null,
          scadenza_patente_nautica: clienteForm.scadenza_patente_nautica || null,
          nazione_cliente: clienteForm.nazione || 'IT',
          // ⭐ 2026-05-14 — Canale operativo
          booking_source: 'blualliance',
          // ⭐ Nave di provenienza (salvata sul record BA locale)
          nave_id: formData.nave_id === '' ? null : Number(formData.nave_id),
        }
        const res = await fetch('/api/ns3000/bookings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ns3000Payload)
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.message || 'Errore NS3000')
        toast.success(`Prenotazione NS3000 creata! ${result.ns3000_booking?.booking_number || ''}`)
        trackAction('prenotazioni', 'crea_ns3000', { booking_number: result.ns3000_booking?.booking_number })
        if (result.local_booking?.id) inviaNotifiche(result.local_booking.id, formData.lingua || 'it')

      } else {
        // Prenotazione locale BA
        const insertBody = {
          codice_prenotazione: formData.codice_prenotazione,
          cliente_id: clienteId,
          servizio_id: formData.servizio_id,
          imbarcazione_id: boatSource === 'esterna' ? null : formData.imbarcazione_id,
          barca_esterna_nome: boatSource === 'esterna' ? (formData.barca_esterna_nome.trim() || null) : null,
          fornitore_id: boatSource === 'esterna' ? (formData.fornitore_id || null) : null,
          percentuale_commissione_override: (() => {
            if (boatSource !== 'esterna') return null
            const val = formData.percentuale_commissione_override
            if (val === '' || val == null) return null
            const num = parseFloat(String(val))
            if (isNaN(num)) return null
            const forn = fornitori.find(f => f.id === formData.fornitore_id)
            if (forn && Number(forn.percentuale_commissione) === num) return null
            return num
          })(),
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
          payment_lines: formData.payment_lines || [],
          lingua: formData.lingua,
          note_cliente: formData.note_cliente || null,
          note_interne: formData.note_interne || null,
          porto_imbarco: formData.porto_imbarco || null,
         ora_imbarco: formData.ora_imbarco || null,
          nave_id: formData.nave_id === '' ? null : Number(formData.nave_id),
          tipo_tour: tipoTour,
        }
        const resCreate = await authFetch('/api/prenotazioni', {
          method: 'POST',
          body: JSON.stringify(insertBody),
        })
        if (!resCreate.ok) {
          const err = await resCreate.json().catch(() => ({}))
          throw new Error(err.error || 'Errore creazione prenotazione')
        }
        const { prenotazione: nuovaPrenotazione } = await resCreate.json()
        toast.success('Prenotazione creata!')
        trackAction('prenotazioni', 'crea', { codice: formData.codice_prenotazione })

        // ── Sync NS3000 se barca mappata (INVARIATO) ──
        const ns3000BoatIdMapped = BA_TO_NS3000_MAP[formData.imbarcazione_id]
        if (ns3000BoatIdMapped) {
          try {
            const syncRes = await fetch('/api/ns3000/bookings', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                boat_id: ns3000BoatIdMapped,
                boat_name: imbarcazioni.find(b => b.id === formData.imbarcazione_id)?.nome || '',
                ba_imbarcazione_id: formData.imbarcazione_id,
                booking_date: formData.data_servizio,
                time_slot: 'full_day',
                customer_name: clienteForm.nome,
                customer_surname: clienteForm.cognome,
                customer_email: clienteForm.email || '',
                customer_phone: clienteForm.telefono || '',
                num_passengers: formData.numero_persone,
                price: formData.prezzo_totale,
                final_price: formData.prezzo_totale,
                notes: formData.note_cliente || null,
                internal_notes: formData.note_interne || null,
                external_ref: formData.codice_prenotazione,
                service_id: BA_TO_NS3000_SERVICE_MAP[formData.servizio_id] || null,
                servizio_id: formData.servizio_id || null,
                porto_imbarco: formData.porto_imbarco || null,
                service_type: tipoTour === 'collettivo' ? 'collective' : 'charter',
                booking_type: tipoTour === 'collettivo' ? 'collective' : 'tour',
                skip_local: true,
                stato: formData.stato,
                metodo_pagamento: formData.metodo_pagamento || 'contanti',
                caparra_ricevuta: formData.caparra_ricevuta || 0,
                saldo_ricevuto: formData.saldo_ricevuto || 0,
                metodo_pagamento_caparra: formData.metodo_pagamento_caparra || null,
                metodo_pagamento_saldo: formData.metodo_pagamento_saldo || null,
                ccaparra_dovuta: (formData.prezzo_totale || 0) * 0.3,
                tipo_documento: clienteForm.tipo_documento || null,
                numero_documento: clienteForm.numero_documento || null,
                scadenza_documento: clienteForm.scadenza_documento || null,
                patente_nautica: clienteForm.patente_nautica || null,
                scadenza_patente_nautica: clienteForm.scadenza_patente_nautica || null,
                nazione_cliente: clienteForm.nazione || 'IT',
                booking_source: 'blualliance',
              })
            })
            const syncResult = await syncRes.json()
            if (!syncRes.ok) console.warn('[BA→NS3000] Sync failed:', syncResult)
          } catch (syncErr) { console.warn('[BA→NS3000] Sync error:', syncErr) }
        }

        // L'ID lo abbiamo già dalla POST response, niente SELECT successivo
        if (nuovaPrenotazione?.id) inviaNotifiche(nuovaPrenotazione.id, formData.lingua || 'it')
        }

      onSave()
      onClose()
    } catch (error: any) {
      console.error('Errore salvataggio:', error)
      toast.error(error.message || 'Errore nel salvataggio')
    } finally { setSaving(false) }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[95vh] flex flex-col mx-2 md:mx-0">

        {/* Header */}
        <div className="p-3 md:p-4 border-b flex items-center justify-between bg-white rounded-t-xl flex-shrink-0">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900">{isEdit ? 'Modifica Prenotazione' : 'Nuova Prenotazione'}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-gray-500">{formData.codice_prenotazione}</p>
              {formData.servizio_id && servizi.find(s => s.id === formData.servizio_id)?.tipo === 'tour_collettivo' && (
                <span className="text-xs px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full font-medium">👥 Collettivo</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-2">×</button>
        </div>

        {/* Form */}
        <div className="overflow-y-auto flex-1">
          <form id="booking-form" onSubmit={handleSubmit} className="p-3 md:p-4">
            {loadingOptions ? (
              <div className="text-center py-8 text-gray-600">Caricamento...</div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {servizi.find(s => s.id === formData.servizio_id)?.tipo === 'tour_collettivo' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 leading-relaxed">
                    💡 <strong>Tour collettivo</strong>: per un <strong>nuovo gruppo</strong> di clienti crea una <strong>nuova prenotazione</strong> (stesso tour e data). Modifica questa solo per correggere i dati di questo gruppo. Le modifiche si sincronizzano automaticamente con NS3000.
                  </div>
                )}

                {/* ── CLIENTE INLINE ── */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-700">👤 Dati Cliente</label>
                    {clienteEsistente && <span className="text-[10px] text-green-600 font-medium">✅ Cliente esistente</span>}
                    {!clienteEsistente && clienteForm.nome && <span className="text-[10px] text-blue-600 font-medium">🆕 Nuovo cliente</span>}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <input type="text" value={clienteForm.nome} onChange={(e) => setClienteForm(prev => ({ ...prev, nome: e.target.value }))}
                        placeholder="Nome *" className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" />
                    </div>
                    <div>
                      <input type="text" value={clienteForm.cognome} onChange={(e) => setClienteForm(prev => ({ ...prev, cognome: e.target.value }))}
                        placeholder="Cognome *" className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" />
                    </div>
                    <div>
                      <input type="email" value={clienteForm.email}
                        onChange={(e) => setClienteForm(prev => ({ ...prev, email: e.target.value }))}
                        onBlur={(e) => cercaClientePerEmail(e.target.value)}
                        placeholder="Email (cerca auto)" className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" />
                    </div>
                    <div>
                      <input type="tel" value={clienteForm.telefono} onChange={(e) => setClienteForm(prev => ({ ...prev, telefono: e.target.value }))}
                        placeholder="Telefono" className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
                   <div>
                      {!nazioneManuale ? (
                        <select value={clienteForm.nazione} onChange={(e) => {
                          if (e.target.value === 'altro') { setNazioneManuale(true); setClienteForm(prev => ({ ...prev, nazione: '' })) }
                          else setClienteForm(prev => ({ ...prev, nazione: e.target.value }))
                        }}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]">
                          <option value="IT">🇮🇹 Italia</option><option value="GB">🇬🇧 UK</option>
                          <option value="US">🇺🇸 USA</option><option value="FR">🇫🇷 Francia</option>
                          <option value="DE">🇩🇪 Germania</option><option value="ES">🇪🇸 Spagna</option>
                          <option value="NL">🇳🇱 Olanda</option><option value="CH">🇨🇭 Svizzera</option>
                          <option value="altro">✏️ Altro...</option>
                        </select>
                      ) : (
                        <div className="flex gap-1">
                          <input type="text" value={clienteForm.nazione}
                            onChange={(e) => setClienteForm(prev => ({ ...prev, nazione: e.target.value.toUpperCase() }))}
                            placeholder="Es. BR, AU, JP..."
                            className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                            maxLength={3} autoFocus />
                          <button type="button" onClick={() => { setNazioneManuale(false); setClienteForm(prev => ({ ...prev, nazione: 'IT' })) }}
                            className="px-2 py-1 text-xs text-gray-500 hover:text-blue-600 border border-gray-300 rounded h-[34px]" title="Torna alla lista">↩</button>
                        </div>
                      )}
                    </div>
                    <div>
                      <select value={clienteForm.tipo_documento}onChange={(e) => setClienteForm(prev => ({ ...prev, tipo_documento: e.target.value }))}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]">
                        <option value="">Doc. ID</option>
                        <option value="carta_identita">🪪 CI</option>
                        <option value="passaporto">📘 Passaporto</option>
                        <option value="patente">🚗 Patente</option>
                      </select>
                    </div>
                    <div>
                      <input type="text" value={clienteForm.numero_documento} onChange={(e) => setClienteForm(prev => ({ ...prev, numero_documento: e.target.value }))}
                        placeholder="N° Doc" className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" />
                    </div>
                    <div>
                      <input type="text" value={clienteForm.patente_nautica} onChange={(e) => setClienteForm(prev => ({ ...prev, patente_nautica: e.target.value }))}
                        placeholder="Pat. Nautica" className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" />
                    </div>
                    <div>
                      <input type="date" value={clienteForm.scadenza_patente_nautica} onChange={(e) => setClienteForm(prev => ({ ...prev, scadenza_patente_nautica: e.target.value }))}
                        title="Scad. Patente" className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" />
                    </div>
                  </div>
                </div>

                {/* ── IMBARCAZIONE ── */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Imbarcazione *</label>
                  <div className="flex gap-1 mb-1.5">
                      <button type="button" onClick={() => { setBoatSource('locale'); setNs3000BoatId(''); setNs3000Availability(null) }}
                        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${boatSource === 'locale' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>🚤 Locale</button>
                      <button type="button" onClick={() => { setBoatSource('ns3000'); setFormData(prev => ({ ...prev, imbarcazione_id: '', barca_esterna_nome: '' })) }}
                        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${boatSource === 'ns3000' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>⛵ NS3000</button>
                      <button type="button" onClick={() => { setBoatSource('esterna'); setNs3000BoatId(''); setNs3000Availability(null); setFormData(prev => ({ ...prev, imbarcazione_id: '' })) }}
                        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${boatSource === 'esterna' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>🆕 Esterna</button>
                    </div>
                  {boatSource === 'esterna' ? (
                    <div>
                      <input
                        type="text"
                        value={formData.barca_esterna_nome}
                        onChange={(e) => setFormData(prev => ({ ...prev, barca_esterna_nome: e.target.value }))}
                        placeholder="Nome barca (es. Sessa 42 - Marina)"
                        className="w-full px-2 py-1.5 border border-amber-300 rounded text-sm h-[34px] bg-amber-50"
                        required
                      />
                      <select
                        value={formData.fornitore_id}
                        onChange={(e) => {
                          const fid = e.target.value
                          const forn = fornitori.find(f => f.id === fid)
                          setFormData(prev => ({
                            ...prev,
                            fornitore_id: fid,
                            percentuale_commissione_override: forn?.percentuale_commissione != null ? String(forn.percentuale_commissione) : ''
                          }))
                        }}
                        className="w-full mt-1.5 px-2 py-1.5 border border-amber-300 rounded text-sm h-[34px] bg-amber-50"
                        required
                      >
                        <option value="">Seleziona fornitore...</option>
                        {fornitori.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.ragione_sociale}{f.percentuale_commissione ? ` (${f.percentuale_commissione}%)` : ''}
                          </option>
                        ))}
                      </select>
                      <div className="mt-1.5">
                        <label className="block text-[11px] text-amber-800 mb-0.5">% Commissione consorzio</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={formData.percentuale_commissione_override}
                          onChange={(e) => setFormData(prev => ({ ...prev, percentuale_commissione_override: e.target.value }))}
                          placeholder="es. 18"
                          className="w-full px-2 py-1.5 border border-amber-300 rounded text-sm h-[34px] bg-amber-50"
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-amber-700">
                        Barca non in flotta: si precompila con la percentuale del fornitore, modificabile per accordi specifici.
                      </p>
                    </div>
                  ) : boatSource === 'locale' ? (
                    <select value={formData.imbarcazione_id} onChange={(e) => setFormData(prev => ({ ...prev, imbarcazione_id: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" required={boatSource === 'locale'}>
                      <option value="">Seleziona...</option>
                      {imbarcazioni.filter(b => !BA_IDS_IN_NS3000.has(b.id)).map(b => (
                        <option key={b.id} value={b.id}>{b.nome} ({b.categoria})</option>
                      ))}
                    </select>
                  ) : (
                    <div>
                      <select value={ns3000BoatId} onChange={(e) => setNs3000BoatId(e.target.value)}
                        className="w-full px-2 py-1.5 border border-indigo-300 rounded text-sm h-[34px] bg-indigo-50">
                        <option value="">Seleziona barca NS3000...</option>
                        {ns3000Boats.map(b => (<option key={b.boat_id} value={b.boat_id}>{b.name} ({b.boat_type} · max {b.max_passengers}p)</option>))}
                      </select>
                      {ns3000BoatId && (
                        <div className="mt-1.5 flex gap-1.5 items-center">
                          <select value={ns3000TimeSlot} onChange={(e) => setNs3000TimeSlot(e.target.value as any)}
                            className="px-2 py-1 border border-indigo-300 rounded text-xs bg-white">
                            <option value="full_day">Giornata Intera</option><option value="morning">Solo Mattina</option><option value="afternoon">Solo Pomeriggio</option>
                          </select>
                          {checkingAvailability && <span className="text-xs text-indigo-500">Verifica...</span>}
                          {ns3000Availability && !checkingAvailability && (
                            <span className={`text-xs font-medium ${ns3000Availability.slots?.[ns3000TimeSlot] ? 'text-green-600' : 'text-red-600'}`}>
                              {ns3000Availability.slots?.[ns3000TimeSlot] ? '✅ Disponibile' : '❌ Non disponibile'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── SERVIZIO + PAX + BAMBINI ── */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Servizio *</label>
                  <select value={formData.servizio_id} onChange={(e) => setFormData(prev => ({ ...prev, servizio_id: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" required>
                    <option value="">Seleziona...</option>
                    {servizi.map(s => (<option key={s.id} value={s.id}>{s.nome}{s.tipo === 'tour_collettivo' ? ' 👥' : ''}</option>))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2 md:gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Pax totali *</label>
                    <input type="number" min="1" value={formData.numero_persone}
                      onChange={(e) => setFormData(prev => ({ ...prev, numero_persone: parseInt(e.target.value) || 1 }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" />
                    {(() => {
                      const srv = servizi.find(s => s.id === formData.servizio_id)
                      const brc = imbarcazioni.find(i => i.id === formData.imbarcazione_id)
                      if (srv?.tipo === 'tour_collettivo' && brc?.minimo_pax_collettivo && formData.numero_persone < brc.minimo_pax_collettivo) {
                        return <p className="text-[10px] text-red-600 mt-0.5">⚠️ Min {brc.minimo_pax_collettivo} pax</p>
                      }
                      return null
                    })()}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Bambini &gt; 3 anni</label>
                    <input type="number" min="0" value={formData.bambini_over_3}
                      onChange={(e) => setFormData(prev => ({ ...prev, bambini_over_3: parseInt(e.target.value) || 0 }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Bambini &lt; 3 anni</label>
                    <input type="number" min="0" value={formData.bambini_under_3}
                      onChange={(e) => setFormData(prev => ({ ...prev, bambini_under_3: parseInt(e.target.value) || 0 }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" />
                    {(() => {
                      const srv = servizi.find(s => s.id === formData.servizio_id)
                      const isCollettivo = srv?.tipo === 'tour_collettivo' || srv?.tipo === 'taxi_boat'
                      if (isCollettivo && formData.bambini_under_3 > 0) {
                        return <p className="text-[10px] text-green-600 mt-0.5">✓ Non pagano</p>
                      }
                      return null
                    })()}
                  </div>
                </div>
                {(formData.bambini_over_3 + formData.bambini_under_3) > formData.numero_persone && (
                  <p className="text-xs text-red-600">⚠️ I bambini ({formData.bambini_over_3 + formData.bambini_under_3}) superano il totale pax ({formData.numero_persone})</p>
                )}

                {/* ── DATA + ORA + PORTO + STATO + LINGUA ── */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 md:gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Data *</label>
                    <input type="date" value={formData.data_servizio} onChange={(e) => setFormData(prev => ({ ...prev, data_servizio: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Ora Imbarco</label>
                    <input type="time" value={formData.ora_imbarco || formData.ora_inizio}
                      onChange={(e) => setFormData(prev => ({ ...prev, ora_imbarco: e.target.value, ora_inizio: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Porto Imbarco</label>
                    <select value={formData.porto_imbarco} onChange={(e) => setFormData(prev => ({ ...prev, porto_imbarco: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]">
                      <option value="">Seleziona porto...</option>
                      <option value="Porto Turistico Marina d'Arechi">Marina d'Arechi</option>
                      <option value="Masuccio Salernitano - Porto di Salerno">Masuccio Salernitano</option>
                      <option value="Molo Manfredi - Porto di Salerno">Molo Manfredi</option>
                      <option value="Porto di Amalfi">Porto di Amalfi</option>
                      <option value="Porto di Positano">Porto di Positano</option>
                      <option value="Porto di Cetara">Porto di Cetara</option>
                      <option value="Porto di Maiori">Porto di Maiori</option>
                      <option value="Porto di Agropoli">Porto di Agropoli</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Stato</label>
                    <select value={formData.stato} onChange={(e) => setFormData(prev => ({ ...prev, stato: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]">
                      <option value="in_attesa">⏳ In Attesa</option><option value="confermata">✅ Confermata</option>
                      <option value="completata">🏁 Completata</option><option value="cancellata">❌ Cancellata</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Lingua</label>
                    <select value={formData.lingua} onChange={(e) => setFormData(prev => ({ ...prev, lingua: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]">
                      <option value="it">🇮🇹 IT</option><option value="en">🇬🇧 EN</option>
<option value="es">🇪🇸 ES</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      🚢 Nave
                      {loadingNavi && <span className="ml-1 text-blue-600">🔄</span>}
                    </label>
                    <select
                      value={formData.nave_id}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        nave_id: e.target.value === '' ? '' : Number(e.target.value)
                      }))}
                      disabled={!formData.data_servizio}
                      className={`w-full px-2 py-1.5 border rounded text-sm h-[34px] ${
                        naviInScalo.length > 1 && !formData.nave_id
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-gray-300'
                      }`}
                      title={
                        !formData.data_servizio
                          ? 'Seleziona prima la data'
                          : naviInScalo.length === 0
                            ? 'Nessuna nave in scalo in questa data'
                            : 'Nave da cui proviene il cliente'
                      }
                    >
                      <option value="">
                        {!formData.data_servizio
                          ? 'Scegli data...'
                          : naviInScalo.length === 0
                            ? 'Nessuno scalo'
                            : 'Non crocierista'}
                      </option>
                      {naviInScalo.map(n => (
                        <option key={n.id} value={n.id}>
                          {n.nome_nave} · {n.capienza_pax.toLocaleString('it-IT')}p
                        </option>
                      ))}
                    </select>
                    {naviInScalo.length > 1 && !formData.nave_id && (
                      <p className="text-[10px] text-amber-600 mt-0.5">⚠️ {naviInScalo.length} navi in scalo</p>
                    )}
                  </div>
                </div>

                {/* ── PREZZI E PAGAMENTI ── */}
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <h3 className="font-semibold text-gray-900 mb-3 text-sm">💰 Prezzi e Pagamenti</h3>
                  {isForfettario && (
                    <div className="mb-3 bg-amber-50 border border-amber-300 rounded-lg p-3">
                      <div className="text-amber-700 font-semibold text-sm mb-1">📋 Regime forfettario — {fornitoreCorrente?.ragione_sociale}</div>
                      <p className="text-xs text-gray-700 mb-2">
                        Il socio fattura e incassa direttamente dal cliente. Blu Alliance non incassa dal cliente: fattura al socio solo la commissione.
                      </p>
                      <div className="flex items-baseline justify-between bg-white rounded px-3 py-2 border border-amber-200">
                        <span className="text-sm text-gray-600">Commissione BA ({commissionePerc}%) su €{(formData.prezzo_totale || 0).toFixed(2)}</span>
                        <span className="text-lg font-bold text-amber-700">€{commissioneForfettaria.toFixed(2)}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">Da fatturare a {fornitoreCorrente?.ragione_sociale} come incasso Blu Alliance.</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Prezzo Totale (€) *</label>
                      <input type="number" step="0.01" min="0" value={formData.prezzo_totale}
                        onChange={(e) => setFormData(prev => ({ ...prev, prezzo_totale: parseFloat(e.target.value) || 0 }))}
                        onFocus={(e) => e.target.select()} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px] font-semibold" />
                    </div>
                    {!isForfettario && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Metodo Pagamento *</label>
                      <select value={formData.metodo_pagamento} onChange={(e) => setFormData(prev => ({ ...prev, metodo_pagamento: e.target.value }))}
                        className={`w-full px-2 py-1.5 border rounded text-sm h-[34px] ${!formData.metodo_pagamento ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} required>
                        <option value="">⚠️ Seleziona...</option>
                        <option value="stripe">💳 Stripe</option><option value="contanti">💵 Contanti</option>
                        <option value="pos">💳 POS</option><option value="bonifico">🏦 Bonifico</option><option value="altro">📋 Altro</option>
                      </select>
                    </div>
                    )}
                  </div>
                  {!isForfettario && (<>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Caparra Ricevuta (€)</label>
                      <input type="number" step="0.01" min="0" value={formData.caparra_ricevuta}
                        onChange={(e) => setFormData(prev => ({ ...prev, caparra_ricevuta: parseFloat(e.target.value) || 0 }))}
                        onFocus={(e) => e.target.select()} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" />
                      {formData.prezzo_totale > 0 && (
                        <div className="flex gap-1 mt-1">
                          <button type="button" onClick={() => setFormData(prev => ({ ...prev, caparra_ricevuta: Math.round(formData.prezzo_totale * 0.3 * 100) / 100 }))}
                            className="px-2 py-0.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-medium">30%</button>
                          <button type="button" onClick={() => setFormData(prev => ({ ...prev, caparra_ricevuta: Math.round(formData.prezzo_totale * 0.5 * 100) / 100 }))}
                            className="px-2 py-0.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-medium">50%</button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Metodo Caparra</label>
                      <select value={formData.metodo_pagamento_caparra} onChange={(e) => setFormData(prev => ({ ...prev, metodo_pagamento_caparra: e.target.value }))}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]">
                        <option value="">Usa principale</option><option value="stripe">💳 Stripe</option>
                        <option value="contanti">💵 Contanti</option><option value="pos">💳 POS</option>
                        <option value="bonifico">🏦 Bonifico</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Saldo Ricevuto (€)</label>
                      <input type="number" step="0.01" min="0" value={formData.saldo_ricevuto}
                        onChange={(e) => setFormData(prev => ({ ...prev, saldo_ricevuto: parseFloat(e.target.value) || 0 }))}
                        onFocus={(e) => e.target.select()} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Metodo Saldo</label>
                      <select value={formData.metodo_pagamento_saldo} onChange={(e) => setFormData(prev => ({ ...prev, metodo_pagamento_saldo: e.target.value }))}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]">
                        <option value="">Usa principale</option><option value="stripe">💳 Stripe</option>
                        <option value="contanti">💵 Contanti</option><option value="pos">💳 POS</option>
                        <option value="bonifico">🏦 Bonifico</option>
                      </select>
                    </div>
                  </div>
                  {/* Pagamenti suddivisi tra partecipanti */}
                  <div className="mb-3 border-t border-gray-200 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-gray-700">Pagamenti suddivisi (partecipanti)</label>
                      <button type="button" onClick={() => setFormData(prev => ({ ...prev, payment_lines: [...(prev.payment_lines || []), { amount: 0, method: '', date: '' }] }))} className="text-xs font-medium text-blue-600 hover:text-blue-800">+ Aggiungi pagamento</button>
                    </div>
                    {(formData.payment_lines || []).map((line: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-center">
                        <div className="col-span-4">
                          <input type="number" step="0.01" value={line.amount} onChange={(e) => { const u = [...formData.payment_lines]; u[idx] = { ...u[idx], amount: parseFloat(e.target.value) || 0 }; setFormData(prev => ({ ...prev, payment_lines: u })) }} onFocus={(e) => e.target.select()} placeholder="Importo" className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" />
                        </div>
                        <div className="col-span-4">
                          <select value={line.method} onChange={(e) => { const u = [...formData.payment_lines]; u[idx] = { ...u[idx], method: e.target.value }; setFormData(prev => ({ ...prev, payment_lines: u })) }} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]">
                            <option value="">Metodo...</option>
                            <option value="stripe">💳 Stripe</option>
                            <option value="contanti">💵 Contanti</option>
                            <option value="pos">💳 POS</option>
                            <option value="bonifico">🏦 Bonifico</option>
                          </select>
                        </div>
                        <div className="col-span-3">
                          <input type="date" value={line.date} onChange={(e) => { const u = [...formData.payment_lines]; u[idx] = { ...u[idx], date: e.target.value }; setFormData(prev => ({ ...prev, payment_lines: u })) }} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" />
                        </div>
                        <div className="col-span-1 text-center">
                          <button type="button" onClick={() => setFormData(prev => ({ ...prev, payment_lines: prev.payment_lines.filter((_: any, i: number) => i !== idx) }))} className="text-red-500 hover:text-red-700 text-sm" title="Rimuovi">🗑️</button>
                        </div>
                      </div>
                    ))}
                    {(formData.payment_lines || []).length > 0 && (() => {
                      const sommaRighe = formData.payment_lines.reduce((s: number, l: any) => s + (Number(l.amount) || 0), 0)
                      const totale = Number(formData.prezzo_totale) || 0
                      const diff = totale - sommaRighe
                      const quadra = Math.abs(diff) < 0.01
                      return (
                        <div className={`text-xs mt-1 px-2 py-1.5 rounded ${quadra ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                          Totale righe: €{sommaRighe.toFixed(2)} / Totale prenotazione: €{totale.toFixed(2)} — {quadra ? '✓ Quadra' : `Differenza: €${diff.toFixed(2)}`}
                        </div>
                      )
                    })()}
                  </div>                  <div className={`p-2 rounded border ${daRicevere > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Da Ricevere:</span>
                      <span className={`text-lg font-bold ${daRicevere > 0 ? 'text-red-600' : 'text-green-600'}`}>€{daRicevere.toFixed(2)}</span>
                    </div>
                  </div>
                  </>)}
                </div>

                {/* ── NOTE ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Note Cliente</label>
                    <textarea value={formData.note_cliente} onChange={(e) => setFormData(prev => ({ ...prev, note_cliente: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" rows={2} placeholder="Note visibili al cliente..." />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Note Interne</label>
                    <textarea value={formData.note_interne} onChange={(e) => setFormData(prev => ({ ...prev, note_interne: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" rows={2} placeholder="Note interne..." />
                  </div>
                </div>

                {/* Avviso tour collettivo */}
                {formData.servizio_id && servizi.find(s => s.id === formData.servizio_id)?.tipo === 'tour_collettivo' && (
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                    <p className="text-xs text-teal-800">👥 <strong>Tour Collettivo</strong> — Apparirà nella pagina Small Group.
                      {boatSource === 'ns3000' && ' Sincronizzata con NS3000.'}</p>
                  </div>
                )}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex gap-2 md:gap-3 p-3 md:p-4 border-t bg-gray-50 rounded-b-xl flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-white text-sm" disabled={saving}>Annulla</button>
          {isEdit && formData.stato === 'confermata' && (
            <button
              type="button"
              disabled={saving || sendingReview}
              onClick={async () => {
                setSendingReview(true)
                try {
                  // 1. Completa la prenotazione (update mirato dello stato)
                  const resStato = await authFetch('/api/prenotazioni/' + prenotazione.id, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ stato: 'completata' }),
                  })
                  if (!resStato.ok) {
                    const d = await resStato.json().catch(() => ({}))
                    throw new Error(d.error || 'Errore nel completare la prenotazione')
                  }
                  setFormData(prev => ({ ...prev, stato: 'completata' }))

                  // 2. Invia la richiesta di recensione
                  const resRev = await authFetch('/api/prenotazioni/' + prenotazione.id + '/send-google-review', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                  })
                  const dataRev = await resRev.json()
                  if (resRev.ok) {
                    toast.success('🏁 Completata + ⭐ recensione inviata')
                    setReviewSentAt(new Date().toISOString())
                    if (typeof onSave === 'function') onSave()
                  } else {
                    toast.error('Prenotazione completata, ma recensione non inviata: ' + (dataRev.error || 'errore'))
                  }
                } catch (e: any) {
                  toast.error(e.message || 'Errore operazione')
                } finally {
                  setSendingReview(false)
                }
              }}
              className="px-4 py-2.5 border border-blue-500 text-white bg-blue-600 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
              title="Completa la prenotazione e invia subito la richiesta di recensione"
            >
              {sendingReview ? 'Invio...' : '🏁 Completa e invia recensione'}
            </button>
          )}

          {isEdit && formData.stato === 'completata' && (
            <div className="flex flex-col items-stretch">
              <button
                type="button"
                disabled={saving || sendingReview}
                onClick={async () => {
                  if (reviewSentAt) {
                    const quando = new Date(reviewSentAt).toLocaleDateString('it-IT')
                    if (!confirm('Recensione gia inviata il ' + quando + '. Reinviare comunque?')) return
                  } else {
                    if (!confirm('Inviare la richiesta di recensione Google via WhatsApp al cliente?')) return
                  }
                  setSendingReview(true)
                  try {
                    const res = await authFetch('/api/prenotazioni/' + prenotazione.id + '/send-google-review', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({}),
                    })
                    const data = await res.json()
                    if (res.ok) {
                      toast.success(data.message || 'Recensione richiesta!')
                      setReviewSentAt(new Date().toISOString())
                    } else { toast.error(data.error || 'Errore invio recensione') }
                  } catch (e: any) {
                    toast.error(e.message || 'Errore invio recensione')
                  } finally {
                    setSendingReview(false)
                  }
                }}
                className={reviewSentAt
                  ? "px-4 py-2.5 border border-green-400 text-green-700 bg-green-50 rounded-lg hover:bg-green-100 text-sm font-medium disabled:opacity-50"
                  : "px-4 py-2.5 border border-amber-400 text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 text-sm font-medium disabled:opacity-50"}
              >
                {sendingReview ? 'Invio...' : reviewSentAt ? '✓ Recensione inviata' : '⭐ Recensione'}
              </button>
              {reviewSentAt && (
                <span className="text-[10px] text-gray-500 mt-0.5 text-center">
                  Inviata il {new Date(reviewSentAt).toLocaleDateString('it-IT')}
                </span>
              )}
            </div>
          )}
          <button type="submit" form="booking-form"
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm"
            disabled={saving || loadingOptions}>
            {saving ? 'Salvataggio...' : (isEdit ? 'Aggiorna' : 'Crea Prenotazione')}
          </button>
        </div>
      </div>
    </div>
  )
}