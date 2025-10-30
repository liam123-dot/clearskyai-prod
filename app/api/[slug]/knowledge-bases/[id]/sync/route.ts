import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { getKnowledgeBase } from '@/lib/knowledge-bases'
import { tasks } from '@trigger.dev/sdk/v3'

export async function POST(
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

    // Only estate agent knowledge bases can be synced
    if (knowledgeBase.type !== 'estate_agent') {
      return NextResponse.json(
        { error: 'Only estate agent knowledge bases can be synced' },
        { status: 400 }
      )
    }

    // Trigger the scraper
    const handle = await tasks.trigger('scrape-rightmove', {
      knowledgeBaseId: id,
    })

    return NextResponse.json({
      success: true,
      taskId: handle.id,
      message: 'Sync started successfully',
    })
  } catch (error) {
    console.error('Error in POST /api/[slug]/knowledge-bases/[id]/sync:', error)
    return NextResponse.json(
      { error: 'Failed to start sync' },
      { status: 500 }
    )
  }
}

