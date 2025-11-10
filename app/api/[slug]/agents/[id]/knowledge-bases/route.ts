import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import {
  assignKnowledgeBaseToAgent,
  unassignKnowledgeBaseFromAgent,
  getAgentKnowledgeBases,
} from '@/lib/knowledge-bases'

interface RouteContext {
  params: Promise<{
    slug: string
    id: string
  }>
}

/**
 * GET /api/[slug]/agents/[id]/knowledge-bases
 * Get all knowledge bases assigned to an agent
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { slug, id: agentId } = await context.params
    
    // Verify user has access to this organization
    await getAuthSession(slug)

    const knowledgeBases = await getAgentKnowledgeBases(agentId)

    return NextResponse.json({ knowledgeBases }, { status: 200 })
  } catch (error) {
    console.error('Error fetching agent knowledge bases:', error)
    return NextResponse.json(
      { error: 'Failed to fetch agent knowledge bases' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/[slug]/agents/[id]/knowledge-bases
 * Assign a knowledge base to an agent
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { slug, id: agentId } = await context.params
    
    // Verify user has access to this organization
    await getAuthSession(slug)

    const body = await request.json()
    const { knowledge_base_id } = body

    if (!knowledge_base_id) {
      return NextResponse.json(
        { error: 'knowledge_base_id is required' },
        { status: 400 }
      )
    }

    await assignKnowledgeBaseToAgent(agentId, knowledge_base_id)

    return NextResponse.json(
      { message: 'Knowledge base assigned successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error assigning knowledge base to agent:', error)
    return NextResponse.json(
      { error: 'Failed to assign knowledge base to agent' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/[slug]/agents/[id]/knowledge-bases
 * Unassign a knowledge base from an agent
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { slug, id: agentId } = await context.params
    
    // Verify user has access to this organization
    await getAuthSession(slug)

    const body = await request.json()
    const { knowledge_base_id } = body

    if (!knowledge_base_id) {
      return NextResponse.json(
        { error: 'knowledge_base_id is required' },
        { status: 400 }
      )
    }

    await unassignKnowledgeBaseFromAgent(agentId, knowledge_base_id)

    return NextResponse.json(
      { message: 'Knowledge base unassigned successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error unassigning knowledge base from agent:', error)
    return NextResponse.json(
      { error: 'Failed to unassign knowledge base from agent' },
      { status: 500 }
    )
  }
}

