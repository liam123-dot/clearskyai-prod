-- Create organization_products table
CREATE TABLE IF NOT EXISTS organization_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  attached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, product_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_organization_products_organization_id ON organization_products(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_products_product_id ON organization_products(product_id);
CREATE INDEX IF NOT EXISTS idx_organization_products_is_active ON organization_products(is_active);

-- Create trigger for organization_products table
CREATE TRIGGER update_organization_products_updated_at
  BEFORE UPDATE ON organization_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

