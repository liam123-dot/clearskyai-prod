import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { getKnowledgeBase, getProperties, updateKnowledgeBase } from '@/lib/knowledge-bases'
import { extractLocationKeywords } from '@/lib/property-prompt'

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

    // Only estate agent knowledge bases have location data
    if (knowledgeBase.type !== 'estate_agent') {
      return NextResponse.json(
        { error: 'Only estate agent knowledge bases have location data' },
        { status: 400 }
      )
    }

    // Check if location_data is already cached
    if (knowledgeBase.location_data) {
      return NextResponse.json({
        locationData: knowledgeBase.location_data,
        cached: true,
      })
    }

    // If not cached, extract from properties
    const properties = await getProperties(id)
    
    if (properties.length === 0) {
      return NextResponse.json({
        locationData: {
          cities: [],
          districts: [],
          subDistricts: [],
          postcodeDistricts: [],
          streets: [],
          allKeywords: [],
        },
        cached: false,
      })
    }

    const locationKeywords = await extractLocationKeywords(properties)

    // Save to database for future use
    try {
      await updateKnowledgeBase(id, {
        location_data: locationKeywords,
      })
    } catch (error) {
      console.error('Failed to save location keywords:', error)
      // Continue even if save fails
    }

    return NextResponse.json({
      locationData: locationKeywords,
      cached: false,
    })
  } catch (error) {
    console.error('Error in GET /api/[slug]/knowledge-bases/[id]/location-data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch location data' },
      { status: 500 }
    )
  }
}

