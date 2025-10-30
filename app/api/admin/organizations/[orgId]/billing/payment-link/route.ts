import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/(admin)/lib/admin-auth'
import { generatePaymentLink } from '@/lib/billing'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    await requireAdmin()
    
    const { orgId } = await params
    
    const paymentLink = await generatePaymentLink(orgId)
    
    return NextResponse.json({ url: paymentLink })
  } catch (error) {
    console.error('Error generating payment link:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate payment link' },
      { status: 500 }
    )
  }
}

