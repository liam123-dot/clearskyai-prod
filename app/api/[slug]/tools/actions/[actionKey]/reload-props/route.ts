import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { pipedreamClient, isPipedreamConfigured } from '@/lib/pipedream/client'

type RouteContext = {
  params: Promise<{ slug: string; actionKey: string }>
}

/**
 * Reload action's configurableProps with configured values
 * This is used when a prop with reloadProps: true changes
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug: slugFromUrl, actionKey } = await context.params

    // Check if Pipedream is configured
    if (!isPipedreamConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Pipedream credentials not configured' },
        { status: 500 }
      )
    }

    // Get authenticated user and organization
    const { user, organizationId } = await getAuthSession(slugFromUrl)
    
    if (!user || !organizationId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated or unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { configuredProps } = body

    if (!actionKey) {
      return NextResponse.json(
        { success: false, error: 'actionKey is required' },
        { status: 400 }
      )
    }

    console.log(`Reloading props for action ${actionKey} with configured props:`, JSON.stringify(configuredProps, null, 2))

    // Call Pipedream's reloadProps API endpoint
    // This returns updated configurableProps based on the configured props
    const reloadResponse = await pipedreamClient.actions.reloadProps({
      id: actionKey,
      externalUserId: organizationId,
      configuredProps: configuredProps || {},
    })

    console.log('Reload props response:', JSON.stringify(reloadResponse, null, 2))

    // The response includes dynamicProps.configurableProps with updated props
    if (reloadResponse.dynamicProps?.configurableProps) {
      return NextResponse.json({
        success: true,
        configurableProps: reloadResponse.dynamicProps.configurableProps,
      })
    }

    // Fallback: if dynamicProps is not available, return error
    return NextResponse.json(
      { 
        success: false, 
        error: 'No updated configurableProps returned from Pipedream API',
      },
      { status: 500 }
    )
  } catch (error) {
    console.error('Error reloading action props:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to reload action props',
      },
      { status: 500 }
    )
  }
}

