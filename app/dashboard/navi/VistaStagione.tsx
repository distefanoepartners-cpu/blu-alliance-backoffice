'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip, PieChart, Pie } from 'recharts'

// =============================================================================
// MAPPING nave -> [compagnia, mercato]
// Centralizzato qui per evitare duplicazioni. Se in futuro serve altrove,
// estrarre in /lib/cruise-mapping.ts
// =============================================================================
const SHIP_MAP: Record<string, [string, string]> = {
  'ENCHANTED PRINCESS': ['Princess Cruises', 'USA'],
  'CELEBRITY CONSTELLATION': ['Celebrity Cruises', 'USA'],
  'CELEBRITY XCEL': ['Celebrity Cruises', 'USA'],
  'CELEBRITY ASCENT': ['Celebrity Cruises', 'USA'],
  'CELEBRITY ECLIPSE': ['Celebrity Cruises', 'USA'],
  'NAUTICA': ['Oceania Cruises', 'USA'],
  'SIRENA': ['Oceania Cruises', 'USA'],
  'ALLURA': ['Oceania Cruises', 'USA'],
  'NORWEGIAN VIVA': ['Norwegian Cruise Line', 'USA'],
  'NORWEGIAN EPIC': ['Norwegian Cruise Line', 'USA'],
  'NORWEGIAN GEM': ['Norwegian Cruise Line', 'USA'],
  'NORWEGIAN SKY': ['Norwegian Cruise Line', 'USA'],
  'ARTEMIS': ['Variety Cruises', 'USA/EU'],
  'ATHENA': ['Variety Cruises', 'USA/EU'],
  'SILVER SHADOW': ['Silversea', 'USA'],
  'SILVER RAY': ['Silversea', 'USA'],
  'SCARLET LADY': ['Virgin Voyages', 'USA/UK'],
  'VALIANT LADY': ['Virgin Voyages', 'USA/UK'],
  'SEA CLOUD II': ['Sea Cloud Cruises', 'DE'],
  'SEA CLOUD SPIRIT': ['Sea Cloud Cruises', 'DE'],
  'WORLD TRAVELLER': ['Atlas Ocean Voyages', 'USA'],
  'OOSTERDAM': ['Holland America', 'USA'],
  'BRILLANCE OF THE SEAS': ['Royal Caribbean', 'USA'],
  'AURORA': ['P&O Cruises', 'UK'],
  'QUEEN VICTORIA': ['Cunard', 'UK'],
  "LE DUMONT D'URVILLE": ['Ponant', 'FR'],
  'LE CHAMPLAIN': ['Ponant', 'FR'],
  'LE BOREAL': ['Ponant', 'FR'],
  'MARELLA DISCOVERY 2': ['Marella Cruises', 'UK'],
  'DOUGLAS MASON': ['Charter / Sailing', 'EU'],
  'DOUGLAS MAWSON': ['Aurora Expeditions', 'AU/USA'],
  'AZAMARA ONWARD': ['Azamara', 'USA'],
  'CRYSTAL SERENITY': ['Crystal Cruises', 'USA'],
  'CARNIVAL LEGEND': ['Carnival Cruise Line', 'USA'],
  'HEBRIDEAN SKY': ['Noble Caledonia', 'UK'],
  'EUROPA 2': ['Hapag-Lloyd Cruises', 'DE'],
  'BOREALIS': ['Fred Olsen', 'UK'],
  'BALMORAL': ['Fred Olsen', 'UK'],
  'SEVEN SEAS NAVIGATOR': ['Regent Seven Seas', 'USA'],
  'SEVEN SEAS PRESTIGE': ['Regent Seven Seas', 'USA'],
  'MEIN SCHIFF 4': ['TUI Cruises', 'DE'],
  'MEIN SCHIFF 5': ['TUI Cruises', 'DE'],
  'MEIN SCHIFF 7': ['TUI Cruises', 'DE'],
  'VIKING SATURN': ['Viking Ocean', 'USA/UK'],
  "LA BELLE DE L'ADRIATIQUE": ['CroisiEurope', 'FR'],
}

const MARKET_COLOR: Record<string, string> = {
  USA: '#2563eb',
  UK: '#0891b2',
  'USA/UK': '#7c3aed',
  DE: '#dc2626',
  FR: '#16a34a',
  'USA/EU': '#d97706',
  EU: '#64748b',
  'AU/USA': '#db2777',
}

const MONTH_NAMES_SHORT: Record<string, string> = {
  '01': 'Gen', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'Mag', '06': 'Giu',
  '07': 'Lug', '08': 'Ago', '09': 'Set', '10': 'Ott', '11': 'Nov', '12': 'Dic',
}

interface Arrivo {
  id: number
  data_arrivo: string
  nome_nave: string
  capienza_pax: number
  pax_effettivi?: number | null
}

// Pax operativo: effettivi se comunicati dall'operativo, altrimenti nominale
const paxOf = (a: Arrivo) => (a.pax_effettivi != null ? a.pax_effettivi : (a.capienza_pax || 0))

