-- Create agent_knowledge_bases join table
CREATE TABLE IF NOT EXISTS agent_knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  vapi_tool_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agent_id, knowledge_base_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_bases_agent_id ON agent_knowledge_bases(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_bases_knowledge_base_id ON agent_knowledge_bases(knowledge_base_id);

-- Create trigger for agent_knowledge_bases table
CREATE TRIGGER update_agent_knowledge_bases_updated_at
  BEFORE UPDATE ON agent_knowledge_bases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

