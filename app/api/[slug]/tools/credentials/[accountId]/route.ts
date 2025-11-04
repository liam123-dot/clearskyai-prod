import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { pipedreamClient, isPipedreamConfigured } from '@/lib/pipedream/client'

type RouteContext = {
  params: Promise<{ slug: string; accountId: string }>
}

/**
 * Delete a connected account
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { slug: slugFromUrl, accountId } = await context.params

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

    // Verify the account exists and belongs to this organization
    // We'll do this by listing accounts and checking if the accountId exists
    const results = await pipedreamClient.accounts.list({
      externalUserId: organizationId,
      includeCredentials: false,
    })

    let accountExists = false
    for await (const account of results) {
      if (account.id === accountId) {
        accountExists = true
        break
      }
    }

    if (!accountExists) {
      return NextResponse.json(
        { success: false, error: 'Account not found or unauthorized' },
        { status: 404 }
      )
    }

    // Delete the account
    await pipedreamClient.accounts.delete(accountId)

    console.log('Account deleted:', {
      accountId,
      organizationId,
    })

    return NextResponse.json({
      success: true,
      message: 'Account disconnected successfully',
    })
  } catch (error) {
    console.error('Error deleting account:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete account' 
      },
      { status: 500 }
    )
  }
}

