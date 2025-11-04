-- Add location_data JSONB column to knowledge_bases table
-- This stores cached location keywords (cities, districts, subDistricts, postcodeDistricts, streets)
-- extracted from properties for estate agent knowledge bases

ALTER TABLE knowledge_bases
ADD COLUMN IF NOT EXISTS location_data JSONB;

-- Add comment to document the structure
COMMENT ON COLUMN knowledge_bases.location_data IS 'Cached location keywords for estate agent knowledge bases. Structure: { cities: string[], districts: string[], subDistricts: string[], postcodeDistricts: string[], streets: string[] }';

