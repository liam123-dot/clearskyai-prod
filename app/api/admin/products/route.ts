import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/(admin)/lib/admin-auth'
import { getProducts, createProduct, CreateProductData } from '@/lib/products'

export async function GET() {
  try {
    await requireAdmin()
    
    const products = await getProducts()
    
    return NextResponse.json({ products })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    
    const body = await request.json()
    const { name, description, base_price_cents, currency, minutes_included, price_per_minute_cents, type } = body
    
    // Default to usage_based if type not specified but usage fields are present
    const productType = type || (minutes_included !== undefined && price_per_minute_cents !== undefined ? 'usage_based' : 'one_time')
    
    if (!name || base_price_cents === undefined) {
      return NextResponse.json(
        { error: 'name and base_price_cents are required' },
        { status: 400 }
      )
    }
    
    // For usage_based products, minutes_included and price_per_minute_cents are required
    if (productType === 'usage_based') {
      if (minutes_included === undefined || price_per_minute_cents === undefined) {
        return NextResponse.json(
          { error: 'minutes_included and price_per_minute_cents are required for usage_based products' },
          { status: 400 }
        )
      }
    }
    
    const productData: CreateProductData = {
      name,
      description,
      amount_cents: parseInt(base_price_cents),
      currency: currency || 'gbp',
      type: productType as 'one_time' | 'recurring' | 'usage_based',
      ...(productType === 'usage_based' && {
        minutes_included: parseInt(minutes_included),
        price_per_minute_cents: parseInt(price_per_minute_cents),
      }),
      ...(productType === 'recurring' && body.interval && {
        interval: body.interval,
        interval_count: body.interval_count || 1,
        trial_days: body.trial_days,
      }),
    }
    
    const product = await createProduct(productData)
    
    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create product' },
      { status: 500 }
    )
  }
}

