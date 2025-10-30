import { z } from 'zod'

// ==================== Parameter Source Types ====================

/**
 * Defines how a parameter value is determined
 */
export type ParameterSource =
  | {
      mode: 'fixed'
      value: string | number | boolean | string[] | number[] | boolean[]
    }
  | {
      mode: 'ai'
      prompt: string
      schema: z.ZodTypeAny
    }
  | {
      mode: 'array_extendable'
      fixedValues: string[] | number[] | boolean[]
      aiExtension: {
        enabled: boolean
        prompt: string
        required: boolean
        itemSchema: z.ZodTypeAny
      }
    }

// ==================== Base Tool Configuration ====================

/**
 * Common fields for all tool types
 */
export interface BaseToolConfig {
  type: 'sms' | 'transfer_call' | 'api_request' | 'pipedream_action'
  label: string
  description: string
  name?: string // Optional - will be generated from label if not provided
  async?: boolean // If true, agent won't wait for response
}

// ==================== SMS Tool Configuration ====================

export interface SmsToolConfig extends BaseToolConfig {
  type: 'sms'
  from: {
    type: 'called_number' | 'specific_number'
    phone_number_id?: string // Only used when type is 'specific_number'
  }
  text: ParameterSource
  recipients: ParameterSource
}

// ==================== Transfer Call Tool Configuration ====================

export interface TransferCallToolConfig extends BaseToolConfig {
  type: 'transfer_call'
  target: {
    type: 'agent' | 'number'
    agentId?: string
    agentName?: string
    phoneNumber?: string
  }
  message: {
    strategy: 'fixed' | 'summarized' | 'none'
    content?: string
    summarizePrompt?: string
  }
}

// ==================== API Request Tool Configuration (Future) ====================

export interface ApiRequestToolConfig extends BaseToolConfig {
  type: 'api_request'
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  url: ParameterSource
  headers?: Record<string, ParameterSource>
  body?: Record<string, ParameterSource>
}

// ==================== Pipedream Action Tool Configuration (Future) ====================

export interface PipedreamActionToolConfig extends BaseToolConfig {
  type: 'pipedream_action'
  pipedreamMetadata: {
    app: string
    appName: string
    appImgSrc?: string
    appFieldName: string
    accountId: string
    actionKey: string
    actionName: string
  }
  preloadedParams?: Record<string, string | number | boolean>
  params: Record<string, ParameterSource>
}

// ==================== Tool Configuration Union ====================

/**
 * Discriminated union of all tool types
 */
export type ToolConfig =
  | SmsToolConfig
  | TransferCallToolConfig
  | ApiRequestToolConfig
  | PipedreamActionToolConfig

// ==================== Database Record ====================

/**
 * Tool as stored in the database
 */
export interface ToolDatabaseRecord {
  id: string
  organization_id: string
  name: string
  label: string | null
  description: string | null
  type: ToolConfig['type'] | null
  function_schema: Record<string, unknown> | null // JSON schema for AI
  static_config: Record<string, unknown> | null // Pre-configured values
  config_metadata: ToolConfig | null // Full configuration for UI reconstruction
  async: boolean | null // If true, agent won't wait for response
  created_at: string
  updated_at: string
}

// ==================== Tool Function Schema ====================

/**
 * Function schema format (what the AI sees)
 */
export interface ToolFunctionSchema {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, {
      type: string
      description?: string
      items?: Record<string, unknown>
      enum?: string[]
      default?: string | number | boolean
    }>
    required: string[]
  }
}

// ==================== Component Props ====================

/**
 * Generic props for tool configuration forms
 */
export interface ToolFormProps<T extends ToolConfig> {
  initialData?: T
  onChange: (config: T) => void
  isSubmitting?: boolean
  slug?: string
}

/**
 * Props for the unified tool creation/edit form
 */
export interface UnifiedToolFormProps {
  mode: 'create' | 'edit'
  toolId?: string
  initialData?: ToolDatabaseRecord
  onSuccess?: (tool: ToolDatabaseRecord) => void
}
