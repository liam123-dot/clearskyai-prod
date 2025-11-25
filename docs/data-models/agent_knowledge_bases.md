# Agent Knowledge Bases Table

The `agent_knowledge_bases` table is a join table that connects agents with knowledge bases and tracks the associated tools created for those assignments. It supports both Vapi and ElevenLabs providers.

## Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Internal database ID |
| `agent_id` | UUID | NOT NULL, REFERENCES agents(id) ON DELETE CASCADE | Agent that has the knowledge base assigned |
| `knowledge_base_id` | UUID | NOT NULL, REFERENCES knowledge_bases(id) ON DELETE CASCADE | Knowledge base that is assigned to the agent |
| `external_tool_id` | TEXT | NULL | External tool ID from the provider (Vapi or ElevenLabs) when a tool is created for this assignment |
| `provider` | TEXT | NULL, CHECK IN ('vapi', 'elevenlabs') | Provider platform for the tool ('vapi' or 'elevenlabs') |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the record was created |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp when the record was last updated |

## Indexes

- `idx_agent_knowledge_bases_agent_id` on `agent_id` - Fast lookups by agent
- `idx_agent_knowledge_bases_knowledge_base_id` on `knowledge_base_id` - Fast lookups by knowledge base
- `UNIQUE(agent_id, knowledge_base_id)` - Ensures a knowledge base can only be assigned once per agent

## Triggers

- `update_agent_knowledge_bases_updated_at` - Automatically updates `updated_at` timestamp on row updates

## Usage Notes

- This is a many-to-many relationship table between agents and knowledge bases
- When an estate agent knowledge base is assigned to an agent, a tool is automatically created in the agent's provider platform (Vapi or ElevenLabs)
- The `external_tool_id` stores the provider's tool ID for cleanup purposes
- The `provider` field indicates which platform the tool was created in
- Both fields are NULL for non-estate agent knowledge bases that don't require tools
- When an agent is deleted, all its knowledge base assignments are automatically deleted (CASCADE)
- When a knowledge base is deleted, all its agent assignments are automatically deleted (CASCADE)

## Multi-Provider Support

The table supports both Vapi and ElevenLabs providers:

- **Vapi agents**: Tools are created via the Vapi API and attached to the assistant's `toolIds`
- **ElevenLabs agents**: Tools are created via the ElevenLabs API and attached to the agent's `conversationConfig.agent.toolIds`

The provider is determined by the agent's `provider` field and tools are created in the corresponding platform.

## Example Queries

### Find all knowledge bases assigned to an agent
```sql
SELECT kb.*
FROM knowledge_bases kb
JOIN agent_knowledge_bases akb ON akb.knowledge_base_id = kb.id
WHERE akb.agent_id = 'agent-uuid-here';
```

### Find all agents using a knowledge base
```sql
SELECT a.*
FROM agents a
JOIN agent_knowledge_bases akb ON akb.agent_id = a.id
WHERE akb.knowledge_base_id = 'kb-uuid-here';
```

### Find assignments with tools (grouped by provider)
```sql
SELECT provider, COUNT(*) as tool_count
FROM agent_knowledge_bases
WHERE external_tool_id IS NOT NULL
GROUP BY provider;
```

### Check if a knowledge base is assigned to an agent
```sql
SELECT EXISTS(
  SELECT 1 FROM agent_knowledge_bases
  WHERE agent_id = 'agent-uuid-here'
  AND knowledge_base_id = 'kb-uuid-here'
);
```

## API Functions

### `assignKnowledgeBaseToAgent(agentId, knowledgeBaseId)`
Assigns a knowledge base to an agent. For estate agent knowledge bases, automatically creates a tool in the agent's provider platform.

```typescript
import { assignKnowledgeBaseToAgent } from '@/lib/knowledge-bases'

await assignKnowledgeBaseToAgent('agent-uuid', 'kb-uuid')
// Creates tool in Vapi or ElevenLabs based on agent's provider
```

### `unassignKnowledgeBaseFromAgent(agentId, knowledgeBaseId)`
Removes a knowledge base assignment from an agent. If a tool was created, it's automatically removed from the provider and deleted.

```typescript
import { unassignKnowledgeBaseFromAgent } from '@/lib/knowledge-bases'

await unassignKnowledgeBaseFromAgent('agent-uuid', 'kb-uuid')
// Removes and deletes tool from provider if one exists
```

### `getAgentKnowledgeBases(agentId)`
Returns all knowledge bases assigned to a specific agent.

```typescript
import { getAgentKnowledgeBases } from '@/lib/knowledge-bases'

const knowledgeBases = await getAgentKnowledgeBases('agent-uuid')
// Returns: KnowledgeBase[]
```

### `getKnowledgeBasesWithAgentStatus(organizationId, agentId)`
Returns all knowledge bases for an organization with assignment status for a specific agent.

```typescript
import { getKnowledgeBasesWithAgentStatus } from '@/lib/knowledge-bases'

const kbsWithStatus = await getKnowledgeBasesWithAgentStatus('org-uuid', 'agent-uuid')
// Returns: (KnowledgeBase & { is_assigned: boolean })[]
```

