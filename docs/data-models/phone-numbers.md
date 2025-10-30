# Phone Numbers Table

The `phone_numbers` table stores phone numbers with their provider credentials for handling incoming calls. It supports multiple providers (Twilio, Vonage, etc.) through a flexible JSONB credentials field.

## Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Internal database ID |
| `phone_number` | TEXT | UNIQUE, NOT NULL | Phone number in E.164 format (e.g., +14155551234) |
| `provider` | TEXT | NOT NULL, DEFAULT 'twilio' | Provider name (twilio, vonage, etc.) |
| `credentials` | JSONB | NOT NULL | Provider-specific credentials |
| `agent_id` | UUID | REFERENCES agents(id) ON DELETE SET NULL | Agent assigned to this number (many-to-one) |
| `organization_id` | UUID | REFERENCES organisations(id) ON DELETE CASCADE | Organization that owns this number |
| `owned_by_admin` | BOOLEAN | NOT NULL, DEFAULT false | Whether owned by admin vs organization |
| `vapi_phone_number_id` | TEXT | NULL | VAPI phone number ID (for Twilio numbers registered with VAPI) |
| `time_based_routing_enabled` | BOOLEAN | NOT NULL, DEFAULT false | Whether time-based routing is enabled for this phone number |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the record was created |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the record was last updated |

## Indexes

- `idx_phone_numbers_phone_number` on `phone_number` - Fast lookups by phone number
- `idx_phone_numbers_agent_id` on `agent_id` - Fast lookups by assigned agent
- `idx_phone_numbers_organization_id` on `organization_id` - Fast lookups by organization
- `idx_phone_numbers_owned_by_admin` on `owned_by_admin` - Fast filtering by ownership type
- `idx_phone_numbers_vapi_phone_number_id` on `vapi_phone_number_id` - Fast lookups by VAPI phone number ID

## Relationships

- **phone_number_schedules**: One-to-many relationship. Phone numbers can have multiple schedules for time-based routing

## Triggers

- `update_phone_numbers_updated_at` - Automatically updates `updated_at` timestamp on row updates

## Provider Credentials Format

### Twilio
```json
{
  "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "auth_token": "your_auth_token",
  "phone_number_sid": "PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

### Future Providers
The `credentials` JSONB field allows flexible structure for any provider:
```json
{
  "api_key": "...",
  "api_secret": "...",
  "provider_specific_field": "..."
}
```

## Usage Notes

- Multiple phone numbers can be assigned to the same agent (many-to-one relationship)
- Phone numbers can be owned by admin (`owned_by_admin = true`) or by organizations
- Admin-owned numbers can be assigned to organizations for their use
- When an organization is deleted, their phone numbers are automatically deleted (CASCADE)
- When an agent is deleted, phone numbers are unassigned (SET NULL)
- Credentials are stored encrypted at rest by the database

### VAPI Integration

- Twilio phone numbers are automatically registered with VAPI when imported or purchased
- The `vapi_phone_number_id` stores the VAPI phone number ID for integration
- When a phone number is assigned to an agent, it is also linked to the agent's VAPI assistant
- The webhook URL is set on Twilio when assigning to an agent to point to our server endpoint

## Example Queries

### Find all phone numbers
```sql
SELECT * FROM phone_numbers ORDER BY created_at DESC;
```

### Find phone numbers for an organization
```sql
SELECT * FROM phone_numbers 
WHERE organization_id = 'uuid-here' 
ORDER BY phone_number;
```

### Find phone numbers assigned to an agent
```sql
SELECT * FROM phone_numbers 
WHERE agent_id = 'uuid-here';
```

### Find admin-owned phone numbers
```sql
SELECT * FROM phone_numbers 
WHERE owned_by_admin = true;
```

### Import a Twilio phone number
```sql
INSERT INTO phone_numbers (
  phone_number, 
  provider, 
  credentials, 
  organization_id, 
  owned_by_admin
)
VALUES (
  '+14155551234',
  'twilio',
  '{"account_sid": "ACxxx", "auth_token": "xxx", "phone_number_sid": "PNxxx"}'::jsonb,
  'org-uuid-here',
  false
);
```

### Assign phone number to agent
```sql
UPDATE phone_numbers 
SET agent_id = 'agent-uuid-here'
WHERE id = 'phone-number-uuid-here';
```

### Get phone number with agent and organization details
```sql
SELECT 
  pn.*,
  a.vapi_assistant_id,
  o.slug as organization_slug,
  o.external_id as organization_external_id
FROM phone_numbers pn
LEFT JOIN agents a ON pn.agent_id = a.id
LEFT JOIN organisations o ON pn.organization_id = o.id
WHERE pn.phone_number = '+14155551234';
```

## API Functions

### `getPhoneNumbers()`
Returns all phone numbers in the system (admin only).

### `getPhoneNumbersByOrganization(organizationId)`
Returns phone numbers owned by or assigned to a specific organization.

### `importPhoneNumber(data)`
Imports a phone number into the database with provider credentials.

### `assignPhoneNumberToAgent(phoneNumberId, agentId)`
Links a phone number to an agent for call handling.

### `assignPhoneNumberToOrganization(phoneNumberId, organizationId)`
Assigns an admin-owned phone number to an organization.

## Security Considerations

1. Credentials are stored in JSONB and encrypted at rest by PostgreSQL
2. API routes must validate ownership before allowing access to credentials
3. Only admins can view all phone numbers
4. Organizations can only view/import their own phone numbers
5. Credentials should never be sent to the client unless necessary

