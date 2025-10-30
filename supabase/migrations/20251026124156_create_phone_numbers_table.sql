-- Create phone_numbers table
CREATE TABLE phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT UNIQUE NOT NULL,
    provider TEXT NOT NULL DEFAULT 'twilio',
    credentials JSONB NOT NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
    owned_by_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_phone_numbers_phone_number ON phone_numbers(phone_number);
CREATE INDEX idx_phone_numbers_agent_id ON phone_numbers(agent_id);
CREATE INDEX idx_phone_numbers_organization_id ON phone_numbers(organization_id);
CREATE INDEX idx_phone_numbers_owned_by_admin ON phone_numbers(owned_by_admin);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_phone_numbers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_phone_numbers_updated_at
    BEFORE UPDATE ON phone_numbers
    FOR EACH ROW
    EXECUTE FUNCTION update_phone_numbers_updated_at();

-- Add comments
COMMENT ON TABLE phone_numbers IS 'Phone numbers with provider credentials for handling incoming calls';
COMMENT ON COLUMN phone_numbers.phone_number IS 'Phone number in E.164 format';
COMMENT ON COLUMN phone_numbers.provider IS 'Provider name (twilio, vonage, etc.)';
COMMENT ON COLUMN phone_numbers.credentials IS 'Provider-specific credentials stored as JSONB';
COMMENT ON COLUMN phone_numbers.agent_id IS 'Agent assigned to this phone number (many-to-one)';
COMMENT ON COLUMN phone_numbers.organization_id IS 'Organization that owns this phone number';
COMMENT ON COLUMN phone_numbers.owned_by_admin IS 'Whether this number is owned by admin vs organization';

