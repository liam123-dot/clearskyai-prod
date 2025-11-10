import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthSession } from '@/lib/auth'
import { generateToolLLMPrompt } from '@/lib/tools/llm-prompt'

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

    // Generate the LLM prompt for the tool
    const markdownPrompt = await generateToolLLMPrompt(tool)

    return NextResponse.json({ prompt: markdownPrompt })
  } catch (error) {
    console.error('Error in /api/[slug]/tools/[id]/llm-prompt GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

