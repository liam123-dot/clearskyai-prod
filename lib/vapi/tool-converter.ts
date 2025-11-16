import { ToolConfig, ToolFunctionSchema, TransferCallToolConfig, HandoffToolConfig } from '@/lib/tools/types'
import { CreateApiRequestToolDto, CreateTransferCallToolDto, CreateHandoffToolDto } from './ToolTypes'

/**
 * Converts a ToolConfig to a VAPI apiRequest tool format
 * 
 * All custom tools (Pipedream, SMS, Transfer) are created as apiRequest tools
 * that callback to our execution endpoint with AI-provided parameters.
 */
export function convertToolConfigToVapiApiRequest(
  toolId: string,
  config: ToolConfig,
  functionSchema: ToolFunctionSchema
): CreateApiRequestToolDto {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'
  
  // Build properties for body - VAPI requires at least one property
  const bodyProperties = Object.fromEntries(
    Object.entries(functionSchema.parameters.properties || {}).map(([key, prop]) => [
      key,
      {
        ...prop,
        default: prop.default !== undefined ? String(prop.default) : undefined,
      }
    ])
  )

  // If no properties exist (all parameters are fixed), add a dummy property
  // This is needed because VAPI requires at least one property in body.properties
  // Tools with execute_on_call_start may have no AI parameters
  if (Object.keys(bodyProperties).length === 0) {
    bodyProperties._dummy = {
      type: 'string',
      description: 'Internal field - not used',
      default: '',
    }
  }

  // Build the VAPI tool structure
  const vapiTool: CreateApiRequestToolDto = {
    type: 'apiRequest',
    function: {
      name: functionSchema.name,
      description: functionSchema.description,
      parameters: functionSchema.parameters,
    },
    messages: [], // No messages - tools should execute silently unless messages are explicitly configured
    name: functionSchema.name,
    url: `${baseUrl}/api/tools/${toolId}/execute`,
    method: 'POST',
    body: {
      type: 'object',
      required: functionSchema.parameters.required || [],
      properties: bodyProperties,
    },
    variableExtractionPlan: {
      schema: {
        type: 'object',
        required: ['success'],
        properties: {
          success: {
            type: 'boolean',
            description: 'Whether the tool executed successfully',
          },
          result: {
            type: 'object',
            description: 'The result returned by the tool',
          },
          message: {
            type: 'string',
            description: 'A message describing what happened',
          },
          error: {
            type: 'string',
            description: 'Error message if the tool failed',
          },
        },
      },
      aliases: [],
    },
  }

  return vapiTool
}

/**
 * Converts a TransferCallToolConfig to Vapi's native transferCall tool format
 */
export function convertToVapiTransferCallTool(config: TransferCallToolConfig): CreateTransferCallToolDto {
  const toolName = config.name || config.label.toLowerCase().replace(/[^a-z0-9]+/g, '_')
  
  return {
    type: 'transferCall',
    function: {
      name: toolName,
      description: config.description,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    messages: [],
    destinations: config.destinations.map(dest => ({
      type: 'number',
      number: dest.number,
      message: dest.message,
      description: dest.description,
      transferPlan: {
        mode: dest.transferPlan.mode,
        message: dest.transferPlan.message,
        summaryPlan: dest.transferPlan.summaryPlan ? {
          enabled: dest.transferPlan.summaryPlan.enabled,
          messages: dest.transferPlan.summaryPlan.messages || [],
          timeoutSeconds: dest.transferPlan.summaryPlan.timeoutSeconds || 30,
          useAssistantLlm: dest.transferPlan.summaryPlan.useAssistantLlm ?? true,
        } : undefined,
      },
      numberE164CheckEnabled: dest.numberE164CheckEnabled,
    })),
  }
}

/**
 * Converts a HandoffToolConfig to Vapi's native handoff tool format
 */
export function convertToVapiHandoffTool(config: HandoffToolConfig): CreateHandoffToolDto {
  const toolName = config.name || config.label.toLowerCase().replace(/[^a-z0-9]+/g, '_')
  
  return {
    type: 'handoff',
    function: {
      name: toolName,
      description: config.description,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    messages: [],
    destinations: [
      {
        type: 'assistant',
        assistantId: config.assistantId, // Use assistantId field for the Vapi assistant ID
        description: config.description,
      }
    ],
  }
}

