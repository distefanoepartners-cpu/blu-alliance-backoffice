'use client'

import { useAuth } from '@/contexts/AuthContext'
import RendicontoContabile from '../rendiconto/RendicontoContabile'

export default function MioRendicontoPage() {
  const { user, fornitoreId, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Caricamento...</p>
        </div>
      </div>
    )
  }

  if (!fornitoreId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-600 font-semibold text-lg">Fornitore non associato</p>
          <p className="text-gray-500 mt-2">Il tuo account non è collegato a nessun fornitore. Contatta l'amministratore.</p>
        </div>
      </div>
    )
  }

  return (
    <RendicontoContabile
      lockedFornitoreId={fornitoreId}
      fornitoreLabel={user?.full_name || ''}
    />
  )
}