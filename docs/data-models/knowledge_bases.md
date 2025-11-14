# Knowledge Bases Table

The `knowledge_bases` table stores knowledge base configurations for organizations. Knowledge bases can be of different types, with `estate_agent` type supporting property listings from Rightmove or Zoopla.

## Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Internal database ID |
| `organization_id` | UUID | NOT NULL, FOREIGN KEY (organisations.id) ON DELETE CASCADE | Reference to the organization |
| `name` | TEXT | NOT NULL | Knowledge base name |
| `type` | knowledge_base_type | NOT NULL | Type of knowledge base ('general' or 'estate_agent') |
| `data` | JSONB | NOT NULL, DEFAULT '{}' | Type-specific configuration data |
| `location_data` | JSONB | | Cached location keywords for property search optimization |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the record was created |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the record was last updated |

## Indexes

- `idx_knowledge_bases_organization_id` on `organization_id` - Fast lookups by organization
- `idx_knowledge_bases_type` on `type` - Filter by knowledge base type

## Triggers

- `update_knowledge_bases_updated_at` - Automatically updates `updated_at` timestamp on row updates

## Knowledge Base Types

### General Knowledge Base

For general-purpose knowledge bases.

**`data` field structure:**
```json
{
  // Custom fields as needed
}
```

### Estate Agent Knowledge Base

For estate agent property listings with support for Rightmove and Zoopla platforms.

**`data` field structure:**
```json
{
  "platform": "rightmove",  // or "zoopla"
  "for_sale_url": "https://www.rightmove.co.uk/property-for-sale/...",
  "rental_url": "https://www.rightmove.co.uk/property-to-rent/...",
  "resync_schedule": "daily"  // "6_hours", "12_hours", "daily", or "none"
}
```

**Fields:**
- `platform` (optional): Property platform to scrape from - `'rightmove'` or `'zoopla'`. Defaults to `'rightmove'` if not specified.
- `for_sale_url` (optional): URL to the for-sale property listings page on the selected platform
- `rental_url` (optional): URL to the rental property listings page on the selected platform
- `resync_schedule` (optional): How often to re-scrape properties - `'6_hours'`, `'12_hours'`, `'daily'`, or `'none'`

**Platform-specific URL examples:**

*Rightmove:*
- For sale: `https://www.rightmove.co.uk/property-for-sale/find.html?locationIdentifier=...`
- To rent: `https://www.rightmove.co.uk/property-to-rent/find.html?locationIdentifier=...`

*Zoopla:*
- For sale: `https://www.zoopla.co.uk/for-sale/property/uk/?branch_id=...`
- To rent: `https://www.zoopla.co.uk/to-rent/property/uk/?branch_id=...`

### Location Data

The `location_data` field is automatically populated after scraping properties. It contains cached location keywords extracted from the properties for faster search and filtering.

**Structure:**
```json
{
  "cities": ["London", "Manchester"],
  "districts": ["Westminster", "Kensington"],
  "subDistricts": ["Belgravia", "Chelsea"],
  "postcodeDistricts": ["SW1", "W8"],
  "streets": ["Baker Street", "Oxford Street"]
}
```

## Usage Notes

- Knowledge bases are automatically deleted when their organization is deleted (CASCADE)
- When an estate agent knowledge base is created, the appropriate scraper (Rightmove or Zoopla) is automatically triggered based on the `platform` field
- Properties associated with a knowledge base are stored in the `properties` table
- The `location_data` field is populated automatically after scraping and is used to optimize property queries

## Example Queries

### Find all knowledge bases for an organization
```sql
SELECT * FROM knowledge_bases 
WHERE organization_id = 'uuid-here'
ORDER BY created_at DESC;
```

### Find estate agent knowledge bases using Zoopla
```sql
SELECT * FROM knowledge_bases 
WHERE type = 'estate_agent'
  AND data->>'platform' = 'zoopla';
```

### Get knowledge base with property count
```sql
SELECT 
  kb.*,
  COUNT(p.id) as property_count
FROM knowledge_bases kb
LEFT JOIN properties p ON p.knowledge_base_id = kb.id
WHERE kb.organization_id = 'uuid-here'
GROUP BY kb.id
ORDER BY kb.created_at DESC;
```

### Create a new estate agent knowledge base
```sql
INSERT INTO knowledge_bases (organization_id, name, type, data)
VALUES (
  'org-uuid-here',
  'Southside Property',
  'estate_agent',
  '{"platform": "rightmove", "for_sale_url": "https://...", "rental_url": "https://...", "resync_schedule": "daily"}'::jsonb
);
```

## API Functions

### `getKnowledgeBases(organizationId)`
Returns all knowledge bases for an organization.

```typescript
import { getKnowledgeBases } from '@/lib/knowledge-bases'

const knowledgeBases = await getKnowledgeBases('org-uuid-here')
```

### `createKnowledgeBase(data)`
Creates a new knowledge base and triggers the appropriate scraper if it's an estate agent type.

```typescript
import { createKnowledgeBase } from '@/lib/knowledge-bases'

const kb = await createKnowledgeBase({
  name: 'My Estate Agency',
  type: 'estate_agent',
  organization_id: 'org-uuid-here',
  data: {
    platform: 'zoopla',
    for_sale_url: 'https://www.zoopla.co.uk/for-sale/...',
    rental_url: 'https://www.zoopla.co.uk/to-rent/...',
    resync_schedule: 'daily'
  }
})
```

### `assignKnowledgeBaseToAgent(agentId, knowledgeBaseId)`
Assigns a knowledge base to an agent. For estate agent knowledge bases, this creates and attaches a VAPI tool.

```typescript
import { assignKnowledgeBaseToAgent } from '@/lib/knowledge-bases'

await assignKnowledgeBaseToAgent('agent-uuid', 'kb-uuid')
```

## Related Tables

- `properties` - Stores property listings for estate agent knowledge bases
- `agent_knowledge_bases` - Junction table linking agents to knowledge bases
- `organisations` - Parent organization that owns the knowledge base

## Scrapers

### Rightmove Scraper
- **Trigger Task ID:** `scrape-rightmove`
- **Apify Actor:** `LwR6JRNl4khcKXIWo`
- **Source Value:** `'rightmove'`

### Zoopla Scraper
- **Trigger Task ID:** `scrape-zoopla`
- **Apify Actor:** `dhrumil~zoopla-scraper`
- **Source Value:** `'zoopla'`

Both scrapers are automatically triggered when:
1. A new estate agent knowledge base is created
2. The re-sync schedule triggers (if configured)
3. Properties are manually refreshed

The scraper used is determined by the `platform` field in the knowledge base `data`. If not specified, defaults to Rightmove.

