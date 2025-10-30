import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { pipedreamClient, isPipedreamConfigured } from '@/lib/pipedream/client'

type RouteContext = {
  params: Promise<{ slug: string }>
}

/**
 * Search for available Pipedream apps
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug: slugFromUrl } = await context.params

    // Check if Pipedream is configured
    if (!isPipedreamConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Pipedream credentials not configured', apps: [] },
        { status: 500 }
      )
    }

    // Get authenticated user and organization (for authorization)
    const { user, organizationId } = await getAuthSession(slugFromUrl)
    
    if (!user || !organizationId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated or unauthorized', apps: [] },
        { status: 401 }
      )
    }

    // Get search query from URL parameters
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''

    // Search for apps using the Pipedream API
    const results = await pipedreamClient.apps.list({
      q: query,
      limit: 50, // Get more results for better search experience
    })

    console.log('Apps search:', JSON.stringify({
      query,
      count: results.data?.length || 0,
    }, null, 2))

    return NextResponse.json({
      success: true,
      apps: results.data || [],
      total: results.data?.length || 0,
    })
  } catch (error) {
    console.error('Error searching apps:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to search apps',
        apps: [],
      },
      { status: 500 }
    )
  }
}

