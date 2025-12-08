// FILE: /app/api/chatbot/lead/route.ts
// Endpoint per raccogliere lead/richieste dal chatbot

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Tabella per salvare i lead generati dal chatbot
// Puoi crearla in Supabase con questo schema:
/*
CREATE TABLE chatbot_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT,
  cognome TEXT,
  email TEXT NOT NULL,
  telefono TEXT,
  numero_persone INTEGER,
  data_desiderata DATE,
  servizio_interesse TEXT,
  messaggio TEXT,
  conversazione_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
*/

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      nome,
      cognome,
      email,
      telefono,
      numero_persone,
      data_desiderata,
      servizio_interesse,
      messaggio,
      conversazione
    } = body

    // Validazione base
    if (!email) {
      return NextResponse.json({ error: 'Email richiesta' }, { status: 400 })
    }

    // Salva il lead nella tabella chatbot_leads
    const { data: lead, error: leadError } = await supabase
      .from('chatbot_leads')
      .insert([{
        nome: nome || null,
        cognome: cognome || null,
        email,
        telefono: telefono || null,
        numero_persone: numero_persone || null,
        data_desiderata: data_desiderata || null,
        servizio_interesse: servizio_interesse || null,
        messaggio: messaggio || null,
        conversazione_json: conversazione || null
      }])
      .select()
      .single()

    if (leadError) {
      // Se la tabella non esiste ancora, restituisci un messaggio più friendly
      if (leadError.code === '42P01') {
        console.error('Tabella chatbot_leads non trovata. Crearla in Supabase.')
        return NextResponse.json({
          success: false,
          message: 'Sistema di raccolta lead non configurato. Contattaci direttamente.',
          error: 'Table not found'
        }, { status: 500 })
      }
      throw leadError
    }

    // TODO: Opzionale - Invia notifica email all'admin
    // TODO: Opzionale - Invia email di conferma al cliente

    return NextResponse.json({
      success: true,
      message: 'Richiesta ricevuta! Ti contatteremo presto.',
      lead_id: lead.id
    })

  } catch (error: any) {
    console.error('Errore salvataggio lead:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Errore nel salvataggio della richiesta', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}

// GET per recuperare i lead (admin only - aggiungi autenticazione!)
export async function GET(request: NextRequest) {
  try {
    // TODO: Aggiungere autenticazione qui
    // Per ora è aperto, ma in produzione deve essere protetto

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const { data: leads, error } = await supabase
      .from('chatbot_leads')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({
      leads: leads || [],
      count: leads?.length || 0
    })

  } catch (error: any) {
    console.error('Errore recupero lead:', error)
    return NextResponse.json(
      { error: 'Errore nel recupero dei lead', details: error.message },
      { status: 500 }
    )
  }
}