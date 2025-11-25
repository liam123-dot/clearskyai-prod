-- Rename vapi_assistant_id to external_agent_id and add provider column
-- Migration for agents table

-- Add the new provider column first with default value
ALTER TABLE agents 
ADD COLUMN provider TEXT NOT NULL DEFAULT 'vapi';

-- Drop the existing index on vapi_assistant_id
DROP INDEX IF EXISTS idx_agents_vapi_assistant_id;

-- Rename the column
ALTER TABLE agents 
RENAME COLUMN vapi_assistant_id TO external_agent_id;

-- Create a new index on the renamed column
CREATE INDEX idx_agents_external_agent_id ON agents(external_agent_id);

-- Add check constraint to ensure provider is either 'vapi' or 'eleven_labs'
ALTER TABLE agents 
ADD CONSTRAINT agents_provider_check CHECK (provider IN ('vapi', 'elevenlabs'));

-- Update the comment on the table
COMMENT ON COLUMN agents.external_agent_id IS 'External agent ID from the provider (VAPI or ElevenLabs)';
COMMENT ON COLUMN agents.provider IS 'AI provider: vapi or elevenlabs';

