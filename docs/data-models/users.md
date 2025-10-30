# Users Table

The `users` table stores user data synced from WorkOS.

## Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Internal database ID |
| `external_id` | TEXT | UNIQUE, NOT NULL | WorkOS user ID |
| `email` | TEXT | UNIQUE, NOT NULL | User's email address |
| `organization_id` | UUID | FOREIGN KEY (organisations.id) ON DELETE SET NULL | Reference to the user's organization |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the record was created |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the record was last updated |

## Indexes

- `idx_users_external_id` on `external_id` - Fast lookups by WorkOS user ID
- `idx_users_email` on `email` - Fast lookups by email address
- `idx_users_organization_id` on `organization_id` - Fast lookups by organization

## Triggers

- `update_users_updated_at` - Automatically updates `updated_at` timestamp on row updates

## Foreign Keys

- `organization_id` references `organisations(id)` with ON DELETE SET NULL
  - If an organization is deleted, users' `organization_id` is set to NULL

## Usage Notes

- The `id` field is used internally in the application, while `external_id` maps to WorkOS
- Users are associated with organizations via the `organization_id` field
- Email addresses are unique across all users
- Admin users are determined by checking email against a hardcoded list (not stored in database)

## Example Queries

### Find user by email
```sql
SELECT * FROM users WHERE email = 'user@example.com';
```

### Find user by WorkOS ID
```sql
SELECT * FROM users WHERE external_id = 'user_01234567890';
```

### Find all users in an organization
```sql
SELECT u.* FROM users u
WHERE u.organization_id = 'uuid-here';
```

### Find user with organization details
```sql
SELECT u.*, o.slug as org_slug, o.permissions as org_permissions
FROM users u
LEFT JOIN organisations o ON u.organization_id = o.id
WHERE u.email = 'user@example.com';
```

