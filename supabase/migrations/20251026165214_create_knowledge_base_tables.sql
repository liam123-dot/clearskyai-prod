-- Enable PostGIS for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create knowledge base type enum
CREATE TYPE knowledge_base_type AS ENUM ('general', 'estate_agent');

-- Create knowledge_bases table
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type knowledge_base_type NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for knowledge_bases
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_organization_id ON knowledge_bases(organization_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_type ON knowledge_bases(type);

-- Create trigger for knowledge_bases
CREATE TRIGGER update_knowledge_bases_updated_at
  BEFORE UPDATE ON knowledge_bases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create properties table
CREATE TABLE IF NOT EXISTS properties (
  -- Primary identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'rightmove',
  rightmove_id TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  
  -- Core property details
  beds INTEGER,
  baths INTEGER,
  price DECIMAL(12,2) NOT NULL,
  property_type TEXT,
  property_subtype TEXT,
  title TEXT,
  
  -- Transaction type
  transaction_type TEXT NOT NULL,
  
  -- Broken down address (for better filtering)
  street_address TEXT,
  city TEXT,
  district TEXT,
  postcode TEXT,
  postcode_district TEXT,
  county TEXT,
  full_address TEXT NOT NULL,
  
  -- Location data (for proximity searches)
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  location GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (
    CASE 
      WHEN latitude IS NOT NULL AND longitude IS NOT NULL 
      THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
      ELSE NULL
    END
  ) STORED,
  
  -- Rental-specific
  deposit DECIMAL(12,2),
  let_available_date TEXT,
  minimum_term_months INTEGER,
  let_type TEXT,
  furnished_type TEXT,
  
  -- Sale-specific
  tenure_type TEXT,
  years_remaining_lease INTEGER,
  
  -- Boolean flags for quick filtering
  has_nearby_station BOOLEAN GENERATED ALWAYS AS (
    (original_data->'nearestStations' IS NOT NULL 
     AND jsonb_array_length(original_data->'nearestStations') > 0)
  ) STORED,
  has_online_viewing BOOLEAN,
  is_retirement BOOLEAN DEFAULT false,
  is_shared_ownership BOOLEAN,
  pets_allowed BOOLEAN,
  bills_included BOOLEAN,
  
  -- Media counts
  image_count INTEGER,
  has_floorplan BOOLEAN,
  has_virtual_tour BOOLEAN,
  
  -- Rich text content
  description TEXT,
  features TEXT[],
  
  -- Metadata
  added_on DATE,
  scraped_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Store complete original data
  original_data JSONB NOT NULL
);

-- Indexes for properties table
CREATE INDEX IF NOT EXISTS idx_properties_knowledge_base_id ON properties(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_properties_source ON properties(source);
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_beds ON properties(beds);
CREATE INDEX IF NOT EXISTS idx_properties_baths ON properties(baths);
CREATE INDEX IF NOT EXISTS idx_properties_property_type ON properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_transaction_type ON properties(transaction_type);
CREATE INDEX IF NOT EXISTS idx_properties_added_on ON properties(added_on DESC);
CREATE INDEX IF NOT EXISTS idx_properties_has_nearby_station ON properties(has_nearby_station) WHERE has_nearby_station = true;
CREATE INDEX IF NOT EXISTS idx_properties_furnished_type ON properties(furnished_type);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_district ON properties(district);
CREATE INDEX IF NOT EXISTS idx_properties_postcode ON properties(postcode);
CREATE INDEX IF NOT EXISTS idx_properties_postcode_district ON properties(postcode_district);
CREATE INDEX IF NOT EXISTS idx_properties_city_postcode ON properties(city, postcode_district);
CREATE INDEX IF NOT EXISTS idx_properties_location ON properties USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_properties_description_fts ON properties USING gin(to_tsvector('english', description));

-- Create trigger for properties
CREATE TRIGGER update_properties_updated_at 
  BEFORE UPDATE ON properties 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

