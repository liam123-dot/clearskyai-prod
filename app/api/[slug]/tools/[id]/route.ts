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

    // Skip native tools (not implemented for ElevenLabs yet)
    const isNativeTool = config.type === 'transfer_call' || config.type === 'handoff'
    if (isNativeTool) {
      return NextResponse.json(
        { error: 'Native tools (handoff, transfer_call) are not supported yet' },
        { status: 400 }
      )
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

    // Handle ElevenLabs tool updates
    const hasExternalId = existingTool.external_tool_id !== null

    try {
      // Import ElevenLabs dependencies
      const { convertToolConfigToElevenLabsWebhook } = await import('@/lib/elevenlabs/tool-converter')
      const { ElevenLabsClient } = await import('@elevenlabs/elevenlabs-js')

      const elevenLabsClient = new ElevenLabsClient({
        apiKey: process.env.ELEVEN_API_KEY,
      })

      if (hasExternalId) {
        // Update existing ElevenLabs tool using PATCH API
        console.log('Updating ElevenLabs tool:', existingTool.external_tool_id)
        
        const elevenLabsToolData = convertToolConfigToElevenLabsWebhook(
          id,
          config,
          functionSchema as any
        )

        await elevenLabsClient.conversationalAi.tools.update(existingTool.external_tool_id, {
          toolConfig: elevenLabsToolData
        })

        console.log('ElevenLabs tool updated successfully')
      } else {
        // Create new ElevenLabs tool (shouldn't happen for tools created via UI, but handle it)
        console.log('Creating missing ElevenLabs tool')
        const elevenLabsToolData = convertToolConfigToElevenLabsWebhook(
          id,
          config,
          functionSchema as any
        )

        const newTool = await elevenLabsClient.conversationalAi.tools.create({
          toolConfig: elevenLabsToolData
        })

        existingTool.external_tool_id = newTool.id
        console.log('ElevenLabs tool created:', newTool.id)
      }
    } catch (elevenLabsError) {
      console.error('Error updating ElevenLabs tool:', elevenLabsError)
      return NextResponse.json(
        { error: 'Failed to update tool in ElevenLabs. Please try again.' },
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
        attach_to_agent: config.attach_to_agent !== false,
        external_tool_id: existingTool.external_tool_id, // May have been updated above
        provider: 'elevenlabs',
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

    // Verify tool belongs to organization before deletion
    const { data: tool, error: fetchError } = await supabase
      .from('tools')
      .select('id')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single()

    if (fetchError || !tool) {
      return NextResponse.json(
        { error: 'Tool not found' },
        { status: 404 }
      )
    }

    // Use the deleteToolWithCleanup function which handles:
    // - Removing tool from all agents in ElevenLabs
    // - Deleting tool from ElevenLabs
    // - Deleting tool from database (CASCADE handles agent_tools)
    const { deleteToolWithCleanup } = await import('@/lib/tools')
    
    try {
      await deleteToolWithCleanup(id)
      console.log('Tool deleted:', id)
      return NextResponse.json({ success: true })
    } catch (deleteError) {
      console.error('Error deleting tool:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete tool' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in /api/[organizationId]/tools/[id] DELETE:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

