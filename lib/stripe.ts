import Stripe from 'stripe'
import { createServiceClient } from './supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

/**
 * Get or create the global billing meter for minutes usage
 * This meter is shared across all organizations
 */
export async function getBillingMeter(): Promise<Stripe.Billing.Meter> {
  // Search for existing meter
  const meters = await stripe.billing.meters.list({ limit: 100 })
  
  const existingMeter = meters.data.find(
    meter => meter.display_name === 'Clearsky AI - Seconds Usage'
  )
  
  if (existingMeter) {
    return existingMeter
  }
  
  // Create new meter if not found
  const newMeter = await stripe.billing.meters.create({
    display_name: 'Clearsky AI - Seconds Usage',
    event_name: 'seconds_used',
    default_aggregation: {
      formula: 'sum',
    },
    value_settings: {
      event_payload_key: 'seconds_used',
    },
    customer_mapping: {
      event_payload_key: 'customer_id',
      type: 'by_id',
    },
  })
  
  return newMeter
}

/**
 * Ensure a Stripe customer exists for the organization
 * Creates one if it doesn't exist
 */
export async function ensureStripeCustomer(organizationId: string): Promise<string> {
  const supabase = await createServiceClient()
  
  // Fetch organization from database
  const { data: org, error } = await supabase
    .from('organisations')
    .select('id, name, billing_email, stripe_customer_id')
    .eq('id', organizationId)
    .single()
  
  if (error || !org) {
    throw new Error('Organization not found')
  }
  
  // If customer already exists, return it
  if (org.stripe_customer_id) {
    return org.stripe_customer_id
  }
  
  // Create new Stripe customer
  const customer = await stripe.customers.create({
    name: org.name,
    email: org.billing_email || undefined,
    metadata: {
      organization_id: org.id,
    },
  })
  
  // Update organization with customer ID
  await supabase
    .from('organisations')
    .update({ stripe_customer_id: customer.id })
    .eq('id', organizationId)
  
  return customer.id
}

/**
 * Check if a customer has a payment method on file
 */
export async function checkPaymentMethod(customerId: string): Promise<boolean> {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
    limit: 1,
  })
  
  return paymentMethods.data.length > 0
}

/**
 * Get invoices for a customer
 */
export async function getInvoices(customerId: string): Promise<Stripe.Invoice[]> {
  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit: 100,
  })
  
  return invoices.data
}

/**
 * Create a meter event for usage tracking
 * Uses idempotency key to prevent duplicate events
 */
export async function createMeterEvent(params: {
  customerId: string
  seconds: number
  callId: string
}): Promise<void> {
  const { customerId, seconds, callId } = params
  
  // Get the billing meter
  const meter = await getBillingMeter()
  
  try {
    // Send meter event with idempotency
    await stripe.billing.meterEvents.create({
      event_name: 'seconds_used',
      payload: {
        customer_id: customerId,
        seconds_used: seconds.toString(),
      },
      identifier: callId, // Ensures idempotency - same call ID won't create duplicate events
    })
    
    console.log(`Meter event created: ${seconds} seconds for customer ${customerId} (call ${callId})`)
  } catch (error) {
    console.error('Error creating meter event:', error)
    throw error
  }
}

/**
 * Get usage records for a billing meter and customer in the current billing period
 */
export async function getCustomerUsageForMeter(
  customerId: string,
  meterId: string,
  subscriptionStart: number,
  subscriptionEnd: number
): Promise<number> {
  try {
    // Align timestamps to minute boundaries as required by the API
    // Round down start time to the nearest minute
    const startTime = Math.floor(subscriptionStart / 60) * 60
    // Round up end time to the nearest minute
    const endTime = Math.ceil(subscriptionEnd / 60) * 60

    console.log('startTime', startTime)
    console.log('endTime', endTime)
    console.log('meterId', meterId)
    console.log('customerId', customerId)
    
    // Get meter event summaries for the billing period
    // Using the correct Stripe API endpoint
    const meterEventSummaries = await stripe.billing.meters.listEventSummaries(
      meterId,
      {
        customer: customerId,
        start_time: startTime,
        end_time: endTime,
      }
    )

    console.log('meterEventSummaries', JSON.stringify(meterEventSummaries.data, null, 2))
    
    // Sum up all the aggregated values from the summaries
    let totalSeconds = 0
    for (const summary of meterEventSummaries.data) {
      totalSeconds += summary.aggregated_value || 0
    }
    
    return totalSeconds
  } catch (error) {
    console.error('Error fetching usage records:', error)
    // Return 0 if there's an error or no usage records
    return 0
  }
}

export { stripe }
