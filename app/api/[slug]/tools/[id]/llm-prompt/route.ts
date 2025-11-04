import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthSession } from '@/lib/auth'
import { generatePropertyQueryPrompt } from '@/lib/property-prompt'

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

function extractKnowledgeBaseIdFromUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null
  
  // URL format: /api/query/estate-agent/{knowledgeBaseId}
  const match = url.match(/\/api\/query\/estate-agent\/([^/]+)/)
  return match ? match[1] : null
}

async function fetchEstateAgentPrompt(knowledgeBaseId: string): Promise<string | null> {
  try {
    const { prompt } = await generatePropertyQueryPrompt(knowledgeBaseId)
    return prompt || null
  } catch (error) {
    console.error('Error fetching estate agent prompt:', error)
    return null
  }
}

function formatMarkdownPrompt(
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
      .select('name, description, function_schema, type, data')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single()

    if (toolError || !tool) {
      return NextResponse.json(
        { error: 'Tool not found' },
        { status: 404 }
      )
    }

    // For query tools, fetch the estate agent prompt
    let estateAgentPrompt: string | null = null
    if (tool.type === 'query' && tool.data) {
      const data = tool.data as { url?: string }
      const knowledgeBaseId = extractKnowledgeBaseIdFromUrl(data.url)
      if (knowledgeBaseId) {
        estateAgentPrompt = await fetchEstateAgentPrompt(knowledgeBaseId)
      }
    }

    // Format the tool data into Markdown
    const markdownPrompt = formatMarkdownPrompt(tool, estateAgentPrompt)

    return NextResponse.json({ prompt: markdownPrompt })
  } catch (error) {
    console.error('Error in /api/[slug]/tools/[id]/llm-prompt GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

