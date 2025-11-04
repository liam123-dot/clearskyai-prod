import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { pipedreamClient, isPipedreamConfigured } from '@/lib/pipedream/client'

type RouteContext = {
  params: Promise<{ slug: string }>
}

/**
 * Generate a Pipedream Connect token for the current organization
 * This token is used to initiate the account connection flow
 */
export async function GET(request: Request, context: RouteContext) {
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

    // Create a token for the organization (using organization ID as external user ID)
    console.log('Creating Pipedream token for organization:', organizationId)
    
    const { token, expiresAt, connectLinkUrl } = await pipedreamClient.tokens.create({
      externalUserId: organizationId,
    })

    console.log("Pipedream token generated:", {
      organizationId,
      expiresAt,
      connectLinkUrl,
      tokenPreview: token?.substring(0, 10) + '...',
    })

    return NextResponse.json({
      success: true,
      token,
      expiresAt,
      connectLinkUrl,
      organizationId,
    })
  } catch (error) {
    console.error('Error generating Pipedream token:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate Connect token' 
      },
      { status: 500 }
    )
  }
}

