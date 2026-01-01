/**
 * BLU ALLIANCE CHATBOT API V4.0
 * File: app/api/chatbot/query/route.ts
 * 
 * Features V4:
 * - Conversational funnel step-by-step
 * - Resend email integration
 * - Supabase lead + conversation tracking
 * - Email notifica admin + preventivo cliente
 * - CORS configurato
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

// ============================================
// CLIENTS INITIALIZATION
// ============================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// CORS CONFIGURATION
// ============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders });
}

// ============================================
// PRICING CONFIGURATION
// ============================================

const PRICING = {
  'tour_capri': { simple: '500-600', premium: '800-1000', luxury: '1200-1500' },
  'tour_amalfi': { simple: '400-600', premium: '700-1000', luxury: '1100-1400' },
  'tour_cilento': { simple: '350-500', premium: '600-900', luxury: '1000-1300' },
  'noleggio': { simple: '300-500', premium: '600-900', luxury: '1000-1500' },
  'taxi_mare': { simple: '150-300', premium: '250-400', luxury: '400-600' },
};

// ============================================
// SYSTEM PROMPT V4
// ============================================

const SYSTEM_PROMPT = `
Sei l'assistente virtuale di Blu Alliance, consorzio di turismo nautico al Porto di Salerno.

## OBIETTIVO
Guidare l'utente step-by-step verso una prenotazione, facendo UNA domanda alla volta.

## FLOW CONVERSAZIONALE

**STEP 0: BENVENUTO**
"Ciao! 👋 Cosa ti interessa oggi?"
QUICK_ACTIONS: 🏖️|Tour|tour;⛵|Noleggio|noleggio;🚤|Taxi Mare|taxi;💬|Info|info

**STEP 1: DESTINAZIONE (se Tour)**
"Ottimo! Quale destinazione?"
QUICK_ACTIONS: 🏝️|Capri|capri;🌅|Amalfi|amalfi;🍋|Cilento|cilento;🌊|Personalizzato|personalizzato

**STEP 2: DATA**
"[Destinazione]! Quando vorresti partire?"
QUICK_ACTIONS: 📅|Oggi|oggi;📅|Domani|domani;📅|Weekend|weekend;📅|Altra data|altra data

**STEP 3: PERSONE**
"Perfetto! Quante persone sarete?"
QUICK_ACTIONS: 2 persone|2;4 persone|4;6 persone|6;8+ persone|8

**STEP 4: ORARIO**
"Ottimo! Che orario preferite?"
QUICK_ACTIONS: 🌅|Mattina 9:00|mattina;☀️|Pomeriggio 14:00|pomeriggio;🌇|Tramonto 17:00|tramonto;⏰|Altro orario|altro

**STEP 5: RIEPILOGO**
"✅ Ecco il riepilogo:

📋 [SERVIZIO MAIUSCOLO]
📅 Data: [data]
👥 Persone: [N]
⏰ Orario: [orario]

Vuoi ricevere il preventivo via email?"
QUICK_ACTIONS: ✅|Sì, inviami preventivo|si_preventivo;💬|Ho domande|domande

**STEP 6: RACCOLTA DATI**
Se sceglie "Sì preventivo":
"Perfetto! Lasciami i tuoi dati per inviarti il preventivo:"

Poi chiedi UNA alla volta:
1. "Il tuo nome?"
2. "La tua email?"
3. "Il tuo telefono?"

**STEP 7: CONFERMA**
"✅ Perfetto! Ti ho inviato il preventivo a [email]!

Controlla la tua inbox (e spam se non lo trovi).

Il preventivo include 3 opzioni:
• Simple
• Premium  
• Luxury

Clicca sul pulsante per prenotare direttamente!"
QUICK_ACTIONS: 📋|Cosa portare|cosa_portare;🌊|Info meteo|meteo;💳|Come si paga|pagamento;👋|Grazie|chiudi

## REGOLE
- UNA domanda alla volta
- SEMPRE quick actions (formato: emoji|label|value separati da ;)
- Quando chiedi dati, NON mostrare quick actions
- Conferma scelta prima di prossima domanda
- Quando hai NOME + EMAIL + TELEFONO completi, restituisci TRIGGER_EMAIL nel messaggio

## TRIGGER EMAIL
Quando l'utente ha fornito nome, email E telefono, includi nel tuo messaggio:
TRIGGER_EMAIL:nome=[nome];email=[email];telefono=[telefono]

Questo trigger serve al sistema per inviare le email automaticamente.
`;

// ============================================
// INTERFACES
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

interface EmailTrigger {
  nome: string;
  email: string;
  telefono: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function parseQuickActions(response: string): any[] {
  const match = response.match(/QUICK_ACTIONS:\s*(.+?)(?:\n|$)/);
  if (!match) return [];

  try {
    const actionsStr = match[1].trim();
    const actions = actionsStr.split(';').map(action => {
      const parts = action.split('|');
      if (parts.length === 2) {
        return { emoji: '', label: parts[0].trim(), value: parts[1].trim() };
      } else if (parts.length === 3) {
        return { emoji: parts[0].trim(), label: parts[1].trim(), value: parts[2].trim() };
      }
      return null;
    }).filter(Boolean);
    return actions;
  } catch (error) {
    console.error('Error parsing quick actions:', error);
    return [];
  }
}

function parseEmailTrigger(response: string): EmailTrigger | null {
  const match = response.match(/TRIGGER_EMAIL:(.+?)(?:\n|$)/);
  if (!match) return null;

  try {
    const parts = match[1].split(';');
    const data: any = {};
    parts.forEach(part => {
      const [key, value] = part.split('=');
      data[key.trim()] = value.trim();
    });
    
    if (data.nome && data.email && data.telefono) {
      return { nome: data.nome, email: data.email, telefono: data.telefono };
    }
  } catch (error) {
    console.error('Error parsing email trigger:', error);
  }
  return null;
}

function removeMetadataFromResponse(response: string): string {
  return response
    .replace(/QUICK_ACTIONS:.+(?:\n|$)/g, '')
    .replace(/TRIGGER_EMAIL:.+(?:\n|$)/g, '')
    .trim();
}

function buildContextFromState(state: SessionState): string {
  let context = '\n\n## STATO CONVERSAZIONE CORRENTE:\n';
  context += `Step: ${state.step}\n`;
  
  if (state.service) context += `Servizio: ${state.service}\n`;
  if (state.destination) context += `Destinazione: ${state.destination}\n`;
  if (state.date) context += `Data: ${state.date}\n`;
  if (state.people) context += `Persone: ${state.people}\n`;
  if (state.time) context += `Orario: ${state.time}\n`;
  if (state.nome) context += `Nome: ${state.nome}\n`;
  if (state.email) context += `Email: ${state.email}\n`;
  if (state.telefono) context += `Telefono: ${state.telefono}\n`;
  
  context += '\nGuida l\'utente al prossimo step.\n';
  return context;
}

function getPricing(service: string, destination?: string) {
  const key = destination ? `tour_${destination.toLowerCase()}` : service.toLowerCase();
  return PRICING[key as keyof typeof PRICING] || PRICING['noleggio'];
}

// ============================================
// EMAIL FUNCTIONS
// ============================================

async function sendAdminNotification(leadData: any) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Blu Alliance Chatbot <noreply@blualliancegroup.com>',
      to: 'info@blualliancegroup.com',
      replyTo: leadData.email,
      subject: `🚤 Nuova richiesta preventivo - ${leadData.servizio}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb; border-radius: 8px;">
            <h2 style="color: #667eea; margin-top: 0;">🚤 Nuova richiesta preventivo</h2>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">👤 Dati cliente</h3>
              <p><strong>Nome:</strong> ${leadData.nome}</p>
              <p><strong>Email:</strong> <a href="mailto:${leadData.email}">${leadData.email}</a></p>
              <p><strong>Telefono:</strong> <a href="tel:${leadData.telefono}">${leadData.telefono}</a></p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">📋 Dettagli richiesta</h3>
              <p><strong>Servizio:</strong> ${leadData.servizio}</p>
              ${leadData.destinazione ? `<p><strong>Destinazione:</strong> ${leadData.destinazione}</p>` : ''}
              ${leadData.data ? `<p><strong>Data:</strong> ${leadData.data}</p>` : ''}
              ${leadData.persone ? `<p><strong>Persone:</strong> ${leadData.persone}</p>` : ''}
              ${leadData.orario ? `<p><strong>Orario:</strong> ${leadData.orario}</p>` : ''}
            </div>
            
            <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea;">
              <p style="margin: 0;"><strong>✅ Preventivo già inviato al cliente</strong></p>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">
                Il cliente ha ricevuto email con le 3 opzioni (Simple, Premium, Luxury) e link diretti per prenotare.
              </p>
            </div>
            
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
              Lead generato dal chatbot AI - ${new Date().toLocaleString('it-IT')}
            </p>
          </div>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('Error sending admin notification:', error);
      return null;
    }

    return data?.id;
  } catch (error) {
    console.error('Error in sendAdminNotification:', error);
    return null;
  }
}

async function sendClientQuote(leadData: any, leadId: string) {
  try {
    const pricing = getPricing(leadData.servizio, leadData.destinazione);
    
    // Load HTML template (in production, read from file or use inline)
    const htmlTemplate = `
      <!-- Email template qui - usa quello che ho creato sopra -->
      <!-- Per brevità, uso versione semplificata -->
    `;

    const { data, error } = await resend.emails.send({
      from: 'Blu Alliance <noreply@blualliancegroup.com>',
      to: leadData.email,
      replyTo: 'info@blualliancegroup.com',
      subject: `🏝️ Il tuo preventivo ${leadData.destinazione || leadData.servizio} è pronto!`,
      html: `
        <!DOCTYPE html>
        <html lang="it">
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background: #f3f4f6;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background: #f3f4f6; padding: 40px 20px;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 16px; overflow: hidden;">
                
                <!-- Header -->
                <tr><td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 28px;">Il tuo preventivo è pronto!</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Grazie per aver scelto Blu Alliance</p>
                </td></tr>
                
                <!-- Saluto -->
                <tr><td style="padding: 30px;">
                  <p style="font-size: 16px; margin: 0;">Ciao <strong>${leadData.nome}</strong>! 👋</p>
                  <p style="color: #666; margin: 15px 0 0;">Ecco il preventivo per la tua esperienza in barca.</p>
                </td></tr>
                
                <!-- Dettagli -->
                <tr><td style="padding: 0 30px 30px;">
                  <div style="background: #f9fafb; padding: 20px; border-radius: 12px; border-left: 4px solid #667eea;">
                    <h3 style="margin: 0 0 15px;">📋 Dettagli richiesta</h3>
                    <p style="margin: 5px 0;"><strong>Servizio:</strong> ${leadData.servizio}</p>
                    ${leadData.destinazione ? `<p style="margin: 5px 0;"><strong>Destinazione:</strong> ${leadData.destinazione}</p>` : ''}
                    ${leadData.data ? `<p style="margin: 5px 0;"><strong>Data:</strong> ${leadData.data}</p>` : ''}
                    ${leadData.persone ? `<p style="margin: 5px 0;"><strong>Persone:</strong> ${leadData.persone}</p>` : ''}
                  </div>
                </td></tr>
                
                <!-- Opzioni -->
                <tr><td style="padding: 0 30px;">
                  <h3 style="margin: 0 0 20px;">💰 Le tue opzioni</h3>
                </td></tr>
                
                <!-- Simple -->
                <tr><td style="padding: 0 30px 15px;">
                  <div style="border: 2px solid #e5e7eb; padding: 20px; border-radius: 12px;">
                    <h4 style="margin: 0;">SIMPLE</h4>
                    <p style="color: #666; margin: 5px 0;">Gozzo tradizionale confortevole</p>
                    <p style="color: #667eea; font-size: 24px; font-weight: bold; margin: 10px 0;">€${pricing.simple}</p>
                    <a href="https://blualliancegroup.com/prenota?lead=${leadId}&option=simple" style="display: block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 15px;">Prenota Simple</a>
                  </div>
                </td></tr>
                
                <!-- Premium -->
                <tr><td style="padding: 0 30px 15px;">
                  <div style="background: #f0f9ff; border: 2px solid #667eea; padding: 20px; border-radius: 12px; position: relative;">
                    <div style="position: absolute; top: 10px; right: 10px; background: #667eea; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">POPOLARE</div>
                    <h4 style="margin: 0;">PREMIUM</h4>
                    <p style="color: #666; margin: 5px 0;">Barca a motore moderna</p>
                    <p style="color: #667eea; font-size: 24px; font-weight: bold; margin: 10px 0;">€${pricing.premium}</p>
                    <a href="https://blualliancegroup.com/prenota?lead=${leadId}&option=premium" style="display: block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 15px;">Prenota Premium</a>
                  </div>
                </td></tr>
                
                <!-- Luxury -->
                <tr><td style="padding: 0 30px 30px;">
                  <div style="background: #fef3c7; border: 2px solid #f59e0b; padding: 20px; border-radius: 12px;">
                    <h4 style="margin: 0;">LUXURY ⭐</h4>
                    <p style="color: #666; margin: 5px 0;">Yacht di lusso con servizi esclusivi</p>
                    <p style="color: #f59e0b; font-size: 24px; font-weight: bold; margin: 10px 0;">€${pricing.luxury}</p>
                    <a href="https://blualliancegroup.com/prenota?lead=${leadId}&option=luxury" style="display: block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 15px;">Prenota Luxury</a>
                  </div>
                </td></tr>
                
                <!-- Incluso -->
                <tr><td style="padding: 0 30px 30px;">
                  <div style="background: #f0fdf4; padding: 20px; border-radius: 12px; border-left: 4px solid #22c55e;">
                    <p style="font-weight: 600; margin: 0 0 10px;">✅ Cosa è incluso:</p>
                    <ul style="margin: 0; padding-left: 20px;">
                      <li>Skipper professionista</li>
                      <li>Carburante</li>
                      <li>Assicurazione</li>
                      <li>Soft drinks e snack</li>
                      <li>Attrezzatura snorkeling</li>
                    </ul>
                  </div>
                </td></tr>
                
                <!-- CTA -->
                <tr><td style="padding: 0 30px 30px; text-align: center;">
                  <p style="color: #666; margin: 0 0 20px;">Hai domande? Siamo qui per aiutarti!</p>
                  <a href="mailto:info@blualliancegroup.com" style="display: inline-block; background: #f3f4f6; color: #333; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 0 5px;">📧 Scrivici</a>
                  <a href="tel:+393792342138" style="display: inline-block; background: #f3f4f6; color: #333; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 0 5px;">📱 Chiamaci</a>
                </td></tr>
                
                <!-- Footer -->
                <tr><td style="background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="color: #999; font-size: 13px; margin: 0;">Blu Alliance - Porto di Salerno</p>
                  <p style="color: #999; font-size: 12px; margin: 10px 0 0;">Preventivo valido 7 giorni</p>
                </td></tr>
                
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('Error sending client quote:', error);
      return null;
    }

    return data?.id;
  } catch (error) {
    console.error('Error in sendClientQuote:', error);
    return null;
  }
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

    // Extract session state
    let sessionState: SessionState = { step: 0 };
    if (conversationHistory.length > 0) {
      const lastMessage = conversationHistory[conversationHistory.length - 1];
      if (lastMessage.metadata?.state) {
        sessionState = lastMessage.metadata.state;
      }
    }

    // Build context
    const stateContext = buildContextFromState(sessionState);

    // Build messages for Claude
    const messages = [
      ...conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT + stateContext,
      messages
    });

    let botResponse = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse metadata
    const quickActions = parseQuickActions(botResponse);
    const emailTrigger = parseEmailTrigger(botResponse);
    botResponse = removeMetadataFromResponse(botResponse);

    // Update session state
    sessionState.step += 1;
    const lowerMsg = message.toLowerCase();
    
    // Detect service
    if (lowerMsg.includes('tour') && !sessionState.service) sessionState.service = 'tour';
    else if (lowerMsg.includes('noleggio') && !sessionState.service) sessionState.service = 'noleggio';
    else if (lowerMsg.includes('taxi')) sessionState.service = 'taxi';
    
    // Detect destination
    if (lowerMsg.includes('capri')) sessionState.destination = 'Capri';
    else if (lowerMsg.includes('amalfi')) sessionState.destination = 'Amalfi';
    else if (lowerMsg.includes('cilento')) sessionState.destination = 'Cilento';
    
    // Detect people
    const peopleMatch = message.match(/(\d+)/);
    if (peopleMatch && !sessionState.people) sessionState.people = parseInt(peopleMatch[1]);

    // Handle email trigger
    let leadId = null;
    if (emailTrigger) {
      // Save to Supabase
      const { data: lead, error: leadError } = await supabase
        .from('chatbot_leads')
        .insert({
          nome: emailTrigger.nome,
          email: emailTrigger.email,
          telefono: emailTrigger.telefono,
          servizio: sessionState.service,
          destinazione: sessionState.destination,
          data: sessionState.date,
          persone: sessionState.people,
          orario: sessionState.time,
          stato: 'nuovo',
          preventivo_inviato: true,
          preventivo_inviato_at: new Date().toISOString()
        })
        .select()
        .single();

      if (!leadError && lead) {
        leadId = lead.id;

        // Save conversation
        await supabase.from('chatbot_conversations').insert({
          lead_id: leadId,
          session_id: `session-${Date.now()}`,
          messages: conversationHistory,
          user_info: emailTrigger
        });

        // Send emails in parallel
        const [adminEmailId, clientEmailId] = await Promise.all([
          sendAdminNotification({
            nome: emailTrigger.nome,
            email: emailTrigger.email,
            telefono: emailTrigger.telefono,
            servizio: sessionState.service,
            destinazione: sessionState.destination,
            data: sessionState.date,
            persone: sessionState.people,
            orario: sessionState.time
          }),
          sendClientQuote({
            nome: emailTrigger.nome,
            email: emailTrigger.email,
            servizio: sessionState.service,
            destinazione: sessionState.destination,
            data: sessionState.date,
            persone: sessionState.people
          }, leadId)
        ]);

        // Log emails
        if (adminEmailId) {
          await supabase.from('chatbot_email_log').insert({
            lead_id: leadId,
            tipo: 'notifica_admin',
            destinatario: 'info@blualliancegroup.com',
            oggetto: `Nuova richiesta preventivo - ${sessionState.service}`,
            resend_id: adminEmailId,
            stato: 'inviata'
          });
        }

        if (clientEmailId) {
          await supabase.from('chatbot_email_log').insert({
            lead_id: leadId,
            tipo: 'preventivo_cliente',
            destinatario: emailTrigger.email,
            oggetto: 'Il tuo preventivo è pronto',
            resend_id: clientEmailId,
            stato: 'inviata'
          });
        }
      }
    }

    // Build response
    const updatedHistory = [
      ...conversationHistory,
      { role: 'user', content: message },
      {
        role: 'assistant',
        content: botResponse,
        metadata: { quickActions, state: sessionState, leadId }
      }
    ];

    return NextResponse.json({
      message: botResponse,
      quickActions,
      conversationHistory: updatedHistory,
      leadId
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
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
    service: 'Blu Alliance Chatbot API v4.0 - Email + Lead Tracking',
    timestamp: new Date().toISOString()
  }, { headers: corsHeaders });
}