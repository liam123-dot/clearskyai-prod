-- Make external_tool_id nullable (preemptive-only tools won't have VAPI tool IDs)
ALTER TABLE tools 
ALTER COLUMN external_tool_id DROP NOT NULL;

-- Add attach_to_agent column
ALTER TABLE tools 
ADD COLUMN attach_to_agent BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN tools.attach_to_agent IS 
'If false, tool cannot be attached to agents and only runs preemptively (on-call-start). If true, tool can be attached and used during conversation.';

COMMENT ON COLUMN tools.external_tool_id IS 
'VAPI tool ID. NULL for preemptive-only tools that are not attached to agents.';

