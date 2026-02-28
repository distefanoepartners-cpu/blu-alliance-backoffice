'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

export default function MieBarchePage() {
  const { isOperatore, fornitoreId, loading: authLoading } = useAuth()
  const router = useRouter()
  const [imbarcazioni, setImbarcazioni] = useState<any[]>([])
  const [fornitore, setFornitore] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Aspetta che auth sia pronta
    if (authLoading) return
    if (!isOperatore) {
      router.replace('/dashboard/disponibilita')
      return
    }
    if (fornitoreId) {
      loadData()
    } else {
      setLoading(false)
    }
  }, [authLoading, isOperatore, fornitoreId])

  async function loadData() {
    setLoading(true)
    try {
      // Carica dati fornitore
      const { data: forn, error: fornError } = await supabase
        .from('fornitori')
        .select('id, ragione_sociale, email, telefono, indirizzo')
        .eq('id', fornitoreId)
        .single()
      if (fornError) console.error('Errore fornitore:', fornError)
      setFornitore(forn)

      // Carica imbarcazioni del fornitore
      // FIX: colonne corrette dalla tabella imbarcazioni
      const { data: barche, error: barcheError } = await supabase
        .from('imbarcazioni')
        .select('id, nome, tipo, categoria, capacita_massima, immagine_principale, descrizione, tipi_servizio, attiva')
        .eq('fornitore_id', fornitoreId)
        .eq('attiva', true)
        .order('nome')
      if (barcheError) console.error('Errore barche:', barcheError)
      setImbarcazioni(barche || [])
    } catch (e) {
      console.error('Errore caricamento barche:', e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Caricamento...</div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* HEADER */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full border border-blue-200">
            👤 Vista Operatore
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Le Mie Barche</h1>
        {fornitore && (
          <p className="text-gray-500 text-sm mt-1">{fornitore.ragione_sociale}</p>
        )}
      </div>

      {/* CARD FORNITORE */}
      {fornitore && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <h2 className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-3">
            🏢 Il Tuo Fornitore
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-gray-500 block text-xs mb-0.5">Ragione Sociale</span>
              <span className="font-semibold text-gray-900">{fornitore.ragione_sociale}</span>
            </div>
            {fornitore.email && (
              <div>
                <span className="text-gray-500 block text-xs mb-0.5">Email</span>
                <a href={`mailto:${fornitore.email}`} className="text-blue-600 hover:underline">
                  {fornitore.email}
                </a>
              </div>
            )}
            {fornitore.telefono && (
              <div>
                <span className="text-gray-500 block text-xs mb-0.5">Telefono</span>
                <a href={`tel:${fornitore.telefono}`} className="text-blue-600 hover:underline">
                  {fornitore.telefono}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{imbarcazioni.length}</div>
          <div className="text-xs text-gray-500 mt-1">🚤 Barche Totali</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">
            {imbarcazioni.filter(b => b.tipo === 'gommone').length}
          </div>
          <div className="text-xs text-gray-500 mt-1">🚤 Gommoni</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">
            {imbarcazioni.filter(b => b.tipo === 'yacht' || b.tipo === 'barca' || b.tipo === 'gozzo').length}
          </div>
          <div className="text-xs text-gray-500 mt-1">⛵ Barche/Yacht</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">
            {/* FIX: era b.posti → ora b.capacita_massima */}
            {imbarcazioni.reduce((sum, b) => sum + (parseInt(b.capacita_massima) || 0), 0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">👥 Posti Totali</div>
        </div>
      </div>

      {/* ELENCO BARCHE */}
      {imbarcazioni.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">🚤</div>
          <p className="text-gray-500">Nessuna imbarcazione assegnata</p>
          <p className="text-gray-400 text-sm mt-1">Contatta l'amministratore per aggiungere le tue barche</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {imbarcazioni.map((barca) => (
            <div
              key={barca.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* FIX: era barca.image_url → ora barca.immagine_principale */}
              {barca.immagine_principale ? (
                <div className="h-40 overflow-hidden bg-gray-100">
                  <img
                    src={barca.immagine_principale}
                    alt={barca.nome}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-40 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                  <span className="text-5xl">🚤</span>
                </div>
              )}

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-gray-900 text-base leading-tight">{barca.nome}</h3>
                  {barca.categoria && (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full capitalize whitespace-nowrap flex-shrink-0">
                      {barca.categoria}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-sm">
                  {barca.tipo && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <span className="text-gray-400">🔹</span>
                      <span className="capitalize">{barca.tipo.replace('_', ' ')}</span>
                    </div>
                  )}
                  {/* FIX: era barca.posti → ora barca.capacita_massima */}
                  {barca.capacita_massima && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <span className="text-gray-400">👥</span>
                      <span>{barca.capacita_massima} posti</span>
                    </div>
                  )}
                  {/* FIX: tipi_servizio al posto di anno/targa */}
                  {barca.tipi_servizio && barca.tipi_servizio.length > 0 && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <span className="text-gray-400">🛥️</span>
                      <span className="text-xs">{barca.tipi_servizio.join(', ')}</span>
                    </div>
                  )}
                </div>

                {barca.descrizione && (
                  <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg p-2 border border-gray-100 leading-relaxed line-clamp-3">
                    {barca.descrizione}
                  </p>
                )}

                {/* Link al planning per questa barca */}
                <button
                  onClick={() => router.push('/dashboard/disponibilita')}
                  className="mt-4 w-full py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                >
                  📅 Vedi nel Planning
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}