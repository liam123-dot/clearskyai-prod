-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  vapi_assistant_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on organization_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_agents_organization_id ON agents(organization_id);

-- Create index on vapi_assistant_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_agents_vapi_assistant_id ON agents(vapi_assistant_id);

-- Create trigger for agents table
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

