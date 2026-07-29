// app/api/arrivi-navi/route.ts
// Restituisce le navi in scalo in una data specifica.
// Usato dal BookingModal per popolare la select "Nave di provenienza".

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const data = searchParams.get('data')

    if (!data) {
      return NextResponse.json({ error: 'Parametro "data" obbligatorio' }, { status: 400 })
    }

    const { data: navi, error } = await supabase
      .from('arrivi_navi')
      .select('id, nome_nave, capienza_pax, data_arrivo')
      .eq('data_arrivo', data)
      .order('capienza_pax', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(navi || [])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}