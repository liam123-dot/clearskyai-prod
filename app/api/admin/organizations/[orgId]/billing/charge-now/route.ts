import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/(admin)/lib/admin-auth'
import { chargeInvoiceNow } from '@/lib/billing'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    await requireAdmin()
    
    const { orgId } = await params
    const body = await request.json()
    const { amount_cents, billing_email, title, description } = body
    
    if (!amount_cents || amount_cents <= 0) {
      return NextResponse.json(
        { error: 'amount_cents must be a positive number' },
        { status: 400 }
      )
    }
    
    const invoice = await chargeInvoiceNow(
      orgId,
      parseInt(amount_cents),
      billing_email,
      title,
      description
    )
    
    return NextResponse.json({ invoice })
  } catch (error) {
    console.error('Error charging invoice:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to charge invoice' },
      { status: 500 }
    )
  }
}

