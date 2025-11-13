import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { organizationId } = await getAuthSession(slug)

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const supabase = await createClient()

    // Get unique issue categories for this organization's annotations
    const { data: annotations, error } = await supabase
      .from('call_annotations')
      .select('issue_category')
      .eq('organization_id', organizationId)
      .eq('created_by_admin', false)

    if (error) {
      throw error
    }

    // Extract unique categories
    const categories = [...new Set(annotations?.map(a => a.issue_category) || [])]
      .filter(Boolean)
      .sort()

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

