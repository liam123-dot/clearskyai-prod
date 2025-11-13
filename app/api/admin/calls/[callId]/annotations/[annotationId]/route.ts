import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/(admin)/lib/admin-auth'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string; annotationId: string }> }
) {
  try {
    await requireAdmin()
    const { callId, annotationId } = await params

    const body = await request.json()
    const { issue_category, note } = body

    // Validate at least one field is being updated
    if (!issue_category && !note) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify the annotation exists
    const { data: existingAnnotation, error: fetchError } = await supabase
      .from('call_annotations')
      .select('*')
      .eq('id', annotationId)
      .eq('call_id', callId)
      .single()

    if (fetchError || !existingAnnotation) {
      return NextResponse.json(
        { error: 'Annotation not found' },
        { status: 404 }
      )
    }

    // Update the annotation
    const updateData: { issue_category?: string; note?: string } = {}
    if (issue_category) updateData.issue_category = issue_category
    if (note) updateData.note = note

    const { data: annotation, error: updateError } = await supabase
      .from('call_annotations')
      .update(updateData)
      .eq('id', annotationId)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ annotation })
  } catch (error) {
    console.error('Error updating annotation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update annotation' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string; annotationId: string }> }
) {
  try {
    await requireAdmin()
    const { callId, annotationId } = await params

    const supabase = await createClient()

    // Verify the annotation exists
    const { data: existingAnnotation, error: fetchError } = await supabase
      .from('call_annotations')
      .select('*')
      .eq('id', annotationId)
      .eq('call_id', callId)
      .single()

    if (fetchError || !existingAnnotation) {
      return NextResponse.json(
        { error: 'Annotation not found' },
        { status: 404 }
      )
    }

    // Delete the annotation
    const { error: deleteError } = await supabase
      .from('call_annotations')
      .delete()
      .eq('id', annotationId)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting annotation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete annotation' },
      { status: 500 }
    )
  }
}

