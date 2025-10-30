-- Create tools table
CREATE TABLE IF NOT EXISTS tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  external_tool_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('query', 'sms', 'apiRequest', 'transferCall', 'externalApp')),
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tools_organization_id ON tools(organization_id);
CREATE INDEX IF NOT EXISTS idx_tools_external_tool_id ON tools(external_tool_id);
CREATE INDEX IF NOT EXISTS idx_tools_type ON tools(type);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_tools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tools_updated_at
  BEFORE UPDATE ON tools
  FOR EACH ROW
  EXECUTE FUNCTION update_tools_updated_at();

-- Add comments
COMMENT ON TABLE tools IS 'Stores VAPI tools assigned to organizations';
COMMENT ON COLUMN tools.id IS 'Internal database ID';
COMMENT ON COLUMN tools.name IS 'Tool name';
COMMENT ON COLUMN tools.organization_id IS 'Organization that owns this tool';
COMMENT ON COLUMN tools.external_tool_id IS 'VAPI tool ID';
COMMENT ON COLUMN tools.type IS 'Type of tool: query, sms, apiRequest, transferCall, externalApp';
COMMENT ON COLUMN tools.data IS 'Full VAPI tool configuration as JSONB';
COMMENT ON COLUMN tools.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN tools.updated_at IS 'Timestamp when the record was last updated';

