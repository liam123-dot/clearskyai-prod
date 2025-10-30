import { NextRequest, NextResponse } from 'next/server'

import { getKnowledgeBase, getProperties } from '@/lib/knowledge-bases'
import { getAuthSession } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params
    const { organizationId, organisation } = await getAuthSession(slug)

    if (!organizationId || !organisation) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const knowledgeBase = await getKnowledgeBase(id)

    if (!knowledgeBase) {
      return NextResponse.json(
        { error: 'Knowledge base not found' },
        { status: 404 }
      )
    }

    // Verify the knowledge base belongs to this organization
    if (knowledgeBase.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'Knowledge base does not belong to this organization' },
        { status: 404 }
      )
    }

    // Get properties if it's an estate_agent knowledge base
    let properties: Awaited<ReturnType<typeof getProperties>> = []
    if (knowledgeBase.type === 'estate_agent') {
      properties = await getProperties(id)
    }

    return NextResponse.json({
      ...knowledgeBase,
      properties,
    })
  } catch (error) {
    console.error('Error in GET /api/[slug]/knowledge-bases/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to fetch knowledge base' },
      { status: 500 }
    )
  }
}

