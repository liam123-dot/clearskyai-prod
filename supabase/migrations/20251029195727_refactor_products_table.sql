-- Refactor products table to support three product types
-- with graduated pricing for usage-based products

-- Create product_type enum
CREATE TYPE product_type AS ENUM ('one_time', 'recurring', 'usage_based');

-- Drop existing table and recreate with new schema
-- Since there are no existing products, we can safely drop and recreate
DROP TABLE IF EXISTS products CASCADE;

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Product identification
  name TEXT NOT NULL,
  description TEXT,
  product_type product_type NOT NULL,
  
  -- Pricing
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'gbp',
  
  -- Recurring product fields
  interval TEXT DEFAULT 'month',
  interval_count INTEGER DEFAULT 1,
  trial_days INTEGER,
  
  -- Usage-based product fields
  minutes_included INTEGER,
  price_per_minute_cents INTEGER,
  tiers JSONB,
  
  -- Stripe integration
  stripe_product_id TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL,
  stripe_billing_meter_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_products_stripe_product_id ON products(stripe_product_id);
CREATE INDEX idx_products_stripe_price_id ON products(stripe_price_id);
CREATE INDEX idx_products_product_type ON products(product_type);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();

-- Add comments for documentation
COMMENT ON TABLE products IS 'Stores product definitions for billing with support for one-time, recurring, and usage-based pricing';
COMMENT ON COLUMN products.product_type IS 'Type of product: one_time (setup fees), recurring (subscriptions), or usage_based (metered with graduated tiers)';
COMMENT ON COLUMN products.trial_days IS 'Number of trial days for recurring products';
COMMENT ON COLUMN products.tiers IS 'Graduated pricing tiers for usage-based products in JSON format';
COMMENT ON COLUMN products.minutes_included IS 'Included minutes for usage-based products (first tier at £0)';
COMMENT ON COLUMN products.price_per_minute_cents IS 'Per-minute rate for usage above included minutes';

