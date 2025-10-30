import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { getTool } from '@/lib/tools'
import { unassignKnowledgeBaseFromAgent } from '@/lib/knowledge-bases'
import { vapiClient } from '@/lib/vapi/VapiClients'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id: agentId } = await params
    const { organizationId } = await getAuthSession(slug)

    const body = await request.json()
    const { toolId } = body

    if (!toolId) {
      return NextResponse.json(
        { error: 'Tool ID is required' },
        { status: 400 }
      )
    }

    // Verify tool exists in DB
    const tool = await getTool(toolId)
    if (!tool) {
      return NextResponse.json(
        { error: 'Tool not found' },
        { status: 404 }
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

    // If this is a query tool, check if it's associated with a knowledge base
    if (tool.type === 'query') {
      // Check if there's an agent_knowledge_bases record with this vapi_tool_id
      const { data: kbAssignment } = await supabase
        .from('agent_knowledge_bases')
        .select('knowledge_base_id')
        .eq('agent_id', agentId)
        .eq('vapi_tool_id', tool.external_tool_id)
        .single()

      if (kbAssignment) {
        // This is a knowledge base query tool, use the special unassign function
        await unassignKnowledgeBaseFromAgent(agentId, kbAssignment.knowledge_base_id)
        return NextResponse.json({ success: true })
      }
    }

    // For non-query tools or query tools not associated with a knowledge base,
    // proceed with normal detach
    
    // Fetch assistant from VAPI
    const assistant = await vapiClient.assistants.get(agent.vapi_assistant_id)
    const currentToolIds = assistant.model?.toolIds || []

    // Check if tool is attached
    if (!currentToolIds.includes(tool.external_tool_id)) {
      return NextResponse.json(
        { error: 'Tool is not attached to this agent' },
        { status: 400 }
      )
    }

    // Remove the tool ID from the assistant
    const updatedToolIds = currentToolIds.filter(id => id !== tool.external_tool_id)

    // Update the assistant without the tool
    await vapiClient.assistants.update(agent.vapi_assistant_id, {
      model: {
        ...assistant.model,
        toolIds: updatedToolIds
      } as any
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error detaching tool:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to detach tool' },
      { status: 500 }
    )
  }
}

