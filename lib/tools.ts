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
  external_tool_id: string
  type: ToolType
  function_schema: Record<string, unknown> | null
  static_config: Record<string, unknown> | null
  config_metadata: Record<string, unknown> | null
  async: boolean | null
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

