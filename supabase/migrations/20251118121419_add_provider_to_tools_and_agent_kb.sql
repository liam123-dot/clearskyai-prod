-- Add provider support to tools and agent_knowledge_bases tables

-- 1. Add provider column to tools table
ALTER TABLE tools
ADD COLUMN provider TEXT NOT NULL DEFAULT 'vapi'
CHECK (provider IN ('vapi', 'elevenlabs'));

-- 2. Update existing tools to have provider='vapi'
UPDATE tools SET provider = 'vapi';

-- 3. Rename vapi_tool_id to external_tool_id in agent_knowledge_bases
ALTER TABLE agent_knowledge_bases
RENAME COLUMN vapi_tool_id TO external_tool_id;

-- 4. Add provider column to agent_knowledge_bases table
ALTER TABLE agent_knowledge_bases
ADD COLUMN provider TEXT
CHECK (provider IN ('vapi', 'elevenlabs'));

-- 5. Update existing agent_knowledge_bases to have provider='vapi' where external_tool_id is not null
UPDATE agent_knowledge_bases
SET provider = 'vapi'
WHERE external_tool_id IS NOT NULL;

