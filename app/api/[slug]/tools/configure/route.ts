import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { pipedreamClient, isPipedreamConfigured } from '@/lib/pipedream/client'

type RouteContext = {
  params: Promise<{ slug: string }>
}

/**
 * Configure a component's props (get remote options, etc.)
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug: slugFromUrl } = await context.params

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
    const { componentId, propName, configuredProps, query } = body

    if (!componentId || !propName) {
      return NextResponse.json(
        { success: false, error: 'componentId and propName are required' },
        { status: 400 }
      )
    }

    console.log(`Configuring prop ${propName} for component ${componentId}`)
    console.log('Configured props:', JSON.stringify(configuredProps, null, 2))
    if (query) {
      console.log('Query:', query)
    }

    // Call Pipedream's configure API
    const configureParams: {
      externalUserId: string;
      id: string;
      propName: string;
      configuredProps: Record<string, unknown>;
      query?: string;
    } = {
      externalUserId: organizationId,
      id: componentId,
      propName: propName,
      configuredProps: configuredProps || {},
    }

    // Add query parameter if provided
    if (query) {
      configureParams.query = query
    }

    const response = await pipedreamClient.actions.configureProp(configureParams)

    console.log('Configure response:', JSON.stringify(response, null, 2))

    return NextResponse.json({
      success: true,
      options: response.options || [],
      stringOptions: response.stringOptions || null,
      context: response.context || null,
      errors: response.errors || [],
    })
  } catch (error) {
    console.error('Error configuring component props:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to configure component props',
      },
      { status: 500 }
    )
  }
}

