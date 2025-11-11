# Calls Table

The `calls` table stores call records from VAPI end-of-call reports, linking them to agents and organizations.

## Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Internal database ID |
| `organization_id` | UUID | NOT NULL, REFERENCES organisations(id) ON DELETE CASCADE | Organization that owns this call |
| `agent_id` | UUID | REFERENCES agents(id) ON DELETE SET NULL | Agent that handled this call |
| `phone_number_id` | UUID | REFERENCES phone_numbers(id) ON DELETE SET NULL | Phone number that received this call |
| `call_sid` | TEXT | NULL | Twilio Call SID for matching call records across endpoints |
| `caller_number` | TEXT | NULL | Phone number of the caller |
| `called_number` | TEXT | NULL | Phone number that was called |
| `control_url` | TEXT | NULL | VAPI control URL for live call injection (derived from Stream URL in TwiML response) |
| `event_sequence` | JSONB | NOT NULL, DEFAULT '[]'::jsonb | Array of call events: `[{type: string, timestamp: string, details: object}]` |
| `routing_status` | TEXT | NULL | Call routing status: 'transferred_to_team', 'team_no_answer', 'direct_to_agent', 'completed' |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the call was created |
| `data` | JSONB | NOT NULL | Full VAPI end-of-call report data |

## Indexes

- `idx_calls_organization_id` on `organization_id` - Fast lookups by organization
- `idx_calls_agent_id` on `agent_id` - Fast lookups by agent
- `idx_calls_call_sid` on `call_sid` - Fast lookups by Twilio Call SID
- `idx_calls_phone_number_id` on `phone_number_id` - Fast lookups by phone number
- `idx_calls_phone_number_created` on `(phone_number_id, created_at DESC)` - Composite index for phone number queries
- `idx_calls_created_at` on `created_at DESC` - Time-based queries
- `idx_calls_org_created` on `(organization_id, created_at DESC)` - Composite index for filtered time queries

## Relationships

- **organizations**: Many-to-one relationship. When an organization is deleted, all their calls are deleted (CASCADE)
- **agents**: Many-to-one relationship. When an agent is deleted, calls are kept but agent_id is set to NULL (SET NULL)
- **phone_numbers**: Many-to-one relationship. When a phone number is deleted, calls are kept but phone_number_id is set to NULL (SET NULL)

## Webhook Flow

### Incoming Call Flow

1. Call comes in to `/api/phone-number/[id]/incoming`
2. System checks schedules and creates initial call record with:
   - `call_sid` from Twilio
   - `phone_number_id`
   - `organization_id` from phone number
   - `agent_id` from phone number
   - `routing_status`: 'transferred_to_team' or 'direct_to_agent'
   - `event_sequence`: `[{type: 'incoming_call', timestamp: now, details: {from, to}}]`
3. If transferred to team and no answer, falls back to `/api/phone-number/[id]/incoming/fallback`
4. Fallback route updates call record:
   - `routing_status`: 'team_no_answer'
   - Appends to `event_sequence`: `{type: 'team_no_answer', timestamp: now, details: {dial_status}}`
5. Call routes to agent endpoint `/api/agent/[id]/call-incoming`
6. VAPI sends end-of-call report to `/api/vapi/webhook`
7. Webhook finds existing call record by `call_sid`
8. Updates call record with:
   - Full report data in `data` field
   - Appends to `event_sequence`: `{type: 'agent_call_completed', timestamp: now, details: report}`
   - Updates `routing_status` if needed

### Event Sequence Format

The `event_sequence` JSONB array tracks the call lifecycle:
```json
[
  {
    "type": "incoming_call",
    "timestamp": "2024-10-30T09:00:00Z",
    "details": {
      "from": "+1234567890",
      "to": "+1987654321"
    }
  },
  {
    "type": "team_no_answer",
    "timestamp": "2024-10-30T09:00:30Z",
    "details": {
      "dial_status": "no-answer"
    }
  },
  {
    "type": "agent_call_completed",
    "timestamp": "2024-10-30T09:05:00Z",
    "details": { /* VAPI report data */ }
  }
]
```

