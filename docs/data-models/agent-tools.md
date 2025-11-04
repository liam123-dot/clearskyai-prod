# Agent Tools Data Model

## Overview

The `agent_tools` table is a join table that tracks ALL agent-tool relationships in our system, serving as the single source of truth for which tools are attached to which agents. This includes both:
1. VAPI-attached tools (`is_vapi_attached = true`) - tools that are added to the agent's VAPI assistant `toolIds` and can be called by the AI during conversations
2. Preemptive-only tools (`is_vapi_attached = false`) - tools that only execute on call start and are not available to the AI during conversations

The system automatically syncs this table with VAPI state whenever agent tools are viewed, ensuring consistency between our database and VAPI.

## Table Schema

```sql
CREATE TABLE agent_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  is_vapi_attached BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agent_id, tool_id)
);
```

## Column Descriptions

- **id**: Primary key UUID
- **agent_id**: The agent this tool is attached to (references `agents.id`)
- **tool_id**: The tool attached to this agent (references `tools.id`)
- **is_vapi_attached**: Whether the tool is in VAPI's toolIds (true = regular tool, false = preemptive-only)
- **created_at**: Timestamp when the record was created
- **updated_at**: Timestamp when the record was last updated (auto-updated by trigger)

## Constraints

- **UNIQUE(agent_id, tool_id)**: Prevents duplicate attachments of the same tool to the same agent
- **CASCADE DELETE**: When an agent or tool is deleted, associated `agent_tools` records are automatically deleted

## Indexes

- `idx_agent_tools_agent_id`: Fast lookup by agent ID
- `idx_agent_tools_tool_id`: Fast lookup by tool ID
- `idx_agent_tools_is_vapi_attached`: Fast filtering by attachment type

## Triggers

- `update_agent_tools_updated_at`: Automatically updates `updated_at` timestamp on row updates

## Usage

### Single Source of Truth

This table is the **single source of truth** for agent-tool relationships. All tool attachments must be tracked here, regardless of whether they're also in VAPI's toolIds.

### Tool Types

#### VAPI-Attached Tools (`is_vapi_attached = true`)
- Added to VAPI assistant's `toolIds`
- Can be called by the AI during conversations
- May also execute on call start if `execute_on_call_start = true`
- Examples: SMS tools, API request tools, transfer call tools

#### Preemptive-Only Tools (`is_vapi_attached = false`)
- NOT added to VAPI assistant's `toolIds`
- Cannot be called by the AI during conversations
- Only execute on call start (must have `execute_on_call_start = true`)
- Examples: CRM lookup tools, context injection tools

### Automatic Sync

When `getAgentTools()` is called (e.g., when viewing an agent's tools page):
1. Fetches tools from VAPI assistant's `toolIds`
2. Fetches tools from `agent_tools` table
3. **Syncs missing tools**: If VAPI has tools not in `agent_tools`, inserts them
4. **Removes stale tools**: If `agent_tools` has VAPI tools not in VAPI, deletes them
5. Returns the synchronized list

This ensures the database stays in sync with VAPI without manual intervention.

## Tool Attachment Flow

### For VAPI-Attached Tools (`attach_to_agent = true`)

1. **User creates tool** (e.g., SMS tool, API request tool)
2. **User navigates to agent tools page** (`/[slug]/agents/[id]/tools`)
3. **Tool appears in "Available Tools"**
4. **User clicks "Attach"**
5. **System**:
   - Adds tool's `external_tool_id` to VAPI assistant's `toolIds`
   - Inserts record into `agent_tools` table with `is_vapi_attached = true`
6. **Tool is now available** during conversations and on call start (if `execute_on_call_start = true`)

### For Preemptive-Only Tools (`attach_to_agent = false`)

1. **User creates tool** with `attach_to_agent = false` and `execute_on_call_start = true`
2. **User navigates to agent tools page** (`/[slug]/agents/[id]/tools`)
3. **Tool appears in "Available Tools"**
4. **User clicks "Attach"**
5. **System inserts record** into `agent_tools` table with `is_vapi_attached = false`
6. **Tool only executes** on call start (not available during conversations)

## Querying Tools

### Get all tools attached to an agent (both VAPI and agent_tools)

```typescript
import { getAgentTools } from '@/lib/tools'

const tools = await getAgentTools(agentId)
// Returns tools from both:
// - VAPI assistant's toolIds (attach_to_agent = true)
// - agent_tools table (attach_to_agent = false)
```

### Get only tools from agent_tools table

```typescript
import { getAgentToolsFromTable } from '@/lib/tools'

const preemptiveTools = await getAgentToolsFromTable(agentId)
// Returns only tools with attach_to_agent = false
```

### Check if a tool is attached to an agent

```typescript
import { isToolAttachedToAgent } from '@/lib/tools'

const isAttached = await isToolAttachedToAgent(agentId, toolId)
// Returns true if attached via VAPI or agent_tools
```

## On-Call-Start Execution

When a call starts, the system queries for tools with `execute_on_call_start = true` that are attached to the agent via:
1. VAPI assistant's `toolIds` (tools with `attach_to_agent = true`)
2. `agent_tools` table (tools with `attach_to_agent = false`)

Only tools explicitly attached to the agent are executed. Tools are no longer executed organization-wide.

## Example Queries

### Find all tools attached to an agent via agent_tools

```sql
SELECT t.*
FROM tools t
JOIN agent_tools at ON t.id = at.tool_id
WHERE at.agent_id = 'agent-uuid-here';
```

### Find all agents that have a specific tool attached

```sql
SELECT a.*
FROM agents a
JOIN agent_tools at ON a.id = at.agent_id
WHERE at.tool_id = 'tool-uuid-here';
```

### Count tools attached to an agent

```sql
SELECT COUNT(*) as tool_count
FROM agent_tools
WHERE agent_id = 'agent-uuid-here';
```

## Relationships

- **agents**: Each record references one agent (CASCADE DELETE)
- **tools**: Each record references one tool (CASCADE DELETE)

## API Endpoints

### Attach Tool

**POST** `/api/[slug]/agents/[id]/tools/attach`

- **If `attach_to_agent = true`**:
  - Adds tool's `external_tool_id` to VAPI assistant's `toolIds`
  - Inserts record into `agent_tools` table with `is_vapi_attached = true`
  - Rolls back VAPI changes if database insert fails

- **If `attach_to_agent = false`**:
  - Inserts record into `agent_tools` table with `is_vapi_attached = false`
  - Does NOT modify VAPI assistant

### Detach Tool

**POST** `/api/[slug]/agents/[id]/tools/detach`

- **If `attach_to_agent = true`**:
  - Removes tool's `external_tool_id` from VAPI assistant's `toolIds`
  - Deletes record from `agent_tools` table

- **If `attach_to_agent = false`**:
  - Deletes record from `agent_tools` table
  - Does NOT modify VAPI assistant

### Tool Deletion

**DELETE** `/api/[slug]/tools/[id]`

When a tool is deleted:
1. Queries `agent_tools` to find all agents with this tool attached
2. For each agent with `is_vapi_attached = true`:
   - Removes tool from VAPI assistant's `toolIds`
   - Handles 404 errors gracefully (tool already deleted)
3. Deletes tool from VAPI
4. Deletes from `tools` table (CASCADE deletes `agent_tools` records)

## Notes

- All agent-tool relationships are tracked in this table (single source of truth)
- Tools with `attach_to_agent = false` MUST have `execute_on_call_start = true` to be attachable
- The UI treats both attachment types identically - users don't need to know the difference
- Automatic sync ensures consistency between database and VAPI
- Tool deletion properly cleans up all agent attachments in VAPI

