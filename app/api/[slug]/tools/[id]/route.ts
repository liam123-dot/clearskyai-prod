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

    // Update VAPI tool first
    try {
      // Build VAPI tool data
      const vapiToolData = convertToolConfigToVapiApiRequest(
        id,
        config,
        functionSchema
      )

      // Remove 'type' field for updates - VAPI update API doesn't accept it
      const { type, ...updateData } = vapiToolData

      console.log('Updating VAPI tool:', existingTool.external_tool_id)

      // Update the VAPI tool
      await vapiClient.tools.update(existingTool.external_tool_id, updateData as any)

      console.log('VAPI tool updated successfully')
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

    // Delete from VAPI first
    try {
      console.log('Deleting VAPI tool:', tool.external_tool_id)
      await vapiClient.tools.delete(tool.external_tool_id)
      console.log('VAPI tool deleted successfully')
    } catch (vapiError) {
      console.error('Error deleting VAPI tool:', vapiError)
      // Continue with DB deletion even if VAPI deletion fails
      // This handles cases where the VAPI tool might already be deleted
    }

    // Delete from DB
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

