-- Create function to validate days array
CREATE OR REPLACE FUNCTION validate_days_array(days_array INTEGER[])
RETURNS BOOLEAN AS $$
BEGIN
  -- Check array is not null and has length between 1 and 7
  IF array_length(days_array, 1) IS NULL OR array_length(days_array, 1) < 1 OR array_length(days_array, 1) > 7 THEN
    RETURN FALSE;
  END IF;
  
  -- Check all values are between 0 and 6
  RETURN NOT EXISTS (
    SELECT 1 FROM unnest(days_array) AS d
    WHERE d < 0 OR d > 6
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create phone_number_schedules table
CREATE TABLE IF NOT EXISTS phone_number_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id UUID NOT NULL REFERENCES phone_numbers(id) ON DELETE CASCADE,
  days INTEGER[] NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  transfer_to_number TEXT NOT NULL,
  dial_timeout INTEGER NOT NULL DEFAULT 30,
  agent_fallback_enabled BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_end_time_after_start_time CHECK (end_time > start_time),
  CONSTRAINT check_valid_days CHECK (validate_days_array(days))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_phone_number_schedules_phone_number_id ON phone_number_schedules(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_phone_number_schedules_phone_number_enabled ON phone_number_schedules(phone_number_id, enabled);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_phone_number_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_phone_number_schedules_updated_at
    BEFORE UPDATE ON phone_number_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_phone_number_schedules_updated_at();

-- Add comments
COMMENT ON TABLE phone_number_schedules IS 'Time-based routing schedules for phone numbers';
COMMENT ON COLUMN phone_number_schedules.phone_number_id IS 'Phone number this schedule applies to';
COMMENT ON COLUMN phone_number_schedules.days IS 'Array of day numbers (0=Sunday, 1=Monday, ..., 6=Saturday)';
COMMENT ON COLUMN phone_number_schedules.start_time IS 'Start time for this schedule (HH:MM format)';
COMMENT ON COLUMN phone_number_schedules.end_time IS 'End time for this schedule (HH:MM format)';
COMMENT ON COLUMN phone_number_schedules.transfer_to_number IS 'Phone number to transfer calls to during this schedule';
COMMENT ON COLUMN phone_number_schedules.dial_timeout IS 'Seconds before dial times out';
COMMENT ON COLUMN phone_number_schedules.agent_fallback_enabled IS 'Whether to fallback to agent if transfer fails';
COMMENT ON COLUMN phone_number_schedules.enabled IS 'Whether this schedule is active';

