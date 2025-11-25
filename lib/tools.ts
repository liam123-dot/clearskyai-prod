import { createClient } from './supabase/server'
import { createNoCookieClient } from './supabase/serverNoCookies'
import { formatLabelForDisplay } from './utils'
import { removeToolFromVapiAgent, deleteVapiTool } from './vapi/tools'
import { removeToolFromElevenLabsAgent, deleteElevenLabsTool } from './elevenlabs/tools'

export type ToolType = 'query' | 'sms' | 'apiRequest' | 'transferCall' | 'transfer_call' | 'handoff' | 'externalApp' | 'pipedream_action'

export interface Tool {
  id: string
  name: string
  label: string | null
  description: string | null
  organization_id: string
  external_tool_id: string | null // VAPI tool ID, NULL for preemptive-only tools
  type: ToolType
  function_schema: Record<string, unknown> | null
  static_config: Record<string, unknown> | null
  config_metadata: Record<string, unknown> | null
  async: boolean | null
  execute_on_call_start: boolean | null
  attach_to_agent: boolean | null // If false, tool cannot be attached to agents and only runs preemptively
  data: any
  created_at: string
  updated_at: string
}

/**
 * Creates a new tool record in the database
 */
export async function createTool(
  organizationId: string,
  externalToolId: string,
  type: ToolType,
  name: string,
  data: any,
  label?: string,
  provider: 'vapi' | 'elevenlabs' = 'vapi'
): Promise<Tool> {
  const supabase = createNoCookieClient()

  // If no label provided, format the name for display
  const displayLabel = label || formatLabelForDisplay(name)

  const { data: tool, error } = await supabase
    .from('tools')
    .insert({
      organization_id: organizationId,
      external_tool_id: externalToolId,
      type,
      name,
      label: displayLabel,
      data,
      function_schema: {},
      static_config: {},
      config_metadata: {},
      provider,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating tool:', error)
    throw error
  }

  return tool
}

/**
 * Gets a single tool by its database ID
 */
export async function getTool(toolId: string): Promise<Tool | null> {
  const supabase = createNoCookieClient()

  const { data: tool, error } = await supabase
    .from('tools')
    .select('*')
    .eq('id', toolId)
    .single()

  if (error) {
    console.error('Error fetching tool:', error)
    return null
  }

  return tool
}

/**
 * Gets a tool by its external VAPI tool ID
 */
export async function getToolByExternalId(externalToolId: string): Promise<Tool | null> {
  const supabase = createNoCookieClient()

  const { data: tool, error } = await supabase
    .from('tools')
    .select('*')
    .eq('external_tool_id', externalToolId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null
    }
    console.error('Error fetching tool by external ID:', error)
    return null
  }

  return tool
}

/**
 * Gets all tools for an organization
 */
export async function getToolsByOrganization(organizationId: string): Promise<Tool[]> {
  const supabase = createNoCookieClient()

  const { data: tools, error } = await supabase
    .from('tools')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching tools:', error)
    throw error
  }

  return tools || []
}

/**
 * Updates a tool's data
 */
export async function updateTool(
  toolId: string,
  updates: {
    name?: string
    type?: ToolType
    data?: any
  }
): Promise<Tool> {
  const supabase = createNoCookieClient()

  const { data: tool, error } = await supabase
    .from('tools')
    .update(updates)
    .eq('id', toolId)
    .select()
    .single()

  if (error) {
    console.error('Error updating tool:', error)
    throw error
  }

  return tool
}

/**
 * Deletes a tool from the database
 */
export async function deleteTool(toolId: string): Promise<void> {
  const supabase = createNoCookieClient()

  const { error } = await supabase
    .from('tools')
    .delete()
    .eq('id', toolId)

  if (error) {
    console.error('Error deleting tool:', error)
    throw error
  }
}

/**
 * Deletes a tool by its external VAPI tool ID
 */
