-- Fix subscriptions table to support multiple items per subscription
-- Remove unique constraint on stripe_subscription_id
-- Add composite unique constraint on (stripe_subscription_id, stripe_subscription_item_id)

-- Drop the unique constraint on stripe_subscription_id
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_stripe_subscription_id_key;

-- Add composite unique constraint on both subscription ID and item ID
-- This allows multiple subscription items from the same Stripe subscription
ALTER TABLE subscriptions 
ADD CONSTRAINT subscriptions_stripe_subscription_item_unique 
UNIQUE (stripe_subscription_id, stripe_subscription_item_id);

