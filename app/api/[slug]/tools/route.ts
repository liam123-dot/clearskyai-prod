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

    // Skip native tools (not implemented for ElevenLabs yet)
    const isNativeTool = config.type === 'transfer_call' || config.type === 'handoff'
    if (isNativeTool) {
      return NextResponse.json(
        { error: 'Native tools (handoff, transfer_call) are not supported yet' },
        { status: 400 }
      )
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

    // Step 1: Create tool in ElevenLabs first
    let elevenLabsTool: any = null
    
    try {
      // Build ElevenLabs tool data with a temporary placeholder ID
      const tempDbId = crypto.randomUUID()
      
      // Import ElevenLabs dependencies
      const { convertToolConfigToElevenLabsWebhook } = await import('@/lib/elevenlabs/tool-converter')
      const { ElevenLabsClient } = await import('@elevenlabs/elevenlabs-js')

      const elevenLabsClient = new ElevenLabsClient({
        apiKey: process.env.ELEVEN_API_KEY,
      })

      const elevenLabsToolData = convertToolConfigToElevenLabsWebhook(
        tempDbId,
        config,
        functionSchema as any
      )

      console.log('Creating ElevenLabs tool:', JSON.stringify(elevenLabsToolData, null, 2))

      // Create the tool in ElevenLabs
      elevenLabsTool = await elevenLabsClient.conversationalAi.tools.create({
        toolConfig: elevenLabsToolData
      })

      console.log('ElevenLabs tool created:', elevenLabsTool.id)

      // Step 2: Create DB record with the ElevenLabs tool data
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
          execute_on_call_start: config.execute_on_call_start || false,
          attach_to_agent: config.attach_to_agent !== false,
          organization_id: organizationId,
          external_tool_id: elevenLabsTool.id,
          provider: 'elevenlabs',
          data: elevenLabsTool,
        })
        .select()
        .single()

      if (createError || !tool) {
        console.error('Error creating tool in DB:', createError)
        
        // Rollback: Delete the ElevenLabs tool
        if (elevenLabsTool?.id) {
          try {
            await elevenLabsClient.conversationalAi.tools.delete(elevenLabsTool.id)
            console.log('Rolled back ElevenLabs tool:', elevenLabsTool.id)
          } catch (rollbackError) {
            console.error('Error rolling back ElevenLabs tool:', rollbackError)
          }
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

      // If we have an ElevenLabs tool, try to delete it
      if (elevenLabsTool?.id) {
        try {
          const { ElevenLabsClient } = await import('@elevenlabs/elevenlabs-js')
          const elevenLabsClient = new ElevenLabsClient({
            apiKey: process.env.ELEVEN_API_KEY,
          })
          await elevenLabsClient.conversationalAi.tools.delete(elevenLabsTool.id)
          console.log('Rolled back ElevenLabs tool:', elevenLabsTool.id)
        } catch (rollbackError) {
          console.error('Error rolling back ElevenLabs tool:', rollbackError)
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

