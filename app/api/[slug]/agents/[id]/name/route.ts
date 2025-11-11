import { NextRequest, NextResponse } from 'next/server'
import { getAgentById } from '@/lib/vapi/agents'
import { getAuthSession } from '@/lib/auth'
import { vapiClient } from '@/lib/vapi/VapiClients'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params
    await getAuthSession(slug) // Verify authentication
    
    const agent = await getAgentById(id)
    
    if (!agent) {
      return NextResponse.json({ name: null }, { status: 404 })
    }
    
    return NextResponse.json({ name: agent.vapiAssistant.name || 'Unnamed Agent' })
  } catch (error) {
    console.error('Error fetching agent name:', error)
    return NextResponse.json({ name: null }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id: agentId } = await params
    const { organizationId } = await getAuthSession(slug)

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()

    // Get the agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('vapi_assistant_id, organization_id')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Verify agent belongs to organization
    if (agent.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Update the assistant name in Vapi
    await vapiClient.assistants.update(agent.vapi_assistant_id, {
      name: name.trim(),
    })

    return NextResponse.json({ success: true, name: name.trim() })
  } catch (error) {
    console.error('Error updating agent name:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update agent name' },
      { status: 500 }
    )
  }
}

