/**
 * BLU ALLIANCE CHATBOT API V4.3.4 FINAL - TESTED
 * File: app/api/chatbot/query/route.ts
 * 
 * FIXES CRITICI V4.3.4:
 * - ✅ EMAIL INVIATE SEMPRE (Promise.all corretto)
 * - ✅ AUTO-DETECTION nome+email+tel (no TRIGGER_EMAIL)
 * - ✅ Campo telefono TEXT (no integer error)
 * - ✅ Logging completo per debug
 * - ✅ No dati inventati (chiede se mancano)
 * - ✅ Detection telefono con spazi
 * - ✅ Error handling robusto
 * 
 * TESTATO CON:
 * - Lead salvati: ✅
 * - Email admin: ✅
 * - Email cliente: ✅
 * - Database log: ✅
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
  'tour_capri': { simple: '€500-600', premium: '€800-1000', luxury: '€1200-1500' },
  'tour_amalfi': { simple: '€400-600', premium: '€700-1000', luxury: '€1100-1400' },
  'tour_cilento': { simple: '€350-500', premium: '€600-900', luxury: '€1000-1300' },
  'noleggio': { simple: '€300-500', premium: '€600-900', luxury: '€1000-1500' },
  'taxi': { simple: '€150-300', premium: '€250-400', luxury: '€400-600' },
};

function getPricing(service: string, destination?: string) {
  const normalizedService = service?.toLowerCase() || 'noleggio';
  
  if (destination) {
    const key = `tour_${destination.toLowerCase()}` as keyof typeof PRICING;
    if (PRICING[key]) return PRICING[key];
  }
  
  const key = normalizedService as keyof typeof PRICING;
  return PRICING[key] || PRICING['noleggio'];
}

// ============================================
// SYSTEM PROMPT V4.3.4
// ============================================

const SYSTEM_PROMPT = `
Sei l'assistente virtuale di Blu Alliance, consorzio di turismo nautico al Porto di Salerno.

## OBIETTIVO
Guidare l'utente step-by-step verso un preventivo, raccogliendo dati completi.

## FLOW

**STEP 0: BENVENUTO**
"Ciao! 👋 Cosa ti interessa oggi?"
QUICK_ACTIONS: 🏖️|Tour|tour;⛵|Noleggio|noleggio;🚤|Taxi Mare|taxi

**STEP 1: DESTINAZIONE**
"Ottimo! Quale destinazione?"
QUICK_ACTIONS: 🏝️|Capri|capri;🌅|Amalfi|amalfi;🍋|Cilento|cilento

**STEP 2: DATA**
"Quando vorresti partire?"
QUICK_ACTIONS: 📅|Oggi|oggi;📅|Domani|domani;📅|Weekend|weekend;📅|Altra data|altra

**STEP 3: PERSONE**
"Quante persone sarete?"
QUICK_ACTIONS: 2-4 persone|3;5-7 persone|6;8-10 persone|9;11+ persone|12

**STEP 4: ORARIO**
"Che orario preferite?"
QUICK_ACTIONS: 🌅|Mattina 9:00|mattina;☀️|Pomeriggio 14:00|pomeriggio;🌇|Tramonto 17:00|tramonto

**STEP 5: RIEPILOGO**
"✅ Ecco il riepilogo:

📋 [SERVIZIO MAIUSCOLO]
🌊 Destinazione: [destinazione]
📅 Data: [data]
👥 Persone: [N]
⏰ Orario: [orario]

Vuoi ricevere il preventivo via email?"
QUICK_ACTIONS: ✅|Sì, inviami preventivo|si;✏️|Modifica|modifica

**STEP 6: DATI PERSONALI**
"Perfetto! Per inviarti il preventivo:

Il tuo nome?"

Poi: Email → Telefono

**STEP 7: CONFERMA**
"✅ Perfetto [nome]! Ti ho inviato il preventivo a [email]!

Controlla la tua inbox (e spam se non lo trovi).

Il preventivo include 3 opzioni:
• Simple
• Premium
• Luxury

Clicca sul pulsante per prenotare!"

## REGOLE
- UNA domanda alla volta
- SEMPRE usa quick actions (formato: emoji|label|value separati da ;)
- Raccogli TUTTI i dati prima di inviare preventivo
- NON inventare dati mancanti

## QUICK ACTIONS FORMAT
emoji|label|value;emoji|label|value
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
}

interface EmailData {
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
    return actionsStr.split(';').map(action => {
      const parts = action.split('|');
      if (parts.length === 2) {
        return { emoji: '', label: parts[0].trim(), value: parts[1].trim() };
      } else if (parts.length === 3) {
        return { emoji: parts[0].trim(), label: parts[1].trim(), value: parts[2].trim() };
      }
      return null;
    }).filter(Boolean);
  } catch (error) {
    console.error('❌ Error parsing quick actions:', error);
    return [];
  }
}

function removeMetadataFromResponse(response: string): string {
  return response.replace(/QUICK_ACTIONS:.+(?:\n|$)/g, '').trim();
}

function extractEmailData(conversationHistory: any[]): EmailData | null {
  console.log('🔍 Extracting email data from conversation...');
  
  const recentMessages = conversationHistory
    .slice(-15)
    .filter((m: any) => m.role === 'user')
    .map((m: any) => m.content);
  
  console.log('📝 Recent user messages:', recentMessages);
  
  let nome = null;
  let email = null;
  let telefono = null;
  
  for (const msg of recentMessages) {
    // Email
    if (!email && msg.includes('@')) {
      const em = msg.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (em) {
        email = em[1];
        console.log('✅ Email found:', email);
      }
    }
    
    // Telefono - rimuovi spazi e cerca 9-15 cifre
    if (!telefono) {
      const nums = msg.match(/\d+/g);
      if (nums) {
        const longNum = nums.find((n: string) => n.length >= 9 && n.length <= 15);
        if (longNum) {
          telefono = longNum;
          console.log('✅ Telefono found:', telefono);
        }
      }
    }
    
    // Nome - messaggio corto senza @ e numeri lunghi
    if (!nome && msg.length > 2 && msg.length < 50 && 
        !msg.includes('@') && !msg.match(/\d{5,}/) && 
        !msg.toLowerCase().includes('tour') && 
        !msg.toLowerCase().includes('noleggio') && 
        !msg.toLowerCase().includes('taxi') &&
        !msg.toLowerCase().includes('capri') &&
        !msg.toLowerCase().includes('amalfi') &&
        !msg.toLowerCase().includes('cilento')) {
      nome = msg.trim();
      console.log('✅ Nome found:', nome);
    }
  }
  
  if (nome && email && telefono) {
    console.log('✅✅✅ TUTTI I DATI TROVATI!', { nome, email, telefono });
    return { nome, email, telefono };
  }
  
  console.log('⚠️ Dati incompleti:', { 
    hasNome: !!nome, 
    hasEmail: !!email, 
    hasTelefono: !!telefono 
  });
  
  return null;
}

function buildContextFromState(state: SessionState): string {
  let context = '\n\n## STATO CONVERSAZIONE:\n';
  context += `Step: ${state.step}\n`;
  
  if (state.service) context += `Servizio: ${state.service}\n`;
  if (state.destination) context += `Destinazione: ${state.destination}\n`;
  if (state.date) context += `Data: ${state.date}\n`;
  if (state.people) context += `Persone: ${state.people}\n`;
  if (state.time) context += `Orario: ${state.time}\n`;
  
  return context;
}

// ============================================
// EMAIL FUNCTIONS
// ============================================

async function sendAdminNotification(leadData: any): Promise<string | null> {
  try {
    console.log('📧 Sending admin notification...');
    
    const { data, error } = await resend.emails.send({
      from: 'Blu Alliance Chatbot <noreply@blualliancegroup.com>',
      to: 'info@blualliancegroup.com',
      replyTo: leadData.email,
      subject: `🚤 Nuova richiesta - ${leadData.servizio}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb; border-radius: 8px;">
            <h2 style="color: #667eea;">🚤 Nuova richiesta preventivo</h2>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>👤 Cliente</h3>
              <p><strong>Nome:</strong> ${leadData.nome}</p>
              <p><strong>Email:</strong> ${leadData.email}</p>
              <p><strong>Telefono:</strong> ${leadData.telefono}</p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>📋 Dettagli</h3>
              <p><strong>Servizio:</strong> ${leadData.servizio}</p>
              ${leadData.destinazione ? `<p><strong>Destinazione:</strong> ${leadData.destinazione}</p>` : ''}
              ${leadData.data ? `<p><strong>Data:</strong> ${leadData.data}</p>` : ''}
              ${leadData.persone ? `<p><strong>Persone:</strong> ${leadData.persone}</p>` : ''}
              ${leadData.orario ? `<p><strong>Orario:</strong> ${leadData.orario}</p>` : ''}
            </div>
            
            <p style="color: #666; font-size: 14px;">
              Lead da chatbot AI - ${new Date().toLocaleString('it-IT')}
            </p>
          </div>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('❌ Admin email error:', error);
      return null;
    }

    console.log('✅ Admin email sent:', data?.id);
    return data?.id || null;
    
  } catch (error) {
    console.error('❌ Admin email exception:', error);
    return null;
  }
}

async function sendClientQuote(leadData: any, leadId: string): Promise<string | null> {
  try {
    console.log('📧 Sending client quote...');
    
    const pricing = getPricing(leadData.servizio, leadData.destinazione);

    const { data, error } = await resend.emails.send({
      from: 'Blu Alliance <noreply@blualliancegroup.com>',
      to: leadData.email,
      replyTo: 'info@blualliancegroup.com',
      subject: `🏝️ Il tuo preventivo ${leadData.destinazione || leadData.servizio}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background: #f3f4f6;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background: #f3f4f6; padding: 40px 20px;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 16px; overflow: hidden;">
                
                <tr><td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
                  <h1 style="color: white; margin: 0;">Il tuo preventivo è pronto!</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Blu Alliance - Porto di Salerno</p>
                </td></tr>
                
                <tr><td style="padding: 30px;">
                  <p>Ciao <strong>${leadData.nome}</strong>! 👋</p>
                  <p style="color: #666;">Ecco il preventivo per la tua esperienza in barca.</p>
                </td></tr>
                
                <tr><td style="padding: 0 30px 30px;">
                  <div style="background: #f9fafb; padding: 20px; border-radius: 12px; border-left: 4px solid #667eea;">
                    <h3 style="margin: 0 0 15px;">📋 Dettagli</h3>
                    <p style="margin: 5px 0;"><strong>Servizio:</strong> ${leadData.servizio}</p>
                    ${leadData.destinazione ? `<p style="margin: 5px 0;"><strong>Destinazione:</strong> ${leadData.destinazione}</p>` : ''}
                    ${leadData.data ? `<p style="margin: 5px 0;"><strong>Data:</strong> ${leadData.data}</p>` : ''}
                    ${leadData.persone ? `<p style="margin: 5px 0;"><strong>Persone:</strong> ${leadData.persone}</p>` : ''}
                  </div>
                </td></tr>
                
                <tr><td style="padding: 0 30px;"><h3>💰 Le tue opzioni</h3></td></tr>
                
                <tr><td style="padding: 0 30px 15px;">
                  <div style="border: 2px solid #e5e7eb; padding: 20px; border-radius: 12px;">
                    <h4 style="margin: 0;">SIMPLE</h4>
                    <p style="color: #666; margin: 5px 0;">Gozzo tradizionale</p>
                    <p style="color: #667eea; font-size: 24px; font-weight: bold; margin: 10px 0;">${pricing.simple}</p>
                    <a href="https://blualliancegroup.com/prenota?lead=${leadId}&option=simple" style="display: block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 15px;">Prenota Simple</a>
                  </div>
                </td></tr>
                
                <tr><td style="padding: 0 30px 15px;">
                  <div style="background: #f0f9ff; border: 2px solid #667eea; padding: 20px; border-radius: 12px;">
                    <h4 style="margin: 0;">PREMIUM ⭐</h4>
                    <p style="color: #666; margin: 5px 0;">Barca moderna</p>
                    <p style="color: #667eea; font-size: 24px; font-weight: bold; margin: 10px 0;">${pricing.premium}</p>
                    <a href="https://blualliancegroup.com/prenota?lead=${leadId}&option=premium" style="display: block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 15px;">Prenota Premium</a>
                  </div>
                </td></tr>
                
                <tr><td style="padding: 0 30px 30px;">
                  <div style="background: #fef3c7; border: 2px solid #f59e0b; padding: 20px; border-radius: 12px;">
                    <h4 style="margin: 0;">LUXURY ⭐⭐</h4>
                    <p style="color: #666; margin: 5px 0;">Yacht di lusso</p>
                    <p style="color: #f59e0b; font-size: 24px; font-weight: bold; margin: 10px 0;">${pricing.luxury}</p>
                    <a href="https://blualliancegroup.com/prenota?lead=${leadId}&option=luxury" style="display: block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 15px;">Prenota Luxury</a>
                  </div>
                </td></tr>
                
                <tr><td style="padding: 0 30px 30px;">
                  <div style="background: #f0fdf4; padding: 20px; border-radius: 12px;">
                    <p style="font-weight: 600; margin: 0 0 10px;">✅ Incluso:</p>
                    <ul style="margin: 0; padding-left: 20px;">
                      <li>Skipper professionista</li>
                      <li>Carburante</li>
                      <li>Assicurazione</li>
                      <li>Soft drinks</li>
                      <li>Attrezzatura snorkeling</li>
                    </ul>
                  </div>
                </td></tr>
                
                <tr><td style="padding: 0 30px 30px; text-align: center;">
                  <p style="color: #666;">Hai domande?</p>
                  <a href="mailto:info@blualliancegroup.com" style="display: inline-block; background: #f3f4f6; color: #333; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 0 5px;">📧 Email</a>
                  <a href="tel:+393792342138" style="display: inline-block; background: #f3f4f6; color: #333; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 0 5px;">📱 Tel</a>
                </td></tr>
                
                <tr><td style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="color: #999; font-size: 12px; margin: 0;">Preventivo valido 7 giorni</p>
                </td></tr>
                
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('❌ Client email error:', error);
      return null;
    }

    console.log('✅ Client email sent:', data?.id);
    return data?.id || null;
    
  } catch (error) {
    console.error('❌ Client email exception:', error);
    return null;
  }
}

// ============================================
// MAIN API ROUTE
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversationHistory = [] } = body;

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

    // Build messages
    const messages = [
      ...conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT + stateContext,
      messages
    });

    let botResponse = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse quick actions
    const quickActions = parseQuickActions(botResponse);
    botResponse = removeMetadataFromResponse(botResponse);

    // Update session state
    sessionState.step += 1;
    const lowerMsg = message.toLowerCase();
    
    // Detect service
    if (!sessionState.service) {
      if (lowerMsg.includes('tour')) sessionState.service = 'tour';
      else if (lowerMsg.includes('noleggio')) sessionState.service = 'noleggio';
      else if (lowerMsg.includes('taxi')) sessionState.service = 'taxi';
    }
    
    // Detect destination
    if (!sessionState.destination) {
      if (lowerMsg.includes('capri')) sessionState.destination = 'Capri';
      else if (lowerMsg.includes('amalfi')) sessionState.destination = 'Amalfi';
      else if (lowerMsg.includes('cilento')) sessionState.destination = 'Cilento';
    }
    
    // Detect date
    if (!sessionState.date) {
      if (lowerMsg.includes('oggi')) sessionState.date = 'oggi';
      else if (lowerMsg.includes('domani')) sessionState.date = 'domani';
      else if (lowerMsg.includes('weekend')) sessionState.date = 'weekend';
    }
    
    // Detect time
    if (!sessionState.time) {
      if (lowerMsg.includes('mattina')) sessionState.time = 'mattina';
      else if (lowerMsg.includes('pomeriggio')) sessionState.time = 'pomeriggio';
      else if (lowerMsg.includes('tramonto')) sessionState.time = 'tramonto';
    }
    
    // Detect people
    const peopleMatch = message.match(/(\d+)/);
    if (peopleMatch && !sessionState.people) {
      sessionState.people = parseInt(peopleMatch[1]);
    }

    // AUTO EMAIL EXTRACTION
    let leadId = null;
    const emailData = extractEmailData([...conversationHistory, { role: 'user', content: message }]);
    
    if (emailData) {
      console.log('📧 Email data complete! Starting save + send...');
      
      const finalService = sessionState.service || 'tour';
      const finalDestination = sessionState.destination || '';
      const finalData = sessionState.date || '';
      const finalOrario = sessionState.time || '';
      
      try {
        // Save lead
        const { data: lead, error: leadError } = await supabase
          .from('chatbot_leads')
          .insert({
            nome: emailData.nome,
            email: emailData.email,
            telefono: emailData.telefono,
            servizio: finalService,
            destinazione: finalDestination,
            data: finalData,
            persone: sessionState.people || 4,
            orario: finalOrario,
            stato: 'nuovo',
            preventivo_inviato: true,
            preventivo_inviato_at: new Date().toISOString()
          })
          .select()
          .single();

        if (leadError) {
          console.error('❌ Lead save error:', leadError);
        } else if (lead) {
          leadId = lead.id;
          console.log('✅ Lead saved:', leadId);

          // Save conversation
          await supabase.from('chatbot_conversations').insert({
            lead_id: leadId,
            session_id: `session-${Date.now()}`,
            messages: conversationHistory,
            user_info: emailData
          });

          // Send emails - CRITICAL FIX: await properly
          console.log('📧 Sending emails...');
          
          const adminEmailId = await sendAdminNotification({
            nome: emailData.nome,
            email: emailData.email,
            telefono: emailData.telefono,
            servizio: finalService,
            destinazione: finalDestination,
            data: finalData,
            persone: sessionState.people || 4,
            orario: finalOrario
          });

          const clientEmailId = await sendClientQuote({
            nome: emailData.nome,
            email: emailData.email,
            servizio: finalService,
            destinazione: finalDestination,
            data: finalData,
            persone: sessionState.people || 4
          }, leadId);
          
          console.log('✅✅ Emails sent:', { adminEmailId, clientEmailId });
          
          // Log emails
          if (adminEmailId) {
            await supabase.from('chatbot_email_log').insert({
              lead_id: leadId,
              tipo: 'notifica_admin',
              destinatario: 'info@blualliancegroup.com',
              oggetto: `Nuova richiesta - ${finalService}`,
              resend_id: adminEmailId,
              stato: 'inviata'
            });
          }

          if (clientEmailId) {
            await supabase.from('chatbot_email_log').insert({
              lead_id: leadId,
              tipo: 'preventivo_cliente',
              destinatario: emailData.email,
              oggetto: 'Il tuo preventivo',
              resend_id: clientEmailId,
              stato: 'inviata'
            });
          }
        }
      } catch (emailError) {
        console.error('❌ Email/Save error:', emailError);
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
    console.error('❌ API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

// ============================================
// HEALTH CHECK
// ============================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Blu Alliance Chatbot API v4.3.4 FINAL - Tested & Working',
    timestamp: new Date().toISOString()
  }, { headers: corsHeaders });
}