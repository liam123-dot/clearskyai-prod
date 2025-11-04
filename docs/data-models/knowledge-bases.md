# Knowledge Bases Table

The `knowledge_bases` table stores knowledge base configurations for different types of knowledge sources.

## Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Internal database ID |
| `organization_id` | UUID | NOT NULL, FOREIGN KEY (organisations.id) ON DELETE CASCADE | Reference to the organization |
| `name` | TEXT | NOT NULL | Name of the knowledge base |
| `type` | knowledge_base_type | NOT NULL | Type of knowledge base: 'general' or 'estate_agent' |
| `data` | JSONB | NOT NULL, DEFAULT '{}' | Type-specific configuration data |
| `location_data` | JSONB | NULL | Cached location keywords for estate agent knowledge bases (cities, districts, subDistricts, postcodeDistricts, streets) |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the record was created |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the record was last updated |

## Indexes

- `idx_knowledge_bases_organization_id` on `organization_id` - Fast lookups by organization
- `idx_knowledge_bases_type` on `type` - Fast filtering by knowledge base type

## Triggers

- `update_knowledge_bases_updated_at` - Automatically updates `updated_at` timestamp on row updates

## Foreign Keys

- `organization_id` references `organisations(id)` with ON DELETE CASCADE
  - If an organization is deleted, all their knowledge bases are deleted

## Knowledge Base Types

### General
For general-purpose knowledge bases that can contain files, links, and text. The `data` field may contain:
```json
{}
```

### Estate Agent
For property listing knowledge bases that sync from external sources. The `data` field contains:
```json
{
  "for_sale_url": "https://www.rightmove.co.uk/...",
  "rental_url": "https://www.rightmove.co.uk/...",
  "resync_schedule": "6_hours" | "12_hours" | "daily" | "none"
}
```

The `location_data` field (separate from `data`) contains cached location keywords extracted from properties:
```json
{
  "cities": ["London", "Manchester", "Birmingham"],
  "districts": ["Kensington", "Westminster", "Salford"],
  "subDistricts": ["North Kensington", "Pimlico"],
  "postcodeDistricts": ["SW1A", "M1", "B1"],
  "streets": ["High Street", "Main Road"],
  "allKeywords": ["London", "Manchester", "Kensington", ...]
}
```

Location data is automatically extracted and cached after properties are synced from RightMove. This data is used for speech-to-text transcription accuracy and is displayed in a separate location data sidebar component.

## Usage Notes

- Knowledge bases are organization-scoped
- The `data` JSONB field provides flexible configuration based on type
- For estate_agent type, URLs point to RightMove search results that will be scraped
- Re-sync schedules trigger background jobs to refresh property data
- Properties are linked via the `properties` table using `knowledge_base_id`

## Example Queries

### Find all knowledge bases for an organization
```sql
SELECT * FROM knowledge_bases 
WHERE organization_id = 'uuid-here'
ORDER BY created_at DESC;
```

### Find estate agent knowledge bases
```sql
SELECT * FROM knowledge_bases 
WHERE type = 'estate_agent'
AND organization_id = 'uuid-here';
```

### Get knowledge base with configuration
```sql
SELECT 
  kb.*,
  kb.data->>'for_sale_url' as for_sale_url,
  kb.data->>'rental_url' as rental_url,
  kb.data->>'resync_schedule' as resync_schedule
FROM knowledge_bases kb
WHERE id = 'uuid-here';
```

### Count properties in a knowledge base
```sql
SELECT 
  kb.name,
  COUNT(p.id) as property_count
FROM knowledge_bases kb
LEFT JOIN properties p ON p.knowledge_base_id = kb.id
WHERE kb.id = 'uuid-here'
GROUP BY kb.id, kb.name;
```

