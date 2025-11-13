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

    // Get all annotations for this call (both admin and client)
    const { data: annotations, error } = await supabase
      .from('call_annotations')
      .select('*')
      .eq('call_id', callId)
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
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    await requireAdmin()
    const { callId } = await params

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

    // Verify the call exists and get its organization_id
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id, organization_id')
      .eq('id', callId)
      .single()

    if (callError || !call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      )
    }

    // Create the annotation (as admin)
    const { data: annotation, error: insertError } = await supabase
      .from('call_annotations')
      .insert({
        call_id: callId,
        organization_id: call.organization_id,
        created_by_admin: true,
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
          { error: 'A call-level admin annotation already exists for this call' },
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

