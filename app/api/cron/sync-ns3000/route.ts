import { NextResponse } from 'next/server'

// Cron Job: Sync NS3000 - Blu Alliance
// Vercel Cron: ogni 5 minuti (configurare in vercel.json)

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.NODE_ENV === 'production' && process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const res = await fetch(`${baseUrl}/api/ns3000/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date_from: new Date().toISOString().split('T')[0],
        date_to: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      })
    })

    const result = await res.json()
    console.log('Cron sync NS3000 completata:', result.summary || result)

    return NextResponse.json({
      success: true,
      ...result,
      triggered_at: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Cron sync NS3000 error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}