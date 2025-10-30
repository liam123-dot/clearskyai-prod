-- Add call tracking fields to calls table
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS phone_number_id UUID REFERENCES phone_numbers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS call_sid TEXT,
ADD COLUMN IF NOT EXISTS event_sequence JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS routing_status TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_calls_call_sid ON calls(call_sid);
CREATE INDEX IF NOT EXISTS idx_calls_phone_number_id ON calls(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_calls_phone_number_created ON calls(phone_number_id, created_at DESC);

-- Add comments
COMMENT ON COLUMN calls.phone_number_id IS 'Phone number that received this call';
COMMENT ON COLUMN calls.call_sid IS 'Twilio Call SID for matching call records across endpoints';
COMMENT ON COLUMN calls.event_sequence IS 'Array of call events: [{type: string, timestamp: string, details: object}]';
COMMENT ON COLUMN calls.routing_status IS 'Call routing status: transferred_to_team, team_no_answer, direct_to_agent, completed';

-- Add constraint for routing_status values
ALTER TABLE calls
ADD CONSTRAINT check_routing_status CHECK (
  routing_status IS NULL OR
  routing_status IN ('transferred_to_team', 'team_no_answer', 'direct_to_agent', 'completed')
);

