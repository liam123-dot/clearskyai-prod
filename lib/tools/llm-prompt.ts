import { generatePropertyQueryPrompt } from '@/lib/property-prompt'

/**
 * Extracts knowledge base ID from tool URL
 */
export function extractKnowledgeBaseIdFromUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null
  
  // URL format: /api/query/estate-agent/{knowledgeBaseId}
  const match = url.match(/\/api\/query\/estate-agent\/([^/]+)/)
  return match ? match[1] : null
}

/**
 * Fetches the estate agent prompt for a knowledge base
 */
export async function fetchEstateAgentPrompt(knowledgeBaseId: string): Promise<string | null> {
  try {
    const { prompt } = await generatePropertyQueryPrompt(knowledgeBaseId)
    return prompt || null
  } catch (error) {
    console.error('Error fetching estate agent prompt:', error)
    return null
  }
}

/**
 * Formats a tool's LLM prompt in markdown format
 */
export function formatMarkdownPrompt(
  tool: {
    name: string
    description: string | null
    function_schema: Record<string, unknown> | null
    type: string
    data?: Record<string, unknown> | null
  },
  estateAgentPrompt?: string | null
): string {
  const lines: string[] = []
  
  // Tool name as heading
  lines.push(`# Tool: ${tool.name}`)
  lines.push('')
  
  // Description section
  lines.push('## Description')
  if (tool.type === 'query' && estateAgentPrompt) {
    // For query tools, use the estate agent prompt
    lines.push(estateAgentPrompt)
  } else if (tool.description) {
    lines.push(tool.description)
  } else {
    lines.push('No description provided.')
  }
  lines.push('')
  
  // Parameters section
  if (tool.function_schema && typeof tool.function_schema === 'object') {
    const schema = tool.function_schema as {
      parameters?: {
        properties?: Record<string, {
          type?: string
          description?: string
        }>
        required?: string[]
      }
    }
    
    if (schema.parameters?.properties) {
      lines.push('## Parameters')
      const properties = schema.parameters.properties
      const required = schema.parameters.required || []
      
      for (const [paramName, paramDef] of Object.entries(properties)) {
        const type = paramDef.type || 'unknown'
        const description = paramDef.description || 'No description provided.'
        const isRequired = required.includes(paramName)
        const requiredMarker = isRequired ? ' (required)' : ''
        
        lines.push(`- **${paramName}** (${type})${requiredMarker}: ${description}`)
      }
      lines.push('')
    }
  }
  
  return lines.join('\n')
}

/**
 * Generates the full LLM prompt for a tool, including fetching estate agent prompts for query tools
 */
export async function generateToolLLMPrompt(
  tool: {
    name: string
    description: string | null
    function_schema: Record<string, unknown> | null
    type: string
    data?: Record<string, unknown> | null
  }
): Promise<string> {
  // For query tools, fetch the estate agent prompt
  let estateAgentPrompt: string | null = null
  if (tool.type === 'query' && tool.data) {
    const data = tool.data as { url?: string }
    const knowledgeBaseId = extractKnowledgeBaseIdFromUrl(data.url)
    if (knowledgeBaseId) {
      estateAgentPrompt = await fetchEstateAgentPrompt(knowledgeBaseId)
    }
  }

  return formatMarkdownPrompt(tool, estateAgentPrompt)
}

