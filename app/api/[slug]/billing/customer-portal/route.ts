import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { createCustomerPortalSession } from '@/lib/billing'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { organizationId } = await getAuthSession(slug)

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/${slug}/settings/billing`
    const portalUrl = await createCustomerPortalSession(organizationId, returnUrl)

    return NextResponse.json({ url: portalUrl })
  } catch (error) {
    console.error('Error creating customer portal session:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
