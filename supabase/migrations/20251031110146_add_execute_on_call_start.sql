-- Add execute_on_call_start column to tools table
ALTER TABLE tools 
ADD COLUMN execute_on_call_start BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tools.execute_on_call_start IS 
'If true, this tool executes automatically when a call starts, before the agent speaks';

-- Add control_url column to calls table
ALTER TABLE calls
ADD COLUMN control_url TEXT;

COMMENT ON COLUMN calls.control_url IS
'VAPI control URL for live call injection (derived from Stream URL in TwiML)';

