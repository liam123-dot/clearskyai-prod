import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/(admin)/lib/admin-auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('org') || undefined
    const agentId = searchParams.get('agent') || undefined

    const supabase = await createClient()

    // Build the query to fetch annotations with related data
    let query = supabase
      .from('call_annotations')
      .select(`
        id,
        call_id,
        organization_id,
        created_by_admin,
        annotation_level,
        transcript_item_index,
        issue_category,
        note,
        created_at,
        updated_at,
        calls!inner (
          id,
          created_at,
          caller_number,
          called_number,
          agent_id,
          data
        )
      `)
      .order('created_at', { ascending: false })

    // Apply filters
    if (organizationId) {
      query = query.eq('organization_id', organizationId)
    }

    if (agentId) {
      query = query.eq('calls.agent_id', agentId)
    }

    const { data: annotations, error } = await query

    if (error) {
      throw error
    }

    // Fetch organizations data
    const { data: organizations } = await supabase
      .from('organisations')
      .select('id, name, slug')

    // Fetch agents data
    const { data: agents } = await supabase
      .from('agents')
      .select('id, vapi_assistant_id, organization_id')

    // Create lookup maps
    const orgMap = new Map(organizations?.map(org => [org.id, org]) || [])
    const agentMap = new Map(agents?.map(agent => [agent.id, agent]) || [])

    // Enrich annotations with related data
    const enrichedAnnotations = (annotations || []).map((annotation: any) => {
      const call = annotation.calls
      const organization = orgMap.get(annotation.organization_id)
      const agent = call?.agent_id ? agentMap.get(call.agent_id) : null
      
      // Extract agent name from call data
      const agentName = call?.data?.assistant?.name || 'Unknown Agent'

      return {
        id: annotation.id,
        call_id: annotation.call_id,
        organization_id: annotation.organization_id,
        created_by_admin: annotation.created_by_admin,
        annotation_level: annotation.annotation_level,
        transcript_item_index: annotation.transcript_item_index,
        issue_category: annotation.issue_category,
        note: annotation.note,
        created_at: annotation.created_at,
        updated_at: annotation.updated_at,
        call: {
          id: call?.id,
          created_at: call?.created_at,
          caller_number: call?.caller_number,
          called_number: call?.called_number,
          agent_id: call?.agent_id,
          data: call?.data,
        },
        organization: {
          id: organization?.id,
          name: organization?.name,
          slug: organization?.slug,
        },
        agent: {
          id: agent?.id,
          vapi_assistant_id: agent?.vapi_assistant_id,
          name: agentName,
        },
      }
    })

    return NextResponse.json({ annotations: enrichedAnnotations })
  } catch (error) {
    console.error('Error fetching call annotations:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch call annotations' },
      { status: 500 }
    )
  }
}

