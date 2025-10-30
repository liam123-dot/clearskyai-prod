'use server'

import { createServiceClient } from './supabase/server'
import { stripe, ensureStripeCustomer, checkPaymentMethod, getInvoices, getCustomerUsageForMeter, getBillingMeter } from './stripe'
import { Product, getProductById } from './products'
import Stripe from 'stripe'

export interface OrganizationBillingState {
  organization: {
    id: string
    name: string
    slug: string
    stripe_customer_id: string | null
    billing_email: string | null
  }
  hasPaymentMethod: boolean
  allProducts: Product[]
  availableProducts: Product[]
  attachedProducts: Array<{
    id: string
    product: Product
    is_active: boolean
    attached_at: string
  }>
  activeSubscriptions: Array<{
    id: string
    product: Product
    stripe_subscription_id: string
    stripe_subscription_item_id: string
    status: string
    current_period_start: string
    current_period_end: string
    started_at: string
    usage?: {
      secondsUsed: number
      minutesUsed: number
      secondsRemainder: number
      minutesIncluded: number
      secondsIncluded: number
      secondsOverage: number
      estimatedOverageCost: number
    }
  }>
  invoices: Stripe.Invoice[]
}

export interface Subscription {
  id: string
  organization_id: string
  product_id: string
  stripe_subscription_id: string
  stripe_subscription_item_id: string
  status: string
  current_period_start: string
  current_period_end: string
  started_at: string
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Sync a single Stripe subscription to the database
 * This is the core reusable function called by webhooks and manual syncs
 */
export async function syncSingleSubscription(
  subscription: Stripe.Subscription,
  organizationId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient()
  
  try {
    // Get organization by stripe customer ID if not provided
    let orgId = organizationId
    if (!orgId) {
      const { data: org, error: orgError } = await supabase
        .from('organisations')
        .select('id')
        .eq('stripe_customer_id', subscription.customer as string)
        .single()
      
      if (orgError || !org) {
        return { success: false, error: 'Organization not found for customer' }
      }
      orgId = org.id
    }
    
    // Process each subscription item (can have multiple: recurring + usage-based)
    for (const item of subscription.items.data) {
      const priceId = item.price.id
      
      // Find product by stripe_price_id (new field)
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, product_type')
        .eq('stripe_price_id', priceId)
        .single()
      
      if (productError || !product) {
        console.warn(`Product not found for price ${priceId}. Error:`, productError)
        console.warn(`Price metadata:`, item.price.metadata)
        console.warn(`Price recurring usage_type:`, item.price.recurring?.usage_type)
        continue
      }
      
      console.log(`Syncing subscription item ${item.id} for product ${product.id} (type: ${product.product_type})`)
      
      // Check if subscription exists in database
      // Use both stripe_subscription_id AND stripe_subscription_item_id since one subscription can have multiple items
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('stripe_subscription_id', subscription.id)
        .eq('stripe_subscription_item_id', item.id)
        .single()
      
      console.log('existingSub', JSON.stringify(existingSub, null, 2))
      
      // Get period start/end from the subscription item (not the subscription object)
      // Each subscription item has its own current_period_start and current_period_end
      const periodStart = (item as any).current_period_start
        ? new Date((item as any).current_period_start * 1000).toISOString()
        : new Date().toISOString()
      const periodEnd = (item as any).current_period_end
        ? new Date((item as any).current_period_end * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      
      console.log('Period from item:', { periodStart, periodEnd, itemId: item.id })
      
      if (existingSub) {
        // Update existing subscription
        await supabase
          .from('subscriptions')
          .update({
            status: subscription.status,
            current_period_start: periodStart,
            current_period_end: periodEnd,
            cancelled_at: subscription.canceled_at 
              ? new Date(subscription.canceled_at * 1000).toISOString()
              : null,
          })
          .eq('id', existingSub.id)
      } else {
        console.log('Creating new subscription, item id:', item.id, 'type:', product.product_type)
        // Create new subscription
        const { data: newSub, error: newSubError } = await supabase
          .from('subscriptions')
          .insert({
            organization_id: orgId,
            product_id: product.id,
            stripe_subscription_id: subscription.id,
            stripe_subscription_item_id: item.id,
            status: subscription.status,
            current_period_start: periodStart,
            current_period_end: periodEnd,
          })
          if (newSubError) {
            console.error('Error creating new subscription:', newSubError)
          }
      }

      
      // Update organization_products to reflect active status
      const isActive = ['active', 'trialing'].includes(subscription.status)
      
      // Ensure the product is attached
      const { data: orgProduct } = await supabase
        .from('organization_products')
        .select('id')
        .eq('organization_id', orgId)
        .eq('product_id', product.id)
        .single()
      
      if (orgProduct) {
        await supabase
          .from('organization_products')
          .update({ is_active: isActive })
          .eq('id', orgProduct.id)
      } else {
        // Create the organization_product if it doesn't exist
        await supabase
          .from('organization_products')
          .insert({
            organization_id: orgId,
            product_id: product.id,
            is_active: isActive,
          })
      }
    }
    
    return { success: true }
  } catch (error) {
    console.error('Error syncing subscription:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Sync all subscriptions for an organization from Stripe
 * Can be called from anywhere (webhooks, Vapi webhook, billing pages, etc.)
 */
export async function syncOrganizationSubscriptions(
  organizationId: string
): Promise<{ success: boolean; synced: number; errors: string[] }> {
  const supabase = await createServiceClient()
  
  // Fetch organization
  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .select('stripe_customer_id')
    .eq('id', organizationId)
    .single()
  
  if (orgError || !org || !org.stripe_customer_id) {
    return { success: false, synced: 0, errors: ['No Stripe customer for organization'] }
  }
  
  try {
    // Fetch all subscriptions from Stripe for this customer (all statuses)
    const subscriptions = await stripe.subscriptions.list({
      customer: org.stripe_customer_id,
      limit: 100,
      status: 'all', // Get all statuses to ensure we sync everything
    })

    console.log('subscriptions', JSON.stringify(subscriptions.data, null, 2))
    
    const errors: string[] = []
    let synced = 0
    
    for (const subscription of subscriptions.data) {
      const result = await syncSingleSubscription(subscription, organizationId)
      if (result.success) {
        synced++
      } else if (result.error) {
        errors.push(result.error)
      }
    }
    
    return { success: errors.length === 0, synced, errors }
  } catch (error) {
    console.error('Error syncing subscriptions from Stripe:', error)
    return { 
      success: false, 
      synced: 0, 
      errors: [error instanceof Error ? error.message : 'Unknown error'] 
    }
  }
}

/**
 * @deprecated Use syncOrganizationSubscriptions instead
 */
export async function syncSubscriptionsFromStripe(organizationId: string): Promise<void> {
  await syncOrganizationSubscriptions(organizationId)
}

/**
 * Get comprehensive billing state for an organization
 */
export async function getOrganizationBilling(organizationId: string): Promise<OrganizationBillingState> {
  const supabase = await createServiceClient()
  
  // Fetch organization first to get customer ID
  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .select('id, name, slug, stripe_customer_id, billing_email')
    .eq('id', organizationId)
    .single()
  
  if (orgError || !org) {
    throw new Error('Organization not found')
  }
  
  // Sync subscriptions from Stripe first - ensure we have the latest data
  if (org.stripe_customer_id) {
    const syncResult = await syncOrganizationSubscriptions(organizationId)
    console.log('Sync result:', { synced: syncResult.synced, errors: syncResult.errors })
  }
  
  // Check payment method status and fetch billing email from Stripe if not set locally
  let hasPaymentMethod = false
  let invoices: Stripe.Invoice[] = []
  let billingEmail = org.billing_email
  
  if (org.stripe_customer_id) {
    hasPaymentMethod = await checkPaymentMethod(org.stripe_customer_id)
    invoices = await getInvoices(org.stripe_customer_id)
    
    // If no billing email locally, check Stripe
    if (!billingEmail) {
      const customer = await stripe.customers.retrieve(org.stripe_customer_id)
      if (customer && !customer.deleted && customer.email) {
        billingEmail = customer.email
        // Update local database with the email from Stripe
        await supabase
          .from('organisations')
          .update({ billing_email: customer.email })
          .eq('id', organizationId)
      }
    }
  }
  
  // Fetch all products
  const { data: allProducts, error: productsError } = await supabase
    .from('products')
    .select('*')
    .order('product_type', { ascending: true })
    .order('created_at', { ascending: false })
  
  if (productsError) {
    throw new Error('Failed to fetch products')
  }
  
  // Fetch attached products (for backwards compatibility)
  const { data: orgProducts, error: orgProductsError } = await supabase
    .from('organization_products')
    .select('*')
    .eq('organization_id', organizationId)
  
  if (orgProductsError) {
    throw new Error('Failed to fetch attached products')
  }
  
  const attachedProductIds = new Set(orgProducts?.map(op => op.product_id) || [])
  
  // Separate available and attached products (for backwards compatibility)
  const availableProducts = allProducts?.filter(p => !attachedProductIds.has(p.id)) || []
  const attachedProducts = (orgProducts || []).map(op => ({
    id: op.id,
    product: allProducts?.find(p => p.id === op.product_id)!,
    is_active: op.is_active,
    attached_at: op.attached_at,
  })).filter(ap => !ap.is_active) // Only show inactive attached products in this section
  
  // Fetch active subscriptions
  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('organization_id', organizationId)
    .in('status', ['active', 'trialing', 'past_due'])
  
  if (subscriptionsError) {
    throw new Error('Failed to fetch subscriptions')
  }
  
  console.log('Fetched subscriptions from DB:', subscriptions?.length || 0)
  console.log('Subscriptions:', subscriptions?.map(s => ({ id: s.id, product_id: s.product_id, status: s.status })))
  
  // Get usage data if customer exists and has usage-based subscriptions
  let totalUsageSeconds = 0
  if (org.stripe_customer_id) {
    try {
      // Check if there are any usage-based subscriptions
      // A subscription can have multiple items - we need to find the metered one
      const usageBasedSubscriptions = subscriptions.filter(sub => {
        const product = allProducts?.find(p => p.id === sub.product_id)
        // Check if product is usage_based
        return product?.product_type === 'usage_based'
      })
      
      console.log('Usage-based subscriptions found:', usageBasedSubscriptions.length)
      console.log('Usage-based subscription details:', usageBasedSubscriptions.map(s => ({
        id: s.id,
        product_id: s.product_id,
        stripe_subscription_item_id: s.stripe_subscription_item_id,
        product: allProducts?.find(p => p.id === s.product_id)
      })))
      
      if (usageBasedSubscriptions.length > 0) {
        // Get the billing meter (shared across all organizations)
        const billingMeter = await getBillingMeter()
        
        // Get usage for the first usage-based subscription's billing period
        // All subscriptions share the same meter and billing period
        const firstUsageBasedSub = usageBasedSubscriptions[0]
        
        if (firstUsageBasedSub) {
          const periodStart = Math.floor(new Date(firstUsageBasedSub.current_period_start).getTime() / 1000)
          const periodEnd = Math.floor(new Date(firstUsageBasedSub.current_period_end).getTime() / 1000)
          
          console.log('Fetching usage for period:', { periodStart, periodEnd, meterId: billingMeter.id })
          
          totalUsageSeconds = await getCustomerUsageForMeter(
            org.stripe_customer_id,
            billingMeter.id,
            periodStart,
            periodEnd
          )
          
          console.log('Total usage seconds:', totalUsageSeconds)
        }
      }
    } catch (error) {
      console.error('Error fetching usage data:', error)
      // Continue without usage data if there's an error
    }
  }
  
  const activeSubscriptions = (subscriptions || []).map(sub => {
    const product = allProducts?.find(p => p.id === sub.product_id)!
    const subscriptionItemId = sub.stripe_subscription_item_id
    
    // Calculate usage for usage-based products (all share the same meter)
    let usage: {
      secondsUsed: number
      minutesUsed: number
      secondsRemainder: number
      minutesIncluded: number
      secondsIncluded: number
      secondsOverage: number
      estimatedOverageCost: number
    } | undefined = undefined
    
    if (product?.product_type === 'usage_based' && totalUsageSeconds > 0) {
      const secondsUsed = totalUsageSeconds
      const minutesUsed = Math.floor(secondsUsed / 60)
      const secondsRemainder = secondsUsed % 60
      const secondsIncluded = (product.minutes_included || 0) * 60
      const secondsOverage = Math.max(0, secondsUsed - secondsIncluded)
      
      // Calculate cost using exact seconds: divide by 60 to get minutes, then multiply by price per minute
      const pricePerMinute = product.price_per_minute_cents || 0
      const exactMinutes = secondsOverage / 60
      const estimatedOverageCost = exactMinutes * (pricePerMinute / 100) // Convert cents to currency
      
      usage = {
        secondsUsed,
        minutesUsed,
        secondsRemainder,
        minutesIncluded: product.minutes_included || 0,
        secondsIncluded,
        secondsOverage,
        estimatedOverageCost,
      }
    }
    
    return {
      id: sub.id,
      product,
      stripe_subscription_id: sub.stripe_subscription_id,
      stripe_subscription_item_id: subscriptionItemId,
      status: sub.status,
      current_period_start: sub.current_period_start,
      current_period_end: sub.current_period_end,
      started_at: sub.started_at,
      usage,
    }
  })
  
  return {
    organization: {
      ...org,
      billing_email: billingEmail,
    },
    hasPaymentMethod,
    allProducts: allProducts || [],
    availableProducts,
    attachedProducts,
    activeSubscriptions,
    invoices,
  }
}

/**
 * Attach a product to an organization
 */
export async function attachProduct(organizationId: string, productId: string): Promise<void> {
  const supabase = await createServiceClient()
  
  const { error } = await supabase
    .from('organization_products')
    .insert({
      organization_id: organizationId,
      product_id: productId,
      is_active: false,
    })
  
  if (error) {
    throw new Error('Failed to attach product')
  }
}

/**
 * Charge an existing open invoice immediately
 */
export async function chargeExistingInvoice(
  organizationId: string,
  invoiceId: string
): Promise<Stripe.Invoice> {
  const supabase = await createServiceClient()
  
  // Fetch organization
  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .select('stripe_customer_id')
    .eq('id', organizationId)
    .single()
  
  if (orgError || !org || !org.stripe_customer_id) {
    throw new Error('Organization not found or has no Stripe customer')
  }
  
  // Get the customer's payment methods
  const paymentMethods = await stripe.paymentMethods.list({
    customer: org.stripe_customer_id,
    type: 'card',
    limit: 1,
  })
  
  if (paymentMethods.data.length === 0) {
    throw new Error('No payment method on file. Please add a payment method first.')
  }
  
  const paymentMethodId = paymentMethods.data[0].id
  
  // Retrieve the invoice to verify it's open
  const invoice = await stripe.invoices.retrieve(invoiceId)
  
  if (invoice.status !== 'open' && invoice.status !== 'draft') {
    throw new Error(`Invoice cannot be charged. Current status: ${invoice.status}`)
  }
  
  // Update invoice to use the payment method
  await stripe.invoices.update(invoiceId, {
    default_payment_method: paymentMethodId,
  })
  
  // Pay the invoice immediately
  const paidInvoice = await stripe.invoices.pay(invoiceId)
  
  return paidInvoice
}

/**
 * Create a one-time invoice for an organization
 */
export async function createSetupFeeInvoice(
  organizationId: string,
  amountCents: number,
  billingEmail?: string,
  title?: string,
  description?: string,
  daysUntilDue?: number
): Promise<Stripe.Invoice> {
  const supabase = await createServiceClient()
  
  // Update billing email if provided
  if (billingEmail) {
    await supabase
      .from('organisations')
      .update({ billing_email: billingEmail })
      .eq('id', organizationId)
  }
  
  // Ensure Stripe customer exists
  const customerId = await ensureStripeCustomer(organizationId)
  
  // Update Stripe customer email if provided
  if (billingEmail) {
    await stripe.customers.update(customerId, {
      email: billingEmail,
    })
  }
  
  // Create invoice with payment method persistence enabled
  const invoice = await stripe.invoices.create({
    customer: customerId,
    auto_advance: true,
    collection_method: 'send_invoice',
    days_until_due: daysUntilDue || 30,
    description: description || undefined,
    payment_settings: {
      payment_method_types: ['card', 'link', 'bacs_debit'],
    },
  })
  
  // Create invoice item
  await stripe.invoiceItems.create({
    customer: customerId,
    amount: amountCents,
    currency: 'gbp',
    description: title || 'One-Time Invoice',
    invoice: invoice.id,
  })

  // Finalize the invoice (this creates the PaymentIntent)
  const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id)
  
  // Retrieve the full invoice to get the PaymentIntent
  const retrievedInvoice = await stripe.invoices.retrieve(finalizedInvoice.id)
  
  // Update the PaymentIntent to always save payment method for future use
  // This ensures payment details are captured when the customer pays
  const paymentIntent = (retrievedInvoice as any).payment_intent
  if (paymentIntent) {
    const paymentIntentId = typeof paymentIntent === 'string' 
      ? paymentIntent 
      : paymentIntent.id
    
    await stripe.paymentIntents.update(paymentIntentId, {
      setup_future_usage: 'off_session',
    })
  }
  
  return retrievedInvoice
}

/**
 * Charge an invoice immediately using saved payment method
 */
export async function chargeInvoiceNow(
  organizationId: string,
  amountCents: number,
  billingEmail?: string,
  title?: string,
  description?: string
): Promise<Stripe.Invoice> {
  const supabase = await createServiceClient()
  
  // Update billing email if provided
  if (billingEmail) {
    await supabase
      .from('organisations')
      .update({ billing_email: billingEmail })
      .eq('id', organizationId)
  }
  
  // Ensure Stripe customer exists
  const customerId = await ensureStripeCustomer(organizationId)
  
  // Get the customer's payment methods
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
    limit: 1,
  })
  
  if (paymentMethods.data.length === 0) {
    throw new Error('No payment method on file. Please add a payment method first.')
  }
  
  const paymentMethodId = paymentMethods.data[0].id
  
  // Update Stripe customer email if provided
  if (billingEmail) {
    await stripe.customers.update(customerId, {
      email: billingEmail,
    })
  }
  
  // Create invoice with charge_automatically and default payment method
  const invoice = await stripe.invoices.create({
    customer: customerId,
    auto_advance: true, // Automatically finalize and charge
    collection_method: 'charge_automatically',
    default_payment_method: paymentMethodId,
    description: description || undefined,
    payment_settings: {
      payment_method_types: ['card', 'link', 'bacs_debit'],
    },
  })
  
  // Create invoice item
  await stripe.invoiceItems.create({
    customer: customerId,
    amount: amountCents,
    currency: 'gbp',
    description: title || 'One-Time Charge',
    invoice: invoice.id,
  })

  // Finalize and pay the invoice in one step
  const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id, {
    auto_advance: true,
  })
  
  return finalizedInvoice
}

/**
 * Generate a Stripe Checkout link for payment method collection
 */
export async function generatePaymentLink(organizationId: string): Promise<string> {
  // Ensure Stripe customer exists
  const customerId = await ensureStripeCustomer(organizationId)
  
  // Create Checkout session in setup mode
  const session = await stripe.checkout.sessions.create({
    mode: 'setup',
    customer: customerId,
    payment_method_types: ['card'],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/admin/client/success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/admin/client/cancelled`,
  })
  
  return session.url || ''
}

/**
 * Start or upgrade a subscription for an organization
 */
export async function startSubscription(
  organizationId: string,
  productId: string
): Promise<Subscription> {
  const supabase = await createServiceClient()
  
  // Ensure Stripe customer exists
  const customerId = await ensureStripeCustomer(organizationId)
  
  // Get the customer's payment methods
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
    limit: 1,
  })
  
  if (paymentMethods.data.length === 0) {
    throw new Error('No payment method on file. Please add a payment method first.')
  }
  
  const paymentMethodId = paymentMethods.data[0].id
  
  // Fetch product details
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single()
  
  if (productError || !product) {
    throw new Error('Product not found')
  }
  
  // Check if organization has an existing active subscription
  const { data: existingSubscriptions } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('organization_id', organizationId)
    .in('status', ['active', 'trialing'])
    .limit(1)
  
  let stripeSubscription: Stripe.Subscription
  
  if (existingSubscriptions && existingSubscriptions.length > 0) {
    // Update existing subscription (upgrade/downgrade)
    const existingSub = existingSubscriptions[0]
    
    stripeSubscription = await stripe.subscriptions.update(existingSub.stripe_subscription_id, {
      items: [
        {
          id: existingSub.stripe_subscription_item_id,
          price: product.stripe_base_price_id,
        },
        {
          price: product.stripe_usage_price_id,
        },
      ],
      proration_behavior: 'always_invoice',
    })
    
    // Update subscription in database
    const periodStart = (stripeSubscription as any).current_period_start
    const periodEnd = (stripeSubscription as any).current_period_end
    
    const { data: updatedSub, error: updateError } = await supabase
      .from('subscriptions')
      .update({
        product_id: productId,
        status: stripeSubscription.status,
        current_period_start: periodStart 
          ? new Date(periodStart * 1000).toISOString()
          : new Date().toISOString(),
        current_period_end: periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', existingSub.id)
      .select()
      .single()
    
    if (updateError) {
      throw new Error('Failed to update subscription')
    }
    
    // Update organization_products
    await supabase
      .from('organization_products')
      .update({ is_active: true })
      .eq('organization_id', organizationId)
      .eq('product_id', productId)
    
    return updatedSub
  } else {
    // Create new subscription with immediate charge
    stripeSubscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        { price: product.stripe_base_price_id },
        { price: product.stripe_usage_price_id },
      ],
      default_payment_method: paymentMethodId,
      payment_behavior: 'error_if_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
      },
    })
    
    // Insert subscription into database
    const periodStart = (stripeSubscription as any).current_period_start
    const periodEnd = (stripeSubscription as any).current_period_end
    
    const { data: newSub, error: insertError } = await supabase
      .from('subscriptions')
      .insert({
        organization_id: organizationId,
        product_id: productId,
        stripe_subscription_id: stripeSubscription.id,
        stripe_subscription_item_id: stripeSubscription.items.data[0].id,
        status: stripeSubscription.status,
        current_period_start: periodStart
          ? new Date(periodStart * 1000).toISOString()
          : new Date().toISOString(),
        current_period_end: periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()
    
    if (insertError) {
      throw new Error('Failed to create subscription')
    }
    
    // Update organization_products
    await supabase
      .from('organization_products')
      .update({ is_active: true })
      .eq('organization_id', organizationId)
      .eq('product_id', productId)
    
    return newSub
  }
}

/**
 * Cancel a subscription at period end
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const supabase = await createServiceClient()
  
  // Fetch subscription
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single()
  
  if (subError || !subscription) {
    throw new Error('Subscription not found')
  }
  
  // Cancel subscription in Stripe at period end
  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: true,
  })
  
  // Update subscription in database
  await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)
  
  // Update organization_products
  await supabase
    .from('organization_products')
    .update({ is_active: false })
    .eq('organization_id', subscription.organization_id)
    .eq('product_id', subscription.product_id)
}

/**
 * Create a Stripe Checkout session with flexible product combinations
 * Supports mixing one-time, recurring, and usage-based products
 */
export async function createCheckoutSession(
  organizationId: string,
  productIds: string[]
): Promise<string> {
  const supabase = await createServiceClient()
  
  if (!productIds || productIds.length === 0) {
    throw new Error('At least one product must be selected')
  }
  
  // Ensure Stripe customer exists
  const customerId = await ensureStripeCustomer(organizationId)
  
  // Fetch all selected products
  const products = await Promise.all(
    productIds.map(id => getProductById(id))
  )
  
  // Filter out null products
  const validProducts = products.filter((p): p is Product => p !== null)
  
  if (validProducts.length === 0) {
    throw new Error('No valid products found')
  }
  
  // Build line items for checkout
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
  let mode: 'payment' | 'subscription' = 'payment'
  let trialPeriodDays: number | undefined = undefined
  
  // Check if we have any recurring or usage-based products
  const hasRecurringOrUsage = validProducts.some(
    p => p.product_type === 'recurring' || p.product_type === 'usage_based'
  )
  
  if (hasRecurringOrUsage) {
    mode = 'subscription'
    
    // Find the maximum trial period from recurring products
    const recurringProducts = validProducts.filter(p => p.product_type === 'recurring')
    const trialDaysArray = recurringProducts
      .map(p => p.trial_days)
      .filter((days): days is number => days !== null && days !== undefined && days > 0)
    
    if (trialDaysArray.length > 0) {
      trialPeriodDays = Math.max(...trialDaysArray)
    }
  }
  
  for (const product of validProducts) {
    if (product.product_type === 'one_time') {
      if (mode === 'subscription') {
        // For one-time products in subscription mode, we need to add them as invoice items
        // This will be handled after subscription creation via webhook
        lineItems.push({
          price: product.stripe_price_id,
          quantity: 1,
        })
      } else {
        // Pure payment mode for one-time products only
        lineItems.push({
          price: product.stripe_price_id,
          quantity: 1,
        })
      }
    } else if (product.product_type === 'recurring') {
      lineItems.push({
        price: product.stripe_price_id,
        quantity: 1,
      })
    } else if (product.product_type === 'usage_based') {
      lineItems.push({
        price: product.stripe_price_id,
      })
    }
  }
  
  // Get organization details for success URL
  const { data: org } = await supabase
    .from('organisations')
    .select('slug')
    .eq('id', organizationId)
    .single()
  
  const successUrl = org?.slug 
    ? `${process.env.NEXT_PUBLIC_APP_URL}/admin/client/${org.slug}/billing?success=true`
    : `${process.env.NEXT_PUBLIC_APP_URL}/admin/client/success`
  
  const cancelUrl = org?.slug
    ? `${process.env.NEXT_PUBLIC_APP_URL}/admin/client/${org.slug}/billing?cancelled=true`
    : `${process.env.NEXT_PUBLIC_APP_URL}/admin/client/cancelled`
  
  // Create checkout session
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: mode,
    customer: customerId,
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    payment_method_types: ['card'],
    billing_address_collection: 'auto',
    metadata: {
      organization_id: organizationId,
      product_ids: productIds.join(','),
    },
  }
  
  // Add subscription-specific settings
  if (mode === 'subscription') {
    // Always collect payment method, even during trials
    sessionParams.payment_method_collection = 'always'
    
    // Add trial period if any recurring products have trials
    if (trialPeriodDays && trialPeriodDays > 0) {
      sessionParams.subscription_data = {
        trial_period_days: trialPeriodDays,
      }
    }
  } else {
    sessionParams.invoice_creation = {
      enabled: true,
    }
  }
  
  const session = await stripe.checkout.sessions.create(sessionParams)
  
  if (!session.url) {
    throw new Error('Failed to create checkout session')
  }
  
  return session.url
}

/**
 * Create a Stripe Customer Portal session for billing management
 */
export async function createCustomerPortalSession(
  organizationId: string,
  returnUrl: string
): Promise<string> {
  const supabase = await createServiceClient()
  
  // Fetch organization
  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .select('stripe_customer_id')
    .eq('id', organizationId)
    .single()
  
  if (orgError || !org || !org.stripe_customer_id) {
    // Ensure customer exists if it doesn't
    const customerId = await ensureStripeCustomer(organizationId)
    
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })
    
    return session.url
  }
  
  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: returnUrl,
  })
  
  return session.url
}

