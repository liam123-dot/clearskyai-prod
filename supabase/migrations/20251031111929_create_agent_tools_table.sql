-- Create agent_tools join table
-- Tracks tools with attach_to_agent = false that are attached to specific agents
-- These tools execute on call start but are not added to VAPI's toolIds
CREATE TABLE IF NOT EXISTS agent_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agent_id, tool_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_agent_tools_agent_id ON agent_tools(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tools_tool_id ON agent_tools(tool_id);

-- Create trigger for agent_tools table
CREATE TRIGGER update_agent_tools_updated_at
  BEFORE UPDATE ON agent_tools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE agent_tools IS 'Tracks tools with attach_to_agent = false that are attached to specific agents. These tools execute on call start but are not added to VAPI toolIds.';
COMMENT ON COLUMN agent_tools.agent_id IS 'The agent this tool is attached to';
COMMENT ON COLUMN agent_tools.tool_id IS 'The tool attached to this agent';

