import { ToolConfig, ToolFunctionSchema } from '@/lib/tools/types'
import { CreateApiRequestToolDto } from './ToolTypes'

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

