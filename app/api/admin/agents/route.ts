import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/(admin)/lib/admin-auth'
import { getAgentsByOrganization, getAgents } from '@/lib/vapi/agents'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId')

    let agents

    if (organizationId) {
      // Get agents for specific organization
      agents = await getAgentsByOrganization(organizationId)
    } else {
      // Get all agents and filter to only assigned agents (those with an organization)
      const allAgents = await getAgents()
      agents = allAgents
        .filter(agent => agent.isAssigned && agent.organization)
        .map(agent => ({
          id: agent.id!,
          vapi_assistant_id: agent.vapi_assistant_id,
          created_at: agent.created_at!,
          updated_at: agent.updated_at!,
          organization: agent.organization!,
          isAssigned: true as const,
          vapiAssistant: agent.vapiAssistant,
        }))
    }

    return NextResponse.json(agents)
  } catch (error) {
    console.error('Error fetching agents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    )
  }
}

