'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function AmministratoriPage() {
  const [amministratori, setAmministratori] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nome: '',
    cognome: '',
    ruolo: 'operatore'
  })

  useEffect(() => {
    loadAmministratori()
  }, [])

  async function loadAmministratori() {
    try {
      const { data, error } = await supabase
        .from('amministratori')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setAmministratori(data || [])
    } catch (error: any) {
      toast.error('Errore nel caricamento')
      console.error('Errore:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Se stiamo modificando
    if (editingId) {
      try {
        const { error } = await supabase
          .from('amministratori')
          .update({
            nome: formData.nome,
            cognome: formData.cognome,
            ruolo: formData.ruolo
          })
          .eq('id', editingId)

        if (error) throw error

        toast.success('Amministratore aggiornato!')
        resetForm()
        loadAmministratori()
      } catch (error: any) {
        toast.error('Errore nell\'aggiornamento')
        console.error('Errore:', error)
      }
      return
    }

    // Creazione nuovo amministratore
    if (formData.password.length < 6) {
      toast.error('La password deve essere di almeno 6 caratteri')
      return
    }

    try {
      // Usa signUp di Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            nome: formData.nome,
            cognome: formData.cognome
          }
        }
      })

      if (authError) throw authError

      if (!authData.user) {
        throw new Error('Errore nella creazione dell\'utente')
      }

      // Aggiungi alla tabella amministratori
      const { error: adminError } = await supabase
        .from('amministratori')
        .insert([{
          user_id: authData.user.id,
          email: formData.email,
          nome: formData.nome,
          cognome: formData.cognome,
          ruolo: formData.ruolo,
          attivo: true
        }])

      if (adminError) {
        console.error('Errore inserimento admin:', adminError)
        throw new Error('Errore nella creazione dell\'amministratore')
      }

      toast.success('Amministratore creato! L\'utente riceverà un\'email di conferma.')
      resetForm()
      
      setTimeout(() => {
        loadAmministratori()
      }, 1000)

    } catch (error: any) {
      console.error('Errore completo:', error)
      if (error.message.includes('User already registered')) {
        toast.error('Email già esistente')
      } else if (error.message.includes('duplicate key')) {
        toast.error('Email già esistente')
      } else {
        toast.error(error.message || 'Errore nella creazione')
      }
    }
  }

  function handleEdit(admin: any) {
    setEditingId(admin.id)
    setFormData({
      email: admin.email,
      password: '',
      nome: admin.nome || '',
      cognome: admin.cognome || '',
      ruolo: admin.ruolo || 'operatore'
    })
    setShowModal(true)
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`Sei sicuro di voler eliminare l'amministratore ${email}?`)) return

    try {
      const { error } = await supabase
        .from('amministratori')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Amministratore eliminato!')
      loadAmministratori()
    } catch (error: any) {
      toast.error('Errore nell\'eliminazione')
      console.error('Errore:', error)
    }
  }

  async function toggleAttivo(id: string, attivo: boolean) {
    try {
      const { error } = await supabase
        .from('amministratori')
        .update({ attivo: !attivo })
        .eq('id', id)

      if (error) throw error

      toast.success(attivo ? 'Utente disattivato' : 'Utente attivato')
      loadAmministratori()
    } catch (error: any) {
      toast.error('Errore nell\'aggiornamento')
    }
  }

  async function cambiaRuolo(id: string, nuovoRuolo: string) {
    try {
      const { error } = await supabase
        .from('amministratori')
        .update({ ruolo: nuovoRuolo })
        .eq('id', id)

      if (error) throw error

      toast.success('Ruolo aggiornato!')
      loadAmministratori()
    } catch (error: any) {
      toast.error('Errore nell\'aggiornamento')
    }
  }

  function resetForm() {
    setFormData({
      email: '',
      password: '',
      nome: '',
      cognome: '',
      ruolo: 'operatore'
    })
    setEditingId(null)
    setShowModal(false)
  }

  if (loading) {
    return <div className="p-8"><div className="text-gray-600">Caricamento...</div></div>
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Amministratori</h1>
          <p className="text-gray-600 mt-1">{amministratori.length} utenti registrati</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Nuovo Amministratore
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ruolo</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stato</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {amministratori.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Nessun amministratore trovato
                  </td>
                </tr>
              ) : (
                amministratori.map((admin) => (
                  <tr key={admin.id} className="hover:bg-gray-50">
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {admin.nome} {admin.cognome}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{admin.email}</div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <select
                        value={admin.ruolo}
                        onChange={(e) => cambiaRuolo(admin.id, e.target.value)}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="admin">Admin</option>
                        <option value="operatore">Operatore</option>
                      </select>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          admin.attivo
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {admin.attivo ? 'Attivo' : 'Disattivato'}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(admin)}
                          className="px-3 py-1 text-xs rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200"
                        >
                          Modifica
                        </button>
                        <button
                          onClick={() => toggleAttivo(admin.id, admin.attivo)}
                          className={`px-3 py-1 text-xs rounded-lg ${
                            admin.attivo
                              ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {admin.attivo ? 'Disattiva' : 'Attiva'}
                        </button>
                        <button
                          onClick={() => handleDelete(admin.id, admin.email)}
                          className="px-3 py-1 text-xs rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                        >
                          Elimina
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingId ? 'Modifica Amministratore' : 'Nuovo Amministratore'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-2xl">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cognome *</label>
                  <input
                    type="text"
                    value={formData.cognome}
                    onChange={(e) => setFormData({ ...formData, cognome: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              {!editingId && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Minimo 6 caratteri"
                      minLength={6}
                      required
                    />
                  </div>
                </>
              )}

              {editingId && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-sm text-gray-600">
                    <strong>Email:</strong> {formData.email}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    L&apos;email non può essere modificata
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ruolo *</label>
                <select
                  value={formData.ruolo}
                  onChange={(e) => setFormData({ ...formData, ruolo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="operatore">Operatore</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Admin: accesso completo | Operatore: solo disponibilità
                </p>
              </div>

              {!editingId && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs text-yellow-800">
                    ℹ️ L&apos;utente riceverà un&apos;email di conferma per attivare l&apos;account
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingId ? 'Aggiorna' : 'Crea'} Amministratore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}