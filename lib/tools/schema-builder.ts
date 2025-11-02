import { z } from 'zod'
import {
  ToolConfig,
  ToolFunctionSchema,
  ParameterSource,
} from '@/lib/tools/types'

// ==================== Tool Name Generation ====================

/**
 * Generate a valid function name from a label
 * Converts to lowercase with underscores
 */
export function generateToolName(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// ==================== Zod to JSON Schema Conversion ====================

/**
 * Convert a Zod schema to JSON Schema format
 * Simplified converter - extend as needed
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (schema as any)._def

  console.log('zodToJsonSchema called with:', {
    schemaType: schema.constructor.name,
    def: def,
    description: def?.description,
  })

  // Handle optional/nullable wrappers - preserve the outer description
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    if (def.innerType) {
      const innerSchema = zodToJsonSchema(def.innerType)
      // If the wrapper has a description, use it; otherwise use inner description
      if (def.description) {
        innerSchema.description = def.description
      }
      return innerSchema
    }
  }

  // String type
  if (schema instanceof z.ZodString) {
    const result = {
      type: 'string',
      description: def.description,
    }
    console.log('ZodString converted to:', result)
    return result
  }

  // Number type
  if (schema instanceof z.ZodNumber) {
    return {
      type: 'number',
      description: def.description,
    }
  }

  // Boolean type
  if (schema instanceof z.ZodBoolean) {
    return {
      type: 'boolean',
      description: def.description,
    }
  }

  // Array type
  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: def.type ? zodToJsonSchema(def.type) : {},
      description: def.description,
    }
  }

  // Object type
  if (schema instanceof z.ZodObject) {
    const properties: Record<string, Record<string, unknown>> = {}
    const shape = def.shape

    if (shape) {
      Object.entries(shape).forEach(([key, value]) => {
        properties[key] = zodToJsonSchema(value as z.ZodTypeAny)
      })
    }

    return {
      type: 'object',
      properties,
      description: def.description,
    }
  }

  // Enum type
  if (schema instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: def.values,
      description: def.description,
    }
  }

  // Fallback
  return { type: 'string' }
}

// ==================== Function Schema Builder ====================

/**
 * Build the function schema (what AI sees) from tool configuration
 */
export function buildFunctionSchema(config: ToolConfig): ToolFunctionSchema {
  console.log('Building function schema for:', config)
  const toolName = config.name || generateToolName(config.label)
  const description = config.description // Use description directly, don't append parameter prompts

  // Build properties directly from config instead of using Zod schemas
  const properties: Record<string, {
    type: string
    description?: string
    items?: Record<string, unknown>
    enum?: string[]
    default?: string | number | boolean
  }> = {}
  const required: string[] = []

  // Helper to add a parameter
  const addParam = (key: string, source: ParameterSource, isRequired: boolean = true) => {
    if (source.mode === 'ai') {
      properties[key] = {
        type: 'string',
        description: source.prompt
      }
      if (isRequired) required.push(key)
    } else if (source.mode === 'array_extendable' && source.aiExtension.enabled) {
      properties[key] = {
        type: 'array',
        items: { type: 'string' },
        description: source.aiExtension.prompt
      }
      if (source.aiExtension.required) required.push(key)
    }
  }

  // Process parameters based on tool type
  switch (config.type) {
    case 'sms':
      addParam('text', config.text)
      addParam('recipients', config.recipients)
      break

    case 'transfer_call':
      if (config.message.strategy === 'summarized') {
        properties.summary = {
          type: 'string',
          description: 'Summary of the conversation'
        }
        required.push('summary')
      }
      break

    case 'api_request':
      addParam('url', config.url)
      if (config.headers) {
        Object.entries(config.headers).forEach(([key, source]) => {
          addParam(`header_${key}`, source)
        })
      }
      if (config.body) {
        Object.entries(config.body).forEach(([key, source]) => {
          addParam(`body_${key}`, source)
        })
      }
      break

    case 'pipedream_action':
      Object.entries(config.params).forEach(([key, source]) => {
        addParam(key, source)
      })
      break
  }

  // If no properties exist (all parameters are fixed), add a dummy property
  // This ensures VAPI validation passes (requires at least one property)
  // The dummy property will be ignored during execution
  if (Object.keys(properties).length === 0) {
    properties._dummy = {
      type: 'string',
      description: 'Internal field - not used',
    }
  }

  console.log('Built properties:', JSON.stringify(properties, null, 2))

  return {
    name: toolName,
    description,
    parameters: {
      type: 'object',
      properties,
      required,
    },
  }
}

// ==================== Static Config Builder ====================

/**
 * Build static config (hidden from AI)
 */
export function buildStaticConfig(config: ToolConfig): Record<string, unknown> {
  const staticConfig: Record<string, unknown> = {}

  switch (config.type) {
    case 'sms':
      // Store from configuration
      staticConfig.from = config.from
      
      if (config.text.mode === 'fixed') {
        staticConfig.text = config.text.value
      }
      if (config.recipients.mode === 'fixed') {
        staticConfig.recipients = config.recipients.value
      } else if (config.recipients.mode === 'array_extendable') {
        staticConfig.recipientsBase = config.recipients.fixedValues
      }
      break

    case 'transfer_call':
      staticConfig.target = config.target
      if (config.message.strategy === 'fixed') {
        staticConfig.message = config.message.content
      }
      staticConfig.messageStrategy = config.message.strategy
      break

    case 'api_request':
      staticConfig.method = config.method
      if (config.url.mode === 'fixed') {
        staticConfig.url = config.url.value
      }

      staticConfig.headers = {}
      if (config.headers) {
        const headers = staticConfig.headers as Record<string, unknown>
        Object.entries(config.headers).forEach(([key, source]) => {
          if (source.mode === 'fixed') {
            headers[key] = source.value
          }
        })
      }

      staticConfig.body = {}
      if (config.body) {
        const body = staticConfig.body as Record<string, unknown>
        Object.entries(config.body).forEach(([key, source]) => {
          if (source.mode === 'fixed') {
            body[key] = source.value
          } else if (source.mode === 'array_extendable') {
            body[`${key}_base`] = source.fixedValues
          }
        })
      }
      break

    case 'pipedream_action':
      staticConfig.preloadedParams = config.preloadedParams || {}
      staticConfig.params = {}
      const params = staticConfig.params as Record<string, unknown>
      Object.entries(config.params).forEach(([key, source]) => {
        if (source.mode === 'fixed') {
          params[key] = source.value
        } else if (source.mode === 'array_extendable') {
          params[`${key}_base`] = source.fixedValues
        }
      })
      break
  }

  return staticConfig
}

// ==================== Validation ====================

/**
 * Validate that all required parameters are configured
 */
export function validateToolConfig(config: ToolConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  switch (config.type) {
    case 'sms':
      // From configuration must be valid
      if (!config.from || !config.from.type) {
        errors.push('SMS sender configuration is required')
      } else if (config.from.type === 'specific_number' && !config.from.phone_number_id) {
        errors.push('Phone number selection is required when sending from a specific number')
      }

      // Text must be configured
      if (config.text.mode === 'fixed' && !config.text.value) {
        errors.push('SMS text message is required')
      }
      if (config.text.mode === 'ai' && !config.text.prompt) {
        errors.push('AI prompt for SMS text is required')
      }

      // Recipients must be configured
      if (config.recipients.mode === 'fixed') {
        const recipientsValue = config.recipients.value
        if (!recipientsValue || (Array.isArray(recipientsValue) && recipientsValue.length === 0)) {
          errors.push('At least one recipient is required')
        }
      }
      if (config.recipients.mode === 'ai' && !config.recipients.prompt) {
        errors.push('AI prompt for recipients is required')
      }
      if (config.recipients.mode === 'array_extendable') {
        if (config.recipients.aiExtension.enabled && !config.recipients.aiExtension.prompt) {
          errors.push('AI prompt for additional recipients is required')
        }
        if (config.recipients.aiExtension.required && config.recipients.fixedValues.length === 0) {
          errors.push('At least one base recipient or AI extension is required')
        }
      }
      break

    case 'transfer_call':
      // Target must be configured
      if (config.target.type === 'agent' && !config.target.agentId) {
        errors.push('Transfer target agent is required')
      }
      if (config.target.type === 'number' && !config.target.phoneNumber) {
        errors.push('Transfer target phone number is required')
      }

      // Message validation based on strategy
      if (config.message.strategy === 'fixed' && !config.message.content) {
        errors.push('Transfer message content is required for fixed message strategy')
      }
      if (config.message.strategy === 'summarized' && !config.message.summarizePrompt) {
        errors.push('Summary prompt is required for summarized message strategy')
      }
      break

    case 'api_request':
      // URL must be configured
      if (config.url.mode === 'fixed' && !config.url.value) {
        errors.push('API request URL is required')
      }
      if (config.url.mode === 'ai' && !config.url.prompt) {
        errors.push('AI prompt for URL is required')
      }
      break

    case 'pipedream_action':
      // Account and action must be configured
      if (!config.pipedreamMetadata.accountId) {
        errors.push('Pipedream account is required')
      }
      if (!config.pipedreamMetadata.actionKey) {
        errors.push('Pipedream action is required')
      }
      break
  }

  // Common validations
  if (!config.label || config.label.trim().length === 0) {
    errors.push('Tool label is required')
  }
  if (!config.description || config.description.trim().length === 0) {
    errors.push('Tool description is required')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

