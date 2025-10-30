# Organization Products Table

The `organization_products` table tracks which products are attached to which organizations and whether they're active.

## Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Internal database ID |
| `organization_id` | UUID | NOT NULL, REFERENCES organisations(id) ON DELETE CASCADE | Organization that has the product attached |
| `product_id` | UUID | NOT NULL, REFERENCES products(id) ON DELETE CASCADE | Product that is attached |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT FALSE | Whether the product has an active subscription |
| `attached_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | When the product was attached |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the record was created |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the record was last updated |

## Indexes

- `idx_organization_products_organization_id` on `organization_id` - Fast lookups by organization
- `idx_organization_products_product_id` on `product_id` - Fast lookups by product
- `idx_organization_products_is_active` on `is_active` - Fast filtering by active status

## Constraints

- `UNIQUE(organization_id, product_id)` - An organization can only have each product attached once

## Triggers

- `update_organization_products_updated_at` - Automatically updates `updated_at` timestamp on row updates

## Usage Notes

- "Attached" means the product is available to the organization but not necessarily active
- `is_active` becomes true when a subscription is started for that product
- An organization can have multiple products attached, but typically only one active at a time
- When a product is attached, it appears in the organization's billing page
- The admin must collect a payment method before activating a product

## Example Queries

### Find all products attached to an organization
```sql
SELECT p.* 
FROM products p
JOIN organization_products op ON op.product_id = p.id
WHERE op.organization_id = 'org-uuid-here';
```

### Find active product for an organization
```sql
SELECT p.* 
FROM products p
JOIN organization_products op ON op.product_id = p.id
WHERE op.organization_id = 'org-uuid-here' 
  AND op.is_active = TRUE;
```

### Find all organizations using a specific product
```sql
SELECT o.* 
FROM organisations o
JOIN organization_products op ON op.organization_id = o.id
WHERE op.product_id = 'product-uuid-here' 
  AND op.is_active = TRUE;
```

