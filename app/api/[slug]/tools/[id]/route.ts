import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthSession } from '@/lib/auth'
import { ToolConfig } from '@/lib/tools/types'
import {
  buildFunctionSchema,
  buildStaticConfig,
  generateToolName,
  validateToolConfig,
} from '@/lib/tools/schema-builder'
import { vapiClient } from '@/lib/vapi/VapiClients'
import { convertToolConfigToVapiApiRequest } from '@/lib/vapi/tool-converter'

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug: slugFromUrl, id } = await context.params
    const { user, organizationId } = await getAuthSession(slugFromUrl)

    if (!user || !organizationId) {
      return NextResponse.json(
        { error: 'Not authenticated or unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createClient()

    // Get the tool (RLS will ensure user can only see tools from their org)
    const { data: tool, error: toolError } = await supabase
      .from('tools')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single()

    if (toolError || !tool) {
      return NextResponse.json(
        { error: 'Tool not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ tool })
  } catch (error) {
    console.error('Error in /api/[organizationId]/tools/[id] GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug: slugFromUrl, id } = await context.params
    const { user, organizationId } = await getAuthSession(slugFromUrl)

    if (!user || !organizationId) {
      return NextResponse.json(
        { error: 'Not authenticated or unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createClient()

    // Get the existing tool
    const { data: existingTool, error: fetchError } = await supabase
      .from('tools')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single()

    if (fetchError || !existingTool) {
      return NextResponse.json(
        { error: 'Tool not found' },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()
    const config = body as ToolConfig

    // Validate tool configuration
    const validation = validateToolConfig(config)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(', ') },
        { status: 400 }
      )
    }

    // Generate new name if label changed
    let toolName = existingTool.name
    if (config.label !== existingTool.label) {
      const baseName = config.name || generateToolName(config.label)
      toolName = baseName
      let increment = 2

      while (true) {
        const { data: conflicting } = await supabase
          .from('tools')
          .select('id')
          .eq('name', toolName)
          .eq('organization_id', organizationId)
          .neq('id', id)
          .maybeSingle()

        if (!conflicting) break

        toolName = `${baseName}_${increment}`
        increment++
      }
    }

    // Build updated schemas
    const functionSchema = buildFunctionSchema({ ...config, name: toolName })
    const staticConfig = buildStaticConfig(config)

    console.log('Updating tool:', {
      id,
      name: toolName,
      type: config.type,
      label: config.label,
      functionSchema: JSON.stringify(functionSchema, null, 2),
    })

    // Handle VAPI tool updates based on attach_to_agent setting
    const attachToAgent = config.attach_to_agent !== false
    const wasAttachable = existingTool.attach_to_agent !== false
    const hasExternalId = existingTool.external_tool_id !== null

    try {
      if (attachToAgent && !wasAttachable) {
        // Converting from preemptive-only to attachable: create VAPI tool
        console.log('Creating VAPI tool for previously preemptive-only tool')
        const vapiToolData = convertToolConfigToVapiApiRequest(
          id,
          config,
          functionSchema
        )
        const vapiTool = await vapiClient.tools.create(vapiToolData as any)
        existingTool.external_tool_id = vapiTool.id
        console.log('VAPI tool created:', vapiTool.id)
      } else if (!attachToAgent && wasAttachable && hasExternalId) {
        // Converting from attachable to preemptive-only: delete VAPI tool
        console.log('Deleting VAPI tool (converting to preemptive-only):', existingTool.external_tool_id)
        await vapiClient.tools.delete(existingTool.external_tool_id)
        existingTool.external_tool_id = null
        console.log('VAPI tool deleted successfully')
      } else if (attachToAgent && hasExternalId) {
        // Still attachable: update VAPI tool
        const vapiToolData = convertToolConfigToVapiApiRequest(
          id,
          config,
          functionSchema
        )
        // Remove 'type' field for updates - VAPI update API doesn't accept it
        const { type, ...updateData } = vapiToolData
        console.log('Updating VAPI tool:', existingTool.external_tool_id)
        await vapiClient.tools.update(existingTool.external_tool_id, updateData as any)
        console.log('VAPI tool updated successfully')
      } else if (attachToAgent && !hasExternalId) {
        // Should be attachable but missing external_tool_id: create it
        console.log('Creating missing VAPI tool for attachable tool')
        const vapiToolData = convertToolConfigToVapiApiRequest(
          id,
          config,
          functionSchema
        )
        const vapiTool = await vapiClient.tools.create(vapiToolData as any)
        existingTool.external_tool_id = vapiTool.id
        console.log('VAPI tool created:', vapiTool.id)
      } else {
        // Preemptive-only: no VAPI operations needed
        console.log('Skipping VAPI operations (preemptive-only tool)')
      }
    } catch (vapiError) {
      console.error('Error updating VAPI tool:', vapiError)
      return NextResponse.json(
        { error: 'Failed to update tool in VAPI. Please try again.' },
        { status: 500 }
      )
    }

    // Update the DB record
    const { data: updatedTool, error: updateError } = await supabase
      .from('tools')
      .update({
        name: toolName,
        label: config.label,
        description: config.description,
        type: config.type,
        function_schema: functionSchema,
        static_config: staticConfig,
        config_metadata: config,
        async: config.async || false,
        execute_on_call_start: config.execute_on_call_start || false,
        attach_to_agent: attachToAgent,
        external_tool_id: existingTool.external_tool_id, // May have been updated above
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating tool in DB:', updateError)
      // Note: VAPI tool is already updated, we're in an inconsistent state
      // Best effort would be to try reverting VAPI, but this is complex
      return NextResponse.json(
        { error: 'Failed to update tool in database' },
        { status: 500 }
      )
    }

    return NextResponse.json({ tool: updatedTool })
  } catch (error) {
    console.error('Error in /api/[organizationId]/tools/[id] PATCH:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { slug: slugFromUrl, id } = await context.params
    const { user, organizationId } = await getAuthSession(slugFromUrl)

    if (!user || !organizationId) {
      return NextResponse.json(
        { error: 'Not authenticated or unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createClient()

    // First, get the tool to retrieve its external_tool_id
    const { data: tool, error: fetchError } = await supabase
      .from('tools')
      .select('external_tool_id')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single()

    if (fetchError || !tool) {
      return NextResponse.json(
        { error: 'Tool not found' },
        { status: 404 }
      )
    }

    // Find all agents with this tool attached via agent_tools
    const { data: agentToolsRecords, error: agentToolsError } = await supabase
      .from('agent_tools')
      .select('agent_id, is_vapi_attached, agents!inner(vapi_assistant_id)')
      .eq('tool_id', id)

    if (agentToolsError) {
      console.error('Error fetching agent_tools:', agentToolsError)
      return NextResponse.json(
        { error: 'Failed to fetch tool attachments' },
        { status: 500 }
      )
    }

    // Remove tool from all agents in VAPI (for is_vapi_attached=true)
    if (tool.external_tool_id && agentToolsRecords && agentToolsRecords.length > 0) {
      console.log(`Removing tool ${id} from ${agentToolsRecords.length} agent(s)`)
      
      for (const record of agentToolsRecords) {
        const agentRecord = record as any
        if (!agentRecord.is_vapi_attached) {
          // Skip preemptive-only tools
          continue
        }

        const vapiAssistantId = agentRecord.agents?.vapi_assistant_id
        if (!vapiAssistantId) {
          console.warn(`Agent ${agentRecord.agent_id} has no vapi_assistant_id`)
          continue
        }

        try {
          // Fetch current assistant
          const assistant = await vapiClient.assistants.get(vapiAssistantId)
          const currentToolIds = assistant.model?.toolIds || []

          // Remove tool from toolIds
          const updatedToolIds = currentToolIds.filter(toolId => toolId !== tool.external_tool_id)

          // Update assistant
          await vapiClient.assistants.update(vapiAssistantId, {
            model: {
              ...assistant.model,
              toolIds: updatedToolIds
            } as any
          })
          
          console.log(`Removed tool from agent ${agentRecord.agent_id} in VAPI`)
        } catch (vapiError: any) {
          // Check if it's a 404 error (tool or assistant not found)
          if (vapiError?.statusCode === 404 || vapiError?.status === 404) {
            console.log(`Tool or assistant not found in VAPI (404), continuing with deletion`)
          } else {
            // Other errors should fail the deletion
            console.error(`Error removing tool from agent ${agentRecord.agent_id}:`, vapiError)
            return NextResponse.json(
              { error: 'Failed to remove tool from agents in VAPI' },
              { status: 500 }
            )
          }
        }
      }
    }

    // Delete tool from VAPI (only if tool has external_tool_id)
    if (tool.external_tool_id) {
      try {
        console.log('Deleting VAPI tool:', tool.external_tool_id)
        await vapiClient.tools.delete(tool.external_tool_id)
        console.log('VAPI tool deleted successfully')
      } catch (vapiError: any) {
        // If 404, the tool was already deleted, which is fine
        if (vapiError?.statusCode === 404 || vapiError?.status === 404) {
          console.log('VAPI tool already deleted (404)')
        } else {
          console.error('Error deleting VAPI tool:', vapiError)
          // Continue with DB deletion even if VAPI deletion fails
        }
      }
    } else {
      console.log('No VAPI tool to delete (preemptive-only tool)')
    }

    // Delete from DB (CASCADE will handle agent_tools deletion)
    const { error: deleteError } = await supabase
      .from('tools')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId)

    if (deleteError) {
      console.error('Error deleting tool from DB:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete tool' },
        { status: 500 }
      )
    }

    console.log('Tool deleted:', id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in /api/[organizationId]/tools/[id] DELETE:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

