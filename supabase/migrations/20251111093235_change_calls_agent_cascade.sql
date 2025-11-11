-- Change calls.agent_id foreign key from ON DELETE CASCADE to ON DELETE SET NULL
-- This preserves call history when agents are deleted

-- Drop the existing foreign key constraint
ALTER TABLE calls
DROP CONSTRAINT IF EXISTS calls_agent_id_fkey;

-- Alter the column to allow NULL values
ALTER TABLE calls
ALTER COLUMN agent_id DROP NOT NULL;

-- Add a new foreign key constraint with ON DELETE SET NULL
ALTER TABLE calls
ADD CONSTRAINT calls_agent_id_fkey
FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL;

