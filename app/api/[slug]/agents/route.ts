import { NextRequest, NextResponse } from 'next/server'
import { getAgentsByOrganization } from '@/lib/vapi/agents'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    // Get organization ID from slug
    const supabase = await createServiceClient()
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .select('id')
      .eq('slug', slug)
      .single()

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Get agents for this organization
    const agents = await getAgentsByOrganization(org.id)
    
    return NextResponse.json(agents)
  } catch (error) {
    console.error('Error fetching agents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    )
  }
}
