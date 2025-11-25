import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/(admin)/lib/admin-auth'
import { getAgentsByOrganization, getAgents } from '@/lib/agents'

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
          external_agent_id: agent.externalAgentId,
          provider: agent.provider as 'vapi' | 'elevenlabs',
          organization: agent.organization!,
          name: agent.name,
          isAssigned: true as const,
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

