'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function MiaAziendaPage() {
  const { isOperatore, fornitoreId, loading: authLoading } = useAuth()
  const router = useRouter()

  const [fornitore, setFornitore] = useState<any>(null)
  const [skipper, setSkipper] = useState<any[]>([])
  const [imbarcazioni, setImbarcazioni] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState<any>({})

  useEffect(() => {
    if (authLoading) return
    if (!isOperatore) { router.replace('/dashboard/disponibilita'); return }
    if (fornitoreId) loadData()
    else setLoading(false)
  }, [authLoading, isOperatore, fornitoreId])

  async function loadData() {
    try {
      setLoading(true)

      const { data: fornData } = await supabase
        .from('fornitori')
        .select('*')
        .eq('id', fornitoreId)
        .single()

      const { data: skipperData } = await supabase
        .from('skipper')
        .select('id, nome, cognome, numero_patente, scadenza_patente, telefono, email, attivo, note')
        .eq('fornitore_id', fornitoreId)
        .order('cognome')

      const { data: barcheData } = await supabase
        .from('imbarcazioni')
        .select('id, nome, tipo, categoria, capacita_massima, attiva')
        .eq('fornitore_id', fornitoreId)
        .order('nome')

      setFornitore(fornData)
      setSkipper(skipperData || [])
      setImbarcazioni(barcheData || [])
      if (fornData) setFormData({ ...fornData })
    } catch (error) {
      console.error('Errore:', error)
      toast.error('Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      setSaving(true)
      const { error } = await supabase
        .from('fornitori')
        .update({
          nome_referente: formData.nome_referente || null,
          email: formData.email || null,
          telefono: formData.telefono || null,
          pec: formData.pec || null,
          partita_iva: formData.partita_iva || null,
          codice_fiscale: formData.codice_fiscale || null,
          codice_sdi: formData.codice_sdi || null,
          indirizzo: formData.indirizzo || null,
          citta: formData.citta || null,
          cap: formData.cap || null,
          provincia: formData.provincia || null,
          iban: formData.iban || null,
          banca: formData.banca || null,
          note: formData.note || null,
          base_nautica: formData.base_nautica || null,
          data_inizio_attivita: formData.data_inizio_attivita || null,
          capitaneria_porto: formData.capitaneria_porto || null,
          art_68: formData.art_68 || false,
          num_dipendenti: formData.num_dipendenti || null,
          // Campi che l'operatore NON modifica:
          // ragione_sociale, percentuale_commissione, attivo → solo admin
        })
        .eq('id', fornitoreId)

      if (error) throw error
      toast.success('Dati aggiornati con successo!')
      setEditing(false)
      loadData()
    } catch (error: any) {
      console.error('Errore:', error)
      toast.error(error.message || 'Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  function giorniScadenza(dataStr: string) {
    return Math.ceil((new Date(dataStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  }

  function getScadenzaBadge(dataStr: string) {
    const g = giorniScadenza(dataStr)
    if (g < 0) return { label: 'SCADUTA', color: 'bg-red-100 text-red-700' }
    if (g <= 30) return { label: `Scade in ${g}gg`, color: 'bg-orange-100 text-orange-700' }
    if (g <= 90) return { label: `Scade in ${g}gg`, color: 'bg-yellow-100 text-yellow-700' }
    return { label: `Scade in ${g}gg`, color: 'bg-green-100 text-green-700' }
  }

  // Helper form field
  const field = (label: string, key: string, type = 'text', opts?: { placeholder?: string; maxLength?: number; disabled?: boolean }) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {editing && !opts?.disabled ? (
        <input
          type={type}
          value={formData[key] || ''}
          onChange={(e) => setFormData((p: any) => ({ ...p, [key]: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          placeholder={opts?.placeholder}
          maxLength={opts?.maxLength}
        />
      ) : (
        <div className="text-sm text-gray-900 font-medium py-2">
          {type === 'date' && fornitore?.[key]
            ? new Date(fornitore[key]).toLocaleDateString('it-IT')
            : fornitore?.[key] || <span className="text-gray-300 italic">—</span>}
        </div>
      )}
    </div>
  )

  if (authLoading || loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-gray-500">Caricamento...</p>
        </div>
      </div>
    )
  }

  if (!fornitoreId) {
    return (
      <div className="p-8 text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Nessun fornitore associato</h2>
        <p className="text-gray-500">Il tuo account non è collegato a nessun fornitore.<br />Contatta l'amministratore.</p>
      </div>
    )
  }

  if (!fornitore) return null

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">

      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full border border-blue-200">
              👤 Vista Operatore
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">La mia Azienda</h1>
          <p className="text-gray-500 mt-1 text-sm">🏢 {fornitore.ragione_sociale}</p>
        </div>
        {!editing ? (
          <button
            onClick={() => { setFormData({ ...fornitore }); setEditing(true) }}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
          >
            ✏️ Modifica Dati
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => { setEditing(false); setFormData({ ...fornitore }) }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
              disabled={saving}
            >
              Annulla
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Salvataggio...' : '💾 Salva Modifiche'}
            </button>
          </div>
        )}
      </div>

      {/* ═══ RIEPILOGO ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Imbarcazioni', val: imbarcazioni.length, icon: '🚤', color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Attive', val: imbarcazioni.filter(b => b.attiva).length, icon: '✅', color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Skipper', val: skipper.length, icon: '👨‍✈️', color: 'text-purple-700', bg: 'bg-purple-50' },
          { label: 'Dipendenti', val: fornitore.num_dipendenti || 0, icon: '👥', color: 'text-gray-700', bg: 'bg-gray-50' },
        ].map(({ label, val, icon, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl border border-gray-200 p-4 text-center`}>
            <div className={`text-2xl font-bold ${color}`}>{val}</div>
            <div className="text-xs text-gray-500 mt-1">{icon} {label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ═══ SEZIONE ANAGRAFICA ═══ */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">🏢 Anagrafica</h3>

          {/* Ragione Sociale — solo visualizzazione */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">Ragione Sociale</label>
            <div className="text-sm text-gray-900 font-bold py-2 flex items-center gap-2">
              {fornitore.ragione_sociale}
              {fornitore.attivo ? (
                <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Attivo</span>
              ) : (
                <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">Inattivo</span>
              )}
              {fornitore.art_68 && (
                <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">Art. 68</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Nome Referente', 'nome_referente')}
            {field('Email', 'email', 'email')}
            {field('Telefono', 'telefono', 'tel')}
            {field('PEC', 'pec', 'email')}
          </div>
        </div>

        {/* ═══ SEZIONE DATI FISCALI ═══ */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">📋 Dati Fiscali</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Partita IVA', 'partita_iva')}
            {field('Codice Fiscale', 'codice_fiscale')}
            {field('Codice SDI', 'codice_sdi', 'text', { maxLength: 7 })}
          </div>

          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mt-6 mb-4">🏦 Dati Bancari</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('IBAN', 'iban')}
            {field('Banca', 'banca')}
          </div>
        </div>

        {/* ═══ SEZIONE INDIRIZZO ═══ */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">📍 Indirizzo</h3>
          <div className="space-y-4">
            {field('Indirizzo', 'indirizzo')}
            <div className="grid grid-cols-3 gap-3">
              {field('Città', 'citta')}
              {field('CAP', 'cap', 'text', { maxLength: 5 })}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Provincia</label>
                {editing ? (
                  <input
                    type="text"
                    value={formData.provincia || ''}
                    onChange={(e) => setFormData((p: any) => ({ ...p, provincia: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    maxLength={2}
                  />
                ) : (
                  <div className="text-sm text-gray-900 font-medium py-2">{fornitore.provincia || <span className="text-gray-300 italic">—</span>}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ SEZIONE DATI NAUTICI ═══ */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">⚓ Dati Nautici</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Base Nautica', 'base_nautica', 'text', { placeholder: 'Es: Porto Turistico Marina d\'Arechi' })}
            {field('Data Inizio Attività', 'data_inizio_attivita', 'date')}
            {field('Capitaneria di Porto', 'capitaneria_porto', 'text', { placeholder: 'Es: Salerno' })}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">N° Dipendenti</label>
              {editing ? (
                <input
                  type="number"
                  min="0"
                  value={formData.num_dipendenti || 0}
                  onChange={(e) => setFormData((p: any) => ({ ...p, num_dipendenti: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <div className="text-sm text-gray-900 font-medium py-2">{fornitore.num_dipendenti || 0}</div>
              )}
            </div>
          </div>

          {/* Art. 68 */}
          <div className="mt-4 flex items-center gap-3">
            {editing ? (
              <>
                <input
                  type="checkbox"
                  id="art68-op"
                  checked={formData.art_68 || false}
                  onChange={(e) => setFormData((p: any) => ({ ...p, art_68: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="art68-op" className="text-sm font-medium text-gray-700">Art. 68 — Iscritto</label>
              </>
            ) : (
              <div className="text-sm">
                <span className="text-gray-500">Art. 68:</span>{' '}
                {fornitore.art_68
                  ? <span className="font-semibold text-green-600">Sì ✅</span>
                  : <span className="text-gray-400">No</span>}
              </div>
            )}
          </div>

          {/* Note */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">Note</label>
            {editing ? (
              <textarea
                value={formData.note || ''}
                onChange={(e) => setFormData((p: any) => ({ ...p, note: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            ) : fornitore.note ? (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">📝 {fornitore.note}</div>
            ) : (
              <div className="text-sm text-gray-300 italic py-2">—</div>
            )}
          </div>

          {/* Commissione — solo visualizzazione */}
          {fornitore.percentuale_commissione && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-xs text-gray-500">Commissione Blu Alliance:</span>
              <span className="ml-2 text-lg font-bold text-blue-700">{fornitore.percentuale_commissione}%</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ SEZIONE SKIPPER ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            👨‍✈️ I miei Skipper ({skipper.length})
          </h3>
          <button
            onClick={() => router.push('/dashboard/skipper')}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            Gestisci in Skipper →
          </button>
        </div>

        {skipper.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">👨‍✈️</div>
            <p className="text-gray-400 text-sm">Nessuno skipper associato</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {skipper.map((s) => {
              const badge = s.scadenza_patente ? getScadenzaBadge(s.scadenza_patente) : null
              return (
                <div key={s.id} className={`p-4 rounded-lg border ${s.attivo ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-gray-900 text-sm">{s.cognome} {s.nome}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.attivo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.attivo ? 'Attivo' : 'Inattivo'}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-gray-500">
                    <div>🪪 Patente: <span className="font-mono text-gray-700">{s.numero_patente}</span></div>
                    {s.telefono && (
                      <div>📱 <a href={`tel:${s.telefono}`} className="text-blue-600 hover:underline">{s.telefono}</a></div>
                    )}
                    {s.email && (
                      <div>📧 <a href={`mailto:${s.email}`} className="text-blue-600 hover:underline">{s.email}</a></div>
                    )}
                  </div>
                  {badge && (
                    <div className="mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
                    </div>
                  )}
                  {s.note && (
                    <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2">📝 {s.note}</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ═══ SEZIONE IMBARCAZIONI RIEPILOGO ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            🚤 Le mie Imbarcazioni ({imbarcazioni.length})
          </h3>
          <button
            onClick={() => router.push('/dashboard/mie-barche')}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            Gestisci Barche →
          </button>
        </div>

        {imbarcazioni.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">Nessuna imbarcazione registrata</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {imbarcazioni.map((b) => (
              <div key={b.id} className={`p-3 rounded-lg border text-sm ${b.attiva ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">{b.nome}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    b.categoria === 'simple' ? 'bg-green-100 text-green-700 border-green-200' :
                    b.categoria === 'premium' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                    'bg-purple-100 text-purple-700 border-purple-200'
                  }`}>
                    {b.categoria}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {b.tipo} • 👥 {b.capacita_massima} posti
                  {!b.attiva && <span className="ml-2 text-red-500">⏸ Inattiva</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}