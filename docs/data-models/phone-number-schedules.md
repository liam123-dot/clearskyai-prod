# Phone Number Schedules Table

The `phone_number_schedules` table stores time-based routing schedules for phone numbers, allowing calls to be routed to different numbers based on the day of week and time of day.

## Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Internal database ID |
| `phone_number_id` | UUID | NOT NULL, REFERENCES phone_numbers(id) ON DELETE CASCADE | Phone number this schedule applies to |
| `days` | INTEGER[] | NOT NULL | Array of day numbers (0=Sunday, 1=Monday, ..., 6=Saturday) |
| `start_time` | TIME | NOT NULL | Start time for this schedule (HH:MM format) |
| `end_time` | TIME | NOT NULL | End time for this schedule (HH:MM format) |
| `transfer_to_number` | TEXT | NOT NULL | Phone number to transfer calls to during this schedule |
| `dial_timeout` | INTEGER | NOT NULL, DEFAULT 30 | Seconds before dial times out |
| `agent_fallback_enabled` | BOOLEAN | NOT NULL, DEFAULT true | Whether to fallback to agent if transfer fails |
| `enabled` | BOOLEAN | NOT NULL, DEFAULT true | Whether this schedule is active |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the record was created |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the record was last updated |

## Constraints

- `check_end_time_after_start_time`: Ensures end_time is after start_time
- `check_valid_days`: Ensures days array contains 1-7 values, all between 0-6

## Indexes

- `idx_phone_number_schedules_phone_number_id` on `phone_number_id` - Fast lookups by phone number
- `idx_phone_number_schedules_phone_number_enabled` on `(phone_number_id, enabled)` - Fast lookups for active schedules

## Triggers

- `update_phone_number_schedules_updated_at` - Automatically updates `updated_at` timestamp on row updates

## Relationships

- **phone_numbers**: Many-to-one relationship. When a phone number is deleted, all its schedules are deleted (CASCADE)

## Overlap Validation Rules

Schedules must not overlap for the same phone number:
- Two schedules overlap if:
  1. Their `days` arrays have at least one day in common (intersection not empty)
  2. Their time ranges overlap: `start_time < other.end_time AND end_time > other.start_time`

## Usage Notes

- Multiple schedules can exist for the same phone number, but they must not overlap
- When a call comes in, the system checks all enabled schedules for the phone number
- If `time_based_routing_enabled` is false on the phone number, schedules are ignored
- If no matching schedule is found, calls route directly to the assigned agent
- If a schedule matches and the transfer fails (no answer), it falls back to the agent if `agent_fallback_enabled` is true

## Example Queries

### Find all schedules for a phone number
```sql
SELECT * FROM phone_number_schedules 
WHERE phone_number_id = 'uuid-here' 
ORDER BY start_time;
```

### Find active schedules for a phone number
```sql
SELECT * FROM phone_number_schedules 
WHERE phone_number_id = 'uuid-here' 
  AND enabled = true
ORDER BY start_time;
```

### Find schedules matching a specific day and time
```sql
SELECT * FROM phone_number_schedules 
WHERE phone_number_id = 'uuid-here'
  AND enabled = true
  AND 2 = ANY(days)  -- Tuesday (day 2)
  AND start_time <= '14:30'::time
  AND end_time > '14:30'::time;
```

### Check for overlapping schedules
```sql
-- Find schedules that overlap with a given schedule
SELECT s1.*, s2.*
FROM phone_number_schedules s1
JOIN phone_number_schedules s2 ON s1.phone_number_id = s2.phone_number_id
WHERE s1.id != s2.id
  AND s1.enabled = true
  AND s2.enabled = true
  AND s1.start_time < s2.end_time
  AND s1.end_time > s2.start_time
  AND EXISTS (
    SELECT 1 FROM unnest(s1.days) AS d1
    INTERSECT
    SELECT 1 FROM unnest(s2.days) AS d2
  );
```

### Create a schedule (Monday-Friday, 9 AM - 5 PM)
```sql
INSERT INTO phone_number_schedules (
  phone_number_id,
  days,
  start_time,
  end_time,
  transfer_to_number,
  dial_timeout,
  agent_fallback_enabled
)
VALUES (
  'phone-number-uuid',
  ARRAY[1, 2, 3, 4, 5],  -- Mon-Fri
  '09:00'::time,
  '17:00'::time,
  '+1234567890',
  30,
  true
);
```

### Update a schedule
```sql
UPDATE phone_number_schedules
SET days = ARRAY[1, 2, 3, 4, 5],
    start_time = '08:00'::time,
    end_time = '18:00'::time,
    transfer_to_number = '+1987654321'
WHERE id = 'schedule-uuid';
```

### Disable a schedule
```sql
UPDATE phone_number_schedules
SET enabled = false
WHERE id = 'schedule-uuid';
```

## Day Numbers Reference

- 0 = Sunday
- 1 = Monday
- 2 = Tuesday
- 3 = Wednesday
- 4 = Thursday
- 5 = Friday
- 6 = Saturday

