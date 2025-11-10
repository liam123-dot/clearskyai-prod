import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { getAgentTools } from '@/lib/tools'

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params
    const { user, organizationId } = await getAuthSession(slug)

    if (!user || !organizationId) {
      return NextResponse.json(
        { error: 'Not authenticated or unauthorized' },
        { status: 401 }
      )
    }

    const allTools = await getAgentTools(id)
    
    // Filter out query tools (knowledge-base tools are handled separately)
    const tools = allTools.filter(tool => tool.type !== 'query')

    return NextResponse.json({ tools })
  } catch (error) {
    console.error('Error in /api/[slug]/agents/[id]/tools GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

