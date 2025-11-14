# Properties Table

The `properties` table stores property listings scraped from external sources (Rightmove, Zoopla) for estate agent knowledge bases.

## Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Internal database ID |
| `knowledge_base_id` | UUID | NOT NULL, FOREIGN KEY (knowledge_bases.id) ON DELETE CASCADE | Reference to the knowledge base |
| `source` | TEXT | NOT NULL, DEFAULT 'rightmove' | Data source provider ('rightmove' or 'zoopla') |
| `external_id` | TEXT | UNIQUE, NOT NULL | External property identifier from the source platform |
| `url` | TEXT | NOT NULL | URL to the property listing |
| `beds` | INTEGER | | Number of bedrooms |
| `baths` | INTEGER | | Number of bathrooms |
| `price` | DECIMAL(12,2) | NOT NULL | Monthly price for rentals, total for sales |
| `property_type` | TEXT | | Type (e.g., 'Flats / Apartments', 'Houses') |
| `property_subtype` | TEXT | | Subtype (e.g., 'Duplex', 'Detached', 'Semi-Detached') |
| `title` | TEXT | | Property title |
| `transaction_type` | TEXT | NOT NULL | 'rent' or 'sale' |
| `street_address` | TEXT | | Street address |
| `city` | TEXT | | City name |
| `district` | TEXT | | District/area (e.g., 'Kensington', 'Westminster') |
| `postcode` | TEXT | | Full postcode |
| `postcode_district` | TEXT | | Postcode district (first part only) |
| `county` | TEXT | | County name |
| `full_address` | TEXT | NOT NULL | Complete address string |
| `latitude` | DECIMAL(10,8) | | Latitude coordinate |
| `longitude` | DECIMAL(11,8) | | Longitude coordinate |
| `location` | GEOGRAPHY(Point, 4326) | GENERATED, STORED | PostGIS geography point for proximity searches |
| `deposit` | DECIMAL(12,2) | | Rental deposit amount |
| `let_available_date` | TEXT | | When property becomes available |
| `minimum_term_months` | INTEGER | | Minimum rental term in months |
| `let_type` | TEXT | | 'Long term' or 'Short term' |
| `furnished_type` | TEXT | | 'Furnished', 'Unfurnished', 'Part Furnished', 'Not Specified' |
| `tenure_type` | TEXT | | Sale tenure type |
| `years_remaining_lease` | INTEGER | | Years remaining on lease (for leasehold) |
| `has_nearby_station` | BOOLEAN | GENERATED, STORED | Auto-computed from original_data |
| `has_online_viewing` | BOOLEAN | | Whether online viewing is available |
| `is_retirement` | BOOLEAN | DEFAULT false | Retirement property flag |
| `is_shared_ownership` | BOOLEAN | | Shared ownership flag |
| `pets_allowed` | BOOLEAN | | Whether pets are allowed |
| `bills_included` | BOOLEAN | | Whether bills are included in rent |
| `image_count` | INTEGER | | Number of property images |
| `has_floorplan` | BOOLEAN | | Whether floorplan is available |
| `has_virtual_tour` | BOOLEAN | | Whether virtual tour is available |
| `description` | TEXT | | Property description |
| `features` | TEXT[] | | Array of property features |
| `added_on` | DATE | | Date property was added to RightMove |
| `scraped_at` | TIMESTAMP | DEFAULT NOW() | When data was scraped |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update timestamp |
| `original_data` | JSONB | NOT NULL | Complete original data from source |

## Indexes

### Filtering Indexes
- `idx_properties_knowledge_base_id` on `knowledge_base_id` - Fast lookups by knowledge base
- `idx_properties_source` on `source` - Filter by data source
- `idx_properties_price` on `price` - Price range queries
- `idx_properties_beds` on `beds` - Filter by number of bedrooms
- `idx_properties_baths` on `baths` - Filter by number of bathrooms
- `idx_properties_property_type` on `property_type` - Filter by property type
- `idx_properties_transaction_type` on `transaction_type` - Filter rent vs sale
- `idx_properties_furnished_type` on `furnished_type` - Filter by furnishing
- `idx_properties_has_nearby_station` on `has_nearby_station` (partial) - Properties near stations

### Location Indexes
- `idx_properties_city` on `city` - Filter by city
- `idx_properties_district` on `district` - Filter by district
- `idx_properties_postcode` on `postcode` - Filter by postcode
- `idx_properties_postcode_district` on `postcode_district` - Filter by postcode area
- `idx_properties_city_postcode` on `(city, postcode_district)` - Composite location filter
- `idx_properties_location` on `location` USING GIST - Geospatial proximity searches

