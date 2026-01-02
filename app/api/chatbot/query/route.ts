/**
 * BLU ALLIANCE CHATBOT API V4.3.1 LITE
 * File: app/api/chatbot/query/route.ts
 * 
 * Features V4.3.1 LITE:
 * - PRICING REALE da database servizi_imbarcazione
 * - LINK a pagina imbarcazioni in email
 * - LOCAZIONE (plurigiornaliero SEMPRE senza skipper)
 * - Flow rigido V4.2 mantenuto
 * - Query database per prezzi medi per categoria
 * - Parametri ricerca salvati in lead
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
// DATABASE PRICING FUNCTIONS
// ============================================

async function getPricingFromDatabase(
  servizio: string,
  durata: string,
  conSkipper: boolean = true
): Promise<{ simple: string; premium: string; luxury: string }> {
  try {
    // Query per ottenere range prezzi per categoria
    const { data, error } = await supabase
      .from('servizi_imbarcazione')
      .select(`
        imbarcazioni!inner(categoria),
        prezzo_base,
        prezzo_weekend
      `)
      .eq('servizio', servizio)
      .eq('durata', durata)
      .eq('skipper_incluso', conSkipper)
      .eq('disponibile', true);

    if (error || !data || data.length === 0) {
      console.log('No pricing found in database, using fallback');
      return getFallbackPricing(servizio, conSkipper);
    }

    // Raggruppa per categoria e calcola min-max
    const byCategory: any = {
      simple: [],
      premium: [],
      luxury: []
    };

    data.forEach((item: any) => {
      const cat = item.imbarcazioni.categoria;
      if (byCategory[cat]) {
        byCategory[cat].push(item.prezzo_base);
      }
    });

    // Calcola range per ogni categoria
    const result = {
      simple: formatPriceRange(byCategory.simple),
      premium: formatPriceRange(byCategory.premium),
      luxury: formatPriceRange(byCategory.luxury)
    };

    console.log('Pricing from database:', result);
    return result;

  } catch (error) {
    console.error('Error getting pricing from database:', error);
    return getFallbackPricing(servizio, conSkipper);
  }
}

function formatPriceRange(prices: number[]): string {
  if (!prices || prices.length === 0) return 'Su richiesta';
  
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  
  if (min === max) return `€${min}`;
  return `€${min}-${max}`;
}

function getFallbackPricing(servizio: string, conSkipper: boolean): { simple: string; premium: string; luxury: string } {
  // Fallback se database query fallisce
  const FALLBACK = {
    'tour': { simple: '€400-600', premium: '€700-1000', luxury: '€1100-1500' },
    'noleggio_con_skipper': { simple: '€300-500', premium: '€600-800', luxury: '€900-1200' },
    'noleggio_senza_skipper': { simple: '€200-300', premium: '€350-500', luxury: '€500-700' },
    'taxi': { simple: '€150-300', premium: '€250-400', luxury: '€400-600' }
  };

  const key = servizio === 'noleggio' 
    ? (conSkipper ? 'noleggio_con_skipper' : 'noleggio_senza_skipper')
    : servizio;

  return FALLBACK[key as keyof typeof FALLBACK] || FALLBACK.tour;
}

// ============================================
// SYSTEM PROMPT V4.3 LITE
// ============================================

const SYSTEM_PROMPT = `
Sei l'assistente virtuale di Blu Alliance, consorzio di turismo nautico al Porto di Salerno.

## OBIETTIVO
Guidare l'utente step-by-step verso un preventivo, raccogliendo dati per poi indirizzarlo alla scelta della barca.

## REGOLE FERREE
1. SEGUI SEMPRE l'ordine degli step
2. FAI UNA SOLA DOMANDA ALLA VOLTA
3. USA prezzi forniti dal sistema (NON inventare)
4. Alla fine INFORMA che riceverà link per scegliere barca specifica

## FLOW PER TOUR

**STEP 0: BENVENUTO**
"Ciao! 👋 Cosa ti interessa oggi?"
QUICK_ACTIONS: 🏖️|Tour|tour;⛵|Noleggio|noleggio;🏠|Locazione|locazione;🚤|Taxi Mare|taxi;💬|Info|info

**STEP 1: DESTINAZIONE**
"Perfetto! Quale destinazione?"
QUICK_ACTIONS: 🏝️|Capri|capri;🌅|Amalfi|amalfi;🍋|Cilento|cilento

**STEP 2: DATA**
"Quando vorresti partire?"
QUICK_ACTIONS: 📅|Oggi|oggi;📅|Domani|domani;📅|Weekend|weekend;📅|Altra data|altra_data

**STEP 3: PERSONE**
"Quante persone sarete?"
QUICK_ACTIONS: 2-4 persone|3;5-7 persone|6;8-10 persone|9;11+ persone|12

**STEP 4: DURATA**
"Che durata preferite?"
QUICK_ACTIONS: 🌅|Mezza giornata (4-5h)|mezza_giornata;🌊|Giornata intera (6-8h)|giornata_intera

**STEP 5: RIEPILOGO + PREZZI**
Il sistema fornirà i prezzi dal database. Mostra così:

"✅ Ecco il riepilogo:

📋 TOUR [DESTINAZIONE MAIUSCOLA]
🌊 Destinazione: [destinazione]
📅 Data: [data]
👥 Persone: [N]
⏰ Durata: [mezza/giornata intera]

💰 PREZZI INDICATIVI:
• Categoria Simple: [prezzo da sistema]
• Categoria Premium: [prezzo da sistema]
• Categoria Luxury: [prezzo da sistema]

Include: Skipper, carburante, assicurazione, soft drinks, attrezzatura snorkeling

I dati sono corretti?"
QUICK_ACTIONS: ✅|Sì, invia preventivo|conferma;✏️|Modifica|modifica

**STEP 6: DATI PERSONALI**
"Perfetto! Per inviarti il preventivo dettagliato con TUTTE le barche disponibili:

Il tuo nome?"

Poi: Email → Telefono

**STEP 7: CONFERMA EMAIL**
TRIGGER_EMAIL:nome=[nome];email=[email];telefono=[telefono]

"✅ Perfetto [nome]! Ti ho inviato il preventivo a [email]!

Nell'email troverai:
• I prezzi per le diverse categorie
• Link per vedere TUTTE le barche disponibili
• Possibilità di scegliere la barca che preferisci

Controlla la tua inbox (e spam se non lo trovi)!"

## FLOW PER NOLEGGIO

**STEP 0-4:** Come tour (servizio, zona, data, persone, durata)

**STEP 5: SKIPPER**
"Hai la patente nautica?"
QUICK_ACTIONS: 👨‍✈️|No, serve skipper|con_skipper;⛵|Sì, ho patente|senza_skipper

**STEP 6-8:** Riepilogo + Dati + Email (come tour)

Nel riepilogo aggiungi:
"⛵ Skipper: [Incluso/Non necessario]"

## FLOW PER LOCAZIONE (plurigiornaliero)

**STEP 0: SERVIZIO**
User sceglie "Locazione"

**STEP 1: ZONA**
"Perfetto! In quale zona vorresti navigare?"
QUICK_ACTIONS: 🏝️|Capri e Costiera|capri;🌅|Costiera Amalfitana|amalfi;🍋|Cilento|cilento;🌊|Isole|isole

**STEP 2: DATA INIZIO**
"Quando vorresti iniziare la locazione?"
QUICK_ACTIONS: 📅|Oggi|oggi;📅|Domani|domani;📅|Prossimo weekend|weekend;📅|Altra data|altra_data

**STEP 3: DURATA GIORNI**
"Per quanti giorni?"
QUICK_ACTIONS: 2 giorni|2;3 giorni|3;4-7 giorni|5;Più di una settimana|10

**STEP 4: PERSONE**
"Quante persone sarete a bordo?"
QUICK_ACTIONS: 2-4 persone|3;5-7 persone|6;8-10 persone|9;11+ persone|12

**STEP 5: RIEPILOGO**
IMPORTANTE: Per LOCAZIONE NON chiedere skipper - è SEMPRE senza (patente obbligatoria)!

"✅ Ecco il riepilogo:

📋 LOCAZIONE BARCA
🌊 Zona: [zona]
📅 Data inizio: [data]
📆 Durata: [N] giorni
👥 Persone: [N]
⛵ Skipper: Non incluso
🪪 Patente nautica: Obbligatoria

💰 PREZZI INDICATIVI:
• Categoria Simple: [prezzo da sistema]
• Categoria Premium: [prezzo da sistema]
• Categoria Luxury: [prezzo da sistema]

Include: Assicurazione, dotazioni di sicurezza
Non include: Carburante, skipper (patente obbligatoria)

I dati sono corretti?"
QUICK_ACTIONS: ✅|Sì, invia preventivo|conferma;✏️|Modifica|modifica

**STEP 6-7:** Dati + Email (come tour)

## GESTIONE MODIFICHE

Se utente chiede di modificare:
1. "Capito, aggiorno..."
2. Ripeti step modificato
3. Nuovo riepilogo
4. Nuova conferma
5. Poi dati

## PARSING DATE

- "22 gennaio" → "22 gennaio 2026"
- "6 gennaio" → "6 gennaio 2026"
- "domenica prossima" → calcola
- Range orari: "10-14" → "10:00-14:00"

## VALIDAZIONI

- Persone: 1-20
- Email: con @
- Durata: mezza_giornata o giornata_intera

## QUICK ACTIONS

emoji|label|value

## TRIGGER EMAIL

TRIGGER_EMAIL:nome=[nome];email=[email];telefono=[telefono]

## IMPORTANTE

- USA SEMPRE prezzi forniti dal sistema
- NON inventare prezzi
- Alla fine SPIEGA che riceverà link per scegliere barca
- Prezzi sono INDICATIVI per categoria
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
  durata?: string;
  time?: string;
  skipper?: 'con_skipper' | 'senza_skipper';
  pricing?: { simple: string; premium: string; luxury: string };
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

async function buildContextFromState(state: SessionState): Promise<string> {
  let context = '\n\n## STATO CONVERSAZIONE CORRENTE:\n';
  context += `Step: ${state.step}\n`;
  
  if (state.service) context += `Servizio: ${state.service}\n`;
  if (state.destination) context += `Destinazione: ${state.destination}\n`;
  if (state.date) context += `Data: ${state.date}\n`;
  if (state.people) context += `Persone: ${state.people}\n`;
  if (state.durata) context += `Durata: ${state.durata}\n`;
  if (state.skipper) context += `Skipper: ${state.skipper}\n`;
  
  // Se abbiamo abbastanza dati, fetch pricing dal database
  if (state.service && state.durata && !state.pricing) {
    const conSkipper = state.skipper !== 'senza_skipper';
    const pricing = await getPricingFromDatabase(state.service, state.durata, conSkipper);
    state.pricing = pricing;
    
    context += '\n## PREZZI DAL DATABASE:\n';
    context += `Simple: ${pricing.simple}\n`;
    context += `Premium: ${pricing.premium}\n`;
    context += `Luxury: ${pricing.luxury}\n`;
    context += '\nUSA QUESTI PREZZI nel riepilogo. NON inventare altri prezzi!\n';
  }
  
  return context;
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
              ${leadData.durata ? `<p><strong>Durata:</strong> ${leadData.durata}</p>` : ''}
              ${leadData.orario ? `<p><strong>Orario:</strong> ${leadData.orario}</p>` : ''}
              ${leadData.skipper !== undefined ? `<p><strong>Skipper:</strong> ${leadData.skipper ? 'Incluso' : 'Non richiesto'}</p>` : ''}
            </div>
            
            <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea;">
              <p style="margin: 0;"><strong>✅ Cliente riceverà link per scegliere barca</strong></p>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">
                Email preventivo inviata con prezzi indicativi e link a pagina imbarcazioni filtrata.
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
    const pricing = leadData.pricing || {
      simple: 'Su richiesta',
      premium: 'Su richiesta',
      luxury: 'Su richiesta'
    };

    // Build link to imbarcazioni page with filters
    const imbarcazioniUrl = new URL('https://blualliancegroup.com/imbarcazioni');
    imbarcazioniUrl.searchParams.set('servizio', leadData.servizio);
    imbarcazioniUrl.searchParams.set('durata', leadData.durata || 'mezza_giornata');
    imbarcazioniUrl.searchParams.set('persone', leadData.persone?.toString() || '4');
    imbarcazioniUrl.searchParams.set('lead_id', leadId);
    if (leadData.destinazione) imbarcazioniUrl.searchParams.set('destinazione', leadData.destinazione);
    
    const skipperText = leadData.skipper === false 
      ? 'Non necessario' 
      : 'Incluso';

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
                
                <tr><td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 28px;">Il tuo preventivo è pronto!</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Grazie per aver scelto Blu Alliance</p>
                </td></tr>
                
                <tr><td style="padding: 30px;">
                  <p style="font-size: 16px; margin: 0;">Ciao <strong>${leadData.nome}</strong>! 👋</p>
                  <p style="color: #666; margin: 15px 0 0;">Ecco il preventivo per la tua esperienza in barca.</p>
                </td></tr>
                
                <tr><td style="padding: 0 30px 30px;">
                  <div style="background: #f9fafb; padding: 20px; border-radius: 12px; border-left: 4px solid #667eea;">
                    <h3 style="margin: 0 0 15px;">📋 Dettagli richiesta</h3>
                    <p style="margin: 5px 0;"><strong>Servizio:</strong> ${leadData.servizio}</p>
                    ${leadData.destinazione ? `<p style="margin: 5px 0;"><strong>Destinazione:</strong> ${leadData.destinazione}</p>` : ''}
                    ${leadData.data ? `<p style="margin: 5px 0;"><strong>Data:</strong> ${leadData.data}</p>` : ''}
                    ${leadData.persone ? `<p style="margin: 5px 0;"><strong>Persone:</strong> ${leadData.persone}</p>` : ''}
                    ${leadData.durata ? `<p style="margin: 5px 0;"><strong>Durata:</strong> ${leadData.durata.replace('_', ' ')}</p>` : ''}
                    ${leadData.orario ? `<p style="margin: 5px 0;"><strong>Orario:</strong> ${leadData.orario}</p>` : ''}
                    ${leadData.skipper !== undefined ? `<p style="margin: 5px 0;"><strong>Skipper:</strong> ${skipperText}</p>` : ''}
                  </div>
                </td></tr>
                
                <tr><td style="padding: 0 30px;">
                  <h3 style="margin: 0 0 20px;">💰 Prezzi indicativi per categoria</h3>
                </td></tr>
                
                <tr><td style="padding: 0 30px 15px;">
                  <div style="border: 2px solid #e5e7eb; padding: 20px; border-radius: 12px;">
                    <h4 style="margin: 0; color: #667eea;">SIMPLE</h4>
                    <p style="color: #666; margin: 5px 0; font-size: 14px;">Barche tradizionali confortevoli</p>
                    <p style="color: #667eea; font-size: 24px; font-weight: bold; margin: 10px 0;">${pricing.simple}</p>
                  </div>
                </td></tr>
                
                <tr><td style="padding: 0 30px 15px;">
                  <div style="background: #f0f9ff; border: 2px solid #667eea; padding: 20px; border-radius: 12px; position: relative;">
                    <div style="position: absolute; top: 10px; right: 10px; background: #667eea; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">POPOLARE</div>
                    <h4 style="margin: 0; color: #667eea;">PREMIUM</h4>
                    <p style="color: #666; margin: 5px 0; font-size: 14px;">Barche moderne con comfort superiore</p>
                    <p style="color: #667eea; font-size: 24px; font-weight: bold; margin: 10px 0;">${pricing.premium}</p>
                  </div>
                </td></tr>
                
                <tr><td style="padding: 0 30px 30px;">
                  <div style="background: #fef3c7; border: 2px solid #f59e0b; padding: 20px; border-radius: 12px;">
                    <h4 style="margin: 0; color: #f59e0b;">LUXURY ⭐</h4>
                    <p style="color: #666; margin: 5px 0; font-size: 14px;">Yacht di lusso con servizi esclusivi</p>
                    <p style="color: #f59e0b; font-size: 24px; font-weight: bold; margin: 10px 0;">${pricing.luxury}</p>
                  </div>
                </td></tr>
                
                <tr><td style="padding: 0 30px 30px;">
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 12px; text-align: center;">
                    <h3 style="color: white; margin: 0 0 15px;">🚤 Scegli la tua barca</h3>
                    <p style="color: rgba(255,255,255,0.9); margin: 0 0 20px; font-size: 14px;">Visualizza tutte le barche disponibili con foto e caratteristiche dettagliate</p>
                    <a href="${imbarcazioniUrl.toString()}" style="display: inline-block; background: white; color: #667eea; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Vedi Tutte le Barche Disponibili →</a>
                  </div>
                </td></tr>
                
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
                
                <tr><td style="padding: 0 30px 30px; text-align: center;">
                  <p style="color: #666; margin: 0 0 20px;">Hai domande? Siamo qui per aiutarti!</p>
                  <a href="mailto:info@blualliancegroup.com" style="display: inline-block; background: #f3f4f6; color: #333; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 0 5px;">📧 Scrivici</a>
                  <a href="tel:+393792342138" style="display: inline-block; background: #f3f4f6; color: #333; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 0 5px;">📱 Chiamaci</a>
                </td></tr>
                
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

    // Build context with pricing from database
    const stateContext = await buildContextFromState(sessionState);

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
    if (!sessionState.service) {
      if (lowerMsg.includes('tour') || lowerMsg.includes('organizzat')) {
        sessionState.service = 'tour';
      } else if (lowerMsg.includes('locazione') || lowerMsg.includes('plurigiorn') || lowerMsg.includes('più giorni')) {
        sessionState.service = 'locazione';
      } else if (lowerMsg.includes('noleggio') || lowerMsg.includes('noleggi') || 
                 lowerMsg.includes('barca') || lowerMsg.includes('affitt')) {
        sessionState.service = 'noleggio';
      } else if (lowerMsg.includes('taxi') || lowerMsg.includes('trasferiment')) {
        sessionState.service = 'taxi';
      }
    }
    
    // Detect destination
    if (!sessionState.destination) {
      if (lowerMsg.includes('capri')) {
        sessionState.destination = 'Capri';
      } else if (lowerMsg.includes('amalfi') || lowerMsg.includes('positano') || lowerMsg.includes('costiera')) {
        sessionState.destination = 'Amalfi';
      } else if (lowerMsg.includes('cilento') || lowerMsg.includes('palinuro')) {
        sessionState.destination = 'Cilento';
      }
    }
    
    // Detect date
    if (!sessionState.date) {
      if (lowerMsg.includes('oggi')) {
        sessionState.date = 'oggi';
      } else if (lowerMsg.includes('domani')) {
        sessionState.date = 'domani';
      } else if (lowerMsg.includes('weekend')) {
        sessionState.date = 'weekend';
      } else if (lowerMsg.match(/\d+\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/i)) {
        sessionState.date = message;
      }
    }
    
    // Detect durata
    if (!sessionState.durata) {
      if (lowerMsg.includes('mezza_giornata') || lowerMsg.includes('mezza giornata')) {
        sessionState.durata = 'mezza_giornata';
      } else if (lowerMsg.includes('giornata_intera') || lowerMsg.includes('giornata intera') || lowerMsg.includes('intera')) {
        sessionState.durata = 'giornata_intera';
      } else if (lowerMsg.includes('giorni') || lowerMsg.includes('settimana') || sessionState.service === 'locazione') {
        // Per locazione, durata è sempre piu_giorni
        sessionState.durata = 'piu_giorni';
      }
    }
    
    // Detect time
    if (!sessionState.time) {
      const timeRange = message.match(/(\d+)\s*[-:]\s*(\d+)/);
      if (timeRange) {
        sessionState.time = `${timeRange[1]}:00-${timeRange[2]}:00`;
      }
    }
    
    // Detect people
    const peopleMatch = message.match(/(\d+)/);
    if (peopleMatch && !sessionState.people) {
      sessionState.people = parseInt(peopleMatch[1]);
    }

    // Detect skipper
    if (!sessionState.skipper) {
      // LOCAZIONE è SEMPRE senza skipper (patente obbligatoria)
      if (sessionState.service === 'locazione') {
        sessionState.skipper = 'senza_skipper';
      } else if (lowerMsg.includes('con_skipper') || lowerMsg.includes('serve skipper') || lowerMsg.includes('no') && lowerMsg.includes('patente')) {
        sessionState.skipper = 'con_skipper';
      } else if (lowerMsg.includes('senza_skipper') || lowerMsg.includes('ho patente') || lowerMsg.includes('sì') && lowerMsg.includes('patente')) {
        sessionState.skipper = 'senza_skipper';
      }
    }

    // Handle email trigger
    let leadId = null;
    if (emailTrigger) {
      const finalService = sessionState.service || 'noleggio';
      const finalDestination = sessionState.destination || 'Costiera';
      const finalData = sessionState.date || 'da definire';
      const finalOrario = sessionState.time || 'da definire';
      const finalDurata = sessionState.durata || 'mezza_giornata';
      const finalSkipper = sessionState.skipper === 'con_skipper';
      
      // Save to Supabase
      const { data: lead, error: leadError } = await supabase
        .from('chatbot_leads')
        .insert({
          nome: emailTrigger.nome,
          email: emailTrigger.email,
          telefono: emailTrigger.telefono,
          servizio: finalService,
          destinazione: finalDestination,
          data: finalData,
          persone: sessionState.people || 4,
          orario: finalOrario,
          durata: finalDurata,
          skipper: finalSkipper,
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

        // Send emails
        const [adminEmailId, clientEmailId] = await Promise.all([
          sendAdminNotification({
            nome: emailTrigger.nome,
            email: emailTrigger.email,
            telefono: emailTrigger.telefono,
            servizio: finalService,
            destinazione: finalDestination,
            data: finalData,
            persone: sessionState.people || 4,
            durata: finalDurata,
            orario: finalOrario,
            skipper: finalSkipper
          }),
          sendClientQuote({
            nome: emailTrigger.nome,
            email: emailTrigger.email,
            servizio: finalService,
            destinazione: finalDestination,
            data: finalData,
            persone: sessionState.people || 4,
            durata: finalDurata,
            orario: finalOrario,
            skipper: finalSkipper,
            pricing: sessionState.pricing
          }, leadId)
        ]);

        // Log emails
        if (adminEmailId) {
          await supabase.from('chatbot_email_log').insert({
            lead_id: leadId,
            tipo: 'notifica_admin',
            destinatario: 'info@blualliancegroup.com',
            oggetto: `Nuova richiesta preventivo - ${finalService}`,
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
    service: 'Blu Alliance Chatbot API v4.3.1 LITE - Database Pricing + Link Barche + LOCAZIONE',
    timestamp: new Date().toISOString()
  }, { headers: corsHeaders });
}