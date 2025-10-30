-- Update tools table to add new columns for VAPI integration
-- This migration adds the fields needed to support tool creation, editing, and execution

-- Add new columns
ALTER TABLE tools
ADD COLUMN IF NOT EXISTS label TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS function_schema JSONB,
ADD COLUMN IF NOT EXISTS static_config JSONB,
ADD COLUMN IF NOT EXISTS config_metadata JSONB,
ADD COLUMN IF NOT EXISTS async BOOLEAN DEFAULT false;

-- Update existing tools to have required fields (if any exist)
UPDATE tools
SET 
  label = name,
  description = COALESCE((data->>'description')::text, 'Tool'),
  function_schema = '{}'::jsonb,
  static_config = '{}'::jsonb,
  config_metadata = '{}'::jsonb,
  async = false
WHERE label IS NULL;

-- Now make label and function_schema NOT NULL
ALTER TABLE tools
ALTER COLUMN label SET NOT NULL,
ALTER COLUMN function_schema SET NOT NULL;

-- Update type check constraint to include pipedream_action type
ALTER TABLE tools DROP CONSTRAINT IF EXISTS tools_type_check;
ALTER TABLE tools ADD CONSTRAINT tools_type_check 
  CHECK (type IN ('query', 'sms', 'apiRequest', 'transferCall', 'externalApp', 'pipedream_action', 'transfer_call'));

-- Add comments for new columns
COMMENT ON COLUMN tools.label IS 'User-friendly display name for the tool';
COMMENT ON COLUMN tools.description IS 'Description of when and how the AI should use this tool';
COMMENT ON COLUMN tools.function_schema IS 'Function signature that the AI sees (parameters AI can provide)';
COMMENT ON COLUMN tools.static_config IS 'Fixed configuration hidden from AI (merged with AI params at execution)';
COMMENT ON COLUMN tools.config_metadata IS 'Full ToolConfig object for editing the tool';
COMMENT ON COLUMN tools.async IS 'Whether the tool should run asynchronously without waiting for completion';

