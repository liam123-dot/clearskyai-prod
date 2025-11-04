import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { pipedreamClient, isPipedreamConfigured } from '@/lib/pipedream/client'

type RouteContext = {
  params: Promise<{ slug: string }>
}

/**
 * Get actions for a specific app
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug: slugFromUrl } = await context.params

    // Check if Pipedream is configured
    if (!isPipedreamConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Pipedream credentials not configured', actions: [] },
        { status: 500 }
      )
    }

    // Get authenticated user and organization
    const { user, organizationId } = await getAuthSession(slugFromUrl)
    
    if (!user || !organizationId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated or unauthorized', actions: [] },
        { status: 401 }
      )
    }

    // Get app from query params
    const { searchParams } = new URL(request.url)
    const app = searchParams.get('app')

    if (!app) {
      return NextResponse.json(
        { success: false, error: 'App parameter is required', actions: [] },
        { status: 400 }
      )
    }

    console.log('Fetching actions for app:', app)

    // Fetch actions from Pipedream
    const actions = await pipedreamClient.actions.list({
      app,
    })

    // Convert to array
    const actionsList = []
    for await (const action of actions) {
      actionsList.push(action)
    }

    console.log('Actions:', JSON.stringify(actionsList, null, 2))

    console.log(`Found ${actionsList.length} actions for app: ${app}`)

    return NextResponse.json({
      success: true,
      actions: actionsList,
    })
  } catch (error) {
    console.error('Error fetching actions:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch actions',
        actions: [],
      },
      { status: 500 }
    )
  }
}

