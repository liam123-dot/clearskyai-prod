import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/(admin)/lib/admin-auth'
import { attachProduct } from '@/lib/billing'

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
    
    await attachProduct(orgId, product_id)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error attaching product:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to attach product' },
      { status: 500 }
    )
  }
}

