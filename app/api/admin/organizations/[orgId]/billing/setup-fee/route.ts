import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/(admin)/lib/admin-auth'
import { createSetupFeeInvoice } from '@/lib/billing'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    await requireAdmin()
    
    const { orgId } = await params
    const body = await request.json()
    const { amount_cents, billing_email, title, description, days_until_due } = body
    
    if (!amount_cents || amount_cents <= 0) {
      return NextResponse.json(
        { error: 'amount_cents must be a positive number' },
        { status: 400 }
      )
    }
    
    const invoice = await createSetupFeeInvoice(
      orgId,
      parseInt(amount_cents),
      billing_email,
      title,
      description,
      days_until_due ? parseInt(days_until_due) : undefined
    )
    
    return NextResponse.json({ invoice })
  } catch (error) {
    console.error('Error creating one-time invoice:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create one-time invoice' },
      { status: 500 }
    )
  }
}

