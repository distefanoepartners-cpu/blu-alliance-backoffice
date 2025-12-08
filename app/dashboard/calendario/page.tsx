'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  format, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  startOfWeek,
  endOfWeek
} from 'date-fns'
import { it } from 'date-fns/locale'
import toast from 'react-hot-toast'

export default function CalendarioPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [prenotazioni, setPrenotazioni] = useState<any[]>([])
  const [imbarcazioni, setImbarcazioni] = useState<any[]>([])
  const [filtroImbarcazione, setFiltroImbarcazione] = useState('tutte')
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [prenotazioniGiorno, setPrenotazioniGiorno] = useState<any[]>([])

  useEffect(() => {
    loadData()
  }, [currentDate])

  async function loadData() {
    try {
      setLoading(true)
      
      const start = startOfMonth(currentDate)
      const end = endOfMonth(currentDate)

      const { data: prenotazioniData } = await supabase
        .from('vista_prenotazioni_complete')
        .select('*')
        .gte('data_servizio', format(start, 'yyyy-MM-dd'))
        .lte('data_servizio', format(end, 'yyyy-MM-dd'))
        .order('data_servizio', { ascending: true })

      const { data: imbarcazioniData } = await supabase
        .from('imbarcazioni')
        .select('id, nome')
        .eq('attiva', true)
        .order('nome')

      setPrenotazioni(prenotazioniData || [])
      setImbarcazioni(imbarcazioniData || [])
    } catch (error) {
      toast.error('Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }

  function getPrenotazioniPerGiorno(date: Date) {
    return prenotazioni.filter(p => {
      if (filtroImbarcazione !== 'tutte' && p.imbarcazione_id !== filtroImbarcazione) {
        return false
      }
      return isSameDay(new Date(p.data_servizio), date)
    })
  }

  function handleDateClick(date: Date) {
    setSelectedDate(date)
    const prenot = getPrenotazioniPerGiorno(date)
    setPrenotazioniGiorno(prenot)
  }

  function getStatoColor(stato: string) {
    switch (stato) {
      case 'confermata': return 'bg-green-500'
      case 'pagata': return 'bg-blue-500'
      case 'completata': return 'bg-gray-400'
      case 'in_attesa': return 'bg-yellow-500'
      case 'cancellata': return 'bg-red-500'
      default: return 'bg-gray-300'
    }
  }

  function getStatoLabel(stato: string) {
    const labels: Record<string, string> = {
      'in_attesa': 'In Attesa',
      'confermata': 'Confermata',
      'pagata': 'Pagata',
      'completata': 'Completata',
      'cancellata': 'Cancellata'
    }
    return labels[stato] || stato
  }

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { locale: it })
  const calendarEnd = endOfWeek(monthEnd, { locale: it })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

  if (loading) {
    return <div className="p-8"><div className="text-gray-600">Caricamento...</div></div>
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Calendario Disponibilità</h1>
          <p className="text-gray-600 mt-1">Vista prenotazioni mensili</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              ←
            </button>
            <h2 className="text-xl font-bold text-gray-900 min-w-[200px] text-center">
              {format(currentDate, 'MMMM yyyy', { locale: it })}
            </h2>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              →
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
            >
              Oggi
            </button>
          </div>

          <div>
            <select
              value={filtroImbarcazione}
              onChange={(e) => setFiltroImbarcazione(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="tutte">Tutte le imbarcazioni</option>
              {imbarcazioni.map((imb) => (
                <option key={imb.id} value={imb.id}>{imb.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {weekDays.map((day) => (
            <div key={day} className="text-center font-semibold text-gray-600 text-xs md:text-sm py-2">
              {day}
            </div>
          ))}

          {calendarDays.map((day, idx) => {
            const prenotazioniGiorno = getPrenotazioniPerGiorno(day)
            const isCurrentMonth = isSameMonth(day, currentDate)
            const isToday = isSameDay(day, new Date())
            const isSelected = selectedDate && isSameDay(day, selectedDate)

            return (
              <div
                key={idx}
                onClick={() => handleDateClick(day)}
                className={`
                  min-h-[60px] md:min-h-[100px] p-1 md:p-2 border rounded-lg cursor-pointer
                  ${!isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'}
                  ${isToday ? 'border-blue-500 border-2' : 'border-gray-200'}
                  ${isSelected ? 'ring-2 ring-blue-300' : ''}
                  hover:bg-blue-50 transition-colors
                `}
              >
                <div className={`text-xs md:text-sm font-semibold mb-1 ${isToday ? 'text-blue-600' : ''}`}>
                  {format(day, 'd')}
                </div>
                {prenotazioniGiorno.length > 0 && (
                  <div className="space-y-1">
                    {prenotazioniGiorno.slice(0, 3).map((p, i) => (
                      <div
                        key={i}
                        className={`text-xs px-1 py-0.5 rounded text-white truncate ${getStatoColor(p.stato)}`}
                        title={`${p.servizio_nome} - ${p.cliente_nome_completo}`}
                      >
                        <span className="hidden md:inline">{p.servizio_nome}</span>
                        <span className="md:hidden">•</span>
                      </div>
                    ))}
                    {prenotazioniGiorno.length > 3 && (
                      <div className="text-xs text-gray-500">+{prenotazioniGiorno.length - 3}</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-500 rounded"></div>
          <span className="text-sm text-gray-600">In Attesa</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-sm text-gray-600">Confermata</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span className="text-sm text-gray-600">Pagata</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-400 rounded"></div>
          <span className="text-sm text-gray-600">Completata</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className="text-sm text-gray-600">Cancellata</span>
        </div>
      </div>

      {selectedDate && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Prenotazioni del {format(selectedDate, 'dd MMMM yyyy', { locale: it })}
          </h3>
          {prenotazioniGiorno.length === 0 ? (
            <p className="text-gray-500">Nessuna prenotazione per questa data</p>
          ) : (
            <div className="space-y-3">
              {prenotazioniGiorno.map((p) => (
                <div key={p.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-gray-900">{p.servizio_nome}</h4>
                      <p className="text-sm text-gray-600">{p.cliente_nome_completo}</p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full text-white ${getStatoColor(p.stato)}`}>
                      {getStatoLabel(p.stato)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Imbarcazione:</span> {p.imbarcazione_nome}
                    </div>
                    <div>
                      <span className="font-medium">Persone:</span> {p.numero_persone}
                    </div>
                    <div>
                      <span className="font-medium">Codice:</span> {p.codice_prenotazione}
                    </div>
                    <div>
                      <span className="font-medium">Importo:</span> €{Number(p.prezzo_totale).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}