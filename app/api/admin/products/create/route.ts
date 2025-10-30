import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/(admin)/lib/admin-auth'
import { createProduct, CreateProductData } from '@/lib/products'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    
    const body = await request.json()
    const { type, name, description, amount_cents, currency } = body
    
    // Validate common fields
    if (!type || !name) {
      return NextResponse.json(
        { error: 'type and name are required' },
        { status: 400 }
      )
    }
    
    if (!['one_time', 'recurring', 'usage_based'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be one_time, recurring, or usage_based' },
        { status: 400 }
      )
    }
    
    // amount_cents is required for one_time and recurring, but not for usage_based
    if ((type === 'one_time' || type === 'recurring') && !amount_cents) {
      return NextResponse.json(
        { error: 'amount_cents is required for one_time and recurring products' },
        { status: 400 }
      )
    }
    
    let productData: CreateProductData
    
    // Build product data based on type
    switch (type) {
      case 'one_time':
        productData = {
          type: 'one_time',
          name,
          description,
          amount_cents: parseInt(amount_cents),
          currency: currency || 'gbp',
        }
        break
        
      case 'recurring':
        const { interval, interval_count, trial_days } = body
        
        productData = {
          type: 'recurring',
          name,
          description,
          amount_cents: parseInt(amount_cents),
          currency: currency || 'gbp',
          interval: interval || 'month',
          interval_count: interval_count ? parseInt(interval_count) : 1,
          trial_days: trial_days ? parseInt(trial_days) : undefined,
        }
        break
        
      case 'usage_based':
        const { minutes_included, price_per_minute_cents } = body
        
        if (!minutes_included || !price_per_minute_cents) {
          return NextResponse.json(
            { error: 'minutes_included and price_per_minute_cents are required for usage_based products' },
            { status: 400 }
          )
        }
        
        productData = {
          type: 'usage_based',
          name,
          description,
          amount_cents: parseInt(amount_cents),
          currency: currency || 'gbp',
          minutes_included: parseInt(minutes_included),
          price_per_minute_cents: parseInt(price_per_minute_cents),
        }
        break
        
      default:
        return NextResponse.json(
          { error: 'Invalid product type' },
          { status: 400 }
        )
    }
    
    const product = await createProduct(productData)
    
    return NextResponse.json({ product })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create product' },
      { status: 500 }
    )
  }
}

