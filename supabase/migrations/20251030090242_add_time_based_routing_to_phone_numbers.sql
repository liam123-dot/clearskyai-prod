-- Add time_based_routing_enabled column to phone_numbers table
ALTER TABLE phone_numbers
ADD COLUMN IF NOT EXISTS time_based_routing_enabled BOOLEAN NOT NULL DEFAULT false;

-- Add comment
COMMENT ON COLUMN phone_numbers.time_based_routing_enabled IS 'Whether time-based routing is enabled for this phone number';

