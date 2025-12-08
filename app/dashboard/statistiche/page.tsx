'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfWeek, startOfMonth, subDays, eachDayOfInterval } from 'date-fns'
import { it } from 'date-fns/locale'

export default function StatistichePage() {
  const [stats, setStats] = useState({
    ricaviOggi: 0,
    ricaviSettimana: 0,
    ricaviMese: 0,
    prenotazioniTotali: 0,
    prenotazioniOggi: 0,
    prenotazioniSettimana: 0,
    inAttesa: 0,
    confermate: 0,
    completate: 0,
    cancellate: 0
  })
  
  const [graficoData, setGraficoData] = useState<any[]>([])
  const [imbarcazioniStats, setImbarcazioniStats] = useState<any[]>([])
  const [topClienti, setTopClienti] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      // Carica tutte le prenotazioni
      const { data: prenotazioni } = await supabase
        .from('vista_prenotazioni_complete')
        .select('*')
        .order('data_servizio', { ascending: false })

      if (!prenotazioni) return

      const oggi = new Date()
      oggi.setHours(0, 0, 0, 0)
      
      const inizioSettimana = startOfWeek(oggi, { locale: it })
      const inizioMese = startOfMonth(oggi)

      // Calcola ricavi
      let ricaviOggi = 0
      let ricaviSettimana = 0
      let ricaviMese = 0
      let prenotazioniOggi = 0
      let prenotazioniSettimana = 0

      // Statistiche per stato
      let inAttesa = 0
      let confermate = 0
      let completate = 0
      let cancellate = 0

      prenotazioni.forEach((p: any) => {
        const dataServizio = new Date(p.data_servizio)
        dataServizio.setHours(0, 0, 0, 0)
        
        const ricevuto = Number(p.caparra_ricevuta || 0) + Number(p.saldo_ricevuto || 0)

        // Ricavi
        if (dataServizio.getTime() === oggi.getTime()) {
          ricaviOggi += ricevuto
          prenotazioniOggi++
        }
        if (dataServizio >= inizioSettimana) {
          ricaviSettimana += ricevuto
          prenotazioniSettimana++
        }
        if (dataServizio >= inizioMese) {
          ricaviMese += ricevuto
        }

        // Stati
        if (p.stato === 'in_attesa') inAttesa++
        else if (p.stato === 'confermata') confermate++
        else if (p.stato === 'completata') completate++
        else if (p.stato === 'cancellata') cancellate++
      })

      setStats({
        ricaviOggi,
        ricaviSettimana,
        ricaviMese,
        prenotazioniTotali: prenotazioni.length,
        prenotazioniOggi,
        prenotazioniSettimana,
        inAttesa,
        confermate,
        completate,
        cancellate
      })

      // Grafico ultimi 7 giorni
      const ultimi7Giorni = eachDayOfInterval({
        start: subDays(oggi, 6),
        end: oggi
      })

      const grafico = ultimi7Giorni.map(giorno => {
        const prenotazioniGiorno = prenotazioni.filter((p: any) => {
          const dataServizio = new Date(p.data_servizio)
          dataServizio.setHours(0, 0, 0, 0)
          return dataServizio.getTime() === giorno.getTime()
        })

        const acconto = prenotazioniGiorno.reduce((sum, p) => sum + Number(p.caparra_ricevuta || 0), 0)
        const saldo = prenotazioniGiorno.reduce((sum, p) => sum + Number(p.saldo_ricevuto || 0), 0)

        return {
          data: format(giorno, 'dd MMM', { locale: it }),
          acconto,
          saldo,
          totale: acconto + saldo
        }
      })

      setGraficoData(grafico)

      // Top 5 clienti
      const clientiMap = new Map()
      prenotazioni.forEach((p: any) => {
        if (!p.cliente_id) return
        const ricevuto = Number(p.caparra_ricevuta || 0) + Number(p.saldo_ricevuto || 0)
        const existing = clientiMap.get(p.cliente_id) || {
          nome: p.cliente_nome_completo,
          email: p.cliente_email,
          totale: 0,
          prenotazioni: 0
        }
        existing.totale += ricevuto
        existing.prenotazioni++
        clientiMap.set(p.cliente_id, existing)
      })

      const topClienti = Array.from(clientiMap.values())
        .sort((a, b) => b.totale - a.totale)
        .slice(0, 5)

      setTopClienti(topClienti)

      // Statistiche imbarcazioni
      const imbarcazioniMap = new Map()
      prenotazioni.forEach((p: any) => {
        if (!p.imbarcazione_id || p.stato === 'cancellata') return
        const existing = imbarcazioniMap.get(p.imbarcazione_id) || {
          nome: p.imbarcazione_nome,
          prenotazioni: 0,
          ricavi: 0
        }
        existing.prenotazioni++
        existing.ricavi += Number(p.caparra_ricevuta || 0) + Number(p.saldo_ricevuto || 0)
        imbarcazioniMap.set(p.imbarcazione_id, existing)
      })

      const imbarcazioni = Array.from(imbarcazioniMap.values())
        .sort((a, b) => b.prenotazioni - a.prenotazioni)

      setImbarcazioniStats(imbarcazioni)

    } catch (error) {
      console.error('Errore caricamento dati:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-gray-600">Caricamento statistiche...</div>
      </div>
    )
  }

  const maxGrafico = Math.max(...graficoData.map(d => d.totale), 1)

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Statistiche</h1>
        <p className="text-gray-600 mt-1">Panoramica attività e statistiche</p>
      </div>

      {/* Ricavi Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ricavi Oggi</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                €{stats.ricaviOggi.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.prenotazioniOggi} prenotazion{stats.prenotazioniOggi !== 1 ? 'i' : 'e'}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
              💰
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ricavi Settimana</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                €{stats.ricaviSettimana.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.prenotazioniSettimana} prenotazion{stats.prenotazioniSettimana !== 1 ? 'i' : 'e'}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl">
              📊
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ricavi Mese</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                €{stats.ricaviMese.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.prenotazioniTotali} totali
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-2xl">
              📈
            </div>
          </div>
        </div>
      </div>

      {/* Stati Prenotazioni */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Stato Prenotazioni</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-3xl font-bold text-yellow-600">{stats.inAttesa}</p>
            <p className="text-sm text-gray-600 mt-1">In Attesa</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-3xl font-bold text-green-600">{stats.confermate}</p>
            <p className="text-sm text-gray-600 mt-1">Confermate</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-3xl font-bold text-blue-600">{stats.completate}</p>
            <p className="text-sm text-gray-600 mt-1">Completate</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-3xl font-bold text-red-600">{stats.cancellate}</p>
            <p className="text-sm text-gray-600 mt-1">Cancellate</p>
          </div>
        </div>
      </div>

      {/* Grafico Ricavi Ultimi 7 Giorni */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Ricavi Ultimi 7 Giorni</h2>
        <div className="space-y-4">
          {graficoData.map((giorno, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{giorno.data}</span>
                <span className="font-semibold text-gray-900">€{giorno.totale.toFixed(2)}</span>
              </div>
              <div className="flex gap-1 h-8">
                {/* Acconto */}
                <div
                  className="bg-blue-500 rounded transition-all"
                  style={{ width: `${(giorno.acconto / maxGrafico) * 100}%` }}
                  title={`Acconto: €${giorno.acconto.toFixed(2)}`}
                />
                {/* Saldo */}
                <div
                  className="bg-green-500 rounded transition-all"
                  style={{ width: `${(giorno.saldo / maxGrafico) * 100}%` }}
                  title={`Saldo: €${giorno.saldo.toFixed(2)}`}
                />
              </div>
              <div className="flex gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-blue-500 rounded"></span>
                  Acconto: €{giorno.acconto.toFixed(2)}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-green-500 rounded"></span>
                  Saldo: €{giorno.saldo.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Clienti */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Clienti</h2>
          {topClienti.length === 0 ? (
            <p className="text-gray-500 text-sm">Nessun cliente trovato</p>
          ) : (
            <div className="space-y-3">
              {topClienti.map((cliente, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{cliente.nome}</p>
                      <p className="text-xs text-gray-500">{cliente.prenotazioni} prenotazion{cliente.prenotazioni !== 1 ? 'i' : 'e'}</p>
                    </div>
                  </div>
                  <p className="font-semibold text-gray-900">€{cliente.totale.toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Imbarcazioni Performance */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Imbarcazioni</h2>
          {imbarcazioniStats.length === 0 ? (
            <p className="text-gray-500 text-sm">Nessuna imbarcazione trovata</p>
          ) : (
            <div className="space-y-3">
              {imbarcazioniStats.map((imb, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900">🚤 {imb.nome}</p>
                    <p className="font-semibold text-gray-900">€{imb.ricavi.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{imb.prenotazioni} prenotazion{imb.prenotazioni !== 1 ? 'i' : 'e'}</span>
                    <span>€{(imb.ricavi / imb.prenotazioni).toFixed(2)} media</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}