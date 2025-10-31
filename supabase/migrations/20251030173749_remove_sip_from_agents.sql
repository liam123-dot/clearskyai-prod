-- Remove SIP configuration fields from agents table
-- Drop index first, then drop columns

DROP INDEX IF EXISTS idx_agents_sip_uri;

ALTER TABLE agents
DROP COLUMN IF EXISTS vapi_phone_number_id,
DROP COLUMN IF EXISTS sip_uri;


