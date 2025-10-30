-- Create calls table
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data JSONB NOT NULL
);

-- Create index on organization_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_calls_organization_id ON calls(organization_id);

-- Create index on agent_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_calls_agent_id ON calls(agent_id);

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at DESC);

-- Create composite index for organization queries with time filtering
CREATE INDEX IF NOT EXISTS idx_calls_org_created ON calls(organization_id, created_at DESC);

