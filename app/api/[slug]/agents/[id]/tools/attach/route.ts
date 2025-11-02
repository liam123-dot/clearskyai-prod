import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { getTool, isToolAttachedToAgent } from '@/lib/tools'
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
      // Preemptive-only tool: attach via agent_tools table
      // Ensure tool has execute_on_call_start = true
      if (!tool.execute_on_call_start) {
        return NextResponse.json(
          { error: 'Preemptive-only tools must have execute_on_call_start enabled' },
          { status: 400 }
        )
      }

      // Insert into agent_tools table
      const { error: insertError } = await supabase
        .from('agent_tools')
        .insert({
          agent_id: agentId,
          tool_id: toolId,
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
      // Attachable tool: attach via VAPI assistant's toolIds
      // Check if tool has an external_tool_id (required for VAPI attachment)
      if (!tool.external_tool_id) {
        return NextResponse.json(
          { error: 'This tool does not have a VAPI tool ID and cannot be attached via VAPI' },
          { status: 400 }
        )
      }

      // Fetch assistant from VAPI
      const assistant = await vapiClient.assistants.get(agent.vapi_assistant_id)
      const currentToolIds = assistant.model?.toolIds || []

      // Add the new tool ID to the assistant
      const updatedToolIds = [...currentToolIds, tool.external_tool_id]

      // Update the assistant with the new tool
      await vapiClient.assistants.update(agent.vapi_assistant_id, {
        model: {
          ...assistant.model,
          toolIds: updatedToolIds
        } as any
      })

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

