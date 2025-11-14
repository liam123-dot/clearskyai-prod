import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { organizationId } = await getAuthSession(slug)

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Get callIds from query parameter
    const { searchParams } = new URL(request.url)
    const callIdsParam = searchParams.get('callIds')
    
    if (!callIdsParam) {
      return NextResponse.json({ counts: {} })
    }

    // Parse comma-separated call IDs
    const callIds = callIdsParam.split(',').filter(id => id.trim().length > 0)

    if (callIds.length === 0) {
      return NextResponse.json({ counts: {} })
    }

    const supabase = await createClient()

    // Get annotation counts for all calls in a single query
    const { data: annotations, error } = await supabase
      .from('call_annotations')
      .select('call_id')
      .in('call_id', callIds)
      .eq('organization_id', organizationId)
      .eq('created_by_admin', false)

    if (error) {
      throw error
    }

    // Count annotations per call_id
    const counts: Record<string, number> = {}
    
    // Initialize all call IDs with 0
    callIds.forEach(callId => {
      counts[callId] = 0
    })

    // Count annotations for each call
    if (annotations) {
      annotations.forEach(annotation => {
        if (annotation.call_id) {
          counts[annotation.call_id] = (counts[annotation.call_id] || 0) + 1
        }
      })
    }

    return NextResponse.json({ counts })
  } catch (error) {
    console.error('Error fetching annotation counts:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch annotation counts' },
      { status: 500 }
    )
  }
}

