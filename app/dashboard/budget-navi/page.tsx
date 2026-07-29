'use client'
import { useRequireRole } from '@/lib/useRequireRole'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, parseISO, addMonths, subMonths } from 'date-fns'
import { it } from 'date-fns/locale'

interface RowData {
  data_arrivo: string
  nome_nave: string
  capienza_pax: number
  pax_previsti: number
  fatturato_previsto: number
  pax_effettivi: number
  fatturato_effettivo: number
}

const fmt = (n: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n)
const fmtNum = (n: number) => new Intl.NumberFormat("it-IT").format(n)

export default function BudgetNaviPage() {
  const { authorized, loading: authLoading } = useRequireRole(['admin'])
  const [arrivi, setArrivi] = useState<any[]>([])
  const [prenotazioni, setPrenotazioni] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [meseFiltro, setMeseFiltro] = useState<Date | null>(null)
  const [vista, setVista] = useState<'tabella' | 'mese'>('tabella')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      setLoading(true)
      const { data: navi } = await supabase
        .from('arrivi_navi')
        .select('*')
        .order('data_arrivo')

      const dates = (navi || []).map(n => n.data_arrivo)
      const minDate = dates[0]
      const maxDate = dates[dates.length - 1]

      const { data: pren } = await supabase
        .from('prenotazioni')
        .select('data_servizio, numero_persone, prezzo_totale, stato')
        .gte('data_servizio', minDate || '2026-01-01')
        .lte('data_servizio', maxDate || '2026-12-31')
        .neq('stato', 'cancellata')

      setArrivi(navi || [])
      setPrenotazioni(pren || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Aggrega prenotazioni per data
  const prenByDate: Record<string, { pax: number; fatturato: number }> = {}
  prenotazioni.forEach(p => {
    if (!prenByDate[p.data_servizio]) prenByDate[p.data_servizio] = { pax: 0, fatturato: 0 }
    prenByDate[p.data_servizio].pax += p.numero_persone || 0
    prenByDate[p.data_servizio].fatturato += parseFloat(p.prezzo_totale || 0)
  })

  // Costruisci righe arricchite
  const rows: RowData[] = arrivi.map(a => {
    const actual = prenByDate[a.data_arrivo] || { pax: 0, fatturato: 0 }
    return {
      data_arrivo: a.data_arrivo,
      nome_nave: a.nome_nave,
      capienza_pax: a.capienza_pax || 0,
      pax_previsti: a.pax_previsti || 0,
      fatturato_previsto: parseFloat(a.fatturato_previsto || 0),
      pax_effettivi: actual.pax,
      fatturato_effettivo: actual.fatturato,
    }
  })

  // Filtra per mese
  const filteredRows = meseFiltro
    ? rows.filter(r => {
        const d = parseISO(r.data_arrivo)
        return d.getMonth() === meseFiltro.getMonth() && d.getFullYear() === meseFiltro.getFullYear()
      })
    : rows

  // Aggregati per mese
  const monthlyData: Record<string, { pax_prev: number; pax_eff: number; fatt_prev: number; fatt_eff: number; scali: number }> = {}
  rows.forEach(r => {
    const key = r.data_arrivo.substring(0, 7) // YYYY-MM
    if (!monthlyData[key]) monthlyData[key] = { pax_prev: 0, pax_eff: 0, fatt_prev: 0, fatt_eff: 0, scali: 0 }
    monthlyData[key].pax_prev += r.pax_previsti
    monthlyData[key].pax_eff += r.pax_effettivi
    monthlyData[key].fatt_prev += r.fatturato_previsto
    monthlyData[key].fatt_eff += r.fatturato_effettivo
    monthlyData[key].scali += 1
  })

  const sortedMonths = Object.keys(monthlyData).sort()

  // Totali
  const totals = filteredRows.reduce((acc, r) => ({
    pax_prev: acc.pax_prev + r.pax_previsti,
    pax_eff: acc.pax_eff + r.pax_effettivi,
    fatt_prev: acc.fatt_prev + r.fatturato_previsto,
    fatt_eff: acc.fatt_eff + r.fatturato_effettivo,
  }), { pax_prev: 0, pax_eff: 0, fatt_prev: 0, fatt_eff: 0 })

  function getDeltaColor(actual: number, forecast: number): string {
    if (forecast === 0) return '#6b7280'
    const ratio = actual / forecast
    if (ratio >= 1.0) return '#059669' // verde
    if (ratio >= 0.7) return '#d97706' // arancio
    return '#dc2626' // rosso
  }

  function getDeltaLabel(actual: number, forecast: number): string {
    if (forecast === 0) return '—'
    const delta = actual - forecast
    const pct = (delta / forecast) * 100
    const sign = delta >= 0 ? '+' : ''
    return `${sign}${pct.toFixed(0)}%`
  }

  if (authLoading || !authorized) return <div className="p-8 text-gray-600">Verifica accesso...</div>
  if (loading) return <div className="p-8 text-gray-600">Caricamento budget navi...</div>

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">📊 Budget Navi 2026</h1>
          <p className="text-gray-600 mt-1">Previsione vs Realizzato — Porto di Salerno</p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setVista('tabella')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${vista === 'tabella' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            📋 Dettaglio
          </button>
          <button onClick={() => setVista('mese')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${vista === 'mese' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            📅 Per mese
          </button>
        </div>
      </div>

      {/* Filtro mese */}
      {vista === 'tabella' && (
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setMeseFiltro(null)}
            className={`px-3 py-1 rounded-lg text-xs font-medium ${!meseFiltro ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600'}`}>
            Tutti
          </button>
          {sortedMonths.map(m => {
            const d = new Date(m + '-01')
            const isActive = meseFiltro && format(meseFiltro, 'yyyy-MM') === m
            return (
              <button key={m}
                onClick={() => setMeseFiltro(d)}
                className={`px-3 py-1 rounded-lg text-xs font-medium ${isActive ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                {format(d, 'MMM', { locale: it })}
              </button>
            )
          })}
        </div>
      )}

      {/* KPI Totali */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-xs text-gray-500 mb-1">Pax Previsti</div>
          <div className="text-xl font-bold text-blue-600">{fmtNum(totals.pax_prev)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-xs text-gray-500 mb-1">Pax Effettivi</div>
          <div className="text-xl font-bold" style={{ color: getDeltaColor(totals.pax_eff, totals.pax_prev) }}>
            {fmtNum(totals.pax_eff)} <span className="text-sm">({getDeltaLabel(totals.pax_eff, totals.pax_prev)})</span>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-xs text-gray-500 mb-1">Fatturato Previsto</div>
          <div className="text-xl font-bold text-blue-600">{fmt(totals.fatt_prev)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-xs text-gray-500 mb-1">Fatturato Effettivo</div>
          <div className="text-xl font-bold" style={{ color: getDeltaColor(totals.fatt_eff, totals.fatt_prev) }}>
            {fmt(totals.fatt_eff)} <span className="text-sm">({getDeltaLabel(totals.fatt_eff, totals.fatt_prev)})</span>
          </div>
        </div>
      </div>

      {vista === 'tabella' ? (
        /* ── TABELLA DETTAGLIO ── */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nave</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cap.</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-blue-600 uppercase">Pax Prev</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">Pax Eff</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Δ Pax</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-blue-600 uppercase">€ Prev</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">€ Eff</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Δ €</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRows.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{format(parseISO(r.data_arrivo), 'EEE dd/MM', { locale: it })}</td>
                    <td className="px-3 py-2 font-semibold text-gray-900">{r.nome_nave}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{fmtNum(r.capienza_pax)}</td>
                    <td className="px-3 py-2 text-right text-blue-600 font-medium">{fmtNum(r.pax_previsti)}</td>
                    <td className="px-3 py-2 text-right font-bold" style={{ color: getDeltaColor(r.pax_effettivi, r.pax_previsti) }}>
                      {fmtNum(r.pax_effettivi)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold" style={{ color: getDeltaColor(r.pax_effettivi, r.pax_previsti) }}>
                      {getDeltaLabel(r.pax_effettivi, r.pax_previsti)}
                    </td>
                    <td className="px-3 py-2 text-right text-blue-600 font-medium">{fmt(r.fatturato_previsto)}</td>
                    <td className="px-3 py-2 text-right font-bold" style={{ color: getDeltaColor(r.fatturato_effettivo, r.fatturato_previsto) }}>
                      {fmt(r.fatturato_effettivo)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold" style={{ color: getDeltaColor(r.fatturato_effettivo, r.fatturato_previsto) }}>
                      {getDeltaLabel(r.fatturato_effettivo, r.fatturato_previsto)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={3} className="px-3 py-3 font-bold text-gray-900">TOTALE</td>
                  <td className="px-3 py-3 text-right font-bold text-blue-600">{fmtNum(totals.pax_prev)}</td>
                  <td className="px-3 py-3 text-right font-bold" style={{ color: getDeltaColor(totals.pax_eff, totals.pax_prev) }}>
                    {fmtNum(totals.pax_eff)}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-xs" style={{ color: getDeltaColor(totals.pax_eff, totals.pax_prev) }}>
                    {getDeltaLabel(totals.pax_eff, totals.pax_prev)}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-blue-600">{fmt(totals.fatt_prev)}</td>
                  <td className="px-3 py-3 text-right font-bold" style={{ color: getDeltaColor(totals.fatt_eff, totals.fatt_prev) }}>
                    {fmt(totals.fatt_eff)}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-xs" style={{ color: getDeltaColor(totals.fatt_eff, totals.fatt_prev) }}>
                    {getDeltaLabel(totals.fatt_eff, totals.fatt_prev)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* ── VISTA PER MESE ── */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mese</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Scali</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-blue-600 uppercase">Pax Previsti</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Pax Effettivi</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Δ %</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-blue-600 uppercase">Fatt. Previsto</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Fatt. Effettivo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Δ %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedMonths.map(m => {
                const d = new Date(m + '-01')
                const data = monthlyData[m]
                return (
                  <tr key={m} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900 capitalize">{format(d, 'MMMM yyyy', { locale: it })}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{data.scali}</td>
                    <td className="px-4 py-3 text-right text-blue-600 font-medium">{fmtNum(data.pax_prev)}</td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: getDeltaColor(data.pax_eff, data.pax_prev) }}>
                      {fmtNum(data.pax_eff)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: getDeltaColor(data.pax_eff, data.pax_prev) }}>
                      {getDeltaLabel(data.pax_eff, data.pax_prev)}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600 font-medium">{fmt(data.fatt_prev)}</td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: getDeltaColor(data.fatt_eff, data.fatt_prev) }}>
                      {fmt(data.fatt_eff)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: getDeltaColor(data.fatt_eff, data.fatt_prev) }}>
                      {getDeltaLabel(data.fatt_eff, data.fatt_prev)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-400">
        🟢 ≥100% del previsto · 🟠 70-99% · 🔴 &lt;70% · Δ% = scostamento dal budget
      </div>
    </div>
  )
}