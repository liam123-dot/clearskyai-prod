import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { syncSingleSubscription } from "@/lib/billing"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')
    
    if (!signature) {
      console.error('No Stripe signature found')
      return NextResponse.json(
        { error: 'No signature' },
        { status: 400 }
      )
    }
    
    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }
    
    console.log('Stripe webhook received:', event.type)
    
    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription)
        break
      
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break
      
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break
      
      case 'payment_method.attached':
        await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod)
        break
      
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
    
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

/**
 * Handle checkout session completion
 * This is the primary event for the new checkout flow
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const supabase = await createServiceClient()
  
  console.log('Checkout session completed:', session.id)
  
  // Extract organization ID from metadata
  const organizationId = session.metadata?.organization_id
  if (!organizationId) {
    console.error('No organization_id in checkout session metadata')
    return
  }
  
  // Handle subscription mode
  if (session.mode === 'subscription' && session.subscription) {
    const subscriptionId = typeof session.subscription === 'string' 
      ? session.subscription 
      : session.subscription.id
    
    // Fetch full subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price']
    })
    
    // Sync the subscription using our new function
    const result = await syncSingleSubscription(subscription, organizationId)
    
    if (result.success) {
      console.log(`Subscription ${subscriptionId} synced for organization ${organizationId}`)
    } else {
      console.error(`Failed to sync subscription: ${result.error}`)
    }
  }
  
  // Handle payment mode (one-time payments)
  if (session.mode === 'payment' && session.payment_intent) {
    console.log(`One-time payment completed for organization ${organizationId}`)
    // One-time payments are already handled by invoice events
  }
  
  // Update organization's payment method status
  if (session.customer) {
    const customerId = typeof session.customer === 'string' 
      ? session.customer 
      : session.customer.id
    
    // Check if customer has payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
      limit: 1,
    })
    
    const hasPaymentMethod = paymentMethods.data.length > 0
    
    // Update in database
    await supabase
      .from('organisations')
      .update({ 
        stripe_customer_id: customerId,
        // Note: has_payment_method is checked dynamically, not stored
      })
      .eq('id', organizationId)
  }
  
  console.log(`Checkout session ${session.id} processed successfully`)
}

/**
 * Handle subscription events using the new sync function
 */
async function handleSubscriptionEvent(subscription: Stripe.Subscription) {
  const result = await syncSingleSubscription(subscription)
  
  if (result.success) {
    console.log(`Subscription ${subscription.id} synced successfully`)
  } else {
    console.error(`Failed to sync subscription ${subscription.id}: ${result.error}`)
  }
}

/**
 * Handle successful invoice payments
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const supabase = await createServiceClient()
  
  console.log(`Invoice ${invoice.id} paid successfully`)
  
  // Get organization by customer ID
  const { data: org } = await supabase
    .from('organisations')
    .select('id')
    .eq('stripe_customer_id', invoice.customer as string)
    .single()
  
  if (!org) {
    console.warn('Organization not found for invoice')
    return
  }
  
  // If this invoice is for a subscription, sync the subscription
  const subscriptionRef = (invoice as any).subscription
  if (subscriptionRef) {
    const subscriptionId = typeof subscriptionRef === 'string'
      ? subscriptionRef
      : subscriptionRef.id
    
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    await syncSingleSubscription(subscription, org.id)
  }
  
  console.log(`Invoice payment processed for organization ${org.id}`)
}

/**
 * Handle failed invoice payments
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const supabase = await createServiceClient()
  
  console.error(`Invoice ${invoice.id} payment failed`)
  
  // Get organization by customer ID
  const { data: org } = await supabase
    .from('organisations')
    .select('id, name')
    .eq('stripe_customer_id', invoice.customer as string)
    .single()
  
  if (!org) {
    console.warn('Organization not found for failed invoice')
    return
  }
  
  // TODO: Send notification to organization about failed payment
  // This could trigger an email or in-app notification
  
  console.log(`Payment failure recorded for organization ${org.id}`)
}

/**
 * Handle payment method attached
 */
async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
  console.log(`Payment method ${paymentMethod.id} attached to customer ${paymentMethod.customer}`)
  
  // Payment method status is checked dynamically when needed
  // No need to store this in database
}
