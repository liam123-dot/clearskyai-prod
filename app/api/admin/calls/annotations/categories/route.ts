import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/(admin)/lib/admin-auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const supabase = await createClient()

    // Get all unique issue categories from all annotations
    const { data: annotations, error } = await supabase
      .from('call_annotations')
      .select('issue_category')

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

