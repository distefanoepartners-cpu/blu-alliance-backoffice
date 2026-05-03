'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isToday, isBefore, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

export default function NaviPage() {
  const [arrivi, setArrivi] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [meseCorrente, setMeseCorrente] = useState(startOfMonth(new Date()))
  const [vista, setVista] = useState<'lista' | 'mese'>('lista')

  useEffect(() => { loadArrivi() }, [meseCorrente])

  async function loadArrivi() {
    try {
      setLoading(true)
      const from = format(meseCorrente, 'yyyy-MM-dd')
      const to = format(endOfMonth(meseCorrente), 'yyyy-MM-dd')
      const { data, error } = await supabase
        .from('arrivi_navi')
        .select('*')
        .gte('data_arrivo', from)
        .lte('data_arrivo', to)
        .order('data_arrivo')
        .order('ora_arrivo')
      if (error) throw error
      setArrivi(data || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const filtered = arrivi.filter(a => {
    if (!searchTerm) return true
    return a.nome_nave.toLowerCase().includes(searchTerm.toLowerCase())
  })

  // Stats
  const totalePax = filtered.reduce((s, a) => s + (a.capienza_pax || 0), 0)
  const totaleScali = filtered.length
  const naviUniche = new Set(filtered.map(a => a.nome_nave)).size
  const oggiScali = filtered.filter(a => isToday(parseISO(a.data_arrivo))).length

  // Group by date for list view
  const groupedByDate: Record<string, any[]> = {}
  filtered.forEach(a => {
    if (!groupedByDate[a.data_arrivo]) groupedByDate[a.data_arrivo] = []
    groupedByDate[a.data_arrivo].push(a)
  })
  const sortedDates = Object.keys(groupedByDate).sort()

  function getSizeBadge(pax: number) {
    if (pax >= 3000) return { emoji: '🔴', label: 'XL', color: 'bg-red-100 text-red-700 border-red-200' }
    if (pax >= 1500) return { emoji: '🟠', label: 'L', color: 'bg-orange-100 text-orange-700 border-orange-200' }
    if (pax >= 500) return { emoji: '🟡', label: 'M', color: 'bg-amber-100 text-amber-700 border-amber-200' }
    return { emoji: '🟢', label: 'S', color: 'bg-green-100 text-green-700 border-green-200' }
  }

  function getDayPaxTotal(dateStr: string) {
    return (groupedByDate[dateStr] || []).reduce((s: number, a: any) => s + (a.capienza_pax || 0), 0)
  }

  const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">🚢 Arrivi Navi</h1>
          <p className="text-gray-600 mt-1">Porto di Salerno — Stagione 2026</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMeseCorrente(subMonths(meseCorrente, 1))}
            className="px-2 py-1 border border-gray-300 rounded text-sm bg-white hover:bg-gray-50">◀</button>
          <button onClick={() => setMeseCorrente(startOfMonth(new Date()))}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-semibold">Oggi</button>
          <button onClick={() => setMeseCorrente(addMonths(meseCorrente, 1))}
            className="px-2 py-1 border border-gray-300 rounded text-sm bg-white hover:bg-gray-50">▶</button>
          <span className="text-sm font-bold text-gray-900 ml-2">
            {monthNames[meseCorrente.getMonth()]} {meseCorrente.getFullYear()}
          </span>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{totaleScali}</div>
          <div className="text-xs text-gray-500">Scali nel mese</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="text-2xl font-bold text-blue-600">{totalePax.toLocaleString('it-IT')}</div>
          <div className="text-xs text-gray-500">Passeggeri totali</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="text-2xl font-bold text-green-600">{naviUniche}</div>
          <div className="text-xs text-gray-500">Navi uniche</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="text-2xl font-bold text-amber-600">{oggiScali}</div>
          <div className="text-xs text-gray-500">Scali oggi</div>
        </div>
      </div>

      {/* Filtri */}
      <div className="flex items-center gap-3 mb-4">
        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cerca nave..."
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm flex-1 md:flex-none md:w-64 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        <div className="flex gap-1">
          <button onClick={() => setVista('lista')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${vista === 'lista' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            📋 Lista
          </button>
          <button onClick={() => setVista('mese')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${vista === 'mese' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            📅 Tabella
          </button>
        </div>
        {/* Legenda */}
        <div className="hidden md:flex items-center gap-3 ml-auto text-[10px] text-gray-500">
          <span>🔴 +3000</span><span>🟠 +1500</span><span>🟡 +500</span><span>🟢 &lt;500</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-600">Caricamento...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Nessun arrivo previsto in questo mese</div>
      ) : vista === 'lista' ? (
        /* ── VISTA LISTA ── */
        <div className="space-y-4">
          {sortedDates.map(dateStr => {
            const ships = groupedByDate[dateStr]
            const dayDate = parseISO(dateStr)
            const isOggi = isToday(dayDate)
            const isPassato = isBefore(dayDate, new Date()) && !isOggi
            const dayPax = getDayPaxTotal(dateStr)

            return (
              <div key={dateStr} className={`rounded-xl border overflow-hidden ${isOggi ? 'border-blue-300 shadow-md' : isPassato ? 'border-gray-200 opacity-60' : 'border-gray-200'}`}>
                <div className={`px-4 py-2 flex items-center justify-between ${isOggi ? 'bg-blue-50' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    {isOggi && <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
                    <span className={`text-sm font-bold ${isOggi ? 'text-blue-700' : 'text-gray-900'}`}>
                      {format(dayDate, 'EEEE d MMMM', { locale: it })}
                    </span>
                    <span className="text-xs text-gray-400">{ships.length} {ships.length === 1 ? 'nave' : 'navi'}</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-600">{dayPax.toLocaleString('it-IT')} pax</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {ships.map((ship: any) => {
                    const badge = getSizeBadge(ship.capienza_pax)
                    return (
                      <div key={ship.id} className="px-4 py-3 flex items-center gap-3 bg-white hover:bg-gray-50">
                        <span className="text-xl">{badge.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 text-sm">{ship.nome_nave}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ${badge.color}`}>
                              {ship.capienza_pax.toLocaleString('it-IT')} pax
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {ship.ora_arrivo && <span>Arrivo: {ship.ora_arrivo.slice(0, 5)}</span>}
                            {ship.ora_partenza && <span> → Partenza: {ship.ora_partenza.slice(0, 5)}</span>}
                            {ship.data_partenza && ship.data_partenza !== ship.data_arrivo && (
                              <span className="ml-1 text-amber-600">(partenza {format(parseISO(ship.data_partenza), 'd MMM', { locale: it })})</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── VISTA TABELLA ── */
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nave</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Pax</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Arrivo</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Partenza</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map(ship => {
                  const dayDate = parseISO(ship.data_arrivo)
                  const isOggi = isToday(dayDate)
                  const badge = getSizeBadge(ship.capienza_pax)
                  return (
                    <tr key={ship.id} className={isOggi ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isOggi && <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
                          <span className={`text-sm ${isOggi ? 'font-bold text-blue-700' : 'text-gray-900'}`}>
                            {format(dayDate, 'EEE dd/MM', { locale: it })}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span>{badge.emoji}</span>
                          <span className="font-semibold text-sm text-gray-900">{ship.nome_nave}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${badge.color}`}>
                          {ship.capienza_pax.toLocaleString('it-IT')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-sm text-gray-600">
                        {ship.ora_arrivo ? ship.ora_arrivo.slice(0, 5) : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-center text-sm text-gray-600">
                        {ship.ora_partenza ? ship.ora_partenza.slice(0, 5) : '-'}
                        {ship.data_partenza && ship.data_partenza !== ship.data_arrivo && (
                          <span className="text-[10px] text-amber-600 ml-1">({format(parseISO(ship.data_partenza), 'd/MM', { locale: it })})</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}