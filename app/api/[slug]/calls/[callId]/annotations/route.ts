import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; callId: string }> }
) {
  try {
    const { slug, callId } = await params
    const { organizationId } = await getAuthSession(slug)

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const supabase = await createClient()

    // Get annotations for this call that belong to the organization and are not admin-created
    const { data: annotations, error } = await supabase
      .from('call_annotations')
      .select('*')
      .eq('call_id', callId)
      .eq('organization_id', organizationId)
      .eq('created_by_admin', false)
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json({ annotations: annotations || [] })
  } catch (error) {
    console.error('Error fetching annotations:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch annotations' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; callId: string }> }
) {
  try {
    const { slug, callId } = await params
    const { organizationId } = await getAuthSession(slug)

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { annotation_level, transcript_item_index, issue_category, note } = body

    // Validate required fields
    if (!annotation_level || !issue_category || !note) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate annotation_level
    if (!['call', 'transcript_item'].includes(annotation_level)) {
      return NextResponse.json(
        { error: 'Invalid annotation_level' },
        { status: 400 }
      )
    }

    // Validate transcript_item_index is provided for transcript_item level
    if (annotation_level === 'transcript_item' && transcript_item_index === undefined) {
      return NextResponse.json(
        { error: 'transcript_item_index required for transcript_item annotations' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify the call exists and belongs to the organization
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id, organization_id')
      .eq('id', callId)
      .eq('organization_id', organizationId)
      .single()

    if (callError || !call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      )
    }

    // Create the annotation
    const { data: annotation, error: insertError } = await supabase
      .from('call_annotations')
      .insert({
        call_id: callId,
        organization_id: organizationId,
        created_by_admin: false,
        annotation_level,
        transcript_item_index: annotation_level === 'transcript_item' ? transcript_item_index : null,
        issue_category,
        note,
      })
      .select()
      .single()

    if (insertError) {
      // Check for unique constraint violation (call-level annotation already exists)
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'A call-level annotation already exists for this call' },
          { status: 409 }
        )
      }
      throw insertError
    }

    return NextResponse.json({ annotation }, { status: 201 })
  } catch (error) {
    console.error('Error creating annotation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create annotation' },
      { status: 500 }
    )
  }
}

