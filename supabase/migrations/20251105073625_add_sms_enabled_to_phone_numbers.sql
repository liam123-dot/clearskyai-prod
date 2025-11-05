-- Add sms_enabled column to phone_numbers table
ALTER TABLE phone_numbers
ADD COLUMN sms_enabled BOOLEAN NOT NULL DEFAULT true;

-- Update existing records to default to true (already handled by DEFAULT, but explicit for clarity)
UPDATE phone_numbers
SET sms_enabled = true
WHERE sms_enabled IS NULL;

-- Add comment
COMMENT ON COLUMN phone_numbers.sms_enabled IS 'Whether SMS is enabled for this phone number';

