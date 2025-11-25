-- Add provider column to calls table
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'vapi';

-- Add constraint for provider values
ALTER TABLE calls
ADD CONSTRAINT check_calls_provider CHECK (
  provider IN ('vapi', 'elevenlabs')
);

-- Create index on provider for filtering
CREATE INDEX IF NOT EXISTS idx_calls_provider ON calls(provider);

-- Add comment
COMMENT ON COLUMN calls.provider IS 'AI provider: vapi or elevenlabs';

