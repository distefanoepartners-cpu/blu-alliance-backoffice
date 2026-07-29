// lib/whatsapp-service.ts
// Blu Alliance - servizio WhatsApp via Twilio (porting da NS3000)
// Riusa le credenziali Twilio gia presenti (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)
// + nuovo mittente WhatsApp dedicato (TWILIO_WHATSAPP_NUMBER).
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID!
const authToken = process.env.TWILIO_AUTH_TOKEN!
const whatsappFrom = process.env.TWILIO_WHATSAPP_NUMBER || '+15559609957'

const client = twilio(accountSid, authToken)

// ═══════════════════════════════════════
// TEMPLATE CONTENT SIDs (Twilio Content API) - account Blu Alliance
// ⚠️ SOSTITUIRE con i contentSid dei template approvati sull'account Twilio BA
// ═══════════════════════════════════════
const TEMPLATES = {
  google_review_it: 'HX7e6d0b74d51455b4810739dcbb8cae0c', // <-- sostituire
  google_review_en: 'HX03d2a628fe47c38678ad097035989dc0', // <-- sostituire
  google_review_es: 'HXfc5fd6a2a41125061dc873bfa3b87729', // <-- sostituire
}

// Mapping lingua → locale per formattazione data
const LOCALE_MAP: Record<string, string> = {
  it: 'it-IT',
  en: 'en-GB',
  es: 'es-ES',
}

function formatDate(dateStr: string, lang: string = 'it'): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(LOCALE_MAP[lang] || 'it-IT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

// Normalizza numero di telefono in formato E.164 (+39...)
function formatPhone(phone: string): string {
  if (!phone) return ''

  // Rimuovi caratteri Unicode invisibili/direzionali
  let p = String(phone).replace(/[\u00A0\u200B-\u200D\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
  p = p.trim().replace(/[\s\-()\.]/g, '')

  if (p.startsWith('+')) {
    p = '+' + p.replace(/\+/g, '')
  } else {
    p = p.replace(/\+/g, '')
  }

  const INTL_PREFIXES = [
    '1', '33', '34', '44', '49', '54', '55', '61',
    '212', '351', '353', '41', '43', '420', '48',
    '7', '86', '81', '91', '27', '52', '356',
    '30', '31', '32', '45', '46', '47',
  ]

  if (p.startsWith('+')) return p
  if (p.startsWith('00')) return '+' + p.substring(2)
  if (p.startsWith('3') && p.length === 10 && /^\d+$/.test(p)) return '+39' + p
  if (p.startsWith('39') && p.length >= 12 && p.length <= 13 && /^\d+$/.test(p)) return '+' + p

  if (/^\d{8,15}$/.test(p)) {
    const sortedPrefixes = [...INTL_PREFIXES].sort((a, b) => b.length - a.length)
    for (const prefix of sortedPrefixes) {
      if (p.startsWith(prefix)) return '+' + p
    }
  }

  console.warn('⚠️ [formatPhone] Formato ambiguo, aggiungo solo "+":', phone, '→', '+' + p)
  return '+' + p
}

// Sanitizza il valore di una variabile template Twilio
function sanitizeTemplateVar(value: string): string {
  if (value == null) return ''
  return String(value)
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
}

// ═══════════════════════════════════════
// INVIO WHATSAPP CON TEMPLATE APPROVATO
// ═══════════════════════════════════════
export async function sendWhatsAppTemplate(
  to: string,
  contentSid: string,
  contentVariables: Record<string, string>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const phone = formatPhone(to)

    const sanitized: Record<string, string> = {}
    for (const [key, val] of Object.entries(contentVariables)) {
      sanitized[key] = sanitizeTemplateVar(val)
    }

    const contentVariablesJson = JSON.stringify(sanitized)

    console.log(`📱 [BA] WhatsApp TEMPLATE ${contentSid} a ${phone}`)
    console.log(`   Variabili:`, sanitized)
    console.log(`   From: whatsapp:${whatsappFrom} | To: whatsapp:${phone}`)

    const result = await client.messages.create({
      contentSid,
      contentVariables: contentVariablesJson,
      from: `whatsapp:${whatsappFrom}`,
      to: `whatsapp:${phone}`,
    })

    console.log(`✅ [BA] WhatsApp template inviato: ${result.sid}`)
    return { success: true, messageId: result.sid }
  } catch (error: any) {
    console.error('❌ [BA] Errore invio WhatsApp template:', error.message)
    console.error('   Codice Twilio:', error.code)
    console.error('   Dettagli:', error.moreInfo || error.details)
    return { success: false, error: error.message }
  }
}

// Helper: seleziona template SID recensione in base a lingua, con fallback IT
function getGoogleReviewTemplateSid(lang: string): string {
  if (lang === 'en' && TEMPLATES.google_review_en && !TEMPLATES.google_review_en.startsWith('HX_BA_')) {
    return TEMPLATES.google_review_en
  }
  if (lang === 'es' && TEMPLATES.google_review_es && !TEMPLATES.google_review_es.startsWith('HX_BA_')) {
    return TEMPLATES.google_review_es
  }
  if ((lang === 'en' || lang === 'es')) {
    console.warn(`⚠️ [BA] Template google_review ${lang.toUpperCase()} non configurato, fallback su IT`)
  }
  return TEMPLATES.google_review_it
}

/**
 * Invia richiesta recensione Google al cliente via WhatsApp (Blu Alliance).
 * Usa il template Twilio Content `google_review_<lang>` approvato da Meta.
 * Il link Google review e statico nel template (non parametrizzato).
 * Variabili template: {{1}} = nome cliente, {{2}} = data servizio formattata.
 */
export async function sendGoogleReviewWhatsApp(
  customerPhone: string,
  data: {
    customer_name: string
    booking_date: string
    lang?: string
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const lang = data.lang || 'it'
  const contentSid = getGoogleReviewTemplateSid(lang)

  const contentVariables: Record<string, string> = {
    '1': data.customer_name,
    '2': formatDate(data.booking_date, lang),
  }

  return sendWhatsAppTemplate(customerPhone, contentSid, contentVariables)
}