'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function AmministratoriPage() {
  const [amministratori, setAmministratori] = useState<any[]>([])
  const [fornitori, setFornitori] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nome: '',
    cognome: '',
    ruolo: 'operatore',
    fornitore_id: ''
  })

  useEffect(() => {
    loadAmministratori()
    loadFornitori()
  }, [])

  async function loadFornitori() {
    const { data } = await supabase
      .from('fornitori')
      .select('id, ragione_sociale')
      .eq('attivo', true)
      .order('ragione_sociale')
    setFornitori(data || [])
  }

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
            ruolo: formData.ruolo,
            fornitore_id: formData.ruolo === 'operatore' ? (formData.fornitore_id || null) : null
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

    // Creazione nuovo amministratore via API server-side (email già confermata)
    if (formData.password.length < 6) {
      toast.error('La password deve essere di almeno 6 caratteri')
      return
    }

    if (formData.ruolo === 'operatore' && !formData.fornitore_id) {
      toast.error('Seleziona il fornitore per questo operatore')
      return
    }

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          nome: formData.nome,
          cognome: formData.cognome,
          ruolo: formData.ruolo,
          fornitore_id: formData.fornitore_id || null
        })
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Errore nella creazione')
      }

      toast.success('Utente creato! Può accedere subito con le credenziali inserite.')
      resetForm()
      setTimeout(() => loadAmministratori(), 500)

    } catch (error: any) {
      console.error('Errore completo:', error)
      toast.error(error.message || 'Errore nella creazione')
    }
  }

  function handleEdit(admin: any) {
    setEditingId(admin.id)
    setFormData({
      email: admin.email,
      password: '',
      nome: admin.nome || '',
      cognome: admin.cognome || '',
      ruolo: admin.ruolo || 'operatore',
      fornitore_id: admin.fornitore_id || ''
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
      ruolo: 'operatore',
      fornitore_id: ''
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
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fornitore</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stato</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {amministratori.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
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
                      {admin.ruolo === 'operatore' ? (
                        admin.fornitore_id ? (
                          <span className="text-sm font-medium text-blue-700">
                            🏢 {fornitori.find(f => f.id === admin.fornitore_id)?.ragione_sociale || '—'}
                          </span>
                        ) : (
                          <span className="text-xs text-red-500 font-medium">⚠️ Non assegnato</span>
                        )
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
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
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg"
                        placeholder="Minimo 6 caratteri"
                        minLength={6}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
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
                  onChange={(e) => setFormData({ ...formData, ruolo: e.target.value, fornitore_id: '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="operatore">Operatore</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Admin: accesso completo | Operatore: solo planning proprie imbarcazioni
                </p>
              </div>

              {/* Fornitore — visibile solo per Operatore */}
              {formData.ruolo === 'operatore' && (
                <div className={`border rounded-lg p-4 ${!formData.fornitore_id ? 'border-orange-300 bg-orange-50' : 'border-green-300 bg-green-50'}`}>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    🏢 Fornitore Associato *
                  </label>
                  <select
                    value={formData.fornitore_id}
                    onChange={(e) => setFormData({ ...formData, fornitore_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    required={formData.ruolo === 'operatore'}
                  >
                    <option value="">— Seleziona fornitore —</option>
                    {fornitori.map(f => (
                      <option key={f.id} value={f.id}>{f.ragione_sociale}</option>
                    ))}
                  </select>
                  <p className="text-xs mt-1.5 text-gray-600">
                    {formData.fornitore_id
                      ? '✅ L\'operatore vedrà solo le imbarcazioni di questo fornitore'
                      : '⚠️ Obbligatorio: senza fornitore l\'operatore non vedrà nessuna imbarcazione'}
                  </p>
                </div>
              )}

              {!editingId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    ✅ L'utente potrà accedere <strong>immediatamente</strong> con le credenziali inserite, senza conferma email.
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