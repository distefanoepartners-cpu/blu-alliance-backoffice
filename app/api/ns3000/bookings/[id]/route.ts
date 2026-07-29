// app/api/ns3000/bookings/[id]/route.ts
// Proxya l'UPDATE (PATCH) di una prenotazione verso NS3000 /api/external/bookings/[id]
// [id] = ns3000_booking_id (UUID della prenotazione su NS3000)
import { NextResponse } from 'next/server'

const NS3000_API_URL = process.env.NS3000_API_URL
const NS3000_API_KEY = process.env.NS3000_API_KEY

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!NS3000_API_URL || !NS3000_API_KEY) {
    return NextResponse.json({ error: 'NS3000 non configurato' }, { status: 503 })
  }
  try {
    const { id } = await context.params
    const body = await request.json()

    const res = await fetch(
      `${NS3000_API_URL}/api/external/bookings/${id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': NS3000_API_KEY,
        },
        body: JSON.stringify(body),
      }
    )
    const result = await res.json()
    if (!res.ok) {
      console.error('[BA->NS3000 PATCH] Errore update:', result)
      return NextResponse.json(
        { error: result.error || 'Errore NS3000', message: result.message },
        { status: res.status }
      )
    }
    return NextResponse.json({ success: true, ns3000_booking: result.booking })
  } catch (error: any) {
    console.error('[BA->NS3000 PATCH] Errore generico:', error)
    return NextResponse.json({ error: error.message || 'Errore interno' }, { status: 500 })
  }
}
