'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ContattiPage() {
  const [fornitori, setFornitori] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadFornitori() }, [])

  async function loadFornitori() {
    try {
      const { data, error } = await supabase
        .from('fornitori')
        .select('id, ragione_sociale, nome_referente, telefono, telefono_2, telefono_2_nome, email')
        .eq('attivo', true)
        .order('ragione_sociale')
      if (error) { console.error('Errore:', error); return }
      setFornitori(data || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const filtered = fornitori.filter(f => {
    const s = searchTerm.toLowerCase()
    return !s || f.ragione_sociale?.toLowerCase().includes(s) || f.nome_referente?.toLowerCase().includes(s) || f.telefono?.includes(s)
  })

  if (loading) return <div className="p-8 text-gray-600">Caricamento...</div>

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">📞 Contatti Fornitori</h1>
          <p className="text-gray-600 mt-1">{fornitori.length} fornitori</p>
        </div>
        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cerca fornitore, referente, telefono..."
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm w-full md:w-80 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(f => (
          <div key={f.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-gray-900 text-sm truncate">{f.ragione_sociale}</h3>
            {f.nome_referente && <p className="text-xs text-gray-500 mt-0.5">👤 {f.nome_referente}</p>}
            <div className="mt-3 space-y-1.5">
              {f.telefono && (
                <a href={`tel:${f.telefono}`} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
                  📱 {f.telefono}
                </a>
              )}
              {f.telefono_2 && (
                <a href={`tel:${f.telefono_2}`} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
                  📱 {f.telefono_2} {f.telefono_2_nome && <span className="text-xs text-gray-400">({f.telefono_2_nome})</span>}
                </a>
              )}
              {f.email && (
                <a href={`mailto:${f.email}`} className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 truncate">
                  ✉️ {f.email}
                </a>
              )}
              {!f.telefono && !f.email && <span className="text-xs text-gray-400">Nessun contatto</span>}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-8 text-gray-500">
            {fornitori.length === 0 ? 'Nessun fornitore attivo trovato' : 'Nessun risultato per la ricerca'}
          </div>
        )}
      </div>
    </div>
  )
}