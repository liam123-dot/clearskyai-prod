import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/(admin)/lib/admin-auth'
import { startSubscription } from '@/lib/billing'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    await requireAdmin()
    
    const { orgId } = await params
    const body = await request.json()
    const { product_id } = body
    
    if (!product_id) {
      return NextResponse.json(
        { error: 'product_id is required' },
        { status: 400 }
      )
    }
    
    const subscription = await startSubscription(orgId, product_id)
    
    return NextResponse.json({ subscription })
  } catch (error) {
    console.error('Error starting subscription:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start subscription' },
      { status: 500 }
    )
  }
}

