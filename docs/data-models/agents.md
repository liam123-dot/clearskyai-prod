# Agents Table

The `agents` table stores AI agents that are associated with organizations and synced with VAPI assistants.

## Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Internal database ID |
| `organization_id` | UUID | REFERENCES organisations(id) ON DELETE CASCADE | Organization that owns this agent |
| `vapi_assistant_id` | TEXT | UNIQUE, NOT NULL | VAPI assistant ID |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the record was created |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the record was last updated |

## Indexes

- `idx_agents_organization_id` on `organization_id` - Fast lookups by organization
- `idx_agents_vapi_assistant_id` on `vapi_assistant_id` - Fast lookups by VAPI assistant ID

## Triggers

- `update_agents_updated_at` - Automatically updates `updated_at` timestamp on row updates

## Usage Notes

- Each agent is associated with one organization via `organization_id`
- The `vapi_assistant_id` is unique across all agents and maps to the VAPI platform
- When an organization is deleted, their agents are automatically deleted (CASCADE)
- Agents are synchronized with VAPI assistants

## Example Queries

### Find all agents for an organization
```sql
SELECT * FROM agents WHERE organization_id = 'uuid-here';
```

### Find agent by VAPI assistant ID
```sql
SELECT * FROM agents WHERE vapi_assistant_id = 'asst_12345';
```

### Get agents with organization details
```sql
SELECT a.*, o.slug, o.external_id 
FROM agents a
JOIN organisations o ON a.organization_id = o.id
WHERE a.id = 'uuid-here';
```

### Create a new agent
```sql
INSERT INTO agents (organization_id, vapi_assistant_id)
VALUES ('org-uuid-here', 'asst_12345');
```

## API Functions

### `getAgents()`
Returns all VAPI agents with their organization assignments. Shows which agents are assigned and which are unassigned.

```typescript
import { getAgents } from '@/lib/vapi/agents'

const agents = await getAgents()
// Returns: AgentWithDetails[]
```

### `getAgentsByOrganization(organizationId)`
Returns only the agents assigned to a specific organization, with full VAPI assistant details.

```typescript
import { getAgentsByOrganization } from '@/lib/vapi/agents'

const agents = await getAgentsByOrganization('org-uuid-here')
// Returns: AgentWithDetails[]
```

## API Endpoints

### `GET /api/[slug]/agents`
Get all agents for an organization by slug.

```bash
curl https://example.com/api/acme-corp/agents
```

