'use server'

import { createServiceClient } from './supabase/server'
import { stripe, getBillingMeter } from './stripe'

// Product type enum
export type ProductType = 'one_time' | 'recurring' | 'usage_based'

// Base product interface from database
export interface Product {
  id: string
  name: string
  description: string | null
  product_type: ProductType
  amount_cents: number
  currency: string
  interval: string
  interval_count: number
  trial_days: number | null
  minutes_included: number | null
  price_per_minute_cents: number | null
  tiers: any | null
  stripe_product_id: string
  stripe_price_id: string
  stripe_billing_meter_id: string | null
  created_at: string
  updated_at: string
}

// Product creation data interfaces
export interface BaseProductData {
  name: string
  description?: string
  amount_cents: number
  currency?: string
}

export interface OneTimeProductData extends BaseProductData {
  type: 'one_time'
}

export interface RecurringProductData extends BaseProductData {
  type: 'recurring'
  interval?: 'day' | 'week' | 'month' | 'year'
  interval_count?: number
  trial_days?: number
}

export interface UsageBasedProductData extends BaseProductData {
  type: 'usage_based'
  minutes_included: number
  price_per_minute_cents: number
}

export type CreateProductData = OneTimeProductData | RecurringProductData | UsageBasedProductData

/**
 * Get all products
 */
export async function getProducts(): Promise<Product[]> {
  const supabase = await createServiceClient()
  
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) {
    throw new Error('Failed to fetch products')
  }
  
  return data || []
}

/**
 * Get products by type
 */
export async function getProductsByType(type: ProductType): Promise<Product[]> {
  const supabase = await createServiceClient()
  
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('product_type', type)
    .order('created_at', { ascending: false })
  
  if (error) {
    throw new Error('Failed to fetch products')
  }
  
  return data || []
}

/**
 * Get product by ID
 */
export async function getProductById(productId: string): Promise<Product | null> {
  const supabase = await createServiceClient()
  
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single()
  
  if (error) {
    return null
  }
  
  return data
}

/**
 * Create a new product (handles all three types)
 */
export async function createProduct(productData: CreateProductData): Promise<Product> {
  const supabase = await createServiceClient()
  
  const { name, description, amount_cents, currency = 'gbp', type } = productData
  
  // Create Stripe product (common for all types)
  // Description will be set per product type
  let stripeProductDescription = description || undefined
  
  const stripeProduct = await stripe.products.create({
    name: name,
    description: stripeProductDescription,
    metadata: {
      product_type: type,
    },
  })
  
  // Create appropriate Stripe price based on type
  let stripePrice
  let dbRecord: any = {
    name,
    description: description || null,
    product_type: type,
    amount_cents,
    currency: currency.toLowerCase(),
    stripe_product_id: stripeProduct.id,
  }
  
  switch (type) {
    case 'one_time':
      // One-time payment
      stripePrice = await stripe.prices.create({
        product: stripeProduct.id,
        unit_amount: amount_cents,
        currency: currency.toLowerCase(),
        metadata: {
          type: 'one_time',
        },
      })
      
      dbRecord.stripe_price_id = stripePrice.id
      break
      
    case 'recurring':
      // Recurring subscription
      const recurringData = productData as RecurringProductData
      const interval = recurringData.interval || 'month'
      const intervalCount = recurringData.interval_count || 1
      const trialDays = recurringData.trial_days
      
      stripePrice = await stripe.prices.create({
        product: stripeProduct.id,
        unit_amount: amount_cents,
        currency: currency.toLowerCase(),
        recurring: {
          interval: interval,
          interval_count: intervalCount,
          trial_period_days: trialDays || undefined,
        },
        metadata: {
          type: 'recurring',
          trial_days: trialDays?.toString() || '0',
        },
      })
      
      dbRecord.stripe_price_id = stripePrice.id
      dbRecord.interval = interval
      dbRecord.interval_count = intervalCount
      dbRecord.trial_days = trialDays || null
      break
      
    case 'usage_based':
      // Usage-based with graduated pricing
      const usageData = productData as UsageBasedProductData
      const minutesIncluded = usageData.minutes_included
      const pricePerMinute = usageData.price_per_minute_cents
      
      // Get or create the global billing meter
      const billingMeter = await getBillingMeter()
      
      // Update Stripe product description to include billing info
      const usageDescription = description 
        ? `${description} • Billed per second` 
        : `${minutesIncluded.toLocaleString()} min included, then £${(pricePerMinute / 100).toFixed(2)}/min • Billed per second`
      
      await stripe.products.update(stripeProduct.id, {
        description: usageDescription,
      })
      
      // Convert minutes to seconds for Stripe tiers (meter tracks seconds)
      const secondsIncluded = minutesIncluded * 60
      
      // Convert per-minute price to per-second price
      // Price per minute / 60 = price per second
      const pricePerSecond = pricePerMinute / 60
      
      // Build graduated tiers
      // Tier 1: 0 to secondsIncluded at £0
      // Tier 2: secondsIncluded to infinity at pricePerSecond
      const tiers = [
        {
          up_to: secondsIncluded,
          flat_amount: 0,
          unit_amount: 0,
        },
        {
          up_to: 'inf' as const,
          unit_amount_decimal: pricePerSecond.toFixed(4), // More decimal places for precision
        },
      ]
      
      stripePrice = await stripe.prices.create({
        product: stripeProduct.id,
        currency: currency.toLowerCase(),
        billing_scheme: 'tiered',
        tiers_mode: 'graduated',
        tiers: tiers,
        recurring: {
          interval: 'month',
          usage_type: 'metered',
          meter: billingMeter.id,
        },
        metadata: {
          type: 'usage_based',
          minutes_included: minutesIncluded.toString(),
          seconds_included: secondsIncluded.toString(),
          price_per_minute_cents: pricePerMinute.toString(),
          price_per_second_cents: pricePerSecond.toFixed(4),
          billing_meter_id: billingMeter.id,
        }
      })
      
      dbRecord.stripe_price_id = stripePrice.id
      dbRecord.stripe_billing_meter_id = billingMeter.id
      dbRecord.minutes_included = minutesIncluded
      dbRecord.price_per_minute_cents = pricePerMinute
      dbRecord.tiers = tiers
      break
  }
  
  // Insert product into database
  const { data, error } = await supabase
    .from('products')
    .insert(dbRecord)
    .select()
    .single()
  
  if (error) {
    console.error('Database error:', error)
    throw new Error('Failed to create product in database')
  }
  
  return data
}

/**
 * Delete a product (soft delete by archiving in Stripe)
 */
export async function deleteProduct(productId: string): Promise<void> {
  const supabase = await createServiceClient()
  
  // Get product
  const product = await getProductById(productId)
  if (!product) {
    throw new Error('Product not found')
  }
  
  // Archive in Stripe
  await stripe.products.update(product.stripe_product_id, {
    active: false,
  })
  
  // Delete from database
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
  
  if (error) {
    throw new Error('Failed to delete product')
  }
}
