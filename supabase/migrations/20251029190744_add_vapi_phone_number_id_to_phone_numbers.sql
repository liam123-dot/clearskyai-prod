-- Add vapi_phone_number_id column to phone_numbers table
-- This stores the VAPI phone number ID for Twilio numbers registered with VAPI

ALTER TABLE phone_numbers 
ADD COLUMN vapi_phone_number_id TEXT NULL;

-- Create index for lookups
CREATE INDEX idx_phone_numbers_vapi_phone_number_id ON phone_numbers(vapi_phone_number_id);

-- Add comment
COMMENT ON COLUMN phone_numbers.vapi_phone_number_id IS 'VAPI phone number ID returned when the number is registered with VAPI';

