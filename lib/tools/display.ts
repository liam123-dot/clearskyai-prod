import { Tool, ToolType } from '@/lib/tools'
import { PipedreamActionToolConfig } from '@/lib/tools/types'

/**
 * Returns the CSS classes for tool type badge colors
 */
export function getToolTypeBadgeColor(type: ToolType): string {
  switch (type) {
    case 'query':
      return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'sms':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'apiRequest':
      return 'bg-green-50 text-green-700 border-green-200'
    case 'transferCall':
      return 'bg-orange-50 text-orange-700 border-orange-200'
    case 'externalApp':
      return 'bg-slate-50 text-slate-700 border-slate-200'
    case 'pipedream_action':
      return 'bg-slate-50 text-slate-700 border-slate-200'
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200'
  }
}

/**
 * Returns a human-readable label for a tool type
 * For Pipedream actions, includes app and action name
 */
export function getToolTypeLabel(type: ToolType, tool?: Tool): string {
  // For Pipedream actions, show app name and action name
  if (type === 'pipedream_action' && tool?.config_metadata) {
    const config = tool.config_metadata as unknown as PipedreamActionToolConfig
    if (config.pipedreamMetadata?.appName && config.pipedreamMetadata?.actionName) {
      return `${config.pipedreamMetadata.appName} - ${config.pipedreamMetadata.actionName}`
    }
  }
  
  // For other types, use standard labels
  switch (type) {
    case 'query':
      return 'Query'
    case 'sms':
      return 'SMS'
    case 'apiRequest':
      return 'API Request'
    case 'transferCall':
      return 'Transfer Call'
    case 'externalApp':
      return 'External App'
    default:
      return type
  }
}

/**
 * Returns the image source URL for a tool, if available
 * Currently only supports Pipedream action app images
 */
export function getToolImageSrc(tool: Tool): string | null {
  if (tool.type === 'pipedream_action' && tool.config_metadata) {
    const config = tool.config_metadata as unknown as PipedreamActionToolConfig
    return config.pipedreamMetadata?.appImgSrc || null
  }
  return null
}

/**
 * Checks if a tool is a knowledge-base tool (estate agent query tool)
 * Knowledge-base tools have type 'query' and their data.url matches /api/query/estate-agent/{id}
 */
export function isKnowledgeBaseTool(tool: Tool): boolean {
  if (tool.type !== 'query') {
    return false
  }
  
  if (!tool.data || typeof tool.data !== 'object') {
    return false
  }
  
  const data = tool.data as { url?: string }
  if (!data.url || typeof data.url !== 'string') {
    return false
  }
  
  // Check if URL matches the estate agent query endpoint pattern
  return /\/api\/query\/estate-agent\//.test(data.url)
}

