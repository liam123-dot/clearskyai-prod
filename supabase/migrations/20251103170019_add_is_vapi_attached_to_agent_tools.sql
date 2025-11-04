-- Add is_vapi_attached column to agent_tools table
-- This column tracks whether the tool is attached to the agent in VAPI's toolIds
-- true = Regular tool (attach_to_agent=true, in VAPI toolIds, callable by AI)
-- false = Preemptive-only tool (attach_to_agent=false, NOT in VAPI toolIds, only on-call-start)

-- Add the column with a default of true for new records
ALTER TABLE agent_tools 
ADD COLUMN is_vapi_attached BOOLEAN NOT NULL DEFAULT true;

-- Update existing records to false since they're all preemptive-only tools currently
UPDATE agent_tools 
SET is_vapi_attached = false;

-- Add index for faster queries filtering by is_vapi_attached
CREATE INDEX idx_agent_tools_is_vapi_attached ON agent_tools(is_vapi_attached);

