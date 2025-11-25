-- Add elevenlabs_phone_number_id column to phone_numbers table
ALTER TABLE phone_numbers
ADD COLUMN IF NOT EXISTS elevenlabs_phone_number_id TEXT NULL;

-- Create index on elevenlabs_phone_number_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_phone_numbers_elevenlabs_phone_number_id ON phone_numbers(elevenlabs_phone_number_id);

-- Add comment
COMMENT ON COLUMN phone_numbers.elevenlabs_phone_number_id IS 'ElevenLabs phone number ID (for Twilio numbers registered with ElevenLabs)';

