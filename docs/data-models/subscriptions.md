# Subscriptions Table

The `subscriptions` table stores active and historical subscription data synced from Stripe.

## Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Internal database ID |
| `organization_id` | UUID | NOT NULL, REFERENCES organisations(id) ON DELETE CASCADE | Organization that has the subscription |
| `product_id` | UUID | NOT NULL, REFERENCES products(id) ON DELETE CASCADE | Product being subscribed to |
| `stripe_subscription_id` | TEXT | NOT NULL | Stripe subscription ID |
| `stripe_subscription_item_id` | TEXT | NOT NULL | Stripe subscription item ID (for usage reporting) |
| `status` | TEXT | NOT NULL | Subscription status (active, cancelled, past_due, etc.) |
| `current_period_start` | TIMESTAMP WITH TIME ZONE | NOT NULL | Start of current billing period |
| `current_period_end` | TIMESTAMP WITH TIME ZONE | NOT NULL | End of current billing period |
| `started_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | When the subscription was first created |
| `cancelled_at` | TIMESTAMP WITH TIME ZONE | NULLABLE | When the subscription was cancelled (if applicable) |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the record was created |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the record was last updated |

## Constraints

- `UNIQUE(stripe_subscription_id, stripe_subscription_item_id)` - Each subscription item is unique (allows multiple items per subscription)

## Indexes

- `idx_subscriptions_organization_id` on `organization_id` - Fast lookups by organization
- `idx_subscriptions_product_id` on `product_id` - Fast lookups by product
- `idx_subscriptions_stripe_subscription_id` on `stripe_subscription_id` - Fast lookups by Stripe ID
- `idx_subscriptions_status` on `status` - Fast filtering by status

## Triggers

- `update_subscriptions_updated_at` - Automatically updates `updated_at` timestamp on row updates

## Usage Notes

- Subscriptions are created when an organization starts using a product
- The `stripe_subscription_item_id` is used for reporting usage to Stripe's billing meter
- Status values include: `active`, `trialing`, `past_due`, `cancelled`, `unpaid`
- When a subscription is cancelled, it remains active until `current_period_end`
- Billing periods are monthly and automatically renew unless cancelled
- Usage tracking happens separately via Stripe's metering system

## Example Queries

### Find active subscriptions for an organization
```sql
SELECT s.*, p.name as product_name
FROM subscriptions s
JOIN products p ON p.id = s.product_id
WHERE s.organization_id = 'org-uuid-here'
  AND s.status IN ('active', 'trialing');
```

### Find subscriptions ending soon
```sql
SELECT s.*, o.name as org_name, p.name as product_name
FROM subscriptions s
JOIN organisations o ON o.id = s.organization_id
JOIN products p ON p.id = s.product_id
WHERE s.current_period_end < NOW() + INTERVAL '7 days'
  AND s.status = 'active';
```

### Find all subscriptions for a product
```sql
SELECT s.*, o.name as org_name
FROM subscriptions s
JOIN organisations o ON o.id = s.organization_id
WHERE s.product_id = 'product-uuid-here'
  AND s.status = 'active';
```

### Get subscription revenue summary
```sql
SELECT 
  p.name as product,
  COUNT(*) as active_subscriptions,
  SUM(p.base_price_cents) / 100.0 as monthly_recurring_revenue
FROM subscriptions s
JOIN products p ON p.id = s.product_id
WHERE s.status = 'active'
GROUP BY p.id, p.name;
```

