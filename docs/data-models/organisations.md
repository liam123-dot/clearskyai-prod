# Organisations Table

The `organisations` table stores organization data synced from WorkOS.

## Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Internal database ID |
| `external_id` | TEXT | UNIQUE, NOT NULL | WorkOS organization ID |
| `slug` | TEXT | UNIQUE, NOT NULL | URL-safe identifier for the organization |
| `name` | TEXT | NULLABLE | Organization name |
| `stripe_customer_id` | TEXT | NULLABLE | Stripe customer ID for billing |
| `billing_email` | TEXT | NULLABLE | Email address for invoice delivery |
| `permissions` | JSONB | NOT NULL, DEFAULT '{}' | Organization-specific permissions configuration |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the record was created |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the record was last updated |

## Indexes

- `idx_organisations_external_id` on `external_id` - Fast lookups by WorkOS organization ID
- `idx_organisations_slug` on `slug` - Fast lookups by slug for URL routing

## Triggers

- `update_organisations_updated_at` - Automatically updates `updated_at` timestamp on row updates

## Usage Notes

- The `id` field is used internally in the application, while `external_id` maps to WorkOS
- The `slug` is auto-generated from the organization name and guaranteed to be unique
- When a WorkOS organization is first accessed, a record is automatically created
- The internal `id` is synced back to WorkOS as the `externalId` field
- Permissions are stored as JSONB for flexible configuration
- `stripe_customer_id` is automatically created when billing operations are initiated
- `billing_email` is used for invoice delivery and can be set during setup fee creation

## Example Queries

### Find organization by slug
```sql
SELECT * FROM organisations WHERE slug = 'acme-corp';
```

### Find organization by WorkOS ID
```sql
SELECT * FROM organisations WHERE external_id = 'org_01234567890';
```

### Update organization permissions
```sql
UPDATE organisations 
SET permissions = '{"feature_x": true, "feature_y": false}'::jsonb
WHERE id = 'uuid-here';
```

### Update billing email
```sql
UPDATE organisations 
SET billing_email = 'billing@example.com'
WHERE id = 'uuid-here';
```

### Find organizations with Stripe customers
```sql
SELECT * FROM organisations 
WHERE stripe_customer_id IS NOT NULL;

