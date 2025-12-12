'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval } from 'date-fns'
import { it } from 'date-fns/locale'
import toast from 'react-hot-toast'

export default function StatistichePage() {
  const [loading, setLoading] = useState(true)
  const [fornitori, setFornitori] = useState<any[]>([])
  const [statisticheGenerali, setStatisticheGenerali] = useState<any>(null)
  const [topServizi, setTopServizi] = useState<any[]>([])
  const [trendMensile, setTrendMensile] = useState<any[]>([])
  const [selectedFornitore, setSelectedFornitore] = useState<string>('tutti')
  const [periodoAnalisi, setPeriodoAnalisi] = useState<string>('anno') // anno, semestre, trimestre
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Detect mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    loadData()
  }, [selectedFornitore, periodoAnalisi])

  async function loadData() {
    try {
      setLoading(true)

      // Calcola date periodo
      const oggi = new Date()
      let dataInizio: Date
      
      switch (periodoAnalisi) {
        case 'trimestre':
          dataInizio = subMonths(oggi, 3)
          break
        case 'semestre':
          dataInizio = subMonths(oggi, 6)
          break
        default: // anno
          dataInizio = subMonths(oggi, 12)
      }

      // 1. Statistiche per Fornitore
      let query = supabase
        .from('fornitori')
        .select(`
          id,
          ragione_sociale,
          imbarcazioni(
            id,
            nome,
            tipo,
            categoria,
            prenotazioni!prenotazioni_imbarcazione_id_fkey(
              id,
              prezzo_totale,
              caparra_ricevuta,
              saldo_ricevuto,
              stato,
              data_servizio
            )
          )
        `)
        .eq('attivo', true)

      const { data: fornitoriData, error: fornitoriError } = await query

      if (fornitoriError) throw fornitoriError

      // Elabora statistiche fornitori
      const fornitoriStats = (fornitoriData || []).map(fornitore => {
        const imbarcazioni = fornitore.imbarcazioni || []
        
        // Filtra prenotazioni valide nel periodo
        const prenotazioniValide = imbarcazioni.flatMap((imb: any) => 
          (imb.prenotazioni || []).filter((p: any) => 
            p.stato !== 'cancellata' &&
            new Date(p.data_servizio) >= dataInizio &&
            new Date(p.data_servizio) <= oggi
          )
        )

        const revenueFormattedTotale = prenotazioniValide.reduce((sum: number, p: any) => 
          sum + (parseFloat(p.prezzo_totale) || 0), 0
        )

        const incassato = prenotazioniValide.reduce((sum: number, p: any) => 
          sum + (parseFloat(p.caparra_ricevuta) || 0) + (parseFloat(p.saldo_ricevuto) || 0), 0
        )

        const daIncassare = revenueFormattedTotale - incassato

        // Calcola per categoria
        const categorieStats = ['simple', 'premium', 'luxury'].map(cat => {
          const imbarcazioniCategoria = imbarcazioni.filter((i: any) => i.categoria === cat)
          const prenotazioniCat = imbarcazioniCategoria.flatMap((imb: any) => 
            (imb.prenotazioni || []).filter((p: any) => 
              p.stato !== 'cancellata' &&
              new Date(p.data_servizio) >= dataInizio &&
              new Date(p.data_servizio) <= oggi
            )
          )
          const revenueCat = prenotazioniCat.reduce((sum: number, p: any) => 
            sum + (parseFloat(p.prezzo_totale) || 0), 0
          )
          return {
            categoria: cat,
            revenue: revenueCat,
            prenotazioni: prenotazioniCat.length,
            barche: imbarcazioniCategoria.length
          }
        })

        return {
          id: fornitore.id,
          nome: fornitore.ragione_sociale,
          num_barche: imbarcazioni.length,
          num_prenotazioni: prenotazioniValide.length,
          revenue_totale: revenueFormattedTotale,
          incassato: incassato,
          da_incassare: daIncassare,
          ticket_medio: prenotazioniValide.length > 0 
            ? revenueFormattedTotale / prenotazioniValide.length 
            : 0,
          categorie: categorieStats,
          imbarcazioni: imbarcazioni
        }
      })

      // Ordina per revenue
      fornitoriStats.sort((a, b) => b.revenue_totale - a.revenue_totale)

      setFornitori(fornitoriStats)

      // 2. Statistiche Generali
      const totaleRevenue = fornitoriStats.reduce((sum, f) => sum + f.revenue_totale, 0)
      const totaleIncassato = fornitoriStats.reduce((sum, f) => sum + f.incassato, 0)
      const totalePrenotazioni = fornitoriStats.reduce((sum, f) => sum + f.num_prenotazioni, 0)
      const totaleBarche = fornitoriStats.reduce((sum, f) => sum + f.num_barche, 0)

      setStatisticheGenerali({
        totale_revenue: totaleRevenue,
        totale_incassato: totaleIncassato,
        totale_da_incassare: totaleRevenue - totaleIncassato,
        totale_prenotazioni: totalePrenotazioni,
        totale_barche: totaleBarche,
        ticket_medio: totalePrenotazioni > 0 ? totaleRevenue / totalePrenotazioni : 0,
        tasso_incasso: totaleRevenue > 0 ? (totaleIncassato / totaleRevenue) * 100 : 0
      })

      // 3. Top Servizi
      const { data: serviziData } = await supabase
        .from('servizi')
        .select(`
          id,
          nome,
          tipo,
          prenotazioni!prenotazioni_servizio_id_fkey(
            id,
            prezzo_totale,
            stato,
            data_servizio
          )
        `)
        .eq('attivo', true)

      const serviziStats = (serviziData || []).map(servizio => {
        const prenotazioniValide = (servizio.prenotazioni || []).filter((p: any) => 
          p.stato !== 'cancellata' &&
          new Date(p.data_servizio) >= dataInizio &&
          new Date(p.data_servizio) <= oggi
        )

        return {
          nome: servizio.nome,
          tipo: servizio.tipo,
          prenotazioni: prenotazioniValide.length,
          revenue: prenotazioniValide.reduce((sum: number, p: any) => 
            sum + (parseFloat(p.prezzo_totale) || 0), 0
          )
        }
      })

      serviziStats.sort((a, b) => b.revenue - a.revenue)
      setTopServizi(serviziStats.slice(0, 5))

      // 4. Trend Mensile
      const mesi = eachMonthOfInterval({
        start: dataInizio,
        end: oggi
      })

      const trendData = mesi.map(mese => {
        const inizioMese = startOfMonth(mese)
        const fineMese = endOfMonth(mese)

        const revenueMese = fornitoriStats.reduce((sum, fornitore) => {
          const prenotazioniMese = fornitore.imbarcazioni.flatMap((imb: any) => 
            (imb.prenotazioni || []).filter((p: any) => {
              const dataPrenotazione = new Date(p.data_servizio)
              return p.stato !== 'cancellata' &&
                dataPrenotazione >= inizioMese &&
                dataPrenotazione <= fineMese
            })
          )
          return sum + prenotazioniMese.reduce((s: number, p: any) => 
            s + (parseFloat(p.prezzo_totale) || 0), 0
          )
        }, 0)

        return {
          mese: format(mese, 'MMM yyyy', { locale: it }),
          revenue: revenueMese
        }
      })

      setTrendMensile(trendData)

    } catch (error: any) {
      console.error('Errore:', error)
      toast.error('Errore nel caricamento statistiche')
    } finally {
      setLoading(false)
    }
  }

  const fornitoriVisualizzati = selectedFornitore === 'tutti' 
    ? fornitori 
    : fornitori.filter(f => f.id === selectedFornitore)

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-gray-600">Caricamento statistiche...</div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Statistiche</h1>
        <p className="text-gray-600">Panoramica attività e performance fornitori</p>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Periodo Analisi</label>
            <select
              value={periodoAnalisi}
              onChange={(e) => setPeriodoAnalisi(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="trimestre">Ultimi 3 Mesi</option>
              <option value="semestre">Ultimi 6 Mesi</option>
              <option value="anno">Ultimo Anno</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fornitore</label>
            <select
              value={selectedFornitore}
              onChange={(e) => setSelectedFornitore(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="tutti">Tutti i Fornitori</option>
              {fornitori.map(f => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Statistiche Generali */}
      {selectedFornitore === 'tutti' && statisticheGenerali && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Panoramica Generale</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 md:gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3 md:p-4 text-white shadow-lg">
              <div className="text-xs opacity-80 mb-1">Revenue Totale</div>
              <div className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>
                €{(statisticheGenerali.totale_revenue / 1000).toFixed(0)}k
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-3 md:p-4 text-white shadow-lg">
              <div className="text-xs opacity-80 mb-1">Incassato</div>
              <div className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>
                €{(statisticheGenerali.totale_incassato / 1000).toFixed(0)}k
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-3 md:p-4 text-white shadow-lg">
              <div className="text-xs opacity-80 mb-1">Da Incassare</div>
              <div className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>
                €{(statisticheGenerali.totale_da_incassare / 1000).toFixed(0)}k
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-3 md:p-4 text-white shadow-lg">
              <div className="text-xs opacity-80 mb-1">Prenotazioni</div>
              <div className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>
                {statisticheGenerali.totale_prenotazioni}
              </div>
            </div>

            <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-3 md:p-4 text-white shadow-lg">
              <div className="text-xs opacity-80 mb-1">Ticket Medio</div>
              <div className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>
                €{statisticheGenerali.ticket_medio.toLocaleString('it-IT', { minimumFractionDigits: 0 })}
              </div>
            </div>

            <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-3 md:p-4 text-white shadow-lg">
              <div className="text-xs opacity-80 mb-1">Imbarcazioni</div>
              <div className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>
                {statisticheGenerali.totale_barche}
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-3 md:p-4 text-white shadow-lg">
              <div className="text-xs opacity-80 mb-1">Tasso Incasso</div>
              <div className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>
                {statisticheGenerali.tasso_incasso.toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trend Mensile */}
      {selectedFornitore === 'tutti' && trendMensile.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Trend Revenue Mensile</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-end justify-between gap-2 h-64">
              {trendMensile.map((mese, index) => {
                const maxRevenue = Math.max(...trendMensile.map(m => m.revenue))
                const altezza = maxRevenue > 0 ? (mese.revenue / maxRevenue) * 100 : 0
                
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2">
                    <div className="relative w-full">
                      <div 
                        className="bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg hover:from-blue-600 hover:to-blue-500 transition-all cursor-pointer group"
                        style={{ height: `${altezza}%`, minHeight: mese.revenue > 0 ? '20px' : '2px' }}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          €{mese.revenue.toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 text-center whitespace-nowrap transform -rotate-45 origin-top-left mt-4">
                      {mese.mese}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Performance Fornitori */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {selectedFornitore === 'tutti' ? 'Performance Fornitori' : 'Dettaglio Fornitore'}
        </h2>
        <div className="space-y-4">
          {fornitoriVisualizzati.map((fornitore, index) => (
            <div key={fornitore.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Header Fornitore */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 md:p-6 text-white">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <div>
                    <div className="flex items-center gap-2 md:gap-3">
                      <span className={`font-bold ${isMobile ? 'text-xl' : 'text-3xl'}`}>#{index + 1}</span>
                      <div>
                        <h3 className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{fornitore.nome}</h3>
                        <p className="text-xs md:text-sm opacity-90">
                          {fornitore.num_barche} imbarcazioni • {fornitore.num_prenotazioni} prenotazioni
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${isMobile ? 'text-2xl' : 'text-4xl'}`}>
                      €{(fornitore.revenue_totale / 1000).toFixed(0)}k
                    </div>
                    <div className="text-xs md:text-sm opacity-90">Revenue Totale</div>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-2 md:gap-4">
                  <div className="bg-white bg-opacity-20 rounded-lg p-2 md:p-3">
                    <div className="text-xs opacity-80">Incassato</div>
                    <div className={`font-bold ${isMobile ? 'text-base' : 'text-xl'}`}>
                      €{(fornitore.incassato / 1000).toFixed(0)}k
                    </div>
                  </div>
                  <div className="bg-white bg-opacity-20 rounded-lg p-2 md:p-3">
                    <div className="text-xs opacity-80">Da Incassare</div>
                    <div className={`font-bold ${isMobile ? 'text-base' : 'text-xl'}`}>
                      €{(fornitore.da_incassare / 1000).toFixed(0)}k
                    </div>
                  </div>
                  <div className="bg-white bg-opacity-20 rounded-lg p-2 md:p-3">
                    <div className="text-xs opacity-80">Ticket Medio</div>
                    <div className={`font-bold ${isMobile ? 'text-base' : 'text-xl'}`}>
                      €{fornitore.ticket_medio.toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats per Categoria */}
              <div className="p-4 md:p-6 border-b">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Performance per Categoria</h4>
                <div className="grid grid-cols-3 gap-2 md:gap-4">
                  {fornitore.categorie.map((cat: any) => {
                    const colore = cat.categoria === 'simple' ? 'green' 
                      : cat.categoria === 'premium' ? 'yellow' 
                      : 'purple'
                    
                    return (
                      <div key={cat.categoria} className={`bg-${colore}-50 border border-${colore}-200 rounded-lg p-2 md:p-4`}>
                        <div className="flex items-center gap-1 md:gap-2 mb-1 md:mb-2">
                          <span className={`w-2 h-2 md:w-3 md:h-3 rounded-full bg-${colore}-500`}></span>
                          <span className="text-xs md:text-sm font-semibold text-gray-900 capitalize">{cat.categoria}</span>
                        </div>
                        <div className={`font-bold text-gray-900 ${isMobile ? 'text-lg' : 'text-2xl'} mb-1`}>
                          €{(cat.revenue / 1000).toFixed(0)}k
                        </div>
                        <div className="text-xs text-gray-600">
                          {cat.prenotazioni} pren. • {cat.barche} barche
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Top Imbarcazioni - Mostra solo top 3 su mobile */}
              <div className="p-4 md:p-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Top Imbarcazioni</h4>
                <div className="space-y-2">
                  {fornitore.imbarcazioni
                    .map((imb: any) => {
                      const prenotazioni = (imb.prenotazioni || []).filter((p: any) => p.stato !== 'cancellata')
                      const revenue = prenotazioni.reduce((sum: number, p: any) => 
                        sum + (parseFloat(p.prezzo_totale) || 0), 0
                      )
                      return { ...imb, prenotazioni_count: prenotazioni.length, revenue }
                    })
                    .sort((a: any, b: any) => b.revenue - a.revenue)
                    .slice(0, isMobile ? 3 : 5)
                    .map((imb: any) => (
                      <div key={imb.id} className="flex items-center justify-between p-2 md:p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                          <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold flex-shrink-0`}>
                            {imb.prenotazioni_count}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-gray-900 text-sm md:text-base truncate">{imb.nome}</div>
                            <div className="text-xs md:text-sm text-gray-500 capitalize">{imb.tipo} • {imb.categoria}</div>
                          </div>
                        </div>
                        <div className="text-right ml-2 flex-shrink-0">
                          <div className="font-bold text-gray-900 text-sm md:text-base">
                            €{(imb.revenue / 1000).toFixed(1)}k
                          </div>
                          <div className="text-xs text-gray-500">
                            {imb.prenotazioni_count} pren.
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top 5 Servizi */}
      {selectedFornitore === 'tutti' && topServizi.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Servizi</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="space-y-3">
              {topServizi.map((servizio, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{servizio.nome}</div>
                    <div className="text-sm text-gray-500 capitalize">{servizio.tipo}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900">
                      €{servizio.revenue.toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                    </div>
                    <div className="text-sm text-gray-500">
                      {servizio.prenotazioni} prenotazioni
                    </div>
                  </div>
                  <div className="w-32">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-purple-600"
                        style={{ 
                          width: `${(servizio.revenue / topServizi[0].revenue) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}