export async function deleteToolByExternalId(externalToolId: string): Promise<void> {
  const supabase = createNoCookieClient()

  const { error } = await supabase
    .from('tools')
    .delete()
    .eq('external_tool_id', externalToolId)

  if (error) {
    console.error('Error deleting tool by external ID:', error)
    throw error
  }
}

/**
 * Deletes a tool with full cleanup (removes from provider and all agents)
 * This function handles the complete deletion process including:
 * - Removing tool from all agents in the provider (Vapi or ElevenLabs)
 * - Deleting tool from the provider
 * - Deleting tool from database (CASCADE handles agent_tools)
 */
export async function deleteToolWithCleanup(toolId: string): Promise<void> {
  const supabase = createNoCookieClient()

  // Get the tool to retrieve its external_tool_id and provider
  const { data: tool, error: fetchError } = await supabase
    .from('tools')
    .select('external_tool_id, provider')
    .eq('id', toolId)
    .single()

  if (fetchError || !tool) {
    throw new Error('Tool not found')
  }

  // Find all agents with this tool attached via agent_tools
  const { data: agentToolsRecords, error: agentToolsError } = await supabase
    .from('agent_tools')
    .select('agent_id, is_vapi_attached, agents!inner(external_agent_id, provider)')
    .eq('tool_id', toolId)

  if (agentToolsError) {
    console.error('Error fetching agent_tools:', agentToolsError)
    throw agentToolsError
  }

  const toolProvider = tool.provider || 'vapi'

  // Remove tool from all agents based on provider
  if (tool.external_tool_id && agentToolsRecords && agentToolsRecords.length > 0) {
    console.log(`Removing tool ${toolId} from ${agentToolsRecords.length} agent(s) (provider: ${toolProvider})`)
    
    for (const record of agentToolsRecords) {
      const agentRecord = record as any
      const agentExternalId = agentRecord.agents?.external_agent_id
      const agentProvider = agentRecord.agents?.provider

      // Skip if agent provider doesn't match tool provider
      if (!agentExternalId || agentProvider !== toolProvider) {
        console.warn(`Agent ${agentRecord.agent_id} provider (${agentProvider}) doesn't match tool provider (${toolProvider})`)
        continue
      }

      // Skip preemptive-only tools for Vapi
      if (toolProvider === 'vapi' && !agentRecord.is_vapi_attached) {
        continue
      }

      try {
        if (toolProvider === 'vapi') {
          await removeToolFromVapiAgent(agentExternalId, tool.external_tool_id)
        } else if (toolProvider === 'elevenlabs') {
          await removeToolFromElevenLabsAgent(agentExternalId, tool.external_tool_id)
        }
      } catch (error) {
        // Provider modules handle 404s gracefully, but other errors should propagate
        // Log and continue with other agents
        console.error(`Error removing tool from agent ${agentRecord.agent_id}:`, error)
        // Don't throw - continue with other agents and tool deletion
      }
    }
  }

  // Delete tool from provider (only if tool has external_tool_id)
  if (tool.external_tool_id) {
    try {
      if (toolProvider === 'vapi') {
        await deleteVapiTool(tool.external_tool_id)
      } else if (toolProvider === 'elevenlabs') {
        await deleteElevenLabsTool(tool.external_tool_id)
      }
    } catch (error) {
      // Provider modules handle 404s gracefully
      // Log error but continue with DB deletion
      console.error(`Error deleting ${toolProvider} tool:`, error)
      // Continue with DB deletion even if provider deletion fails
    }
  } else {
    console.log('No external tool to delete (preemptive-only tool)')
  }

  // Delete from DB (CASCADE will handle agent_tools deletion)
  const { error: deleteError } = await supabase
    .from('tools')
    .delete()
    .eq('id', toolId)

  if (deleteError) {
    console.error('Error deleting tool from DB:', deleteError)
    throw deleteError
  }

  console.log('Tool deleted:', toolId)
}

/**
 * Gets all tools across all organizations (for admin use)
 */
