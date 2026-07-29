'use client'
import RendicontoContabile from './RendicontoContabile'
import { useRequireRole } from '@/lib/useRequireRole'
export default function RendicontoPage() {
  const { authorized, loading } = useRequireRole(['admin'])
  if (loading || !authorized) return <div className="p-8 text-gray-600">Verifica accesso...</div>
  return <RendicontoContabile />
}