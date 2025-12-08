'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import toast from 'react-hot-toast'

export default function PrenotazioniPage() {
  const [prenotazioni, setPrenotazioni] = useState<any[]>([])
  const [filteredPrenotazioni, setFilteredPrenotazioni] = useState<any[]>([])
  const [clienti, setClienti] = useState<any[]>([])
  const [servizi, setServizi] = useState<any[]>([])
  const [imbarcazioni, setImbarcazioni] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroStato, setFiltroStato] = useState('tutti')
  const [showModal, setShowModal] = useState(false)
  const [showPagamentoModal, setShowPagamentoModal] = useState(false)
  const [prenotazioneSelezionata, setPrenotazioneSelezionata] = useState<any>(null)
  const [nuovoCliente, setNuovoCliente] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)

  const [formData, setFormData] = useState({
    cliente_id: '',
    nuovo_cliente_nome: '',
    nuovo_cliente_cognome: '',
    nuovo_cliente_email: '',
    nuovo_cliente_telefono: '',
    servizio_id: '',
    imbarcazione_id: '',
    data_servizio: '',
    ora_imbarco: '',
    luogo_imbarco: '',
    numero_persone: 2,
    lingua: 'it',
    note_cliente: '',
    stato: 'in_attesa'
  })

  const [pagamentoData, setPagamentoData] = useState({
    tipo: 'caparra',
    importo: 0,
    metodo: 'contanti',
    note: ''
  })

  // Stati per i pagamenti nel form di modifica
  const [pagamentiForm, setPagamentiForm] = useState({
    caparra_ricevuta: 0,
    metodo_pagamento_caparra: 'contanti',
    saldo_ricevuto: 0,
    metodo_pagamento_saldo: 'contanti'
  })

  const applicaFiltri = useCallback(() => {
    let risultati = [...prenotazioni]

    if (searchTerm) {
      risultati = risultati.filter(p =>
        p.codice_prenotazione?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.cliente_nome_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.cliente_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.servizio_nome?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (filtroStato !== 'tutti') {
      risultati = risultati.filter(p => p.stato === filtroStato)
    }

    setFilteredPrenotazioni(risultati)
  }, [prenotazioni, searchTerm, filtroStato])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    applicaFiltri()
  }, [applicaFiltri])

  useEffect(() => {
    if (formData.servizio_id && !editingId) {
      const servizio = servizi.find(s => s.id === formData.servizio_id)
      if (servizio) {
        setFormData(prev => ({
          ...prev,
          imbarcazione_id: servizio.imbarcazione_id || '',
          luogo_imbarco: servizio.luogo_imbarco || '',
          ora_imbarco: servizio.ora_imbarco || ''
        }))
      }
    }
  }, [formData.servizio_id, servizi, editingId])

  async function loadData() {
    try {
      const { data: prenotazioniData } = await supabase
        .from('vista_prenotazioni_complete')
        .select('*')
        .order('data_servizio', { ascending: true })
        .order('created_at', { ascending: true })

      const { data: clientiData } = await supabase
        .from('clienti')
        .select('id, nome, cognome, email')
        .order('cognome')

      const { data: serviziData } = await supabase
        .from('servizi')
        .select('id, nome, prezzo_base, prezzo_per_persona, caparra_percentuale, imbarcazione_id, luogo_imbarco, ora_imbarco')
        .eq('attivo', true)

      const { data: imbarcazioniData } = await supabase
        .from('imbarcazioni')
        .select('id, nome')
        .eq('attiva', true)

      setPrenotazioni(prenotazioniData || [])
      setClienti(clientiData || [])
      setServizi(serviziData || [])
      setImbarcazioni(imbarcazioniData || [])
    } catch (error: any) {
      toast.error('Errore nel caricamento')
      console.error('Errore:', error)
    } finally {
      setLoading(false)
    }
  }

  async function sendConfirmationEmail(prenotazione: any) {
    setSendingEmail(true)
    try {
      const response = await fetch('/api/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: prenotazione.cliente_email,
          nomeCliente: prenotazione.cliente_nome_completo,
          codicePrenotazione: prenotazione.codice_prenotazione,
          nomeServizio: prenotazione.servizio_nome,
          dataServizio: prenotazione.data_servizio,
          oraImbarco: prenotazione.ora_imbarco,
          luogoImbarco: prenotazione.luogo_imbarco,
          numeroPax: prenotazione.numero_persone,
          prezzoTotale: prenotazione.prezzo_totale,
          accontoRicevuto: prenotazione.caparra_ricevuta || 0,
          saldoRicevuto: prenotazione.saldo_ricevuto || 0,
          lingua: prenotazione.lingua || 'it'
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Errore invio email')
      }

      toast.success('Email di conferma inviata! 📧')
    } catch (error: any) {
      toast.error('Errore invio email: ' + error.message)
      console.error('Errore:', error)
    } finally {
      setSendingEmail(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      let clienteId = formData.cliente_id

      // Solo per nuove prenotazioni: crea nuovo cliente se richiesto
      if (nuovoCliente && !editingId) {
        const { data: nuovoClienteData, error: clienteError } = await supabase
          .from('clienti')
          .insert([{
            nome: formData.nuovo_cliente_nome,
            cognome: formData.nuovo_cliente_cognome,
            email: formData.nuovo_cliente_email,
            telefono: formData.nuovo_cliente_telefono
          }])
          .select()
          .single()

        if (clienteError) throw clienteError
        clienteId = nuovoClienteData.id
      }

      if (!clienteId) throw new Error('Cliente non selezionato')
      if (!formData.servizio_id) throw new Error('Servizio non selezionato')
      if (!formData.imbarcazione_id) throw new Error('Imbarcazione non selezionata')
      if (!formData.data_servizio) throw new Error('Data non selezionata')

      const servizio = servizi.find(s => s.id === formData.servizio_id)
      if (!servizio) throw new Error('Servizio non trovato')

      const prezzoTotale = servizio.prezzo_per_persona
        ? servizio.prezzo_base * formData.numero_persone
        : servizio.prezzo_base

      const dataToSave: any = {
        cliente_id: clienteId,
        servizio_id: formData.servizio_id,
        imbarcazione_id: formData.imbarcazione_id,
        data_servizio: formData.data_servizio,
        ora_imbarco: formData.ora_imbarco || null,
        luogo_imbarco: formData.luogo_imbarco || null,
        numero_persone: formData.numero_persone,
        lingua: formData.lingua,
        prezzo_totale: prezzoTotale,
        stato: formData.stato,
        note_cliente: formData.note_cliente || null
      }

      let emailInviata = false
      let prenotazioneData: any = null

      if (editingId) {
        // Aggiungi dati pagamento se modificati
        dataToSave.caparra_ricevuta = Number(pagamentiForm.caparra_ricevuta)
        dataToSave.metodo_pagamento_caparra = pagamentiForm.metodo_pagamento_caparra
        dataToSave.saldo_ricevuto = Number(pagamentiForm.saldo_ricevuto)
        dataToSave.metodo_pagamento_saldo = pagamentiForm.metodo_pagamento_saldo

        if (pagamentiForm.caparra_ricevuta > 0) {
          dataToSave.data_pagamento_caparra = new Date().toISOString()
        }
        if (pagamentiForm.saldo_ricevuto > 0) {
          dataToSave.data_pagamento_saldo = new Date().toISOString()
        }

        // Calcola se completamente pagato
        const totaleRicevuto = Number(pagamentiForm.caparra_ricevuta) + Number(pagamentiForm.saldo_ricevuto)
        const statoOriginale = prenotazioni.find(p => p.id === editingId)?.stato

        if (totaleRicevuto >= prezzoTotale && statoOriginale === 'in_attesa') {
          dataToSave.stato = 'confermata'
          emailInviata = true
        }

        // Modifica prenotazione esistente
        const { error } = await supabase
          .from('prenotazioni')
          .update(dataToSave)
          .eq('id', editingId)

        if (error) throw error

        // Se passa a confermata, invia email
        if (emailInviata) {
          const { data: prenotazioneAggiornata } = await supabase
            .from('vista_prenotazioni_complete')
            .select('*')
            .eq('id', editingId)
            .single()

          if (prenotazioneAggiornata) {
            await sendConfirmationEmail(prenotazioneAggiornata)
          }
          toast.success('Prenotazione confermata! Email inviata ✅')
        } else {
          toast.success('Prenotazione aggiornata!')
        }
      } else {
        // Crea nuova prenotazione
        const { data: nuovaPrenotazione, error } = await supabase
          .from('prenotazioni')
          .insert([{
            ...dataToSave,
            caparra_ricevuta: 0,
            saldo_ricevuto: 0
          }])
          .select()
          .single()

        if (error) throw error
        toast.success('Prenotazione creata con successo!')
      }

      resetForm()
      // Aspetta che la vista si aggiorni prima di ricaricare
      setTimeout(() => {
        loadData()
      }, 800)
    } catch (error: any) {
      toast.error(error.message || 'Errore nel salvataggio')
      console.error('Errore:', error)
    }
  }

  function handleEdit(prenotazione: any) {
    setEditingId(prenotazione.id)
    setFormData({
      cliente_id: prenotazione.cliente_id,
      nuovo_cliente_nome: '',
      nuovo_cliente_cognome: '',
      nuovo_cliente_email: '',
      nuovo_cliente_telefono: '',
      servizio_id: prenotazione.servizio_id,
      imbarcazione_id: prenotazione.imbarcazione_id,
      data_servizio: prenotazione.data_servizio,
      ora_imbarco: prenotazione.ora_imbarco || '',
      luogo_imbarco: prenotazione.luogo_imbarco || '',
      numero_persone: prenotazione.numero_persone,
      lingua: prenotazione.lingua || 'it',
      note_cliente: prenotazione.note_cliente || '',
      stato: prenotazione.stato
    })
    setPagamentiForm({
      caparra_ricevuta: prenotazione.caparra_ricevuta || 0,
      metodo_pagamento_caparra: prenotazione.metodo_pagamento_caparra || 'contanti',
      saldo_ricevuto: prenotazione.saldo_ricevuto || 0,
      metodo_pagamento_saldo: prenotazione.metodo_pagamento_saldo || 'contanti'
    })
    setNuovoCliente(false)
    setShowModal(true)
  }

  async function handleCambiaStato(prenotazioneId: string, nuovoStato: string) {
    try {
      const statoOriginale = prenotazioni.find(p => p.id === prenotazioneId)?.stato

      const { error } = await supabase
        .from('prenotazioni')
        .update({ stato: nuovoStato })
        .eq('id', prenotazioneId)

      if (error) throw error

      // Se passa a confermata, invia email
      if (nuovoStato === 'confermata' && statoOriginale !== 'confermata') {
        const { data: prenotazione } = await supabase
          .from('vista_prenotazioni_complete')
          .select('*')
          .eq('id', prenotazioneId)
          .single()

        if (prenotazione) {
          await sendConfirmationEmail(prenotazione)
          toast.success('Stato aggiornato! Email inviata ✅')
        }
      } else {
        toast.success('Stato aggiornato!')
      }

      setTimeout(() => {
        loadData()
      }, 500)
    } catch (error: any) {
      toast.error('Errore nell\'aggiornamento')
    }
  }

  function openPagamentoModal(prenotazione: any, tipo: 'caparra' | 'saldo') {
    setPrenotazioneSelezionata(prenotazione)

    // Calcola quanto resta da pagare
    const daRicevere = Number(prenotazione.prezzo_totale) - Number(prenotazione.caparra_ricevuta || 0) - Number(prenotazione.saldo_ricevuta || 0)

    const importoSuggerito = tipo === 'caparra'
      ? daRicevere  // Suggerisci tutto quello che manca
      : daRicevere  // Suggerisci tutto quello che manca

    setPagamentoData({
      tipo,
      importo: importoSuggerito,
      metodo: 'contanti',
      note: ''
    })

    setShowPagamentoModal(true)
  }

  async function handleRegistraPagamento() {
    if (!prenotazioneSelezionata) return

    try {
      const updates: any = {}

      if (pagamentoData.tipo === 'caparra') {
        updates.caparra_ricevuta = (prenotazioneSelezionata.caparra_ricevuta || 0) + Number(pagamentoData.importo)
        updates.metodo_pagamento_caparra = pagamentoData.metodo
        updates.data_pagamento_caparra = new Date().toISOString()
      } else {
        updates.saldo_ricevuto = (prenotazioneSelezionata.saldo_ricevuto || 0) + Number(pagamentoData.importo)
        updates.metodo_pagamento_saldo = pagamentoData.metodo
        updates.data_pagamento_saldo = new Date().toISOString()
      }

      if (pagamentoData.note) {
        updates.note_pagamento = pagamentoData.note
      }

      // Calcola il nuovo saldo totale
      const nuovaCaparraRicevuta = pagamentoData.tipo === 'caparra'
        ? updates.caparra_ricevuta
        : (prenotazioneSelezionata.caparra_ricevuta || 0)

      const nuovoSaldoRicevuto = pagamentoData.tipo === 'saldo'
        ? updates.saldo_ricevuto
        : (prenotazioneSelezionata.saldo_ricevuto || 0)

      const totaleRicevuto = nuovaCaparraRicevuta + nuovoSaldoRicevuto
      const prezzoTotale = Number(prenotazioneSelezionata.prezzo_totale)

      // Se totalmente pagato, cambia stato in "confermata"
      if (totaleRicevuto >= prezzoTotale && prenotazioneSelezionata.stato === 'in_attesa') {
        updates.stato = 'confermata'
      }

      const { error } = await supabase
        .from('prenotazioni')
        .update(updates)
        .eq('id', prenotazioneSelezionata.id)

      if (error) throw error

      setShowPagamentoModal(false)

      // Se passa a confermata, invia email
      if (updates.stato === 'confermata') {
        const { data: prenotazioneAggiornata } = await supabase
          .from('vista_prenotazioni_complete')
          .select('*')
          .eq('id', prenotazioneSelezionata.id)
          .single()

        if (prenotazioneAggiornata) {
          await sendConfirmationEmail(prenotazioneAggiornata)
          toast.success('Pagamento registrato! Prenotazione confermata e email inviata ✅')
        }
      } else {
        toast.success('Pagamento registrato!')
      }

      // Aspetta che la vista si aggiorni prima di ricaricare
      setTimeout(() => {
        loadData()
      }, 800)
    } catch (error: any) {
      toast.error('Errore nella registrazione')
    }
  }

  function resetForm() {
    setFormData({
      cliente_id: '',
      nuovo_cliente_nome: '',
      nuovo_cliente_cognome: '',
      nuovo_cliente_email: '',
      nuovo_cliente_telefono: '',
      servizio_id: '',
      imbarcazione_id: '',
      data_servizio: '',
      ora_imbarco: '',
      luogo_imbarco: '',
      numero_persone: 2,
      lingua: 'it',
      note_cliente: '',
      stato: 'in_attesa'
    })
    setPagamentiForm({
      caparra_ricevuta: 0,
      metodo_pagamento_caparra: 'contanti',
      saldo_ricevuto: 0,
      metodo_pagamento_saldo: 'contanti'
    })
    setNuovoCliente(false)
    setEditingId(null)
    setShowModal(false)
  }

  function getStatoColor(stato: string) {
    switch (stato) {
      case 'confermata': return 'bg-green-100 text-green-800'
      case 'completata': return 'bg-blue-100 text-blue-800'
      case 'in_attesa': return 'bg-yellow-100 text-yellow-800'
      case 'cancellata': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  function getStatoLabel(stato: string) {
    const labels: Record<string, string> = {
      'in_attesa': 'In Attesa',
      'confermata': 'Confermata',
      'completata': 'Completata',
      'cancellata': 'Cancellata'
    }
    return labels[stato] || stato
  }

  function esportaCSV() {
    const headers = ['Codice', 'Cliente', 'Email', 'Servizio', 'Data', 'Persone', 'Lingua', 'Totale', 'Acconto Ricevuto', 'Saldo Ricevuto', 'Da Ricevere', 'Stato']
    const rows = filteredPrenotazioni.map(p => {
      const daRicevere = Number(p.prezzo_totale) - Number(p.caparra_ricevuta || 0) - Number(p.saldo_ricevuto || 0)

      return [
        p.codice_prenotazione,
        p.cliente_nome_completo,
        p.cliente_email,
        p.servizio_nome,
        format(new Date(p.data_servizio), 'dd/MM/yyyy'),
        p.numero_persone,
        p.lingua?.toUpperCase() || 'IT',
        Number(p.prezzo_totale).toFixed(2),
        Number(p.caparra_ricevuta || 0).toFixed(2),
        Number(p.saldo_ricevuto || 0).toFixed(2),
        daRicevere.toFixed(2),
        getStatoLabel(p.stato)
      ]
    })

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `prenotazioni-${format(new Date(), 'yyyy-MM-dd')}.csv`
    link.click()
    toast.success('CSV esportato!')
  }

  if (loading) {
    return <div className="p-8"><div className="text-gray-600">Caricamento...</div></div>
  }

  const servizioSelezionato = servizi.find(s => s.id === formData.servizio_id)

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Prenotazioni</h1>
          <p className="text-gray-600 mt-1">
            {filteredPrenotazioni.length} prenotazion{filteredPrenotazioni.length !== 1 ? 'i' : 'e'} trovate
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Nuova
          </button>
          <button
            onClick={esportaCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            📥 CSV
          </button>
        </div>
      </div>

      {/* Statistiche per Data */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {(() => {
          const oggi = new Date()
          oggi.setHours(0, 0, 0, 0)
          const domani = new Date(oggi)
          domani.setDate(domani.getDate() + 1)

          const oggiCount = filteredPrenotazioni.filter(p => {
            const dataServizio = new Date(p.data_servizio)
            dataServizio.setHours(0, 0, 0, 0)
            return dataServizio.getTime() === oggi.getTime()
          }).length

          const domaniCount = filteredPrenotazioni.filter(p => {
            const dataServizio = new Date(p.data_servizio)
            dataServizio.setHours(0, 0, 0, 0)
            return dataServizio.getTime() === domani.getTime()
          }).length

          const settimanaCount = filteredPrenotazioni.filter(p => {
            const dataServizio = new Date(p.data_servizio)
            const giorni = Math.floor((dataServizio.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24))
            return giorni >= 0 && giorni < 7
          }).length

          const passateCount = filteredPrenotazioni.filter(p => {
            const dataServizio = new Date(p.data_servizio)
            return dataServizio < oggi
          }).length

          return (
            <>
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                <p className="text-sm text-gray-600">Oggi</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{oggiCount}</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                <p className="text-sm text-gray-600">Domani</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{domaniCount}</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                <p className="text-sm text-gray-600">Prossimi 7gg</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">{settimanaCount}</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                <p className="text-sm text-gray-600">Passate</p>
                <p className="text-2xl font-bold text-gray-600 mt-1">{passateCount}</p>
              </div>
            </>
          )
        })()}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cerca</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Codice, cliente, email..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Stato</label>
            <select
              value={filtroStato}
              onChange={(e) => setFiltroStato(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="tutti">Tutti</option>
              <option value="in_attesa">In Attesa</option>
              <option value="confermata">Confermata</option>
              <option value="completata">Completata</option>
              <option value="cancellata">Cancellata</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Codice</th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Servizio</th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Importo</th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stato</th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPrenotazioni.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="text-4xl mb-3">📅</div>
                    <p>Nessuna prenotazione trovata</p>
                  </td>
                </tr>
              ) : (
                filteredPrenotazioni.map((prenotazione) => {
                  const daRicevere = Number(prenotazione.prezzo_totale) - Number(prenotazione.caparra_ricevuta || 0) - Number(prenotazione.saldo_ricevuto || 0)

                  return (
                    <tr key={prenotazione.id} className="hover:bg-gray-50">
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap text-xs md:text-sm font-medium text-gray-900">
                        {prenotazione.codice_prenotazione}
                        {prenotazione.lingua === 'en' && (
                          <span className="ml-2 text-xs">🇬🇧</span>
                        )}
                      </td>
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                        <div className="text-xs md:text-sm">
                          <div className="font-medium text-gray-900">{prenotazione.cliente_nome_completo}</div>
                          <div className="text-gray-500 text-xs hidden sm:block">{prenotazione.cliente_email}</div>
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap text-xs md:text-sm text-gray-900 hidden md:table-cell">
                        {prenotazione.servizio_nome}
                      </td>
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap text-xs md:text-sm text-gray-600">
                        {format(new Date(prenotazione.data_servizio), 'dd MMM yyyy', { locale: it })}
                      </td>
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                        <div className="text-xs md:text-sm">
                          <div className="font-medium text-gray-900">
                            Totale: €{Number(prenotazione.prezzo_totale).toFixed(2)}
                          </div>
                          <div className="text-xs text-blue-600">
                            Acconto ricevuto: €{Number(prenotazione.caparra_ricevuta || 0).toFixed(2)}
                          </div>
                          <div className="text-xs text-green-600">
                            Saldo ricevuto: €{Number(prenotazione.saldo_ricevuto || 0).toFixed(2)}
                          </div>
                          <div className={`text-xs font-medium border-t pt-1 mt-1 ${daRicevere === 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                            Da ricevere: €{daRicevere.toFixed(2)}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                        <select
                          value={prenotazione.stato}
                          onChange={(e) => handleCambiaStato(prenotazione.id, e.target.value)}
                          className={`px-2 md:px-3 py-1 text-xs font-semibold rounded-full border-0 cursor-pointer ${getStatoColor(prenotazione.stato)}`}
                        >
                          <option value="in_attesa">In Attesa</option>
                          <option value="confermata">Confermata</option>
                          <option value="completata">Completata</option>
                          <option value="cancellata">Cancellata</option>
                        </select>
                      </td>
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(prenotazione)}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                            title="Modifica prenotazione"
                          >
                            ✏️
                          </button>
                          {prenotazione.stato === 'confermata' && (
                            <button
                              onClick={() => sendConfirmationEmail(prenotazione)}
                              disabled={sendingEmail}
                              className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50"
                              title="Invia email conferma"
                            >
                              📧
                            </button>
                          )}
                          {daRicevere > 0 && (
                            <>
                              <button
                                onClick={() => openPagamentoModal(prenotazione, 'caparra')}
                                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                title="Registra acconto"
                              >
                                💰
                              </button>
                              <button
                                onClick={() => openPagamentoModal(prenotazione, 'saldo')}
                                className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                                title="Registra saldo"
                              >
                                ✅
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nuova/Modifica Prenotazione */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingId ? 'Modifica Prenotazione' : 'Nuova Prenotazione'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Cliente *</label>
                  {!editingId && (
                    <button
                      type="button"
                      onClick={() => setNuovoCliente(!nuovoCliente)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      {nuovoCliente ? '← Seleziona esistente' : '+ Nuovo cliente'}
                    </button>
                  )}
                </div>

                {nuovoCliente && !editingId ? (
                  <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={formData.nuovo_cliente_nome}
                        onChange={(e) => setFormData({ ...formData, nuovo_cliente_nome: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Nome"
                        required
                      />
                      <input
                        type="text"
                        value={formData.nuovo_cliente_cognome}
                        onChange={(e) => setFormData({ ...formData, nuovo_cliente_cognome: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Cognome"
                        required
                      />
                    </div>
                    <input
                      type="email"
                      value={formData.nuovo_cliente_email}
                      onChange={(e) => setFormData({ ...formData, nuovo_cliente_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Email"
                      required
                    />
                    <input
                      type="tel"
                      value={formData.nuovo_cliente_telefono}
                      onChange={(e) => setFormData({ ...formData, nuovo_cliente_telefono: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Telefono"
                    />
                  </div>
                ) : (
                  <select
                    value={formData.cliente_id}
                    onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required={!nuovoCliente}
                    disabled={!!editingId}
                  >
                    <option value="">Seleziona cliente</option>
                    {clienti.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.cognome} {cliente.nome} - {cliente.email}
                      </option>
                    ))}
                  </select>
                )}
                {editingId && (
                  <p className="text-xs text-gray-500 mt-1">
                    Il cliente non può essere modificato per motivi di sicurezza
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Servizio *</label>
                <select
                  value={formData.servizio_id}
                  onChange={(e) => setFormData({ ...formData, servizio_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Seleziona servizio</option>
                  {servizi.map((servizio) => (
                    <option key={servizio.id} value={servizio.id}>
                      {servizio.nome} - €{servizio.prezzo_base}
                    </option>
                  ))}
                </select>
                {servizioSelezionato && (
                  <div className="text-sm text-gray-500 mt-1 space-y-1">
                    <p>
                      Prezzo base: €{servizioSelezionato.prezzo_base}
                      {servizioSelezionato.prezzo_per_persona && <span className="text-blue-600 font-medium"> × {formData.numero_persone} persone = €{(servizioSelezionato.prezzo_base * formData.numero_persone).toFixed(2)}</span>}
                    </p>
                    <p>
                      Caparra suggerita: {servizioSelezionato.caparra_percentuale}%
                      (€{((servizioSelezionato.prezzo_per_persona ? servizioSelezionato.prezzo_base * formData.numero_persone : servizioSelezionato.prezzo_base) * servizioSelezionato.caparra_percentuale / 100).toFixed(2)})
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Imbarcazione *</label>
                <select
                  value={formData.imbarcazione_id}
                  onChange={(e) => setFormData({ ...formData, imbarcazione_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Seleziona imbarcazione</option>
                  {imbarcazioni.map((imb) => (
                    <option key={imb.id} value={imb.id}>
                      {imb.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data Servizio *</label>
                  <input
                    type="date"
                    value={formData.data_servizio}
                    onChange={(e) => setFormData({ ...formData, data_servizio: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Numero Persone *</label>
                  <input
                    type="number"
                    value={formData.numero_persone}
                    onChange={(e) => setFormData({ ...formData, numero_persone: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Luogo Imbarco</label>
                  <select
                    value={formData.luogo_imbarco}
                    onChange={(e) => setFormData({ ...formData, luogo_imbarco: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Seleziona porto</option>
                    <option value="Masuccio Salernitano, Salerno">Masuccio Salernitano, Salerno</option>
                    <option value="Molo Manfredi, Salerno">Molo Manfredi, Salerno</option>
                    <option value="Vietri sul Mare">Vietri sul Mare</option>
                    <option value="Cetara">Cetara</option>
                    <option value="Maiori">Maiori</option>
                    <option value="Minori">Minori</option>
                    <option value="Amalfi">Amalfi</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ora Imbarco</label>
                  <input
                    type="time"
                    value={formData.ora_imbarco}
                    onChange={(e) => setFormData({ ...formData, ora_imbarco: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Pre-compilata dal servizio, modificabile</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Lingua Email *</label>
                <select
                  value={formData.lingua}
                  onChange={(e) => setFormData({ ...formData, lingua: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="it">🇮🇹 Italiano</option>
                  <option value="en">🇬🇧 English</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note Cliente</label>
                <textarea
                  value={formData.note_cliente}
                  onChange={(e) => setFormData({ ...formData, note_cliente: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Note o richieste speciali..."
                />
              </div>

              {editingId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stato</label>
                  <select
                    value={formData.stato}
                    onChange={(e) => setFormData({ ...formData, stato: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="in_attesa">In Attesa</option>
                    <option value="confermata">Confermata</option>
                    <option value="completata">Completata</option>
                    <option value="cancellata">Cancellata</option>
                  </select>
                </div>
              )}

              {editingId && servizioSelezionato && (
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Gestione Pagamenti</h3>

                  <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                    {/* Riepilogo importi */}
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Prezzo Totale:</span>
                        <span className="text-lg font-bold text-gray-900">
                          €{(servizioSelezionato.prezzo_per_persona ? servizioSelezionato.prezzo_base * formData.numero_persone : servizioSelezionato.prezzo_base).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 italic">
                        Nota: La caparra suggerita è {servizioSelezionato.caparra_percentuale}% (€{(servizioSelezionato.prezzo_base * servizioSelezionato.caparra_percentuale / 100).toFixed(2)}), ma puoi inserire qualsiasi importo
                      </div>
                    </div>

                    {/* Caparra */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">💰 Acconto Ricevuto</label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={pagamentiForm.caparra_ricevuta}
                            onChange={(e) => setPagamentiForm({ ...pagamentiForm, caparra_ricevuta: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <select
                            value={pagamentiForm.metodo_pagamento_caparra}
                            onChange={(e) => setPagamentiForm({ ...pagamentiForm, metodo_pagamento_caparra: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          >
                            <option value="contanti">Contanti</option>
                            <option value="bonifico">Bonifico</option>
                            <option value="pos">POS/Carta</option>
                            <option value="online">Online</option>
                            <option value="assegno">Assegno</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Saldo */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">✅ Saldo Ricevuto</label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={pagamentiForm.saldo_ricevuto}
                            onChange={(e) => setPagamentiForm({ ...pagamentiForm, saldo_ricevuto: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <select
                            value={pagamentiForm.metodo_pagamento_saldo}
                            onChange={(e) => setPagamentiForm({ ...pagamentiForm, metodo_pagamento_saldo: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          >
                            <option value="contanti">Contanti</option>
                            <option value="bonifico">Bonifico</option>
                            <option value="pos">POS/Carta</option>
                            <option value="online">Online</option>
                            <option value="assegno">Assegno</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Totale Ricevuto */}
                    <div className="bg-white p-3 rounded border-2 border-gray-300">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-gray-700">Totale Ricevuto:</span>
                        <span className="text-lg font-bold text-green-600">
                          €{(Number(pagamentiForm.caparra_ricevuta) + Number(pagamentiForm.saldo_ricevuto)).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-sm font-semibold text-gray-700">Da Ricevere:</span>
                        <span className={`text-lg font-bold ${((servizioSelezionato.prezzo_per_persona ? servizioSelezionato.prezzo_base * formData.numero_persone : servizioSelezionato.prezzo_base) - (Number(pagamentiForm.caparra_ricevuta) + Number(pagamentiForm.saldo_ricevuto))) === 0
                            ? 'text-green-600'
                            : 'text-red-600'
                          }`}>
                          €{((servizioSelezionato.prezzo_per_persona ? servizioSelezionato.prezzo_base * formData.numero_persone : servizioSelezionato.prezzo_base) - (Number(pagamentiForm.caparra_ricevuta) + Number(pagamentiForm.saldo_ricevuto))).toFixed(2)}
                        </span>
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
                  {editingId ? 'Aggiorna Prenotazione' : 'Crea Prenotazione'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pagamento */}
      {showPagamentoModal && prenotazioneSelezionata && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                Registra {pagamentoData.tipo === 'caparra' ? 'Acconto' : 'Saldo'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {prenotazioneSelezionata.codice_prenotazione} - {prenotazioneSelezionata.cliente_nome_completo}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Prezzo totale:</span>
                  <span className="font-medium">€{Number(prenotazioneSelezionata.prezzo_totale).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Acconto già ricevuto:</span>
                  <span>€{Number(prenotazioneSelezionata.caparra_ricevuta || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Saldo già ricevuto:</span>
                  <span>€{Number(prenotazioneSelezionata.saldo_ricevuto || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">Ancora da ricevere:</span>
                  <span className="font-bold text-red-600">
                    €{(Number(prenotazioneSelezionata.prezzo_totale) - Number(prenotazioneSelezionata.caparra_ricevuta || 0) - Number(prenotazioneSelezionata.saldo_ricevuto || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Importo Ricevuto *</label>
                <input
                  type="number"
                  step="0.01"
                  value={pagamentoData.importo}
                  onChange={(e) => setPagamentoData({ ...pagamentoData, importo: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Metodo Pagamento *</label>
                <select
                  value={pagamentoData.metodo}
                  onChange={(e) => setPagamentoData({ ...pagamentoData, metodo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="contanti">Contanti</option>
                  <option value="bonifico">Bonifico</option>
                  <option value="pos">POS/Carta</option>
                  <option value="online">Online</option>
                  <option value="assegno">Assegno</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note</label>
                <textarea
                  value={pagamentoData.note}
                  onChange={(e) => setPagamentoData({ ...pagamentoData, note: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                  placeholder="Riferimento bonifico, numero ricevuta..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPagamentoModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  onClick={handleRegistraPagamento}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Registra Pagamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}