# Products Table

The `products` table stores product definitions for billing with support for three types: one-time payments, recurring subscriptions, and usage-based pricing with graduated tiers.

## Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Internal database ID |
| `name` | TEXT | NOT NULL | Product name (e.g., "Professional Plan", "Setup Fee") |
| `description` | TEXT | NULLABLE | Optional product description |
| `product_type` | ENUM | NOT NULL | Type: 'one_time', 'recurring', or 'usage_based' |
| `amount_cents` | INTEGER | NOT NULL | Price in cents |
| `currency` | TEXT | NOT NULL, DEFAULT 'gbp' | Currency code |
| `interval` | TEXT | DEFAULT 'month' | Billing interval for recurring products |
| `interval_count` | INTEGER | DEFAULT 1 | Number of intervals between billings |
| `trial_days` | INTEGER | NULLABLE | Trial period days for recurring products |
| `minutes_included` | INTEGER | NULLABLE | Included minutes for usage-based products |
| `price_per_minute_cents` | INTEGER | NULLABLE | Overage rate per minute for usage-based |
| `tiers` | JSONB | NULLABLE | Graduated pricing tiers for usage-based products |
| `stripe_product_id` | TEXT | NOT NULL | Stripe product ID |
| `stripe_price_id` | TEXT | NOT NULL | Stripe price ID |
| `stripe_billing_meter_id` | TEXT | NULLABLE | Stripe billing meter ID (for usage-based) |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the record was created |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the record was last updated |

## Product Types

### One-Time Products
Used for setup fees, onboarding charges, or other one-time payments.

**Required Fields:**
- `name`, `amount_cents`, `currency`, `stripe_product_id`, `stripe_price_id`

**Example:**
```sql
INSERT INTO products (
  name, description, product_type, amount_cents, currency,
  stripe_product_id, stripe_price_id
) VALUES (
  'Onboarding Setup Fee',
  'One-time setup and configuration',
  'one_time',
  50000, -- £500.00
  'gbp',
  'prod_xxxxx',
  'price_xxxxx'
);
```

### Recurring Products
Used for subscription plans with regular billing intervals.

**Required Fields:**
- `name`, `amount_cents`, `currency`, `interval`, `stripe_product_id`, `stripe_price_id`

**Optional Fields:**
- `trial_days` - Free trial period before first charge
- `interval_count` - Number of intervals (e.g., 3 months = interval='month', interval_count=3)

**Example:**
```sql
INSERT INTO products (
  name, description, product_type, amount_cents, currency,
  interval, interval_count, trial_days,
  stripe_product_id, stripe_price_id
) VALUES (
  'Professional Plan',
  'Monthly subscription with advanced features',
  'recurring',
  29900, -- £299.00/month
  'gbp',
  'month',
  1,
  14, -- 14-day trial
  'prod_xxxxx',
  'price_xxxxx'
);
```

### Usage-Based Products
Used for metered billing with graduated pricing tiers. The first tier (0 to included_minutes) has zero cost, and overage is charged at the per-minute rate.

**Required Fields:**
- `name`, `amount_cents`, `currency`, `minutes_included`, `price_per_minute_cents`, `tiers`, `stripe_product_id`, `stripe_price_id`, `stripe_billing_meter_id`

**Tiers Format:**
```json
[
  {
    "up_to": 1000,
    "flat_amount": 0,
    "unit_amount": 0
  },
  {
    "up_to": "inf",
    "unit_amount_decimal": "5.00"
  }
]
```

**Example:**
```sql
INSERT INTO products (
  name, description, product_type, amount_cents, currency,
  minutes_included, price_per_minute_cents, tiers,
  stripe_product_id, stripe_price_id, stripe_billing_meter_id
) VALUES (
  'Voice AI Minutes',
  'Pay-as-you-go voice AI usage',
  'usage_based',
  0, -- No base fee, usage only
  'gbp',
  1000, -- First 1000 minutes free
  5, -- £0.05 per minute after
  '[{"up_to": 1000, "flat_amount": 0}, {"up_to": "inf", "unit_amount_decimal": "5.00"}]'::jsonb,
  'prod_xxxxx',
  'price_xxxxx',
  'meter_xxxxx'
);
```