### Other Indexes
- `idx_properties_added_on` on `added_on DESC` - Sort by date added
- `idx_properties_description_fts` on `to_tsvector('english', description)` - Full-text search

## Triggers

- `update_properties_updated_at` - Automatically updates `updated_at` timestamp on row updates

## Generated Columns

### location
Automatically computed from `latitude` and `longitude`:
```sql
ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
```

### has_nearby_station
Automatically computed from `original_data`:
```sql
(original_data->'nearestStations' IS NOT NULL 
 AND jsonb_array_length(original_data->'nearestStations') > 0)
```

## Usage Notes

- Properties are automatically deleted when their knowledge base is deleted (CASCADE)
- The `location` field enables proximity searches (e.g., "properties within 5km of a point")
- Full-text search on descriptions allows semantic property searches
- The `original_data` JSONB field preserves all data from the source platform (Rightmove or Zoopla) for future use
- Filter queries can combine multiple indexes for efficient property searches
- The `external_id` field stores platform-specific identifiers (Rightmove ID, Zoopla UPRN, etc.)
- The `source` field indicates which platform the property data came from

## Example Queries

### Find all properties for a knowledge base
```sql
SELECT * FROM properties
WHERE knowledge_base_id = 'uuid-here'
ORDER BY added_on DESC;
```

### Filter properties by criteria
```sql
SELECT * FROM properties
WHERE knowledge_base_id = 'uuid-here'
  AND transaction_type = 'rent'
  AND beds >= 2
  AND price <= 2000
  AND city = 'London'
  AND postcode_district = 'W8'
ORDER BY price ASC;
```

### Find properties near a location (5km radius)
```sql
SELECT 
  id,
  title,
  full_address,
  price,
  ST_Distance(
    location,
    ST_SetSRID(ST_MakePoint(-0.1951, 51.4993), 4326)::geography
  ) / 1000 as distance_km
FROM properties
WHERE knowledge_base_id = 'uuid-here'
  AND ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint(-0.1951, 51.4993), 4326)::geography,
    5000
  )
ORDER BY distance_km ASC;
```

### Full-text search on descriptions
```sql
SELECT * FROM properties
WHERE knowledge_base_id = 'uuid-here'
  AND to_tsvector('english', description) @@ to_tsquery('english', 'garden & parking')
ORDER BY added_on DESC;
```

### Get filter options for a knowledge base
```sql
SELECT 
  MIN(price) as min_price,
  MAX(price) as max_price,
  MIN(beds) as min_beds,
  MAX(beds) as max_beds,
  ARRAY_AGG(DISTINCT city) as cities,
  ARRAY_AGG(DISTINCT district) as districts,
  ARRAY_AGG(DISTINCT property_type) as property_types
FROM properties
WHERE knowledge_base_id = 'uuid-here';
```

## Location Filtering (API)

The property query API supports general location filtering using Google Maps Geocoding API. This allows users to search for properties near a location (e.g., "London") rather than exact city/district/postcode matches.

### API Usage

**Endpoint:** `POST /api/query/estate-agent/{id}`

**Request Body:**
```json
{
  "location": "London",
  "location_radius_km": 25,
  "beds": 2,
  "transaction_type": "rent",
  "price": {
    "filter": "under",
    "value": 2000
  }
}
```

**Response:**
```json
{
  "properties": [
    {
      "id": "uuid",
      "title": "Property Title",
      "full_address": "123 Main St, London, SW1A 1AA",
      "price": 1500,
      "distance_km": 2.5,
      ...
    }
  ],
  "totalCount": 15,
  "refinements": [...]
}
```

### Location Filter Parameters

- `location` (string, optional): General location search query (e.g., "London", "Manchester, UK"). This will be geocoded using Google Maps API to get coordinates.
- `location_radius_km` (number, optional): Search radius in kilometers. Defaults to 25km if not specified.

### How It Works

1. When `location` is provided, the API geocodes the location string using Google Maps Geocoding API to get latitude/longitude coordinates.
2. Properties are filtered to those within the specified radius (using PostGIS `ST_DWithin`).
3. Results are sorted by distance from the location center (nearest first), then by date added.
4. Each property result includes a `distance_km` field showing the distance from the search location.

### Fallback Behavior

- If geocoding fails, the API falls back to treating `location` as a text search on the `city` field.
- If a property doesn't have coordinates (`latitude`/`longitude`), it won't be included in location-filtered results.

### Environment Variables

Required for location filtering:
- `GOOGLE_MAPS_API_KEY`: Google Maps Geocoding API key

Optional for address normalization:
- `OPENAI_API_KEY`: OpenAI API key (for enhanced address normalization)

