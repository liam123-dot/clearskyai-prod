import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/(admin)/lib/admin-auth'
import { createCheckoutSession } from '@/lib/billing'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    await requireAdmin()
    
    const { orgId } = await params
    const body = await request.json()
    const { product_ids } = body
    
    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return NextResponse.json(
        { error: 'product_ids array is required and must not be empty' },
        { status: 400 }
      )
    }
    
    const checkoutUrl = await createCheckoutSession(orgId, product_ids)
    
    return NextResponse.json({ url: checkoutUrl })
  } catch (error) {
    console.error('Error creating checkout link:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create checkout link' },
      { status: 500 }
    )
  }
}