export default function VistaStagione({ arrivi }: { arrivi: Arrivo[] }) {
  const stats = useMemo(() => {
    const totaleArrivi = arrivi.length
    const totalePax = arrivi.reduce((s, a) => s + paxOf(a), 0)

    const byMonth: Record<string, number> = {}
    const byMarket: Record<string, number> = {}
    const byCompany: Record<string, { pax: number; arrivi: number; market: string }> = {}
    const byDay: Record<string, { pax: number; navi: string[] }> = {}

    arrivi.forEach((a) => {
      const month = a.data_arrivo.slice(0, 7)
      const [company, market] = SHIP_MAP[a.nome_nave] || ['Altro', 'EU']
      const pax = paxOf(a)
      byMonth[month] = (byMonth[month] || 0) + pax
      byMarket[market] = (byMarket[market] || 0) + pax
      if (!byCompany[company]) byCompany[company] = { pax: 0, arrivi: 0, market }
      byCompany[company].pax += pax
      byCompany[company].arrivi += 1
      if (!byDay[a.data_arrivo]) byDay[a.data_arrivo] = { pax: 0, navi: [] }
      byDay[a.data_arrivo].pax += pax
      byDay[a.data_arrivo].navi.push(a.nome_nave)
    })

    const monthData = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, pax]) => ({ month: MONTH_NAMES_SHORT[m.slice(5)], pax, key: m }))

    const peakMonth = monthData.length
      ? monthData.reduce((m, c) => (c.pax > m.pax ? c : m), monthData[0])
      : { month: '-', pax: 0, key: '' }

    const marketData = Object.entries(byMarket)
      .map(([market, pax]) => ({ market, pax, color: MARKET_COLOR[market] || '#64748b' }))
      .sort((a, b) => b.pax - a.pax)

    const companyData = Object.entries(byCompany)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.pax - a.pax)
      .slice(0, 10)

    const multiNaveDays = Object.entries(byDay)
      .filter(([, v]) => v.navi.length >= 2)
      .map(([data, v]) => ({ data, ...v }))
      .sort((a, b) => b.pax - a.pax)
      .slice(0, 12)

    const peakDay = multiNaveDays[0] || null

    return { totaleArrivi, totalePax, monthData, peakMonth, marketData, companyData, multiNaveDays, peakDay, byDay }
  }, [arrivi])

  // Heatmap calendario
  const seasonMonths = stats.monthData.map((m) => m.key).filter(Boolean)
  const heatmapData = seasonMonths.map((mKey) => {
    const [yearStr, mStr] = mKey.split('-')
    const year = parseInt(yearStr)
    const month = parseInt(mStr)
    const daysInMonth = new Date(year, month, 0).getDate()
    const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7
    const days: Array<{ empty?: boolean; key?: string; day?: number; dateStr?: string; pax?: number; navi?: string[] }> = []
    for (let i = 0; i < firstWeekday; i++) days.push({ empty: true, key: `e-${mKey}-${i}` })
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${yearStr}-${mStr}-${String(d).padStart(2, '0')}`
      const info = stats.byDay[dateStr]
      days.push({ day: d, dateStr, pax: info?.pax || 0, navi: info?.navi || [] })
    }
    return { month: MONTH_NAMES_SHORT[mStr], days }
  })

  const allDayPax = Object.values(stats.byDay).map((v) => v.pax)
  const maxDayPax = allDayPax.length ? Math.max(...allDayPax) : 0
  const heatColor = (pax: number) => {
    if (!pax) return '#f9fafb'
    const t = pax / maxDayPax
    if (t < 0.2) return '#dbeafe'
    if (t < 0.45) return '#93c5fd'
    if (t < 0.7) return '#3b82f6'
    return '#1d4ed8'
  }

  if (arrivi.length === 0) {
    return <div className="text-center py-12 text-gray-500">Nessun arrivo nella stagione selezionata</div>
  }

  return (
    <div className="space-y-6">
      {/* KPI stagionali */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{stats.totaleArrivi}</div>
          <div className="text-xs text-gray-500">Arrivi stagionali</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="text-2xl font-bold text-blue-600">{stats.totalePax.toLocaleString('it-IT')}</div>
          <div className="text-xs text-gray-500">Passeggeri totali</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="text-2xl font-bold text-green-600">{stats.peakMonth.month}</div>
          <div className="text-xs text-gray-500">Mese di picco — {stats.peakMonth.pax.toLocaleString('it-IT')} pax</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="text-2xl font-bold text-amber-600">
            {stats.peakDay ? stats.peakDay.data.slice(8) + '/' + stats.peakDay.data.slice(5, 7) : '-'}
          </div>
          <div className="text-xs text-gray-500">
            {stats.peakDay ? `Giorno top — ${stats.peakDay.navi.length} navi · ${stats.peakDay.pax.toLocaleString('it-IT')} pax` : '-'}
          </div>
        </div>
      </div>

      {/* Distribuzione mensile */}
      <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900">📊 Distribuzione mensile</h2>
          <span className="text-xs text-gray-500">Passeggeri totali per mese</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={stats.monthData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <XAxis dataKey="month" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
            <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => [v.toLocaleString('it-IT') + ' pax', 'Passeggeri']}
              cursor={{ fill: 'rgba(37, 99, 235, 0.05)' }}
            />
            <Bar dataKey="pax" radius={[4, 4, 0, 0]}>
              {stats.monthData.map((d, i) => (
                <Cell key={i} fill={d.month === stats.peakMonth.month ? '#2563eb' : '#93c5fd'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Mercati + Compagnie */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">🌍 Mercati</h2>
            <span className="text-xs text-gray-500">Per area linguistica</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={stats.marketData} dataKey="pax" nameKey="market" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                {stats.marketData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [v.toLocaleString('it-IT') + ' pax']}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-3">
            {stats.marketData.map((m) => {
              const pct = ((m.pax / stats.totalePax) * 100).toFixed(1)
              return (
                <div key={m.market} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                    <span className="text-gray-700 font-medium">{m.market}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 tabular-nums">{m.pax.toLocaleString('it-IT')}</span>
                    <span className="text-blue-600 font-semibold w-12 text-right">{pct}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">🚢 Top 10 compagnie</h2>
            <span className="text-xs text-gray-500">Per passeggeri</span>
          </div>
          <div className="space-y-2.5">
            {stats.companyData.map((c, i) => {
              const pct = (c.pax / (stats.companyData[0]?.pax || 1)) * 100
              const color = MARKET_COLOR[c.market] || '#64748b'
              return (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 w-5 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                      <span className="text-gray-900 font-semibold">{c.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: color + '20', color }}>
                        {c.market}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums">
                      <span className="text-gray-400">{c.arrivi} arr</span>
                      <span className="text-gray-900 font-semibold w-20 text-right">{c.pax.toLocaleString('it-IT')}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Heatmap calendario */}
      <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900">📅 Calendario intensità</h2>
          <span className="text-xs text-gray-500">Heatmap giornaliera passeggeri</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {heatmapData.map((m) => (
            <div key={m.month}>
              <div className="text-xs text-blue-600 uppercase tracking-wider mb-2 font-bold">{m.month}</div>
              <div className="grid grid-cols-7 gap-1">
                {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((wd, i) => (
                  <div key={i} className="text-[9px] text-gray-400 text-center">{wd}</div>
                ))}
                {m.days.map((d) =>
                  d.empty ? (
                    <div key={d.key} />
                  ) : (
                    <div
                      key={d.dateStr}
                      className="aspect-square text-[10px] flex items-center justify-center font-medium group relative cursor-default rounded"
                      style={{
                        background: heatColor(d.pax || 0),
                        color: (d.pax || 0) > maxDayPax * 0.45 ? '#ffffff' : (d.pax ? '#1f2937' : '#9ca3af'),
                      }}
                    >
                      {d.day}
                      {d.navi && d.navi.length > 0 && (
                        <div className="absolute z-20 hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900 text-white px-3 py-2 text-[10px] whitespace-nowrap pointer-events-none rounded-lg shadow-xl">
                          <div className="text-amber-300 font-bold mb-1">
                            {d.dateStr} · {(d.pax || 0).toLocaleString('it-IT')} pax
                          </div>
                          {d.navi.map((n) => (
                            <div key={n} className="text-gray-200">· {n}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-gray-100 text-[10px] text-gray-500">
          <span>Bassa</span>
          <span className="w-4 h-4 rounded" style={{ background: '#dbeafe' }} />
          <span className="w-4 h-4 rounded" style={{ background: '#93c5fd' }} />
          <span className="w-4 h-4 rounded" style={{ background: '#3b82f6' }} />
          <span className="w-4 h-4 rounded" style={{ background: '#1d4ed8' }} />
          <span>Alta</span>
          <span className="ml-auto">Hover su un giorno per i dettagli</span>
        </div>
      </div>

      {/* Top giorni multi-nave */}
      {stats.multiNaveDays.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">⚡ Giorni multi-nave</h2>
            <span className="text-xs text-gray-500">Top 12 giornate ad alta concentrazione passeggeri</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Navi</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Mercati</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Passeggeri</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">vs Media</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.multiNaveDays.map((d) => {
                  const markets = Array.from(new Set(d.navi.map((n) => SHIP_MAP[n]?.[1] || 'EU')))
                  const avg = stats.totalePax / stats.totaleArrivi
                  const ratio = (d.pax / avg).toFixed(1)
                  return (
                    <tr key={d.data} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-semibold text-blue-600 tabular-nums whitespace-nowrap">{d.data}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {d.navi.map((n) => (
                            <span key={n} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">{n}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {markets.map((m) => (
                            <span
                              key={m}
                              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                              style={{ background: (MARKET_COLOR[m] || '#64748b') + '20', color: MARKET_COLOR[m] || '#64748b' }}
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 tabular-nums">{d.pax.toLocaleString('it-IT')}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-amber-600 tabular-nums">{ratio}×</td>
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