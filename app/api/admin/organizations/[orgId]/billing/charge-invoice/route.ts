import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/(admin)/lib/admin-auth'
import { chargeExistingInvoice } from '@/lib/billing'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    await requireAdmin()
    
    const { orgId } = await params
    const body = await request.json()
    const { invoice_id } = body
    
    if (!invoice_id) {
      return NextResponse.json(
        { error: 'invoice_id is required' },
        { status: 400 }
      )
    }
    
    const invoice = await chargeExistingInvoice(orgId, invoice_id)
    
    return NextResponse.json({ invoice })
  } catch (error) {
    console.error('Error charging existing invoice:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to charge invoice' },
      { status: 500 }
    )
  }
}

