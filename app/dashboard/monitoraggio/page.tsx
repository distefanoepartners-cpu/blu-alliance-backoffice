'use client'
import { useRequireRole } from '@/lib/useRequireRole'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, formatDistanceToNow, subDays } from 'date-fns'
import { it } from 'date-fns/locale'

interface UserStats {
  user_email: string
  user_name: string | null
  totale_azioni: number
  pagine_visitate: number
  giorni_attivi: number
  ultimo_accesso: string
  primo_accesso: string
  visite: number
  modifiche: number
  azioni_ultimi_7gg: number
  azioni_ultimi_30gg: number
}

interface ActivityLog {
  id: string
  user_email: string
  user_name: string | null
  pagina: string
  azione: string
  dettagli: any
  created_at: string
}

interface DailyStats {
  giorno: string
  visite: number
  modifiche: number
}

export default function MonitoraggioPage() {
  const { authorized, loading: authLoading } = useRequireRole(['admin'])
  const [userStats, setUserStats] = useState<UserStats[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([])
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'utenti' | 'attivita' | 'dettaglio'>('utenti')
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [selectedUserLogs, setSelectedUserLogs] = useState<ActivityLog[]>([])
  const [periodo, setPeriodo] = useState<'7' | '30' | '90'>('30')

  useEffect(() => { loadData() }, [periodo])

  async function loadData() {
    try {
      setLoading(true)

      // 1. Riepilogo utenti
      const { data: statsData } = await supabase
        .from('vista_attivita_utenti')
        .select('*')
        .order('ultimo_accesso', { ascending: false })

      setUserStats(statsData || [])

      // 2. Attività recente (ultime 100)
      const { data: activityData } = await supabase
        .from('activity_log')
        .select('*')
        .gte('created_at', subDays(new Date(), parseInt(periodo)).toISOString())
        .order('created_at', { ascending: false })
        .limit(200)

      setRecentActivity(activityData || [])

      // 3. Stats giornaliere
      if (activityData) {
        const byDay: Record<string, { visite: number; modifiche: number }> = {}
        activityData.forEach(log => {
          const giorno = log.created_at.split('T')[0]
          if (!byDay[giorno]) byDay[giorno] = { visite: 0, modifiche: 0 }
          if (log.azione === 'visita') byDay[giorno].visite++
          else byDay[giorno].modifiche++
        })
        const daily = Object.entries(byDay)
          .map(([giorno, stats]) => ({ giorno, ...stats }))
          .sort((a, b) => a.giorno.localeCompare(b.giorno))
        setDailyStats(daily)
      }

    } catch (error) {
      console.error('Errore caricamento monitoraggio:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadUserDetail(email: string) {
    setSelectedUser(email)
    setActiveTab('dettaglio')
    const { data } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_email', email)
      .gte('created_at', subDays(new Date(), parseInt(periodo)).toISOString())
      .order('created_at', { ascending: false })
      .limit(200)
    setSelectedUserLogs(data || [])
  }

  // ── Totali ──
  const totaleUtenti = userStats.length
  const utentiAttivi7gg = userStats.filter(u => u.azioni_ultimi_7gg > 0).length
  const utentiAttivi30gg = userStats.filter(u => u.azioni_ultimi_30gg > 0).length
  const totaleAzioni = recentActivity.length
  const totaleModifiche = recentActivity.filter(a => ['crea', 'modifica', 'elimina'].includes(a.azione)).length

  // ── Chart semplice ──
  const maxDayValue = Math.max(...dailyStats.map(d => d.visite + d.modifiche), 1)

  function getAzioneColor(azione: string) {
    switch (azione) {
      case 'visita': return 'bg-blue-100 text-blue-700'
      case 'crea': return 'bg-green-100 text-green-700'
      case 'modifica': return 'bg-amber-100 text-amber-700'
      case 'elimina': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  function getAzioneIcon(azione: string) {
    switch (azione) {
      case 'visita': return '👁️'
      case 'crea': return '➕'
      case 'modifica': return '✏️'
      case 'elimina': return '🗑️'
      default: return '📋'
    }
  }

  function getStatusBadge(user: UserStats) {
    const now = new Date()
    const ultimo = new Date(user.ultimo_accesso)
    const diffHours = (now.getTime() - ultimo.getTime()) / (1000 * 60 * 60)

    if (diffHours < 1) return { label: 'Online', color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' }
    if (diffHours < 24) return { label: 'Oggi', color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' }
    if (diffHours < 72) return { label: 'Recente', color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' }
    if (diffHours < 168) return { label: 'Settimana', color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' }
    return { label: 'Inattivo', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' }
  }

  if (authLoading || !authorized) return <div className="p-8"><div className="text-gray-600">Verifica accesso...</div></div>
  if (loading) {
    return <div className="p-8"><div className="text-gray-600">Caricamento monitoraggio...</div></div>
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">📊 Monitoraggio Accessi</h1>
          <p className="text-gray-600 mt-1">Attività utenti sulla piattaforma</p>
        </div>
        <div className="flex gap-2">
          {(['7', '30', '90'] as const).map(p => (
            <button key={p} onClick={() => setPeriodo(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${periodo === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {p}gg
            </button>
          ))}
          <button onClick={loadData} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">🔄</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{totaleUtenti}</div>
          <div className="text-xs text-gray-500 mt-1">Utenti Totali</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="text-2xl font-bold text-green-600">{utentiAttivi7gg}</div>
          <div className="text-xs text-gray-500 mt-1">Attivi (7gg)</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="text-2xl font-bold text-blue-600">{utentiAttivi30gg}</div>
          <div className="text-xs text-gray-500 mt-1">Attivi (30gg)</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{totaleAzioni}</div>
          <div className="text-xs text-gray-500 mt-1">Azioni ({periodo}gg)</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="text-2xl font-bold text-amber-600">{totaleModifiche}</div>
          <div className="text-xs text-gray-500 mt-1">Modifiche ({periodo}gg)</div>
        </div>
      </div>

      {/* Grafico Attività Giornaliera */}
      {dailyStats.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">📈 Attività Giornaliera</h3>
          <div className="flex items-end gap-1 h-32 overflow-x-auto">
            {dailyStats.slice(-30).map((day, i) => {
              const total = day.visite + day.modifiche
              const height = Math.max((total / maxDayValue) * 100, 4)
              const modHeight = total > 0 ? (day.modifiche / total) * height : 0
              const visitHeight = height - modHeight
              const isToday = day.giorno === format(new Date(), 'yyyy-MM-dd')
              return (
                <div key={day.giorno} className="flex flex-col items-center flex-shrink-0" style={{ minWidth: '20px' }}>
                  <div className="text-[8px] text-gray-400 mb-0.5">{total}</div>
                  <div className="flex flex-col" style={{ height: `${height}%` }}>
                    <div className="bg-blue-400 rounded-t-sm w-4" style={{ height: `${visitHeight}%`, minHeight: visitHeight > 0 ? '2px' : '0' }} />
                    <div className="bg-amber-400 rounded-b-sm w-4" style={{ height: `${modHeight}%`, minHeight: modHeight > 0 ? '2px' : '0' }} />
                  </div>
                  <div className={`text-[8px] mt-0.5 ${isToday ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                    {format(new Date(day.giorno), 'dd')}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-400 rounded-sm" /><span className="text-[10px] text-gray-500">Visite</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-400 rounded-sm" /><span className="text-[10px] text-gray-500">Modifiche</span></div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        <button onClick={() => setActiveTab('utenti')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'utenti' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          👥 Utenti ({totaleUtenti})
        </button>
        <button onClick={() => setActiveTab('attivita')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'attivita' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          📋 Attività Recente
        </button>
        {selectedUser && (
          <button onClick={() => setActiveTab('dettaglio')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dettaglio' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            🔍 {selectedUser.split('@')[0]}
          </button>
        )}
      </div>

      {/* ── TAB UTENTI ── */}
      {activeTab === 'utenti' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stato</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ultimo Accesso</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Giorni Attivi</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Visite</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Modifiche</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">7gg</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">30gg</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {userStats.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Nessun dato di attività registrato</td></tr>
                ) : (
                  userStats.map(user => {
                    const status = getStatusBadge(user)
                    return (
                      <tr key={user.user_email} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-blue-600 font-semibold text-sm">
                                {(user.user_name || user.user_email)?.[0]?.toUpperCase() || '?'}
                              </span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{user.user_name || '-'}</div>
                              <div className="text-xs text-gray-500">{user.user_email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${status.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">{format(new Date(user.ultimo_accesso), 'dd MMM yyyy HH:mm', { locale: it })}</div>
                          <div className="text-xs text-gray-500">{formatDistanceToNow(new Date(user.ultimo_accesso), { addSuffix: true, locale: it })}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-semibold text-gray-900">{user.giorni_attivi}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-blue-600 font-medium">{user.visite}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-amber-600 font-medium">{user.modifiche}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-sm font-semibold ${user.azioni_ultimi_7gg > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {user.azioni_ultimi_7gg}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-sm font-semibold ${user.azioni_ultimi_30gg > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {user.azioni_ultimi_30gg}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => loadUserDetail(user.user_email)}
                            className="text-blue-600 hover:text-blue-900 text-sm font-medium">
                            Dettagli
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB ATTIVITÀ RECENTE ── */}
      {activeTab === 'attivita' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data/Ora</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pagina</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Azione</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dettagli</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentActivity.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Nessuna attività nel periodo</td></tr>
                ) : (
                  recentActivity.slice(0, 100).map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="text-xs text-gray-900">{format(new Date(log.created_at), 'dd/MM HH:mm', { locale: it })}</div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <button onClick={() => loadUserDetail(log.user_email)} className="text-sm text-blue-600 hover:underline">
                          {log.user_name || log.user_email.split('@')[0]}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-sm text-gray-900 font-medium">{log.pagina}</span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getAzioneColor(log.azione)}`}>
                          {getAzioneIcon(log.azione)} {log.azione}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {log.dettagli ? (
                          <span className="text-xs text-gray-500 truncate block max-w-xs">
                            {typeof log.dettagli === 'object' ? JSON.stringify(log.dettagli).substring(0, 80) : String(log.dettagli)}
                          </span>
                        ) : <span className="text-xs text-gray-400">-</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB DETTAGLIO UTENTE ── */}
      {activeTab === 'dettaglio' && selectedUser && (
        <div>
          {/* User summary */}
          {(() => {
            const user = userStats.find(u => u.user_email === selectedUser)
            if (!user) return null
            const status = getStatusBadge(user)
            return (
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-4">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-xl">{(user.user_name || user.user_email)?.[0]?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-gray-900">{user.user_name || user.user_email}</h2>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${status.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">{user.user_email}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Primo accesso: {format(new Date(user.primo_accesso), 'dd MMM yyyy', { locale: it })} •
                      Ultimo: {formatDistanceToNow(new Date(user.ultimo_accesso), { addSuffix: true, locale: it })}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-xl font-bold text-gray-900">{user.giorni_attivi}</div>
                      <div className="text-[10px] text-gray-500">Giorni</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-blue-600">{user.visite}</div>
                      <div className="text-[10px] text-gray-500">Visite</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-amber-600">{user.modifiche}</div>
                      <div className="text-[10px] text-gray-500">Modifiche</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-green-600">{user.azioni_ultimi_7gg}</div>
                      <div className="text-[10px] text-gray-500">7gg</div>
                    </div>
                  </div>
                </div>

                {/* Pagine più visitate */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="text-xs font-semibold text-gray-500 mb-2">Pagine più visitate</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      const pageCounts: Record<string, number> = {}
                      selectedUserLogs.forEach(l => { pageCounts[l.pagina] = (pageCounts[l.pagina] || 0) + 1 })
                      return Object.entries(pageCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10)
                        .map(([pagina, count]) => (
                          <span key={pagina} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">
                            {pagina} <span className="font-bold text-blue-600">{count}</span>
                          </span>
                        ))
                    })()}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Activity timeline */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700">Timeline attività ({selectedUserLogs.length} azioni)</h3>
            </div>
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {selectedUserLogs.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">Nessuna attività nel periodo</div>
              ) : (
                selectedUserLogs.map(log => (
                  <div key={log.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50">
                    <div className="text-xs text-gray-400 w-24 flex-shrink-0">
                      {format(new Date(log.created_at), 'dd/MM HH:mm')}
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${getAzioneColor(log.azione)}`}>
                      {getAzioneIcon(log.azione)} {log.azione}
                    </span>
                    <span className="text-sm text-gray-900 font-medium">{log.pagina}</span>
                    {log.dettagli && (
                      <span className="text-xs text-gray-500 truncate">
                        {typeof log.dettagli === 'object' ? JSON.stringify(log.dettagli) : String(log.dettagli)}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}