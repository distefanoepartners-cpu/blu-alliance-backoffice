import { NextResponse } from 'next/server'

const NS3000_API_URL = process.env.NS3000_API_URL
const NS3000_API_KEY = process.env.NS3000_API_KEY

export async function GET(request: Request) {
  if (!NS3000_API_URL || !NS3000_API_KEY) {
    return NextResponse.json(
      { error: 'NS3000 non configurato' },
      { status: 503 }
    )
  }

  const { searchParams } = new URL(request.url)
  
  // Forward tutti i parametri a NS3000
  const params = new URLSearchParams()
  searchParams.forEach((value, key) => params.set(key, value))

  try {
    const res = await fetch(
      `${NS3000_API_URL}/api/external/availability?${params.toString()}`,
      {
        headers: { 'X-API-Key': NS3000_API_KEY },
        next: { revalidate: 60 } // Cache 1 minuto
      }
    )

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Errore NS3000' }))
      return NextResponse.json(error, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('Errore chiamata NS3000 availability:', error)
    return NextResponse.json(
      { error: 'Errore connessione NS3000' },
      { status: 502 }
    )
  }
}