### Routing Status Values

- `transferred_to_team`: Call was transferred to a team number per schedule
- `team_no_answer`: Team number didn't answer, falling back to agent
- `direct_to_agent`: Call went directly to agent (no schedule match or routing disabled)
- `completed`: Call completed successfully

## Usage Notes

- Calls are automatically linked to the correct organization through the agent relationship
- The `data` field stores the complete VAPI report as JSONB for flexible querying
- Calls are automatically cleaned up when agents or organizations are deleted
- All timestamps are stored in UTC

## Example Queries

### Get all calls for an organization
```sql
SELECT * FROM calls 
WHERE organization_id = 'uuid-here'
ORDER BY created_at DESC;
```

### Get all calls for a specific agent
```sql
SELECT * FROM calls 
WHERE agent_id = 'uuid-here'
ORDER BY created_at DESC;
```

### Get calls with agent and organization details
```sql
SELECT 
  c.*,
  a.vapi_assistant_id,
  o.slug as organization_slug
FROM calls c
JOIN agents a ON c.agent_id = a.id
JOIN organisations o ON c.organization_id = o.id
WHERE c.organization_id = 'uuid-here'
ORDER BY c.created_at DESC
LIMIT 100;
```

### Get calls within a date range
```sql
SELECT * FROM calls
WHERE organization_id = 'uuid-here'
  AND created_at >= '2024-01-01'
  AND created_at < '2024-02-01'
ORDER BY created_at DESC;
```

### Query call data (JSONB)
```sql
-- Get calls with specific duration
SELECT * FROM calls
WHERE (data->'call'->>'duration')::int > 60
ORDER BY created_at DESC;

-- Get calls by status
SELECT * FROM calls
WHERE data->'call'->>'status' = 'completed'
ORDER BY created_at DESC;
```

### Count calls by agent
```sql
SELECT 
  a.vapi_assistant_id,
  COUNT(*) as call_count
FROM calls c
JOIN agents a ON c.agent_id = a.id
WHERE c.organization_id = 'uuid-here'
GROUP BY a.id, a.vapi_assistant_id
ORDER BY call_count DESC;
```

## Revenue and Margin Calculation

### API Endpoint: `/api/admin/calls/[id]/revenue`

Admin-only endpoint that calculates revenue and profit margin for a specific call based on the organization's active subscription and product pricing.

**Method**: `GET`

**Authentication**: Requires admin privileges

**Response Format**:
```typescript
{
  callDurationMinutes: number
  totalCost: number
  includedMinutesRate?: {
    basePriceCents: number
    minutesIncluded: number
    ratePerMinuteCents: number
    ratePerMinuteFormatted: string
    revenueCents: number
    revenueFormatted: string
    marginCents: number
    marginFormatted: string
    marginPercentage: number
    calculation: string
  }
  overageRate?: {
    pricePerMinuteCents: number
    pricePerMinuteFormatted: string
    revenueCents: number
    revenueFormatted: string
    marginCents: number
    marginFormatted: string
    marginPercentage: number
  }
  productName?: string
  hasActiveSubscription: boolean
}
```

**Calculation Logic**:

1. **Included Minutes Rate**: 
   - Calculates effective rate per minute: `base_price_cents ÷ minutes_included`
   - Revenue for call: `rate_per_minute × call_duration_minutes`
   - Margin: `revenue - (total_cost × 100)` (converting cost to cents)
   - Margin percentage: `(margin ÷ revenue) × 100`

2. **Overage Rate**:
   - Uses `price_per_minute_cents` from product
   - Revenue for call: `price_per_minute_cents × call_duration_minutes`
   - Margin: `revenue - (total_cost × 100)`
   - Margin percentage: `(margin ÷ revenue) × 100`

**Notes**:
- Both scenarios are calculated and displayed since the system doesn't yet track which billing tier (included vs overage) each call falls into
- Cost data comes from VAPI's `call.data.costs` array
- Only calculates for organizations with active subscriptions and usage-based products
- Returns `hasActiveSubscription: false` if no active subscription is found

