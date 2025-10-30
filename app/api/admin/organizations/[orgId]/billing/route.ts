import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/(admin)/lib/admin-auth'
import { getOrganizationBilling } from '@/lib/billing'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    await requireAdmin()
    
    const { orgId } = await params
    
    const billingState = await getOrganizationBilling(orgId)
    
    return NextResponse.json(billingState)
  } catch (error) {
    console.error('Error fetching billing state:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch billing state' },
      { status: 500 }
    )
  }
}

