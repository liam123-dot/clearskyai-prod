# Agent Tools Data Model

## Overview

The `agent_tools` table is a join table that tracks tools with `attach_to_agent = false` that are attached to specific agents. These tools execute on call start but are not added to VAPI's `toolIds`, meaning they are not available during conversations.

## Table Schema

```sql
CREATE TABLE agent_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agent_id, tool_id)
);
```

## Column Descriptions

- **id**: Primary key UUID
- **agent_id**: The agent this tool is attached to (references `agents.id`)
- **tool_id**: The tool attached to this agent (references `tools.id`)
- **created_at**: Timestamp when the record was created
- **updated_at**: Timestamp when the record was last updated (auto-updated by trigger)

## Constraints

- **UNIQUE(agent_id, tool_id)**: Prevents duplicate attachments of the same tool to the same agent
- **CASCADE DELETE**: When an agent or tool is deleted, associated `agent_tools` records are automatically deleted

## Indexes

- `idx_agent_tools_agent_id`: Fast lookup by agent ID
- `idx_agent_tools_tool_id`: Fast lookup by tool ID

## Triggers

- `update_agent_tools_updated_at`: Automatically updates `updated_at` timestamp on row updates

## Usage

### When to Use This Table

This table is used for tools that have:
- `attach_to_agent = false`
- `execute_on_call_start = true`

These tools:
- Are not added to VAPI assistant's `toolIds`
- Cannot be called by the AI during conversations
- Execute automatically when a call starts (before the agent speaks)
- Must be explicitly attached to specific agents (not organization-wide)

### Example Use Cases

- **CRM Lookup Tools**: Pre-fetch customer data before the conversation starts
- **Context Injection Tools**: Gather background information to enrich the conversation
- **Pre-call Validation**: Verify caller information or permissions before the agent responds

## Tool Attachment Flow

1. **User creates tool** with `attach_to_agent = false` and `execute_on_call_start = true`
2. **User navigates to agent tools page** (`/[slug]/agents/[id]/tools`)
3. **Tool appears in "Available Tools"** (even though it won't be added to VAPI)
4. **User clicks "Attach"**
5. **System inserts record** into `agent_tools` table
6. **Tool executes** when calls start for this agent

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

If `attach_to_agent = false`:
- Inserts record into `agent_tools` table
- Does NOT add to VAPI assistant's `toolIds`

### Detach Tool

**POST** `/api/[slug]/agents/[id]/tools/detach`

If `attach_to_agent = false`:
- Deletes record from `agent_tools` table
- Does NOT modify VAPI assistant

## Notes

- Tools with `attach_to_agent = false` MUST have `execute_on_call_start = true` to be attachable
- The UI treats both attachment types identically - users don't need to know the difference
- Preemptive-only tools are scoped to specific agents, not organization-wide

