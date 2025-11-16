-- Add 'handoff' to the tools type check constraint
ALTER TABLE tools DROP CONSTRAINT IF EXISTS tools_type_check;
ALTER TABLE tools ADD CONSTRAINT tools_type_check 
  CHECK (type IN ('query', 'sms', 'apiRequest', 'transferCall', 'externalApp', 'pipedream_action', 'transfer_call', 'handoff'));

