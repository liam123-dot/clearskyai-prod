import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import {
  getKnowledgeBases,
  createKnowledgeBase,
  type KnowledgeBaseType,
  type EstateAgentKnowledgeBaseData,
  type GeneralKnowledgeBaseData,
} from '@/lib/knowledge-bases'
import { tasks } from '@trigger.dev/sdk/v3'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { organizationId, organisation } = await getAuthSession(slug)

    if (!organizationId || !organisation) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const knowledgeBases = await getKnowledgeBases(organizationId)
    return NextResponse.json(knowledgeBases)
  } catch (error) {
    console.error('Error in GET /api/[slug]/knowledge-bases:', error)
    return NextResponse.json(
      { error: 'Failed to fetch knowledge bases' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { organizationId, organisation } = await getAuthSession(slug)

    if (!organizationId || !organisation) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { name, type, data } = body

    // Validate required fields
    if (!name || !type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      )
    }

    // Validate type
    if (type !== 'general' && type !== 'estate_agent') {
      return NextResponse.json(
        { error: 'Invalid knowledge base type' },
        { status: 400 }
      )
    }

    // Create the knowledge base
    const knowledgeBase = await createKnowledgeBase({
      name,
      type: type as KnowledgeBaseType,
      data: (data || {}) as EstateAgentKnowledgeBaseData | GeneralKnowledgeBaseData,
      organization_id: organizationId,
    })

    // Trigger Rightmove scraper for estate agent knowledge bases
    if (type === 'estate_agent') {
      try {
        await tasks.trigger('scrape-rightmove', {
          knowledgeBaseId: knowledgeBase.id,
        })
        console.log('Triggered Rightmove scraper for knowledge base:', knowledgeBase.id)
      } catch (error) {
        console.error('Failed to trigger Rightmove scraper:', error)
        // Don't fail the request if trigger fails
      }
    }

    return NextResponse.json(knowledgeBase, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/[slug]/knowledge-bases:', error)
    return NextResponse.json(
      { error: 'Failed to create knowledge base' },
      { status: 500 }
    )
  }
}

