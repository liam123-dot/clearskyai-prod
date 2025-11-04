import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { pipedreamClient, isPipedreamConfigured } from '@/lib/pipedream/client'

type RouteContext = {
  params: Promise<{ slug: string; appSlug: string }>
}

/**
 * Get app details and connected accounts for a specific app
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug: slugFromUrl, appSlug } = await context.params

    // Check if Pipedream is configured
    if (!isPipedreamConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Pipedream credentials not configured', app: null, accounts: [], total: 0 },
        { status: 500 }
      )
    }

    // Get authenticated user and organization
    const { user, organizationId } = await getAuthSession(slugFromUrl)
    
    if (!user || !organizationId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated or unauthorized', app: null, accounts: [], total: 0 },
        { status: 401 }
      )
    }

    // Fetch app details from Pipedream
    let appData = null
    try {
      const appsResults = await pipedreamClient.apps.list({
        q: appSlug,
        limit: 10,
      })
      
      // Find exact match by nameSlug
      appData = appsResults.data?.find(app => app.nameSlug === appSlug) || null
      
      if (!appData) {
        return NextResponse.json(
          { success: false, error: 'App not found', app: null, accounts: [], total: 0 },
          { status: 404 }
        )
      }
    } catch (error) {
      console.error('Error fetching app details:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch app details', app: null, accounts: [], total: 0 },
        { status: 500 }
      )
    }

    // List all connected accounts for this organization
    const results = await pipedreamClient.accounts.list({
      externalUserId: organizationId,
      includeCredentials: false,
    })

    // Collect all accounts and filter by app
    const allAccounts = []
    for await (const account of results) {
      allAccounts.push(account)
    }

    // Filter accounts for this specific app
    const appAccounts = allAccounts.filter(
      account => account.app?.nameSlug === appSlug
    )

    console.log('App credentials:', {
      organizationId,
      appSlug,
      appName: appData.name,
      accountCount: appAccounts.length,
    })

    return NextResponse.json({
      success: true,
      app: appData,
      accounts: appAccounts,
      total: appAccounts.length,
    })
  } catch (error) {
    console.error('Error fetching app credentials:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch app credentials',
        app: null,
        accounts: [],
        total: 0,
      },
      { status: 500 }
    )
  }
}

