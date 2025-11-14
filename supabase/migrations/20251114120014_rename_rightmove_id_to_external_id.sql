-- Rename rightmove_id to external_id to support multiple property platforms
-- This makes the column generic enough to store IDs from Rightmove, Zoopla, or other sources

-- Rename the column
ALTER TABLE properties RENAME COLUMN rightmove_id TO external_id;

-- The UNIQUE constraint on rightmove_id should automatically be renamed
-- But let's verify and add a comment for clarity
COMMENT ON COLUMN properties.external_id IS 'External property ID from the source platform (e.g., Rightmove ID, Zoopla ID)';
COMMENT ON COLUMN properties.source IS 'Property data source platform (e.g., ''rightmove'', ''zoopla'')';

