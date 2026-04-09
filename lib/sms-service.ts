import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID!
const authToken = process.env.TWILIO_AUTH_TOKEN!
const fromNumber = process.env.TWILIO_PHONE_NUMBER!

const client = twilio(accountSid, authToken)

/**
 * Formatta numero italiano per Twilio
 */
function formatPhone(phone: string): string {
  let p = phone.replace(/\s+/g, '').replace(/-/g, '')
  if (p.startsWith('3') && p.length === 10) {
    p = '+39' + p
  } else if (!p.startsWith('+')) {
    p = '+39' + p
  }
  return p
}

/**
 * Invia SMS generico
 */
export async function sendSms(
  to: string,
  body: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const phone = formatPhone(to)
    const result = await client.messages.create({
      body,
      from: 'BluAlliance',
      to: phone,
    })
    console.log(`✅ [SMS] Inviato a ${phone}: ${result.sid}`)
    return { success: true, messageId: result.sid }
  } catch (error: any) {
    console.error('❌ [SMS] Errore:', error.message)
    return { success: false, error: error.message }
  }
}

 /**
 * Invia SMS prenotazione al fornitore (supporta secondo numero)
 */
export async function sendBookingSmsToFornitore(
  telefono: string,
  ragioneSociale: string,
  data: {
    codice: string
    clienteNome: string
    barcaNome: string
    servizioNome: string
    dataServizio: string
    oraImbarco: string
    portoImbarco: string
    numPersone: number
    prezzoTotale: number
    caparra: number
    noteCliente?: string
    // ⭐ Secondo numero opzionale
    telefono_2?: string
    telefono_2_nome?: string
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const saldo = data.prezzoTotale - data.caparra

  const message = [
    `⚓ Blu Alliance - Nuova Prenotazione`,
    ``,
    `📋 ${data.codice}`,
    `👤 ${data.clienteNome}`,
    `🚤 ${data.barcaNome}`,
    `⚓ ${data.servizioNome}`,
    `📅 ${formatDate(data.dataServizio)}`,
    `⏰ ${data.oraImbarco || 'Da definire'}`,
    `📍 ${data.portoImbarco || 'Da definire'}`,
    `👥 ${data.numPersone} pax`,
    `💰 €${data.prezzoTotale.toFixed(0)} (acc. €${data.caparra.toFixed(0)}${saldo > 0 ? ` | saldo €${saldo.toFixed(0)}` : ''})`,
    data.noteCliente ? `📝 ${data.noteCliente}` : '',
  ].filter(Boolean).join('\n')

  console.log(`📱 [SMS] Notifica a ${ragioneSociale} (${telefono})`)

  // Invia al numero principale
  const result = await sendSms(telefono, message)

  // ⭐ Invia al secondo numero se presente
  if (data.telefono_2) {
    const label = data.telefono_2_nome ? ` (${data.telefono_2_nome})` : ''
    console.log(`📱 [SMS] Notifica secondo numero${label}: ${data.telefono_2}`)
    await sendSms(data.telefono_2, message)
  }

  return result
}
/**
 * SMS di cancellazione al fornitore
 */
export async function sendCancellazioneSmsToFornitore(
  telefono: string,
  data: {
    codice: string
    barcaNome: string
    dataServizio: string
    motivo?: string
    // ⭐ aggiungi:
    telefono_2?: string
    telefono_2_nome?: string
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const message = [
    `❌ Blu Alliance - Prenotazione Cancellata`,
    ``,
    `📋 ${data.codice}`,
    `🚤 ${data.barcaNome}`,
    `📅 ${formatDate(data.dataServizio)}`,
    data.motivo ? `📝 Motivo: ${data.motivo}` : '',
  ].filter(Boolean).join('\n')

  // ⭐ Invia a entrambi i numeri
  const result = await sendSms(telefono, message)
  if (data.telefono_2) {
    await sendSms(data.telefono_2, message)
  }
  return result
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}