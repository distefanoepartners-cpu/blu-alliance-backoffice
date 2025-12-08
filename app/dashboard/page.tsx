'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, endOfWeek } from 'date-fns'
import { it } from 'date-fns/locale'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()
  const [prenotazioni, setPrenotazioni] = useState<any[]>([])
  const [imbarcazioni, setImbarcazioni] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => {
    loadData()
  }, [currentDate])

  async function loadData() {
    try {
      setLoading(true)

      // Carica prenotazioni del mese corrente
      const startDate = startOfMonth(currentDate)
      const endDate = endOfMonth(currentDate)

      const { data: prenotazioniData } = await supabase
        .from('vista_prenotazioni_complete')
        .select('*')
        .gte('data_servizio', startDate.toISOString())
        .lte('data_servizio', endDate.toISOString())
        .order('data_servizio')

      const { data: imbarcazioniData } = await supabase
        .from('imbarcazioni')
        .select('*')
        .order('nome')

      setPrenotazioni(prenotazioniData || [])
      setImbarcazioni(imbarcazioniData || [])
    } catch (error) {
      console.error('Errore:', error)
    } finally {
      setLoading(false)
    }
  }

  function getPrenotazioniPerGiorno(date: Date) {
    return prenotazioni.filter(p => 
      isSameDay(new Date(p.data_servizio), date)
    )
  }

  function getImbarcazioniDisponibili(date: Date) {
    const prenotazioniGiorno = getPrenotazioniPerGiorno(date)
    const imbarcazioniPrenotate = prenotazioniGiorno.map(p => p.imbarcazione_id)
    return imbarcazioni.filter(i => 
      i.attiva && !imbarcazioniPrenotate.includes(i.id)
    ).length
  }

  function cambiaaMese(direzione: 'prev' | 'next') {
    const newDate = new Date(currentDate)
    if (direzione === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }

  // Genera giorni del calendario
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { locale: it })
  const calendarEnd = endOfWeek(monthEnd, { locale: it })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  // Statistiche rapide
  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)
  
  const prenotazioniOggi = prenotazioni.filter(p => 
    isSameDay(new Date(p.data_servizio), oggi)
  )
  
  const domani = new Date(oggi)
  domani.setDate(domani.getDate() + 1)
  const prenotazioniDomani = prenotazioni.filter(p => 
    isSameDay(new Date(p.data_servizio), domani)
  )

  const imbarcazioniAttive = imbarcazioni.filter(i => i.attiva).length
  const imbarcazioniDisponibiliOggi = imbarcazioniAttive - prenotazioniOggi.length

  if (loading) {
    return <div className="p-8"><div className="text-gray-600">Caricamento...</div></div>
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Panoramica operativa</p>
      </div>

      {/* Statistiche Rapide */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-600">Prenotazioni Oggi</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{prenotazioniOggi.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-600">Prenotazioni Domani</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{prenotazioniDomani.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-600">Barche Disponibili</p>
          <p className="text-3xl font-bold text-purple-600 mt-2">{imbarcazioniDisponibiliOggi}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-600">Barche Attive</p>
          <p className="text-3xl font-bold text-gray-600 mt-2">{imbarcazioniAttive}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendario */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {format(currentDate, 'MMMM yyyy', { locale: it })}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => cambiaaMese('prev')}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  ←
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                >
                  Oggi
                </button>
                <button
                  onClick={() => cambiaaMese('next')}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  →
                </button>
              </div>
            </div>

            {/* Intestazione giorni settimana */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-600 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Giorni del calendario */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                const prenotazioniGiorno = getPrenotazioniPerGiorno(day)
                const disponibili = getImbarcazioniDisponibili(day)
                const isCurrentMonth = day.getMonth() === currentDate.getMonth()
                const isOggi = isToday(day)

                return (
                  <div
                    key={idx}
                    className={`
                      min-h-20 p-2 border rounded-lg cursor-pointer transition-all
                      ${!isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white hover:bg-blue-50'}
                      ${isOggi ? 'ring-2 ring-blue-500' : 'border-gray-200'}
                    `}
                    onClick={() => {
                      if (prenotazioniGiorno.length > 0) {
                        router.push('/dashboard/calendario')
                      }
                    }}
                  >
                    <div className={`text-sm font-medium mb-1 ${isOggi ? 'text-blue-600' : ''}`}>
                      {format(day, 'd')}
                    </div>
                    
                    {isCurrentMonth && prenotazioniGiorno.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-blue-600">
                          {prenotazioniGiorno.length} pren.
                        </div>
                        {disponibili > 0 && (
                          <div className="text-xs text-green-600">
                            {disponibili} disp.
                          </div>
                        )}
                      </div>
                    )}
                    
                    {isCurrentMonth && prenotazioniGiorno.length === 0 && disponibili > 0 && (
                      <div className="text-xs text-gray-500">
                        {disponibili} disp.
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-100 rounded"></div>
                <span>Con prenotazioni</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 ring-2 ring-blue-500 rounded"></div>
                <span>Oggi</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Barche e Prenotazioni Oggi */}
        <div className="space-y-6">
          {/* Imbarcazioni */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Imbarcazioni</h2>
              <button
                onClick={() => router.push('/dashboard/imbarcazioni')}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Gestisci →
              </button>
            </div>

            <div className="space-y-3">
              {imbarcazioni.slice(0, 5).map(imb => {
                const prenotataOggi = prenotazioniOggi.some(p => p.imbarcazione_id === imb.id)
                
                return (
                  <div key={imb.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {imb.immagine_principale ? (
                        <img
                          src={imb.immagine_principale}
                          alt={imb.nome}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                          🚤
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">{imb.nome}</p>
                        <p className="text-xs text-gray-500 capitalize">{imb.tipo}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {imb.attiva ? (
                        prenotataOggi ? (
                          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                            Occupata
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                            Disponibile
                          </span>
                        )
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                          Non Attiva
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {imbarcazioni.length > 5 && (
              <button
                onClick={() => router.push('/dashboard/imbarcazioni')}
                className="w-full mt-4 text-sm text-gray-600 hover:text-gray-900"
              >
                Vedi tutte ({imbarcazioni.length})
              </button>
            )}
          </div>

          {/* Prenotazioni Oggi */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Prenotazioni Oggi</h2>
              <button
                onClick={() => router.push('/dashboard/prenotazioni')}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Vedi tutte →
              </button>
            </div>

            {prenotazioniOggi.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">🎉</div>
                <p className="text-sm text-gray-500">Nessuna prenotazione oggi</p>
              </div>
            ) : (
              <div className="space-y-3">
                {prenotazioniOggi.map(pren => (
                  <div key={pren.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {pren.cliente_nome_completo}
                        </p>
                        <p className="text-xs text-gray-500">{pren.servizio_nome}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        pren.stato === 'confermata' ? 'bg-green-100 text-green-700' :
                        pren.stato === 'in_attesa' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {pren.stato}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>🚤 {pren.imbarcazione_nome}</span>
                      <span>👥 {pren.numero_persone}</span>
                      <span className="font-medium">€{pren.prezzo_totale}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}