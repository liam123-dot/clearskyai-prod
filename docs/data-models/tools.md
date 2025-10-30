# Tools Data Model

## Overview

The `tools` table stores custom tools that can be attached to agents. Tools enable agents to perform actions like sending SMS messages, making API requests, or executing Pipedream workflows. All tools are created as VAPI `apiRequest` tools that callback to our execution endpoint.

## Table Schema

```sql
CREATE TABLE tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  organization_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  external_tool_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('query', 'sms', 'apiRequest', 'transferCall', 'externalApp', 'pipedream_action', 'transfer_call')),
  function_schema JSONB NOT NULL,
  static_config JSONB,
  config_metadata JSONB,
  async BOOLEAN DEFAULT false,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Column Descriptions

### Core Fields

- **id**: Internal database UUID, used in the execution callback URL
- **name**: Internal tool name (snake_case, used as function name)
- **label**: User-friendly display name
- **description**: Description of when and how the AI should use this tool
- **organization_id**: The organization that owns this tool
- **external_tool_id**: The VAPI tool ID (returned from VAPI API)

### Tool Type

- **type**: The type of tool
  - `pipedream_action`: Executes a Pipedream action
  - `sms`: Sends SMS messages via Twilio
  - `transfer_call`: Transfers calls to another number/agent
  - `api_request`: Makes custom API requests
  - `query`: Queries knowledge bases (estate agent properties)
  - `transferCall`, `externalApp`: Legacy types

### Configuration Fields

- **function_schema**: The function signature that the AI sees
  ```json
  {
    "name": "send_confirmation_sms",
    "description": "Send a confirmation SMS to the customer",
    "parameters": {
      "type": "object",
      "properties": {
        "message": {
          "type": "string",
          "description": "The message to send"
        }
      },
      "required": ["message"]
    }
  }
  ```

- **static_config**: Fixed configuration hidden from AI (merged with AI params at execution)
  ```json
  {
    "from": {
      "type": "called_number"
    },
    "recipients": ["+1234567890"]
  }
  ```

- **config_metadata**: Full `ToolConfig` object for editing the tool in the UI
  ```json
  {
    "type": "pipedream_action",
    "label": "Send Email",
    "description": "Send an email via Gmail",
    "pipedreamMetadata": {
      "app": "gmail",
      "appName": "Gmail",
      "accountId": "acc_xxx",
      "actionKey": "gmail.action.send-email"
    },
    "params": {
      "to": {
        "mode": "ai",
        "prompt": "The recipient's email address"
      },
      "subject": {
        "mode": "fixed",
        "value": "Order Confirmation"
      }
    }
  }
  ```

- **async**: Whether the tool runs asynchronously (agent continues without waiting for result)

- **data**: Full VAPI tool object (for reference/debugging)

### Timestamps

- **created_at**: When the tool was created
- **updated_at**: When the tool was last modified (auto-updated by trigger)

## Tool Types

### Pipedream Action (`pipedream_action`)

Executes a Pipedream action with AI-provided and static parameters.

**Key fields in config_metadata:**
- `pipedreamMetadata.app`: App slug (e.g., "gmail")
- `pipedreamMetadata.accountId`: Connected account ID
- `pipedreamMetadata.actionKey`: Pipedream action key
- `params`: Parameter sources (AI or fixed values)

**Execution flow:**
1. AI calls tool with dynamic parameters
2. Execution endpoint merges AI params with `static_config`
3. Calls Pipedream API with configured action and credentials
4. Returns result to AI

### SMS (`sms`)

Sends SMS messages via Twilio.

**Key fields in config_metadata:**
- `from.type`: "called_number" or "specific_number"
- `from.phone_number_id`: Phone number ID (if specific_number)
- `text`: Message text (AI or fixed)
- `recipients`: Recipient numbers (AI, fixed, or extendable array)

**Execution flow:**
1. AI provides message text and/or recipients
2. Execution endpoint fetches phone number credentials
3. Sends SMS via Twilio
4. Returns delivery status

### Transfer Call (`transfer_call`)

Transfers the current call to another number or agent.

**Status:** Not yet fully implemented in execution endpoint

### API Request (`api_request`)

Makes custom HTTP requests with AI-provided parameters.

**Status:** To be implemented

### Query (`query`)

Specialized tool for querying knowledge bases (e.g., estate agent properties).

**Note:** Created automatically when attaching certain knowledge bases to agents.

## Tool Creation Flow

1. **User creates tool in UI** (`/[slug]/tools/create`)
   - Configures tool type, parameters, and behavior
   - Form validates configuration

2. **POST /api/[slug]/tools**
   - Validates `ToolConfig`
   - Generates unique tool name
   - Builds `function_schema` (what AI sees)
   - Builds `static_config` (hidden from AI)
   - Creates temporary DB record (to get ID for callback URL)
   - Creates VAPI apiRequest tool with callback to `/api/tools/{id}/execute`
   - Updates DB record with VAPI `external_tool_id`
   - Rolls back on failure

3. **Tool is now available for attachment to agents**

## Tool Attachment Flow

1. **User navigates to agent tools page** (`/[slug]/agents/[id]/tools`)
   - Sees available tools and currently attached tools

2. **User clicks "Attach" button**

3. **POST /api/[slug]/agents/[id]/tools/attach**
   - Fetches agent's VAPI assistant
   - Adds tool's `external_tool_id` to assistant's `toolIds`
   - Updates VAPI assistant

4. **Tool is now available to agent during calls**

## Tool Execution Flow

1. **AI agent decides to use tool during call**
   - Extracts parameters from conversation
   - Calls VAPI tool

2. **VAPI sends POST request to `/api/tools/{id}/execute`**
   - Includes AI-provided parameters
   - Includes call metadata (caller/called numbers)

3. **Execution endpoint processes request**
   - Fetches tool from DB using `id`
   - Extracts `config_metadata` and `static_config`
   - Merges AI params with static config (static takes precedence)
   - Routes to appropriate handler based on `type`
   - Executes the tool action
   - Returns result to VAPI

4. **VAPI returns result to AI agent**
   - Agent uses result in conversation

## Tool Editing Flow

1. **User edits tool** (`/[slug]/tools/[id]/edit`)
   - Modifies configuration in UI

2. **PATCH /api/[slug]/tools/[id]**
   - Validates new configuration
   - Rebuilds function_schema and static_config
   - Updates VAPI tool first
   - Updates DB record
   - Rolls back VAPI on DB failure (best effort)

3. **Changes take effect immediately for all agents using this tool**

## Tool Deletion Flow

1. **User deletes tool** (`/[slug]/tools/[id]/edit`)
   - Confirms deletion in UI

2. **DELETE /api/[slug]/tools/[id]**
   - Checks if tool is attached to any agents
   - Deletes from VAPI first
   - Deletes from DB
   - Continues with DB deletion even if VAPI fails

3. **Tool is removed from all agents and database**

## Parameter Modes

Tools support different parameter modes for flexibility:

### Fixed Mode
```json
{
  "mode": "fixed",
  "value": "Order Confirmation"
}
```
Value is set by the user and hidden from AI. Always used during execution.

### AI Mode
```json
{
  "mode": "ai",
  "prompt": "The recipient's email address",
  "schema": { "type": "string", "description": "..." }
}
```
AI extracts value from conversation. Appears in function_schema.

### Array Extendable Mode
```json
{
  "mode": "array_extendable",
  "fixedValues": ["+1234567890"],
  "aiExtension": {
    "enabled": true,
    "prompt": "Additional phone numbers from conversation",
    "required": false
  }
}
```
Combines fixed base values with AI-provided additional values.

## Security Notes

- Static config values are never exposed to AI
- Credentials (Pipedream accounts, Twilio) stored securely
- All operations require authentication and organization ownership checks
- VAPI tool IDs are public but can only be modified by authorized users

## Indexes

- `idx_tools_organization_id`: Fast lookup by organization
- `idx_tools_external_tool_id`: Fast lookup by VAPI tool ID
- `idx_tools_type`: Filter by tool type

## Relationships

- **organizations**: Tools belong to an organization (CASCADE DELETE)
- **agents**: Tools attached to agents via VAPI assistant toolIds (indirect relationship)

