// FILE: /app/api/chatbot/query/route.ts
// Endpoint principale per le conversazioni del chatbot

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// CORS Headers per permettere chiamate da blualliancegroup.com
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://blualliancegroup.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Handle preflight OPTIONS request
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

// System prompt per il chatbot Blu Alliance
const SYSTEM_PROMPT = `Sei l'assistente virtuale di Blu Alliance, un consorzio di turismo marittimo che opera dal Porto di Salerno.

SERVIZI OFFERTI:
- Tour in barca lungo la Costiera Amalfitana (Positano, Amalfi, Ravello)
- Escursioni a Capri
- Tour nel Cilento
- Noleggio barche con e senza skipper
- Water taxi
- Tour collettivi

CARATTERISTICHE:
- Diverse categorie di imbarcazioni: Simple, Premium, Luxury
- Barche con capacità da 6 a 12+ persone
- Servizi personalizzabili
- Punti di imbarco: Porto di Salerno (Masuccio Salernitano, Molo Manfredi), Vietri, Cetara, Maiori, Minori, Amalfi

COMPORTAMENTO:
- Rispondi in modo cordiale, professionale e conciso
- Usa emoji occasionalmente per rendere la conversazione più amichevole 🚤
- Chiedi informazioni chiave: numero persone, data desiderata, tipo di esperienza
- Suggerisci servizi e barche in base alle esigenze
- Dopo 2-3 scambi, se l'utente sembra interessato, chiedi: "Vuoi che ti prepari un preventivo personalizzato?"
- Per prenotazioni, raccogli: nome, email, telefono, numero persone, data preferita
- Spiega che verranno ricontattati dal team entro 24 ore
- Guida l'utente verso la prenotazione in modo naturale
- Se non hai informazioni specifiche, suggerisci di chiamare il +39 379 234 2138

IMPORTANTE:
- NON inventare prezzi o disponibilità se non hai dati certi
- NON confermare prenotazioni - solo assistere nella scelta
- Fornisci informazioni basate sui dati reali del database
- Sii proattivo nel guidare verso la prenotazione
- Parla in italiano a meno che l'utente non scriva in inglese

CONTATTI:
- Telefono: +39 379 234 2138
- Disponibile per informazioni immediate`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, conversationHistory = [], userInfo = null } = body

    if (!message) {
      return NextResponse.json({ error: 'Messaggio richiesto' }, { status: 400, headers: corsHeaders })
    }

    // Aggiungi info utente al context se disponibili
    let userContext = '';
    if (userInfo && (userInfo.nome || userInfo.email || userInfo.telefono)) {
      userContext = `\n\nINFORMAZIONI UTENTE:
Nome: ${userInfo.nome || 'Non fornito'}
Email: ${userInfo.email || 'Non fornita'}
Telefono: ${userInfo.telefono || 'Non fornito'}

Usa queste informazioni per personalizzare la conversazione. Se hai il nome, chiamalo per nome.`;
    }

    // Recupera dati dal database per contestualizzare la risposta
    const [imbarcazioniResult, serviziResult] = await Promise.all([
      supabase
        .from('imbarcazioni')
        .select('id, nome, tipo, categoria, capacita_massima, descrizione, caratteristiche, attiva')
        .eq('attiva', true),
      supabase
        .from('servizi')
        .select('id, nome, tipo, descrizione, prezzo_base, durata_minuti, include, prezzo_per_persona, min_persone, max_persone, luogo_imbarco, attivo')
        .eq('attivo', true)
    ])

    const imbarcazioni = imbarcazioniResult.data || []
    const servizi = serviziResult.data || []

    // Recupera relazioni imbarcazioni-servizi
    const { data: relazioni } = await supabase
      .from('imbarcazioni_servizi')
      .select('imbarcazione_id, servizio_id')
      .eq('attivo', true)

    // Crea un contesto con i dati disponibili
    const contextData = {
      imbarcazioni: imbarcazioni.map(i => ({
        nome: i.nome,
        tipo: i.tipo,
        categoria: i.categoria,
        capacita: i.capacita_massima,
        descrizione: i.descrizione,
        caratteristiche: i.caratteristiche
      })),
      servizi: servizi.map(s => {
        // Trova barche associate a questo servizio
        const barcheIds = relazioni?.filter(r => r.servizio_id === s.id).map(r => r.imbarcazione_id) || []
        const barcheAssociate = imbarcazioni.filter(i => barcheIds.includes(i.id)).map(i => i.nome)

        return {
          nome: s.nome,
          tipo: s.tipo,
          descrizione: s.descrizione,
          prezzo_base: s.prezzo_base,
          durata_ore: (s.durata_minuti / 60).toFixed(1),
          include: s.include,
          prezzo_per_persona: s.prezzo_per_persona,
          min_persone: s.min_persone,
          max_persone: s.max_persone,
          luogo_imbarco: s.luogo_imbarco,
          barche_disponibili: barcheAssociate
        }
      })
    }

    // Costruisci i messaggi per Claude
    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory,
      {
        role: 'user',
        content: `DATI DISPONIBILI:
${JSON.stringify(contextData, null, 2)}${userContext}

DOMANDA CLIENTE:
${message}`
      }
    ]

    // Chiama Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages
    })

    const assistantMessage = response.content[0].type === 'text' 
      ? response.content[0].text 
      : 'Mi dispiace, non ho potuto elaborare la risposta.'

    // Salva lead se è il primo messaggio e ha fornito contatti
    if (conversationHistory.length === 0 && userInfo && (userInfo.email || userInfo.nome)) {
      try {
        const { data: newLead } = await supabase
          .from('chatbot_leads')
          .insert([{
            nome: userInfo.nome || null,
            cognome: null,
            email: userInfo.email || null,
            telefono: userInfo.telefono || null,
            messaggio: message,
            conversazione_json: [
              { role: 'user', content: message },
              { role: 'assistant', content: assistantMessage }
            ],
            stato: 'nuovo'
          }])
          .select()
          .single()
        
        console.log('Lead salvato:', newLead?.id)
      } catch (leadError) {
        console.error('Errore salvataggio lead:', leadError)
        // Non bloccare la conversazione se il salvataggio lead fallisce
      }
    } else if (conversationHistory.length > 0 && userInfo && userInfo.email) {
      // Aggiorna conversazione se il lead esiste già (conversazione continua)
      try {
        const { data: existingLead } = await supabase
          .from('chatbot_leads')
          .select('id')
          .eq('email', userInfo.email)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        
        if (existingLead) {
          await supabase
            .from('chatbot_leads')
            .update({
              conversazione_json: [
                ...conversationHistory,
                { role: 'user', content: message },
                { role: 'assistant', content: assistantMessage }
              ],
              updated_at: new Date().toISOString()
            })
            .eq('id', existingLead.id)
        }
      } catch (updateError) {
        console.error('Errore aggiornamento lead:', updateError)
        // Non bloccare la conversazione
      }
    }

    return NextResponse.json({
      message: assistantMessage,
      conversationHistory: [
        ...conversationHistory,
        { role: 'user', content: message },
        { role: 'assistant', content: assistantMessage }
      ]
    }, { headers: corsHeaders })

  } catch (error: any) {
    console.error('Errore chatbot:', error)
    return NextResponse.json(
      { error: 'Errore nell\'elaborazione della richiesta', details: error.message },
      { status: 500, headers: corsHeaders }
    )
  }
}