## Indexes

- `idx_products_stripe_product_id` on `stripe_product_id` - Fast lookups by Stripe product ID
- `idx_products_stripe_price_id` on `stripe_price_id` - Fast lookups by Stripe price ID
- `idx_products_product_type` on `product_type` - Fast filtering by product type

## Triggers

- `update_products_updated_at` - Automatically updates `updated_at` timestamp on row updates

## Usage Notes

- Products are global and can be used in any checkout session
- Each product has exactly one Stripe price (unlike the old system with base + usage prices)
- Usage-based products use graduated tiers where the first tier is always free (included minutes)
- Multiple products can be combined in a single checkout session
- Recurring products support trial periods that delay the first charge
- All prices are stored in cents to avoid floating-point precision issues

## Checkout Session Combinations

You can combine different product types in a single checkout:

1. **Setup + Subscription**: One-time setup fee + recurring monthly plan
2. **Subscription + Usage**: Recurring base fee + metered usage
3. **All Three**: Setup fee + monthly plan + usage-based minutes
4. **Setup Only**: Just a one-time payment
5. **Usage Only**: Pure pay-as-you-go with no recurring fee

## Example Queries

### Find all products by type
```sql
SELECT * FROM products 
WHERE product_type = 'recurring' 
ORDER BY amount_cents ASC;
```

### Find product by Stripe ID
```sql
SELECT * FROM products 
WHERE stripe_product_id = 'prod_xxxxx';
```

### Get products with pricing formatted
```sql
SELECT 
  name,
  product_type,
  amount_cents / 100.0 AS price_pounds,
  CASE 
    WHEN product_type = 'recurring' THEN interval
    ELSE NULL
  END AS billing_interval,
  CASE 
    WHEN product_type = 'usage_based' THEN minutes_included
    ELSE NULL
  END AS included_minutes
FROM products
ORDER BY product_type, amount_cents;
```

### Find products with trials
```sql
SELECT name, trial_days, amount_cents / 100.0 AS monthly_price
FROM products
WHERE product_type = 'recurring' 
  AND trial_days IS NOT NULL
ORDER BY trial_days DESC;
```

### Get usage-based products with overage details
```sql
SELECT 
  name,
  minutes_included,
  price_per_minute_cents / 100.0 AS overage_rate_pounds
FROM products
WHERE product_type = 'usage_based'
ORDER BY minutes_included DESC;
```

## API Functions

### `createProduct(productData)`
Creates a new product in both Stripe and the database. Handles all three product types with appropriate validation.

**One-Time Product:**
```typescript
import { createProduct } from '@/lib/products'

const product = await createProduct({
  type: 'one_time',
  name: 'Setup Fee',
  description: 'Initial setup and configuration',
  amount_cents: 50000,
  currency: 'gbp'
})
```

**Recurring Product:**
```typescript
const product = await createProduct({
  type: 'recurring',
  name: 'Professional Plan',
  description: 'Monthly subscription',
  amount_cents: 29900,
  currency: 'gbp',
  interval: 'month',
  interval_count: 1,
  trial_days: 14
})
```

**Usage-Based Product:**
```typescript
const product = await createProduct({
  type: 'usage_based',
  name: 'Voice AI Minutes',
  description: 'Pay-as-you-go usage',
  amount_cents: 0,
  currency: 'gbp',
  minutes_included: 1000,
  price_per_minute_cents: 5
})
```

### `getProducts()`
Returns all products ordered by creation date.

```typescript
import { getProducts } from '@/lib/products'

const products = await getProducts()
// Returns: Product[]
```

### `getProductsByType(type)`
Returns products filtered by type.

```typescript
import { getProductsByType } from '@/lib/products'

const recurringProducts = await getProductsByType('recurring')
// Returns: Product[]
```
