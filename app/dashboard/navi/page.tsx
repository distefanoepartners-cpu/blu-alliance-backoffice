'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isToday, isBefore, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import toast from 'react-hot-toast'
import VistaStagione from './VistaStagione'

export default function NaviPage() {
  const [arrivi, setArrivi] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [meseCorrente, setMeseCorrente] = useState(startOfMonth(new Date()))
  const [vista, setVista] = useState<'lista' | 'mese' | 'stagione'>('lista')
  const [annoStagione, setAnnoStagione] = useState(new Date().getFullYear())

  // ⭐ Editing pax effettivi
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [savingPax, setSavingPax] = useState(false)

  useEffect(() => { loadArrivi() }, [meseCorrente, vista, annoStagione])

  async function loadArrivi() {
    try {
      setLoading(true)
      let query = supabase.from('arrivi_navi').select('*').order('data_arrivo').order('ora_arrivo')

      if (vista === 'stagione') {
        query = query
          .gte('data_arrivo', `${annoStagione}-01-01`)
          .lte('data_arrivo', `${annoStagione}-12-31`)
      } else {
        const from = format(meseCorrente, 'yyyy-MM-dd')
        const to = format(endOfMonth(meseCorrente), 'yyyy-MM-dd')
        query = query.gte('data_arrivo', from).lte('data_arrivo', to)
      }

      const { data, error } = await query
      if (error) throw error
      setArrivi(data || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  // ⭐ Avvia editing di una riga
  function startEdit(ship: any) {
    setEditingId(ship.id)
    setEditValue(ship.pax_effettivi != null ? String(ship.pax_effettivi) : '')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValue('')
  }

  // ⭐ Salva pax effettivi (stringa vuota => null, torna al nominale)
  async function savePaxEffettivi(shipId: string) {
    try {
      setSavingPax(true)
      const trimmed = editValue.trim()
      let value: number | null = null
      if (trimmed !== '') {
        const n = parseInt(trimmed, 10)
        if (isNaN(n) || n < 0) { toast.error('Inserisci un numero valido'); return }
        value = n
      }

      const { error } = await supabase
        .from('arrivi_navi')
        .update({ pax_effettivi: value })
        .eq('id', shipId)

      if (error) throw error

      setArrivi(prev => prev.map(a => a.id === shipId ? { ...a, pax_effettivi: value } : a))
      toast.success(value == null ? 'Ripristinata capienza nominale' : `Pax effettivi: ${value.toLocaleString('it-IT')}`)
      cancelEdit()
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Errore salvataggio')
    } finally {
      setSavingPax(false)
    }
  }

  const filtered = arrivi.filter(a => {
    if (!searchTerm) return true
    return a.nome_nave.toLowerCase().includes(searchTerm.toLowerCase())
  })

  // ⭐ Pax "operativo": effettivi se presenti, altrimenti nominale
  const paxOf = (a: any) => (a.pax_effettivi != null ? a.pax_effettivi : (a.capienza_pax || 0))

  // Stats
  const totalePax = filtered.reduce((s, a) => s + paxOf(a), 0)
  const totaleScali = filtered.length
  const naviUniche = new Set(filtered.map(a => a.nome_nave)).size
  const oggiScali = filtered.filter(a => isToday(parseISO(a.data_arrivo))).length

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
    return (groupedByDate[dateStr] || []).reduce((s: number, a: any) => s + paxOf(a), 0)
  }

  const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

  const isStagione = vista === 'stagione'

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">🚢 Arrivi Navi</h1>
          <p className="text-gray-600 mt-1">
            Porto di Salerno — {isStagione ? `Stagione ${annoStagione}` : 'Stagione 2026'}
          </p>
        </div>
        {!isStagione && (
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
        )}
        {isStagione && (
          <div className="flex items-center gap-2">
            <button onClick={() => setAnnoStagione(annoStagione - 1)}
              className="px-2 py-1 border border-gray-300 rounded text-sm bg-white hover:bg-gray-50">◀</button>
            <span className="text-sm font-bold text-gray-900 px-3">{annoStagione}</span>
            <button onClick={() => setAnnoStagione(annoStagione + 1)}
              className="px-2 py-1 border border-gray-300 rounded text-sm bg-white hover:bg-gray-50">▶</button>
          </div>
        )}
      </div>

      {/* KPI mensili */}
      {!isStagione && (
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
      )}

      {/* Filtri + Toggle vista */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4">
        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cerca nave..."
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm w-full sm:flex-1 md:flex-none md:w-64 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        <div className="flex gap-1">
          <button onClick={() => setVista('lista')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${vista === 'lista' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            📋 Lista
          </button>
          <button onClick={() => setVista('mese')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${vista === 'mese' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            📅 Tabella
          </button>
          <button onClick={() => setVista('stagione')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${vista === 'stagione' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            📊 Stagione
          </button>
        </div>
        {!isStagione && (
          <div className="hidden md:flex items-center gap-3 ml-auto text-[10px] text-gray-500">
            <span>🔴 +3000</span><span>🟠 +1500</span><span>🟡 +500</span><span>🟢 &lt;500</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-600">Caricamento...</div>
      ) : isStagione ? (
        <VistaStagione arrivi={filtered} />
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
                    const badge = getSizeBadge(paxOf(ship))
                    const hasEffettivi = ship.pax_effettivi != null
                    const isEditing = editingId === ship.id
                    return (
                      <div key={ship.id} className="px-4 py-3 flex items-center gap-3 bg-white hover:bg-gray-50">
                        <span className="text-xl">{badge.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">{ship.nome_nave}</span>
                            {/* Pax nominale */}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ${badge.color}`}>
                              {(ship.capienza_pax || 0).toLocaleString('it-IT')} nominali
                            </span>
                            {/* Pax effettivi (badge blu se presenti) */}
                            {hasEffettivi && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-blue-300 bg-blue-50 text-blue-700 font-semibold">
                                ✓ {ship.pax_effettivi.toLocaleString('it-IT')} effettivi
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {ship.ora_arrivo && <span>Arrivo: {ship.ora_arrivo.slice(0, 5)}</span>}
                            {ship.ora_partenza && <span> → Partenza: {ship.ora_partenza.slice(0, 5)}</span>}
                            {ship.data_partenza && ship.data_partenza !== ship.data_arrivo && (
                              <span className="ml-1 text-amber-600">(partenza {format(parseISO(ship.data_partenza), 'd MMM', { locale: it })})</span>
                            )}
                          </div>
                        </div>

                        {/* ⭐ Editing pax effettivi */}
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') savePaxEffettivi(ship.id)
                                if (e.key === 'Escape') cancelEdit()
                              }}
                              placeholder="Pax reali"
                              autoFocus
                              className="w-24 px-2 py-1 border border-blue-400 rounded text-sm h-[32px]"
                            />
                            <button
                              onClick={() => savePaxEffettivi(ship.id)}
                              disabled={savingPax}
                              className="px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50 h-[32px]"
                              title="Salva"
                            >
                              {savingPax ? '⏳' : '✓'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={savingPax}
                              className="px-2 py-1 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-100 h-[32px]"
                              title="Annulla"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(ship)}
                            className="px-2.5 py-1 border border-gray-300 text-gray-600 rounded-lg text-xs font-medium hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 whitespace-nowrap"
                            title="Inserisci passeggeri effettivi"
                          >
                            ✏️ Pax reali
                          </button>
                        )}
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
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Nominali</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Effettivi</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Arrivo</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Partenza</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map(ship => {
                  const dayDate = parseISO(ship.data_arrivo)
                  const isOggi = isToday(dayDate)
                  const badge = getSizeBadge(paxOf(ship))
                  const isEditing = editingId === ship.id
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
                        <span className="text-xs text-gray-500">
                          {(ship.capienza_pax || 0).toLocaleString('it-IT')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') savePaxEffettivi(ship.id)
                                if (e.key === 'Escape') cancelEdit()
                              }}
                              autoFocus
                              className="w-20 px-1.5 py-1 border border-blue-400 rounded text-sm h-[30px] text-center"
                            />
                            <button onClick={() => savePaxEffettivi(ship.id)} disabled={savingPax}
                              className="px-1.5 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 h-[30px]">
                              {savingPax ? '⏳' : '✓'}
                            </button>
                            <button onClick={cancelEdit} disabled={savingPax}
                              className="px-1.5 py-1 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-100 h-[30px]">✕</button>
                          </div>
                        ) : ship.pax_effettivi != null ? (
                          <button onClick={() => startEdit(ship)}
                            className="text-xs px-2 py-0.5 rounded-full border border-blue-300 bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100"
                            title="Modifica pax effettivi">
                            {ship.pax_effettivi.toLocaleString('it-IT')} ✏️
                          </button>
                        ) : (
                          <button onClick={() => startEdit(ship)}
                            className="text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-400 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300"
                            title="Inserisci pax effettivi">
                            + inserisci
                          </button>
                        )}
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