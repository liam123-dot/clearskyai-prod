-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  base_price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'gbp',
  minutes_included INTEGER NOT NULL,
  price_per_minute_cents INTEGER NOT NULL,
  stripe_product_id TEXT NOT NULL,
  stripe_base_price_id TEXT NOT NULL,
  stripe_usage_price_id TEXT NOT NULL,
  stripe_billing_meter_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on stripe_product_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_stripe_product_id ON products(stripe_product_id);

-- Create trigger for products table
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

