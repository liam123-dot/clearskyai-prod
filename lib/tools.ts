import { createClient } from './supabase/server'
import { createServiceClient } from './supabase/server'
import { vapiClient } from './vapi/VapiClients'
import { formatLabelForDisplay } from './utils'

export type ToolType = 'query' | 'sms' | 'apiRequest' | 'transferCall' | 'externalApp' | 'pipedream_action'

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
  label?: string
): Promise<Tool> {
  const supabase = await createServiceClient()

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
  const supabase = await createClient()

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
  const supabase = await createServiceClient()

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
  const supabase = await createClient()

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
  const supabase = await createServiceClient()

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
  const supabase = await createServiceClient()

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
  const supabase = await createServiceClient()

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
 * Gets all tools across all organizations (for admin use)
 */
export async function getAllTools(): Promise<Tool[]> {
  const supabase = await createServiceClient()

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
 * Gets or creates tools for an agent based on their VAPI toolIds
 * Auto-creates DB records for tools that don't exist yet
 */
export async function getOrCreateAgentTools(
  agentId: string,
  toolIds: string[]
): Promise<Tool[]> {
  const supabase = await createServiceClient()
  
  // Get the agent to access organization
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('organization_id')
    .eq('id', agentId)
    .single()

  if (agentError || !agent) {
    throw new Error('Failed to fetch agent data')
  }

  const tools: Tool[] = []

  for (const toolId of toolIds) {
    // Check if tool exists in DB
    let tool = await getToolByExternalId(toolId)
    
    if (!tool) {
      // Tool doesn't exist, fetch from VAPI and create
      try {
        const vapiTool = await vapiClient.tools.get(toolId)
        const toolType = inferToolType(vapiTool)
        const toolLabel = inferToolName(vapiTool)
        
        // Use function name as the database name (not the display label)
        let toolName = toolId
        if ('function' in vapiTool && vapiTool.function?.name) {
          toolName = vapiTool.function.name
        } else if ('name' in vapiTool && vapiTool.name) {
          toolName = vapiTool.name
        }
        
        tool = await createTool(
          agent.organization_id,
          toolId,
          toolType,
          toolName,
          vapiTool,
          toolLabel
        )
      } catch (error) {
        console.error(`Error fetching/creating tool ${toolId}:`, error)
        // Skip this tool if we can't fetch it
        continue
      }
    }
    
    tools.push(tool)
  }

  return tools
}

/**
 * Gets all tools attached to an agent and syncs with VAPI state
 * This function reconciles VAPI toolIds with agent_tools table
 */
export async function getAgentTools(agentId: string): Promise<Tool[]> {
  const supabase = await createServiceClient()
  
  // Get agent and VAPI assistant
  const { data: agent } = await supabase
    .from('agents')
    .select('vapi_assistant_id, organization_id')
    .eq('id', agentId)
    .single()

  if (!agent) {
    return []
  }

  // Get tools from VAPI
  let vapiToolIds: string[] = []
  if (agent.vapi_assistant_id) {
    try {
      const assistant = await vapiClient.assistants.get(agent.vapi_assistant_id)
      vapiToolIds = assistant.model?.toolIds || []
    } catch (error) {
      console.error('Error fetching VAPI assistant:', error)
    }
  }

  // Get tools from agent_tools table
  const { data: agentToolsRecords } = await supabase
    .from('agent_tools')
    .select('tool_id, is_vapi_attached, tools!inner(external_tool_id)')
    .eq('agent_id', agentId)

  const agentToolsMap = new Map<string, { toolId: string; isVapiAttached: boolean; externalToolId: string | null }>()
  for (const record of agentToolsRecords || []) {
    const toolRecord = record as any
    agentToolsMap.set(toolRecord.tool_id, {
      toolId: toolRecord.tool_id,
      isVapiAttached: toolRecord.is_vapi_attached,
      externalToolId: toolRecord.tools?.external_tool_id || null,
    })
  }

  // Sync: Find VAPI tools not in agent_tools (is_vapi_attached=true)
  const vapiToolsToSync: string[] = []
  for (const externalToolId of vapiToolIds) {
    // Check if this external_tool_id is already in agent_tools
    const found = Array.from(agentToolsMap.values()).find(
      t => t.externalToolId === externalToolId && t.isVapiAttached
    )
    if (!found) {
      vapiToolsToSync.push(externalToolId)
    }
  }

  // Insert missing VAPI tools into agent_tools
  if (vapiToolsToSync.length > 0) {
    console.log(`Syncing ${vapiToolsToSync.length} tools from VAPI to agent_tools for agent ${agentId}`)
    for (const externalToolId of vapiToolsToSync) {
      // Get or create the tool in our database
      let tool = await getToolByExternalId(externalToolId)
      if (!tool) {
        try {
          const vapiTool = await vapiClient.tools.get(externalToolId)
          const toolType = inferToolType(vapiTool)
          const toolLabel = inferToolName(vapiTool)
          let toolName = externalToolId
          if ('function' in vapiTool && vapiTool.function?.name) {
            toolName = vapiTool.function.name
          } else if ('name' in vapiTool && vapiTool.name) {
            toolName = vapiTool.name
          }
          tool = await createTool(agent.organization_id, externalToolId, toolType, toolName, vapiTool, toolLabel)
        } catch (error) {
          console.error(`Error fetching/creating tool ${externalToolId}:`, error)
          continue
        }
      }

      // Insert into agent_tools
      const { error: insertErr } = await supabase.from('agent_tools').insert({
        agent_id: agentId,
        tool_id: tool.id,
        is_vapi_attached: true,
      })
      
      if (insertErr) {
        console.error(`Error inserting tool ${tool.id} into agent_tools:`, insertErr)
      }
    }
  }

  // Sync: Find agent_tools (is_vapi_attached=true) not in VAPI
  const staleToolIds: string[] = []
  for (const [toolId, toolData] of agentToolsMap) {
    if (toolData.isVapiAttached && toolData.externalToolId && !vapiToolIds.includes(toolData.externalToolId)) {
      staleToolIds.push(toolId)
    }
  }

  // Remove stale tools from agent_tools
  if (staleToolIds.length > 0) {
    console.log(`Removing ${staleToolIds.length} stale tools from agent_tools for agent ${agentId}`)
    const { error: deleteErr } = await supabase
      .from('agent_tools')
      .delete()
      .eq('agent_id', agentId)
      .in('tool_id', staleToolIds)
      
    if (deleteErr) {
      console.error('Error removing stale tools:', deleteErr)
    }
  }

  // Fetch all current tools from agent_tools (after sync)
  const { data: finalAgentToolsRecords } = await supabase
    .from('agent_tools')
    .select('tool_id')
    .eq('agent_id', agentId)

  const toolIds = (finalAgentToolsRecords || []).map(record => record.tool_id)
  const tools: Tool[] = []

  for (const toolId of toolIds) {
    const tool = await getTool(toolId)
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
  const supabase = await createServiceClient()

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
  const supabase = await createServiceClient()

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