export async function getAllTools(): Promise<Tool[]> {
  const supabase = createNoCookieClient()

  const { data: tools, error } = await supabase
    .from('tools')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching all tools:', error)
    throw error
  }

  return tools || []
}

/**
 * DEPRECATED: Only used for Vapi auto-fetch, which is removed
 * Infers the tool type from VAPI tool data
 */
export function inferToolType(vapiTool: any): ToolType {
  const functionName = vapiTool.function?.name || ''
  
  // Check for query tools (query_{kb_name})
  if (functionName.startsWith('query_')) {
    return 'query'
  }
  
  // Check for external app tools (external_app_{name})
  if (functionName.startsWith('external_app_')) {
    return 'externalApp'
  }
  
  // Map VAPI type to our DB type
  switch (vapiTool.type) {
    case 'sms':
      return 'sms'
    case 'apiRequest':
      return 'apiRequest'
    case 'transferCall':
      return 'transferCall'
    default:
      return 'apiRequest' // Default fallback
  }
}

/**
 * DEPRECATED: Only used for Vapi auto-fetch, which is removed
 * Infers a friendly tool name from VAPI tool data
 */
export function inferToolName(vapiTool: any): string {
  const functionName = vapiTool.function?.name || ''
  
  // Query tools: query_{kb_name} → {Knowledge Base Name} Query
  if (functionName.startsWith('query_')) {
    const kbName = functionName.replace('query_', '').replace(/_props$/, '')
    const formatted = formatLabelForDisplay(kbName)
    return `${formatted} Query`
  }
  
  // External app tools: external_app_{name} → {Name}
  if (functionName.startsWith('external_app_')) {
    const appName = functionName.replace('external_app_', '')
    return formatLabelForDisplay(appName)
  }
  
  // Use existing name or function name, formatted if it contains underscores
  const rawName = vapiTool.name || vapiTool.function?.name || vapiTool.id
  if (rawName.includes('_')) {
    return formatLabelForDisplay(rawName)
  }
  return rawName
}


/**
 * Gets all tools attached to an agent from the database
 * Tools are only created from the UI, no auto-sync with provider
 */
export async function getAgentTools(agentId: string): Promise<Tool[]> {
  const supabase = createNoCookieClient()
  
  // Fetch all tools from agent_tools table
  const { data: agentToolsRecords, error } = await supabase
    .from('agent_tools')
    .select('tool_id')
    .eq('agent_id', agentId)

  if (error) {
    console.error('Error fetching agent_tools:', error)
    return []
  }

  const tools: Tool[] = []
  for (const record of agentToolsRecords || []) {
    const tool = await getTool(record.tool_id)
    if (tool) {
      tools.push(tool)
    }
  }

  return tools
}

/**
 * Checks if a tool is attached to an agent
 * Uses agent_tools table as the single source of truth
 */
export async function isToolAttachedToAgent(
  agentId: string,
  toolId: string
): Promise<boolean> {
  const supabase = createNoCookieClient()

  // Check agent_tools table
  const { data: agentTool, error: agentToolError } = await supabase
    .from('agent_tools')
    .select('id')
    .eq('agent_id', agentId)
    .eq('tool_id', toolId)
    .maybeSingle()

  if (agentToolError) {
    console.error('Error checking agent_tools:', agentToolError)
    return false
  }

  return !!agentTool
}

/**
 * Gets tools attached via agent_tools table (non-VAPI attached)
 */
export async function getAgentToolsFromTable(agentId: string): Promise<Tool[]> {
  const supabase = createNoCookieClient()

  const { data: agentToolsRecords, error } = await supabase
    .from('agent_tools')
    .select('tool_id')
    .eq('agent_id', agentId)

  if (error) {
    console.error('Error fetching agent_tools:', error)
    return []
  }

  const tools: Tool[] = []
  for (const record of agentToolsRecords || []) {
    const tool = await getTool(record.tool_id)
    if (tool) {
      tools.push(tool)
    }
  }

  return tools
}


