// FILE: /app/api/chatbot/availability/route.ts
// Endpoint per verificare disponibilità barche in date specifiche

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://blualliancegroup.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { data_servizio, imbarcazione_id, servizio_id } = body

    if (!data_servizio) {
      return NextResponse.json({ error: 'Data richiesta' }, { status: 400 })
    }

    // Query per trovare prenotazioni esistenti nella data richiesta
    let query = supabase
      .from('prenotazioni')
      .select('id, imbarcazione_id, servizio_id, ora_imbarco, numero_persone, stato')
      .eq('data_servizio', data_servizio)
      .in('stato', ['in_attesa', 'confermata']) // Escludi cancellate e completate

    if (imbarcazione_id) {
      query = query.eq('imbarcazione_id', imbarcazione_id)
    }

    const { data: prenotazioni, error } = await query

    if (error) throw error

    // Se ci sono prenotazioni nella stessa data con la stessa barca, potrebbe non essere disponibile
    const disponibile = !prenotazioni || prenotazioni.length === 0

    // Recupera info sulla barca se specificata
    let imbarcazioneInfo = null
    if (imbarcazione_id) {
      const { data: imb } = await supabase
        .from('imbarcazioni')
        .select('nome, tipo, categoria, capacita_massima')
        .eq('id', imbarcazione_id)
        .eq('attiva', true)
        .single()
      
      imbarcazioneInfo = imb
    }

    // Recupera info sul servizio se specificato
    let servizioInfo = null
    if (servizio_id) {
      const { data: srv } = await supabase
        .from('servizi')
        .select('nome, tipo, prezzo_base, durata_minuti, prezzo_per_persona')
        .eq('id', servizio_id)
        .eq('attivo', true)
        .single()
      
      servizioInfo = srv
    }

    return NextResponse.json({
      disponibile,
      data_richiesta: data_servizio,
      prenotazioni_esistenti: prenotazioni?.length || 0,
      imbarcazione: imbarcazioneInfo,
      servizio: servizioInfo,
      message: disponibile 
        ? 'La data è disponibile!' 
        : `Attenzione: ci sono già ${prenotazioni?.length} prenotazioni per questa data.`
    }, { headers: corsHeaders })

  } catch (error: any) {
    console.error('Errore verifica disponibilità:', error)
    return NextResponse.json(
      { error: 'Errore nella verifica disponibilità', details: error.message },
      { status: 500, headers: corsHeaders }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const data_da = searchParams.get('data_da') || new Date().toISOString().split('T')[0]
    const data_a = searchParams.get('data_a')
    const imbarcazione_id = searchParams.get('imbarcazione_id')

    // Query per ottenere prenotazioni nel range di date
    let query = supabase
      .from('vista_prenotazioni_complete')
      .select('*')
      .gte('data_servizio', data_da)
      .in('stato', ['in_attesa', 'confermata'])

    if (data_a) {
      query = query.lte('data_servizio', data_a)
    }

    if (imbarcazione_id) {
      query = query.eq('imbarcazione_id', imbarcazione_id)
    }

    const { data: prenotazioni, error } = await query.order('data_servizio')

    if (error) throw error

    // Raggruppa prenotazioni per data
    const prenotazioniPerData: Record<string, any[]> = {}
    prenotazioni?.forEach(p => {
      const data = p.data_servizio
      if (!prenotazioniPerData[data]) {
        prenotazioniPerData[data] = []
      }
      prenotazioniPerData[data].push({
        imbarcazione: p.imbarcazione_nome,
        servizio: p.servizio_nome,
        ora_imbarco: p.ora_imbarco,
        numero_persone: p.numero_persone
      })
    })

    return NextResponse.json({
      prenotazioni_per_data: prenotazioniPerData,
      totale_prenotazioni: prenotazioni?.length || 0
    }, { headers: corsHeaders })

  } catch (error: any) {
    console.error('Errore recupero disponibilità:', error)
    return NextResponse.json(
      { error: 'Errore nel recupero disponibilità', details: error.message },
      { status: 500, headers: corsHeaders }
    )
  }
}
