import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { pipedreamClient, isPipedreamConfigured } from '@/lib/pipedream/client'

type RouteContext = {
  params: Promise<{ slug: string }>
}

/**
 * Get all connected accounts for the current organization
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug: slugFromUrl } = await context.params

    // Check if Pipedream is configured
    if (!isPipedreamConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Pipedream credentials not configured', accounts: [] },
        { status: 500 }
      )
    }

    // Get authenticated user and organization
    const { user, organizationId } = await getAuthSession(slugFromUrl)
    
    if (!user || !organizationId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated or unauthorized', accounts: [] },
        { status: 401 }
      )
    }

    // List all accounts for this organization
    const results = await pipedreamClient.accounts.list({
      externalUserId: organizationId,
      includeCredentials: false, // We don't expose credentials to the client
    })

    // Collect all accounts from the paginated results
    const accounts = []
    for await (const account of results) {
      accounts.push(account)
    }

    console.log('Connected accounts:', {
      organizationId,
      count: accounts.length,
    })

    return NextResponse.json({
      success: true,
      accounts,
      total: accounts.length,
    })
  } catch (error) {
    console.error('Error fetching connected accounts:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch accounts',
        accounts: [],
      },
      { status: 500 }
    )
  }
}

