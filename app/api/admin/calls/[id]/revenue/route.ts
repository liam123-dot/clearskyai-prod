import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/(admin)/lib/admin-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getCallDuration } from '@/lib/calls-helpers'
import type { Call } from '@/lib/calls-helpers'

export interface RevenueData {
  callDurationMinutes: number
  totalCost: number
  includedMinutesRate?: {
    basePriceCents: number
    minutesIncluded: number
    ratePerMinuteCents: number
    ratePerMinuteFormatted: string
    revenueCents: number
    revenueFormatted: string
    marginCents: number
    marginFormatted: string
    marginPercentage: number
    calculation: string
  }
  overageRate?: {
    pricePerMinuteCents: number
    pricePerMinuteFormatted: string
    revenueCents: number
    revenueFormatted: string
    marginCents: number
    marginFormatted: string
    marginPercentage: number
  }
  productName?: string
  hasActiveSubscription: boolean
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { error: 'Call ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()
    
    // Fetch the call
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('*')
      .eq('id', id)
      .single()

    if (callError || !call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      )
    }

    const callData = call as Call
    
    // Get call duration and costs
    const durationSeconds = getCallDuration(callData.data)
    const durationMinutes = durationSeconds / 60
    const costs = (callData.data as any)?.costs || []
    const totalCostUSD = costs.reduce((sum: number, item: any) => sum + (item.cost || 0), 0)
    
    // Convert cost from USD to GBP using exchange rate £1 = $1.3
    const USD_TO_GBP_RATE = 1.3
    const totalCostGBP = totalCostUSD / USD_TO_GBP_RATE
    const totalCostCents = totalCostGBP * 100 // Convert to pence for calculations

    // Fetch organization's active subscriptions
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('organization_id', callData.organization_id)
      .in('status', ['active', 'trialing'])

    if (subscriptionsError) {
      console.error('Error fetching subscriptions:', subscriptionsError)
      return NextResponse.json(
        { error: 'Failed to fetch subscription data' },
        { status: 500 }
      )
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json<RevenueData>({
        callDurationMinutes: durationMinutes,
        totalCost: totalCostGBP,
        hasActiveSubscription: false,
      })
    }

    // Fetch products for the subscriptions
    const productIds = subscriptions.map((sub: any) => sub.product_id)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds)

    if (productsError) {
      console.error('Error fetching products:', productsError)
      return NextResponse.json(
        { error: 'Failed to fetch product data' },
        { status: 500 }
      )
    }

    // Join subscriptions with products
    const subscriptionsWithProducts = subscriptions.map((sub: any) => ({
      ...sub,
      product: products?.find((p: any) => p.id === sub.product_id),
    }))

    // Find recurring subscription (Base Plan) for base price
    const recurringSubscription = subscriptionsWithProducts.find(
      (sub: any) => sub.product?.product_type === 'recurring'
    )

    // Find usage-based subscription (Voice AI Minutes) for included minutes and overage
    const usageBasedSubscription = subscriptionsWithProducts.find(
      (sub: any) => sub.product?.product_type === 'usage_based'
    )

    // Calculate revenue scenarios
    const result: RevenueData = {
      callDurationMinutes: durationMinutes,
      totalCost: totalCostGBP,
      productName: usageBasedSubscription?.product?.name || recurringSubscription?.product?.name,
      hasActiveSubscription: true,
    }

    // Calculate included minutes rate using base price from recurring subscription
    // and included minutes from usage-based subscription
    if (recurringSubscription?.product && usageBasedSubscription?.product) {
      const basePriceCents = recurringSubscription.product.amount_cents
      const minutesIncluded = usageBasedSubscription.product.minutes_included

      if (basePriceCents > 0 && minutesIncluded && minutesIncluded > 0) {
        const ratePerMinuteCents = basePriceCents / minutesIncluded
        const revenueCents = ratePerMinuteCents * durationMinutes
        const marginCents = revenueCents - totalCostCents // Cost already converted to GBP pence
        const marginPercentage = revenueCents > 0 ? (marginCents / revenueCents) * 100 : 0

        const basePriceFormatted = `£${(basePriceCents / 100).toFixed(2)}`
        const ratePerMinuteFormatted = `£${(ratePerMinuteCents / 100).toFixed(2)}`
        const revenueFormatted = `£${(revenueCents / 100).toFixed(4)}`
        const marginFormatted = marginCents >= 0 
          ? `£${(marginCents / 100).toFixed(4)}` 
          : `-£${Math.abs(marginCents / 100).toFixed(4)}`

        result.includedMinutesRate = {
          basePriceCents,
          minutesIncluded,
          ratePerMinuteCents,
          ratePerMinuteFormatted,
          revenueCents,
          revenueFormatted,
          marginCents,
          marginFormatted,
          marginPercentage,
          calculation: `${basePriceFormatted}/${recurringSubscription.product.interval || 'mo'} ÷ ${minutesIncluded} min = ${ratePerMinuteFormatted}/min`,
        }
      }
    }

    // Calculate overage rate from usage-based subscription
    if (usageBasedSubscription?.product?.price_per_minute_cents && usageBasedSubscription.product.price_per_minute_cents > 0) {
      const pricePerMinuteCents = usageBasedSubscription.product.price_per_minute_cents
      const revenueCents = pricePerMinuteCents * durationMinutes
      const marginCents = revenueCents - totalCostCents // Cost already converted to GBP pence
      const marginPercentage = revenueCents > 0 ? (marginCents / revenueCents) * 100 : 0

      const pricePerMinuteFormatted = `£${(pricePerMinuteCents / 100).toFixed(2)}`
      const revenueFormatted = `£${(revenueCents / 100).toFixed(4)}`
      const marginFormatted = marginCents >= 0 
        ? `£${(marginCents / 100).toFixed(4)}` 
        : `-£${Math.abs(marginCents / 100).toFixed(4)}`

      result.overageRate = {
        pricePerMinuteCents,
        pricePerMinuteFormatted,
        revenueCents,
        revenueFormatted,
        marginCents,
        marginFormatted,
        marginPercentage,
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error calculating call revenue:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate revenue' },
      { status: 500 }
    )
  }
}

