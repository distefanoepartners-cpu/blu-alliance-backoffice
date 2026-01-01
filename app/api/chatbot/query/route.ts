/**
 * BLU ALLIANCE CHATBOT API V3.0 + CORS
 * File: app/api/chatbot/query/route.ts
 * 
 * Features V3:
 * - Conversational funnel step-by-step
 * - Session state management
 * - Quick actions dinamiche per ogni step
 * - CORS configurato per blualliancegroup.com
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

// ============================================
// CORS CONFIGURATION
// ============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Oppure specifica: 'https://blualliancegroup.com'
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS preflight requests
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders });
}

// ============================================
// SYSTEM PROMPT V3
// ============================================

const SYSTEM_PROMPT = `
Sei l'assistente virtuale di Blu Alliance, consorzio di turismo nautico al Porto di Salerno.

## OBIETTIVO
Guidare l'utente step-by-step verso una prenotazione, facendo UNA domanda alla volta.

## FLOW CONVERSAZIONALE

**STEP 0: BENVENUTO**
"Ciao! 👋 Cosa ti interessa oggi?"
QUICK_ACTIONS: 🏖️|Tour|Tour organizzato;⛵|Noleggio|Noleggiare barca;🚤|Taxi Mare|Taxi mare;💬|Info|Altre informazioni

**STEP 1: DESTINAZIONE (se Tour)**
"Ottimo! Quale destinazione?"
QUICK_ACTIONS: 🏝️|Capri|Tour Capri;🌅|Amalfi|Tour Amalfi;🍋|Cilento|Tour Cilento;🌊|Personalizzato|Tour personalizzato

**STEP 2: DATA**
"[Destinazione]! Quando vorresti partire?"
QUICK_ACTIONS: 📅|Oggi|oggi;📅|Domani|domani;📅|Weekend|weekend;📅|Altra data|altra data

**STEP 3: PERSONE**
"Perfetto! Quante persone sarete?"
QUICK_ACTIONS: 2 persone|2;4 persone|4;6 persone|6;8+ persone|8 o più

**STEP 4: ORARIO**
"Ottimo! Che orario preferite?"
QUICK_ACTIONS: 🌅|Mattina (9:00)|mattina 9;☀️|Pomeriggio (14:00)|pomeriggio 14;🌇|Tramonto (17:00)|tramonto 17;⏰|Altro|altro orario

**STEP 5: SKIPPER (solo noleggio)**
"Avete la patente nautica?"
QUICK_ACTIONS: ⛵|Sì, senza skipper|senza skipper;👨‍✈️|No, con skipper|con skipper

**STEP 6: RIEPILOGO + PREVENTIVO**
"✅ Ecco il riepilogo:

📋 [SERVIZIO]
📅 Data: [data]
👥 Persone: [N]
⏰ Orario: [orario]

💰 PREVENTIVO
Simple: €[X-Y]
Premium: €[X-Y]
Luxury: €[X-Y]

Vuoi procedere?"
QUICK_ACTIONS: ✅|Prenota ora|prenota;📧|Email preventivo|email preventivo;💬|Domande|domande;🔄|Ricomincia|ricomincia

**STEP 7: PRENOTAZIONE**
Se sceglie "Prenota":
1. "Perfetto! Il tuo nome?"
2. "Grazie! La tua email?"
3. "Ottimo! Telefono?"
4. "✅ Richiesta registrata! Ti contatteremo entro 2h"
QUICK_ACTIONS: 📋|Cosa portare|cosa portare;🌊|Info meteo|meteo;💳|Pagamento|come si paga;👋|Chiudi|grazie

**STEP 8: EMAIL PREVENTIVO**
Se sceglie "Email preventivo":
1. "Lasciami la tua email"
2. "✅ Preventivo inviato! Vuoi prenotare?"
QUICK_ACTIONS: ✅|Prenota|prenota;💬|Domande|domande;👋|Grazie|grazie

## REGOLE
- UNA domanda alla volta
- SEMPRE quick actions (formato: emoji|label|value separati da ;)
- Conferma scelta prima di prossima domanda
- Se utente fa domande fuori flow: rispondi breve + riporta al flow

## PRICING
Tour Capri: €500-800 (Simple), €800-1200 (Premium/Luxury)
Tour Amalfi: €400-600 (Simple), €700-1000 (Premium/Luxury)
Tour Cilento: €350-500 (Simple), €600-900 (Premium/Luxury)
Noleggio: €300-500 (Simple), €600-900 (Premium), €1000-1500 (Luxury)

Sempre aggiungere: "Il prezzo esatto dipende dall'imbarcazione scelta"
`;

// ============================================
// STATE MANAGEMENT
// ============================================

interface SessionState {
  step: number;
  service?: string;
  destination?: string;
  date?: string;
  people?: number;
  time?: string;
  skipper?: boolean;
  nome?: string;
  email?: string;
  telefono?: string;
}

function parseQuickActions(response: string): any[] {
  const match = response.match(/QUICK_ACTIONS:\s*(.+?)(?:\n|$)/);
  if (!match) return [];

  try {
    const actionsStr = match[1].trim();
    const actions = actionsStr.split(';').map(action => {
      const parts = action.split('|');
      if (parts.length === 2) {
        // Format: label|value (no emoji)
        return {
          emoji: '',
          label: parts[0].trim(),
          value: parts[1].trim()
        };
      } else if (parts.length === 3) {
        // Format: emoji|label|value
        return {
          emoji: parts[0].trim(),
          label: parts[1].trim(),
          value: parts[2].trim()
        };
      }
      return null;
    }).filter(Boolean);
    
    return actions;
  } catch (error) {
    console.error('Error parsing quick actions:', error);
    return [];
  }
}

function removeQuickActionsFromResponse(response: string): string {
  return response.replace(/QUICK_ACTIONS:.+(?:\n|$)/g, '').trim();
}

function buildContextFromState(state: SessionState): string {
  let context = '\n\n## STATO CONVERSAZIONE CORRENTE:\n';
  context += `Step: ${state.step}\n`;
  
  if (state.service) context += `Servizio scelto: ${state.service}\n`;
  if (state.destination) context += `Destinazione: ${state.destination}\n`;
  if (state.date) context += `Data: ${state.date}\n`;
  if (state.people) context += `Persone: ${state.people}\n`;
  if (state.time) context += `Orario: ${state.time}\n`;
  if (state.skipper !== undefined) context += `Skipper: ${state.skipper ? 'Con skipper' : 'Senza skipper'}\n`;
  if (state.nome) context += `Nome: ${state.nome}\n`;
  if (state.email) context += `Email: ${state.email}\n`;
  if (state.telefono) context += `Telefono: ${state.telefono}\n`;
  
  context += '\nGuida l\'utente al prossimo step del funnel.\n';
  
  return context;
}

// ============================================
// MAIN API ROUTE - POST
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversationHistory = [], userInfo = null } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Missing message' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Extract or initialize session state
    let sessionState: SessionState = {
      step: 0
    };

    // Try to extract state from last assistant message
    if (conversationHistory.length > 0) {
      const lastMessage = conversationHistory[conversationHistory.length - 1];
      if (lastMessage.metadata?.state) {
        sessionState = lastMessage.metadata.state;
      }
    }

    // Build context with current state
    const stateContext = buildContextFromState(sessionState);

    // Build messages for Claude
    const messages = [
      ...conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ];

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT + stateContext,
      messages
    });

    // Extract response
    let botResponse = response.content[0].type === 'text' 
      ? response.content[0].text 
      : '';

    // Parse quick actions
    const quickActions = parseQuickActions(botResponse);
    botResponse = removeQuickActionsFromResponse(botResponse);

    // Update session state based on response
    sessionState.step += 1;

    // Detect what info was collected
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('tour') && !sessionState.service) {
      sessionState.service = 'tour';
    } else if (lowerMsg.includes('noleggio') && !sessionState.service) {
      sessionState.service = 'noleggio';
    }
    
    if (lowerMsg.includes('capri') && !sessionState.destination) {
      sessionState.destination = 'Capri';
    } else if (lowerMsg.includes('amalfi') && !sessionState.destination) {
      sessionState.destination = 'Amalfi';
    }
    
    // Extract numbers for people
    const peopleMatch = message.match(/(\d+)\s*persone?/i);
    if (peopleMatch && !sessionState.people) {
      sessionState.people = parseInt(peopleMatch[1]);
    }

    // Build updated conversation history
    const updatedHistory = [
      ...conversationHistory,
      {
        role: 'user',
        content: message
      },
      {
        role: 'assistant',
        content: botResponse,
        metadata: {
          quickActions,
          state: sessionState
        }
      }
    ];

    // Return response with CORS headers
    return NextResponse.json({
      message: botResponse,
      quickActions,
      conversationHistory: updatedHistory
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('Chat API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message 
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// ============================================
// HEALTH CHECK - GET
// ============================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Blu Alliance Chatbot API v3.0 - Conversational Funnel',
    timestamp: new Date().toISOString()
  }, { headers: corsHeaders });
}