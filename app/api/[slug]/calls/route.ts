import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { getCallsByOrganization } from '@/lib/calls'

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

    const calls = await getCallsByOrganization(organizationId)
    return NextResponse.json({ calls })
  } catch (error) {
    console.error('Error fetching calls:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch calls' },
      { status: 500 }
    )
  }
}

