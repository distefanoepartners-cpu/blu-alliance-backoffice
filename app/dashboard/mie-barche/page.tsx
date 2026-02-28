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
                >'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Image from 'next/image'

export default function MieBarchePage() {
  const { isOperatore, isAdmin, fornitoreId, loading: authLoading } = useAuth()
  const router = useRouter()

  const [imbarcazioni, setImbarcazioni] = useState<any[]>([])
  const [fornitore, setFornitore] = useState<any>(null)
  const [servizi, setServizi] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Servizi modal
  const [showServiziModal, setShowServiziModal] = useState(false)
  const [selectedImbarcazione, setSelectedImbarcazione] = useState<any>(null)
  const [serviziSelezionati, setServiziSelezionati] = useState<{[key: string]: boolean}>({})
  const [prezziServizi, setPrezziServizi] = useState<{[key: string]: number | string}>({})

  // Detail modal
  const [showDettagli, setShowDettagli] = useState(false)
  const [dettagliImbarcazione, setDettagliImbarcazione] = useState<any>(null)

  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'gommone',
    categoria: 'simple',
    capacita_massima: 6,
    descrizione: '',
    caratteristiche: '',
    immagine_principale: '',
    attiva: true
  })

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    // Solo operatore può accedere
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
    try {
      setLoading(true)

      // Carica dati fornitore
      const { data: fornData } = await supabase
        .from('fornitori')
        .select('id, ragione_sociale, email, telefono, indirizzo')
        .eq('id', fornitoreId)
        .single()
      setFornitore(fornData)

      // Carica imbarcazioni del fornitore
      const { data: barcheData } = await supabase
        .from('imbarcazioni')
        .select('*')
        .eq('fornitore_id', fornitoreId)
        .order('nome')

      // Carica servizi
      const { data: serviziData } = await supabase
        .from('servizi')
        .select('id, nome, tipo, prezzo_base')
        .eq('attivo', true)
        .order('nome')

      // Carica prezzi per categoria
      const { data: prezziCategoriaData } = await supabase
        .from('servizi_prezzi_categoria')
        .select('*')

      // Carica servizi associati dalla view
      const { data: serviziAssociatiData } = await supabase
        .from('vista_imbarcazioni_servizi_con_prezzi')
        .select('*')

      // Combina servizi con prezzi
      const serviziConPrezzi = (serviziData || []).map(servizio => {
        const prezzi = (prezziCategoriaData || []).filter(p => p.servizio_id === servizio.id)
        return {
          ...servizio,
          prezzi_categoria: {
            simple: prezzi.find(p => p.categoria === 'simple')?.prezzo || null,
            premium: prezzi.find(p => p.categoria === 'premium')?.prezzo || null,
            luxury: prezzi.find(p => p.categoria === 'luxury')?.prezzo || null
          }
        }
      })

      // Combina imbarcazioni con servizi
      const imbarcazioniConServizi = (barcheData || []).map(imb => {
        const serviziDellImb = (serviziAssociatiData || [])
          .filter(sa => sa.imbarcazione_id === imb.id)
          .map(sa => ({
            id: sa.servizio_id,
            nome: sa.servizio_nome,
            tipo: sa.servizio_tipo,
            prezzo_base: sa.servizio_prezzo_base,
            prezzo_finale: sa.prezzo_finale,
            prezzo_personalizzato: sa.prezzo_personalizzato
          }))
        return { ...imb, servizi_associati: serviziDellImb }
      })

      setImbarcazioni(imbarcazioniConServizi)
      setServizi(serviziConPrezzi)
    } catch (error) {
      console.error('Errore caricamento:', error)
      toast.error('Errore nel caricamento dati')
    } finally {
      setLoading(false)
    }
  }

  // ═══ FILTRO RICERCA ═══
  const imbarcazioniFiltrate = imbarcazioni.filter(b => {
    if (!searchTerm.trim()) return true
    const t = searchTerm.toLowerCase()
    return b.nome?.toLowerCase().includes(t) ||
      b.tipo?.toLowerCase().includes(t) ||
      b.descrizione?.toLowerCase().includes(t)
  })

  // ═══ HELPERS ═══
  const getTipoLabel = (tipo: string) => {
    const labels: {[k: string]: string} = {
      'gommone': 'Gommone', 'barca': 'Natante', 'barca_vela': 'Barca a Vela',
      'yacht': 'Yacht', 'catamarano': 'Catamarano', 'gozzo': 'Gozzo'
    }
    return labels[tipo] || tipo
  }

  const getCategoriaColor = (cat: string) => {
    switch (cat) {
      case 'simple': return 'bg-green-100 text-green-700 border-green-200'
      case 'premium': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'luxury': return 'bg-purple-100 text-purple-700 border-purple-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getCategoriaLabel = (cat: string) => {
    switch (cat) {
      case 'simple': return 'Simple'
      case 'premium': return 'Premium'
      case 'luxury': return 'Luxury'
      default: return cat
    }
  }

  // ═══ EDIT MODAL ═══
  function handleEdit(imbarcazione: any) {
    setEditingId(imbarcazione.id)
    let caratteristicheString = ''
    if (imbarcazione.caratteristiche) {
      caratteristicheString = Array.isArray(imbarcazione.caratteristiche)
        ? imbarcazione.caratteristiche.join(', ')
        : imbarcazione.caratteristiche
    }
    setFormData({
      nome: imbarcazione.nome,
      tipo: imbarcazione.tipo,
      categoria: imbarcazione.categoria,
      capacita_massima: imbarcazione.capacita_massima,
      descrizione: imbarcazione.descrizione || '',
      caratteristiche: caratteristicheString,
      immagine_principale: imbarcazione.immagine_principale || '',
      attiva: imbarcazione.attiva
    })
    setImageFile(null)
    setImagePreview(imbarcazione.immagine_principale || null)
    setShowModal(true)
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Il file deve essere un\'immagine'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Immagine troppo grande (max 5MB)'); return }
    setImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function uploadImage(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const { error } = await supabase.storage
      .from('imbarcazioni')
      .upload(fileName, file, { cacheControl: '3600', upsert: false })
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage
      .from('imbarcazioni')
      .getPublicUrl(fileName)
    return publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      setSaving(true)
      let imageUrl = formData.immagine_principale
      if (imageFile) {
        setUploadingImage(true)
        imageUrl = await uploadImage(imageFile)
      }

      const caratteristicheArray = (() => {
        if (!formData.caratteristiche || formData.caratteristiche.trim() === '') return null
        return formData.caratteristiche.split(/[,\n]/).map(c => c.trim()).filter(c => c.length > 0)
      })()

      const dataToSave = {
        nome: formData.nome,
        tipo: formData.tipo,
        categoria: formData.categoria,
        capacita_massima: formData.capacita_massima || null,
        descrizione: formData.descrizione || null,
        caratteristiche: caratteristicheArray,
        immagine_principale: imageUrl || null,
        fornitore_id: fornitoreId, // sempre il proprio fornitore
        attiva: formData.attiva
      }

      if (editingId) {
        // Operatore può solo aggiornare le PROPRIE barche
        const { error } = await supabase
          .from('imbarcazioni')
          .update(dataToSave)
          .eq('id', editingId)
          .eq('fornitore_id', fornitoreId) // sicurezza extra
        if (error) throw error
        toast.success('Imbarcazione aggiornata!')
      } else {
        const { error } = await supabase
          .from('imbarcazioni')
          .insert([dataToSave])
        if (error) throw error
        toast.success('Imbarcazione creata!')
      }

      setShowModal(false)
      loadData()
    } catch (error: any) {
      console.error('Errore:', error)
      toast.error(error.message || 'Errore nel salvataggio')
    } finally {
      setSaving(false)
      setUploadingImage(false)
    }
  }

  function handleNew() {
    setEditingId(null)
    setFormData({
      nome: '', tipo: 'gommone', categoria: 'simple', capacita_massima: 6,
      descrizione: '', caratteristiche: '', immagine_principale: '', attiva: true
    })
    setImageFile(null)
    setImagePreview(null)
    setShowModal(true)
  }

  async function toggleAttiva(barca: any) {
    try {
      const { error } = await supabase
        .from('imbarcazioni')
        .update({ attiva: !barca.attiva })
        .eq('id', barca.id)
        .eq('fornitore_id', fornitoreId)
      if (error) throw error
      toast.success(barca.attiva ? 'Barca disattivata' : 'Barca attivata')
      loadData()
    } catch { toast.error('Errore aggiornamento stato') }
  }

  // ═══ SERVIZI MODAL ═══
  function openServiziModal(imbarcazione: any) {
    setSelectedImbarcazione(imbarcazione)
    const stati: {[key: string]: boolean} = {}
    const prezzi: {[key: string]: number | string} = {}
    imbarcazione.servizi_associati?.forEach((s: any) => {
      stati[s.id] = true
      prezzi[s.id] = s.prezzo_personalizzato ?? s.prezzo_finale ?? ''
    })
    setServiziSelezionati(stati)
    setPrezziServizi(prezzi)
    setShowServiziModal(true)
  }

  async function handleSalvaServizi() {
    if (!selectedImbarcazione) return
    try {
      await supabase.from('imbarcazioni_servizi').delete().eq('imbarcazione_id', selectedImbarcazione.id)
      const serviziDaInserire = Object.entries(serviziSelezionati)
        .filter(([_, sel]) => sel)
        .map(([servizioId]) => ({
          imbarcazione_id: selectedImbarcazione.id,
          servizio_id: servizioId,
          attivo: true,
          prezzo_personalizzato: prezziServizi[servizioId] !== '' && prezziServizi[servizioId] != null
            ? parseFloat(String(prezziServizi[servizioId]))
            : null
        }))
      if (serviziDaInserire.length > 0) {
        const { error } = await supabase.from('imbarcazioni_servizi').insert(serviziDaInserire)
        if (error) throw error
      }
      toast.success('Servizi aggiornati!')
      setShowServiziModal(false)
      loadData()
    } catch (error: any) {
      console.error('Errore:', error)
      toast.error('Errore nel salvataggio servizi')
    }
  }

  // ═══ LOADING & AUTH STATES ═══
  if (authLoading || loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-gray-500">Caricamento barche...</p>
        </div>
      </div>
    )
  }

  if (!fornitoreId) {
    return (
      <div className="p-8 text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Nessun fornitore associato</h2>
        <p className="text-gray-500">Il tuo account non è collegato a nessun fornitore.<br />Contatta l'amministratore per la configurazione.</p>
      </div>
    )
  }

  const attive = imbarcazioni.filter(b => b.attiva).length
  const totPosti = imbarcazioni.filter(b => b.attiva).reduce((s, b) => s + (parseInt(b.capacita_massima) || 0), 0)

  return (
    <div className="p-4 md:p-8">

      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full border border-blue-200">
              👤 Vista Operatore
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Le Mie Barche</h1>
          {fornitore && (
            <p className="text-gray-500 mt-1 text-sm">🏢 {fornitore.ragione_sociale}</p>
          )}
        </div>
        <button
          onClick={handleNew}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
        >
          + Nuova Imbarcazione
        </button>
      </div>

      {/* ═══ INFO FORNITORE ═══ */}
      {fornitore && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-gray-500 block text-xs mb-0.5">Ragione Sociale</span>
              <span className="font-semibold text-gray-900">{fornitore.ragione_sociale}</span>
            </div>
            {fornitore.email && (
              <div>
                <span className="text-gray-500 block text-xs mb-0.5">Email</span>
                <a href={`mailto:${fornitore.email}`} className="text-blue-600 hover:underline">{fornitore.email}</a>
              </div>
            )}
            {fornitore.telefono && (
              <div>
                <span className="text-gray-500 block text-xs mb-0.5">Telefono</span>
                <a href={`tel:${fornitore.telefono}`} className="text-blue-600 hover:underline">{fornitore.telefono}</a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ STATS ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Totale Barche', val: imbarcazioni.length, color: 'text-gray-900', bg: 'bg-white' },
          { label: 'Attive', val: attive, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Non attive', val: imbarcazioni.length - attive, color: 'text-gray-500', bg: 'bg-white' },
          { label: 'Posti Totali', val: totPosti, color: 'text-blue-700', bg: 'bg-blue-50' },
        ].map(({ label, val, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl border border-gray-200 p-4 text-center`}>
            <div className={`text-2xl font-bold ${color}`}>{val}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* ═══ RICERCA ═══ */}
      {imbarcazioni.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cerca per nome, tipo, descrizione..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      )}

      {/* ═══ CARD BARCHE ═══ */}
      {imbarcazioniFiltrate.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">🚤</div>
          <p className="text-gray-500">
            {searchTerm ? 'Nessuna barca trovata' : 'Nessuna imbarcazione registrata'}
          </p>
          {!searchTerm && (
            <button onClick={handleNew} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
              Aggiungi la prima barca
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {imbarcazioniFiltrate.map((barca) => (
            <div key={barca.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow ${!barca.attiva ? 'opacity-60' : ''}`}>
              {/* Immagine */}
              {barca.immagine_principale ? (
                <div className="relative h-48 bg-gray-100">
                  <Image src={barca.immagine_principale} alt={barca.nome} fill className="object-cover" />
                  <div className="absolute top-3 right-3 flex gap-2">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getCategoriaColor(barca.categoria)}`}>
                      {getCategoriaLabel(barca.categoria)}
                    </span>
                  </div>
                  <div className="absolute top-3 left-3">
                    <button
                      onClick={() => toggleAttiva(barca)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors ${
                        barca.attiva
                          ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {barca.attiva ? '✅ Attiva' : '⏸ Inattiva'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative h-48 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                  <span className="text-5xl">🚤</span>
                  <div className="absolute top-3 right-3 flex gap-2">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getCategoriaColor(barca.categoria)}`}>
                      {getCategoriaLabel(barca.categoria)}
                    </span>
                  </div>
                  <div className="absolute top-3 left-3">
                    <button
                      onClick={() => toggleAttiva(barca)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors ${
                        barca.attiva
                          ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {barca.attiva ? '✅ Attiva' : '⏸ Inattiva'}
                    </button>
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="p-5">
                <h3 className="text-lg font-bold text-gray-900 mb-1">{barca.nome}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <span>{getTipoLabel(barca.tipo)}</span>
                  <span>•</span>
                  <span>👥 {barca.capacita_massima} posti</span>
                </div>

                {barca.descrizione && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{barca.descrizione}</p>
                )}

                {/* Caratteristiche */}
                {barca.caratteristiche && barca.caratteristiche.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {(Array.isArray(barca.caratteristiche) ? barca.caratteristiche : []).map((c: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full border border-gray-200">
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                {/* Servizi */}
                {barca.servizi_associati?.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-3 mb-3">
                    <div className="text-xs font-semibold text-blue-900 mb-1.5">📋 Servizi & Prezzi</div>
                    <div className="space-y-1">
                      {barca.servizi_associati.map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{s.nome}</span>
                          <span className="font-semibold text-blue-600">
                            €{(s.prezzo_finale || s.prezzo_base || 0).toLocaleString('it-IT')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Azioni */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => openServiziModal(barca)}
                    className="px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 text-xs font-medium"
                  >
                    🎯 Servizi
                  </button>
                  <button
                    onClick={() => handleEdit(barca)}
                    className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-xs font-medium"
                  >
                    ✏️ Modifica
                  </button>
                  <button
                    onClick={() => router.push('/dashboard/disponibilita')}
                    className="px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 text-xs font-medium"
                  >
                    📅 Planning
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ MODAL MODIFICA / CREA BARCA ═══ */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full my-8">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white p-6 border-b flex items-center justify-between rounded-t-xl">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingId ? 'Modifica Imbarcazione' : 'Nuova Imbarcazione'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  🏢 {fornitore?.ragione_sociale}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Immagine */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Immagine</label>
                {imagePreview ? (
                  <div className="relative mb-3">
                    <div className="relative h-48 w-full rounded-lg overflow-hidden bg-gray-100">
                      <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                    </div>
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(null); setFormData(p => ({ ...p, immagine_principale: '' })) }}
                      className="absolute top-2 right-2 px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                    >
                      Rimuovi
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <input type="file" accept="image/*" onChange={handleImageSelect} disabled={uploadingImage} className="hidden" id="img-upload" />
                    <label htmlFor="img-upload" className="cursor-pointer">
                      <span className="text-4xl mb-2 block">📷</span>
                      <span className="text-sm text-gray-600">Click per caricare immagine</span>
                      <span className="text-xs text-gray-500 block mt-1">JPG, PNG, WebP (max 5MB)</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Nome + Tipo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                  <input type="text" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="gommone">Gommone</option>
                    <option value="barca">Natante</option>
                    <option value="barca_vela">Barca a Vela</option>
                    <option value="yacht">Yacht</option>
                    <option value="catamarano">Catamarano</option>
                    <option value="gozzo">Gozzo</option>
                  </select>
                </div>
              </div>

              {/* Categoria + Capacità */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
                  <select value={formData.categoria} onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required>
                    <option value="simple">Simple</option>
                    <option value="premium">Premium</option>
                    <option value="luxury">Luxury</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacità Max</label>
                  <input type="number" value={formData.capacita_massima}
                    onChange={(e) => setFormData({ ...formData, capacita_massima: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" min="1" />
                </div>
              </div>

              {/* Descrizione */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                <textarea value={formData.descrizione} onChange={(e) => setFormData({ ...formData, descrizione: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={3} />
              </div>

              {/* Caratteristiche */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Caratteristiche</label>
                <textarea value={formData.caratteristiche} onChange={(e) => setFormData({ ...formData, caratteristiche: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={2}
                  placeholder="Tendalino, doccetta, igloo con ghiaccio..." />
                <p className="text-xs text-gray-500 mt-1">Separa con virgole</p>
              </div>

              {/* Stato */}
              <div className="flex items-center gap-3">
                <input type="checkbox" id="attiva-modal" checked={formData.attiva}
                  onChange={(e) => setFormData({ ...formData, attiva: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded" />
                <label htmlFor="attiva-modal" className="text-sm font-medium text-gray-700">Imbarcazione attiva</label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} disabled={saving}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
                  Annulla
                </button>
                <button type="submit" disabled={saving || uploadingImage}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                  {uploadingImage ? 'Caricamento immagine...' : saving ? 'Salvataggio...' : editingId ? 'Aggiorna' : 'Crea Imbarcazione'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ MODAL SERVIZI & PREZZI ═══ */}
      {showServiziModal && selectedImbarcazione && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Servizi & Prezzi</h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  {selectedImbarcazione.nome} • <span className="font-semibold">{getCategoriaLabel(selectedImbarcazione.categoria)}</span>
                </p>
              </div>
              <button onClick={() => setShowServiziModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5">
                <p className="text-sm text-blue-900">
                  💡 Attiva i servizi offerti e imposta il <strong>prezzo specifico</strong> per questa barca.
                </p>
              </div>

              <div className="space-y-3">
                {servizi.map(servizio => {
                  const isSelected = serviziSelezionati[servizio.id] || false
                  return (
                    <div key={servizio.id} className={`border-2 rounded-lg transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                      <div className="flex items-center gap-3 p-4 cursor-pointer"
                        onClick={() => setServiziSelezionati(prev => ({ ...prev, [servizio.id]: !prev[servizio.id] }))}>
                        <input type="checkbox" checked={isSelected} onChange={() => {}} className="w-4 h-4 text-blue-600 rounded flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900">{servizio.nome}</div>
                          <div className="text-xs text-gray-500 capitalize mt-0.5">{servizio.tipo}</div>
                        </div>
                        {isSelected && prezziServizi[servizio.id] ? (
                          <span className="text-sm font-bold text-blue-700">€{parseFloat(String(prezziServizi[servizio.id])).toLocaleString('it-IT')}</span>
                        ) : isSelected ? (
                          <span className="text-xs text-amber-600 font-medium">⚠️ Prezzo mancante</span>
                        ) : null}
                      </div>
                      {isSelected && (
                        <div className="px-4 pb-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Prezzo (€)</label>
                            <div className="relative flex-1 max-w-[180px]">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                              <input type="number" min="0" step="0.01"
                                value={prezziServizi[servizio.id] ?? ''}
                                onChange={(e) => setPrezziServizi(prev => ({ ...prev, [servizio.id]: e.target.value }))}
                                placeholder="0.00"
                                className="w-full pl-7 pr-3 py-2 border border-blue-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 bg-white" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button onClick={() => setShowServiziModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white text-sm">
                Annulla
              </button>
              <button onClick={handleSalvaServizi} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                Salva Servizi & Prezzi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
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