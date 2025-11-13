import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/(admin)/lib/admin-auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    await requireAdmin()
    const { callId } = await params

    const supabase = await createClient()

    const { data: call, error } = await supabase
      .from('calls')
      .select('*')
      .eq('id', callId)
      .single()

    if (error || !call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ call })
  } catch (error) {
    console.error('Error fetching call:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch call' },
      { status: 500 }
    )
  }
}

