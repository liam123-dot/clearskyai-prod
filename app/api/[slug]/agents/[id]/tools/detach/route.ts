import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { getTool } from '@/lib/tools'
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
      .select('external_agent_id, organization_id, provider')
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

    // For now, only support ElevenLabs
    if (agent.provider !== 'elevenlabs') {
      return NextResponse.json(
        { error: 'Only ElevenLabs agents are supported currently' },
        { status: 400 }
      )
    }
    
    // Check if tool is attached via agent_tools table
    const { data: agentTool, error: agentToolError } = await supabase
      .from('agent_tools')
      .select('id')
      .eq('agent_id', agentId)
      .eq('tool_id', toolId)
      .maybeSingle()

    if (agentToolError) {
      console.error('Error checking agent_tools:', agentToolError)
      return NextResponse.json(
        { error: 'Failed to check tool attachment' },
        { status: 500 }
      )
    }

    if (!agentTool) {
      return NextResponse.json(
        { error: 'Tool is not attached to this agent' },
        { status: 400 }
      )
    }

    // Handle detachment based on attach_to_agent flag
    if (tool.attach_to_agent === false) {
      // Preemptive-only tool: only remove from agent_tools table
      const { error: deleteError } = await supabase
        .from('agent_tools')
        .delete()
        .eq('id', agentTool.id)

      if (deleteError) {
        console.error('Error removing from agent_tools:', deleteError)
        return NextResponse.json(
          { error: 'Failed to detach tool' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    } else {
      // ElevenLabs-attached tool: remove from both ElevenLabs and agent_tools
      if (!tool.external_tool_id) {
        return NextResponse.json(
          { error: 'Tool does not have an external tool ID and cannot be detached' },
          { status: 400 }
        )
      }

      const { ElevenLabsClient } = await import('@elevenlabs/elevenlabs-js')
      const elevenLabsClient = new ElevenLabsClient({
        apiKey: process.env.ELEVEN_API_KEY,
      })

      // Fetch agent from ElevenLabs
      const elevenLabsAgent = await elevenLabsClient.conversationalAi.agents.get(agent.external_agent_id)
      const currentToolIds = (elevenLabsAgent.conversationConfig?.agent as any)?.prompt?.toolIds || []

      // Check if tool is attached
      if (!currentToolIds.includes(tool.external_tool_id)) {
        console.warn(`Tool ${toolId} not found in ElevenLabs but was in agent_tools`)
      } else {
        // Remove the tool ID from the agent
        const updatedToolIds = currentToolIds.filter((id: string) => id !== tool.external_tool_id)

        // Update the agent without the tool
        await elevenLabsClient.conversationalAi.agents.update(agent.external_agent_id, {
          conversationConfig: {
            agent: {
              prompt: {
                toolIds: updatedToolIds
              }
            }
          }
        })
      }

      // Remove from agent_tools table
      const { error: deleteError } = await supabase
        .from('agent_tools')
        .delete()
        .eq('id', agentTool.id)

      if (deleteError) {
        console.error('Error removing from agent_tools:', deleteError)
        return NextResponse.json(
          { error: 'Failed to detach tool' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    }
  } catch (error) {
    console.error('Error detaching tool:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to detach tool' },
      { status: 500 }
    )
  }
}

