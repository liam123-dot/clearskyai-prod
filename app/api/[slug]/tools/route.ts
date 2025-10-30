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
  params: Promise<{ slug: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug: slugFromUrl } = await context.params
    const { user, organizationId } = await getAuthSession(slugFromUrl)

    if (!user || !organizationId) {
      return NextResponse.json(
        { error: 'Not authenticated or unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createClient()

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

    // Generate unique tool name
    const baseName = config.name || generateToolName(config.label)
    let toolName = baseName
    let increment = 2

    while (true) {
      const { data: existing } = await supabase
        .from('tools')
        .select('id')
        .eq('name', toolName)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (!existing) break

      toolName = `${baseName}_${increment}`
      increment++
    }

    // Build function schema and static config
    const functionSchema = buildFunctionSchema({ ...config, name: toolName })
    const staticConfig = buildStaticConfig(config)

    console.log('Creating tool:', {
      name: toolName,
      type: config.type,
      label: config.label,
      functionSchema: JSON.stringify(functionSchema, null, 2),
    })

    // Step 1: Create tool in VAPI first with a temporary callback URL
    // We'll use a placeholder ID that we'll update after DB creation
    let vapiTool: any = null
    
    try {
      // Build VAPI tool data with a temporary placeholder ID
      // We'll use a UUID that we'll assign to the DB record
      const tempDbId = crypto.randomUUID()
      
      const vapiToolData = convertToolConfigToVapiApiRequest(
        tempDbId,
        config,
        functionSchema
      )

      console.log('Creating VAPI tool:', JSON.stringify(vapiToolData, null, 2))

      // Create the tool in VAPI first
      vapiTool = await vapiClient.tools.create(vapiToolData as any)

      console.log('VAPI tool created:', vapiTool.id)

      // Step 2: Create DB record with the VAPI tool data
      const { data: tool, error: createError } = await supabase
        .from('tools')
        .insert({
          id: tempDbId, // Use the same UUID we used in the callback URL
          name: toolName,
          label: config.label,
          description: config.description,
          type: config.type,
          function_schema: functionSchema,
          static_config: staticConfig,
          config_metadata: config,
          async: config.async || false,
          organization_id: organizationId,
          external_tool_id: vapiTool.id,
          data: vapiTool, // Store the full VAPI tool object
        })
        .select()
        .single()

      if (createError || !tool) {
        console.error('Error creating tool in DB:', createError)
        
        // Rollback: Delete the VAPI tool
        try {
          await vapiClient.tools.delete(vapiTool.id)
          console.log('Rolled back VAPI tool:', vapiTool.id)
        } catch (rollbackError) {
          console.error('Error rolling back VAPI tool:', rollbackError)
        }

        return NextResponse.json(
          { error: 'Failed to create tool in database' },
          { status: 500 }
        )
      }

      console.log('Tool created successfully:', tool.id)
      return NextResponse.json({ tool }, { status: 201 })
    } catch (error) {
      console.error('Error in tool creation:', error)

      // If we have a VAPI tool, try to delete it
      if (vapiTool?.id) {
        try {
          await vapiClient.tools.delete(vapiTool.id)
          console.log('Rolled back VAPI tool:', vapiTool.id)
        } catch (rollbackError) {
          console.error('Error rolling back VAPI tool:', rollbackError)
        }
      }

      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to create tool' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in /api/[organizationId]/tools POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug: slugFromUrl } = await context.params
    const { user, organizationId } = await getAuthSession(slugFromUrl)

    if (!user || !organizationId) {
      return NextResponse.json({ tools: [] })
    }

    const supabase = await createClient()

    // Get all tools for the user's organization with their associated agents
    const { data: tools, error: toolsError } = await supabase
      .from('tools')
      .select(`
        *,
        agent_tools(
          agent_id,
          agents(id, name)
        )
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (toolsError) {
      console.error('Error fetching tools:', toolsError)
      return NextResponse.json(
        { error: 'Failed to fetch tools' },
        { status: 500 }
      )
    }

    // Transform the data to include agents in a cleaner format
    interface AgentToolRecord {
      agent_id: string
      agents: {
        id: string
        name: string
      } | null
    }

    interface ToolRecord {
      agent_tools: AgentToolRecord[]
    }

    const toolsWithAgents = (tools || []).map((tool: ToolRecord & Record<string, unknown>) => ({
      ...tool,
      agents: (tool.agent_tools || [])
        .map((at: AgentToolRecord) => ({
          id: at.agents?.id,
          name: at.agents?.name || 'Unnamed Agent'
        }))
        .filter((agent): agent is { id: string | undefined; name: string } => agent.id !== undefined)
    }))

    console.log('Tools with agents:', JSON.stringify(toolsWithAgents, null, 2))

    return NextResponse.json({ success: true, tools: toolsWithAgents })
  } catch (error) {
    console.error('Error in /api/[organizationId]/tools GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

