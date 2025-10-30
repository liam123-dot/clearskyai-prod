-- Add billing_email column to organisations table
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS billing_email TEXT;

