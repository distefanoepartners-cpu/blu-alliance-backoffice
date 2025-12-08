import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Imbarcazione {
  id: string
  nome: string
  tipo: string
  capacita_massima: number
  descrizione: string | null
  caratteristiche: string[] | null
  attiva: boolean
  created_at: string
}

export interface PrenotazioneCompleta {
  id: string
  codice_prenotazione: string
  data_servizio: string
  numero_persone: number
  prezzo_totale: number
  stato: string
  cliente_nome_completo: string
  cliente_email: string
  servizio_nome: string
  imbarcazione_nome: string
  created_at: string
}