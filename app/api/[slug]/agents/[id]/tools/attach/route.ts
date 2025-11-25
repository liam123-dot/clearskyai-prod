import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { getTool, isToolAttachedToAgent } from '@/lib/tools'
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

    // Verify tool exists in DB and belongs to organization
    const tool = await getTool(toolId)
    if (!tool) {
      return NextResponse.json(
        { error: 'Tool not found' },
        { status: 404 }
      )
    }

    if (tool.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
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

    // Check if tool is already attached (via VAPI or agent_tools)
    const isAttached = await isToolAttachedToAgent(agentId, toolId)
    if (isAttached) {
      return NextResponse.json(
        { error: 'Tool is already attached to this agent' },
        { status: 400 }
      )
    }

    // Handle attachment based on attach_to_agent flag
    if (tool.attach_to_agent === false) {
      // Preemptive-only tool: attach via agent_tools table only
      if (!tool.execute_on_call_start) {
        return NextResponse.json(
          { error: 'Preemptive-only tools must have execute_on_call_start enabled' },
          { status: 400 }
        )
      }

      const { error: insertError } = await supabase
        .from('agent_tools')
        .insert({
          agent_id: agentId,
          tool_id: toolId,
          is_vapi_attached: false, // Keep field name for backward compatibility
        })

      if (insertError) {
        console.error('Error inserting into agent_tools:', insertError)
        return NextResponse.json(
          { error: 'Failed to attach tool' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    } else {
      // Attachable tool: attach via ElevenLabs agent
      if (!tool.external_tool_id) {
        return NextResponse.json(
          { error: 'This tool does not have an external tool ID and cannot be attached' },
          { status: 400 }
        )
      }

      const { ElevenLabsClient } = await import('@elevenlabs/elevenlabs-js')
      const elevenLabsClient = new ElevenLabsClient({
        apiKey: process.env.ELEVEN_API_KEY,
      })

      // Get current agent tools
      const elevenLabsAgent = await elevenLabsClient.conversationalAi.agents.get(agent.external_agent_id)
      const currentToolIds = (elevenLabsAgent.conversationConfig?.agent as any)?.prompt?.toolIds || []

      // Add the new tool ID
      const updatedToolIds = [...currentToolIds, tool.external_tool_id]

      // Update the agent with the new tool
      await elevenLabsClient.conversationalAi.agents.update(agent.external_agent_id, {
        conversationConfig: {
          agent: {
            prompt: {
              toolIds: updatedToolIds
            }
          }
        }
      })

      // Insert into agent_tools table
      const { error: insertError } = await supabase
        .from('agent_tools')
        .insert({
          agent_id: agentId,
          tool_id: toolId,
          is_vapi_attached: true, // Keep field name for backward compatibility
        })

      if (insertError) {
        // Rollback ElevenLabs change
        try {
          await elevenLabsClient.conversationalAi.agents.update(agent.external_agent_id, {
            conversationConfig: {
              agent: {
                prompt: {
                  toolIds: currentToolIds
                }
              }
            }
          })
        } catch (rollbackError) {
          console.error('Error rolling back ElevenLabs change:', rollbackError)
        }
        return NextResponse.json(
          { error: 'Failed to attach tool' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    }
  } catch (error) {
    console.error('Error attaching tool:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to attach tool' },
      { status: 500 }
    )
  }
}

