'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface CreateCustomerModalProps {
  isOpen: boolean
  onClose: () => void
  onCustomerCreated: (clienteId: string) => void
}

export default function CreateCustomerModal({ isOpen, onClose, onCustomerCreated }: CreateCustomerModalProps) {
  const [form, setForm] = useState({
    nome: '',
    cognome: '',
    email: '',
    telefono: '',
    nazione: 'IT'
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.nome || !form.cognome) {
      toast.error('Nome e cognome obbligatori')
      return
    }

    try {
      setSaving(true)

      const { data, error } = await supabase
        .from('clienti')
        .insert([{
          nome: form.nome.trim(),
          cognome: form.cognome.trim(),
          email: form.email.trim() || null,
          telefono: form.telefono.trim() || null,
          nazione: form.nazione || 'IT'
        }])
        .select('id')
        .single()

      if (error) throw error

      toast.success('Cliente creato!')
      onCustomerCreated(data.id)
      onClose()
      setForm({ nome: '', cognome: '', email: '', telefono: '', nazione: 'IT' })
    } catch (error: any) {
      console.error('Errore creazione cliente:', error)
      toast.error(error.message || 'Errore nella creazione')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">👤 Nuovo Cliente</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nome *</label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Mario"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Cognome *</label>
              <input
                type="text"
                value={form.cognome}
                onChange={(e) => setForm({ ...form, cognome: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Rossi"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="mario@email.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Telefono</label>
              <input
                type="tel"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="+39 333..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nazione</label>
              <select
                value={form.nazione}
                onChange={(e) => setForm({ ...form, nazione: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="IT">🇮🇹 Italia</option>
                <option value="GB">🇬🇧 UK</option>
                <option value="US">🇺🇸 USA</option>
                <option value="FR">🇫🇷 Francia</option>
                <option value="DE">🇩🇪 Germania</option>
                <option value="ES">🇪🇸 Spagna</option>
                <option value="NL">🇳🇱 Olanda</option>
                <option value="CH">🇨🇭 Svizzera</option>
                <option value="AT">🇦🇹 Austria</option>
                <option value="altro">Altro</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              disabled={saving}
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Salvataggio...' : '✅ Crea Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}