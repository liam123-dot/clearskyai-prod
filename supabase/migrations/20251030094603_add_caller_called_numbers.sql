-- Add caller_number and called_number columns to calls table
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS caller_number TEXT,
ADD COLUMN IF NOT EXISTS called_number TEXT;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_calls_caller_number ON calls(caller_number);
CREATE INDEX IF NOT EXISTS idx_calls_called_number ON calls(called_number);

-- Add comments
COMMENT ON COLUMN calls.caller_number IS 'Phone number of the caller';
COMMENT ON COLUMN calls.called_number IS 'Phone number that was called';

