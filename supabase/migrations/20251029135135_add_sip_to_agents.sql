-- Add SIP configuration fields to agents table
ALTER TABLE agents
ADD COLUMN vapi_phone_number_id TEXT,
ADD COLUMN sip_uri TEXT;

-- Create index on sip_uri for fast lookups
CREATE INDEX idx_agents_sip_uri ON agents(sip_uri);

-- Add comments
COMMENT ON COLUMN agents.vapi_phone_number_id IS 'VAPI phone number ID for SIP calling';
COMMENT ON COLUMN agents.sip_uri IS 'SIP URI for forwarding calls (e.g., sip:username@sip.vapi.ai)';

