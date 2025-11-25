import { ToolConfig, ToolFunctionSchema } from '@/lib/tools/types'

/**
 * Converts a ToolConfig to an ElevenLabs webhook tool format
 * 
 * All custom tools (Pipedream, SMS, API Request) are created as webhook tools
 * that callback to our execution endpoint with AI-provided parameters.
 */
export function convertToolConfigToElevenLabsWebhook(
  toolId: string,
  config: ToolConfig,
  functionSchema: ToolFunctionSchema
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!
  
  // Convert function schema properties to ElevenLabs requestBodySchema format
  const requestBodyProperties: Record<string, any> = {}
  const required: string[] = []

  Object.entries(functionSchema.parameters.properties || {}).forEach(([key, prop]) => {
    requestBodyProperties[key] = {
      type: prop.type as string,
      description: prop.description,
    }

    // Add items for arrays
    if (prop.items) {
      const items: any = {}
      
      // Copy type from items
      if (typeof prop.items === 'object' && 'type' in prop.items) {
        items.type = prop.items.type
      }
      
      // ElevenLabs requires at least one of: description, dynamic_variable, is_system_provided, or constant_value
      // Add description if available, otherwise add a default
      if (typeof prop.items === 'object' && 'description' in prop.items) {
        items.description = prop.items.description
      } else {
        items.description = `Item for ${key}`
      }
      
      // Copy other properties if they exist
      if (typeof prop.items === 'object') {
        if ('enum' in prop.items) items.enum = prop.items.enum
        if ('default' in prop.items) items.default = prop.items.default
      }
      
      requestBodyProperties[key].items = items
    }

    // Add enum for enums
    if (prop.enum) {
      requestBodyProperties[key].enum = prop.enum
    }
  })

  // Add required fields
  if (functionSchema.parameters.required) {
    required.push(...functionSchema.parameters.required)
  }

  // Sanitize name for function name (must match /^[a-zA-Z0-9_-]{1,40}$/)
  const sanitizedName = functionSchema.name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .substring(0, 40)

  const requestBodySchema: any = {
    type: 'object' as const,
    properties: requestBodyProperties,
  }

  // Only include 'required' field if there are required properties
  if (required.length > 0) {
    requestBodySchema.required = required
  }

  return {
    type: 'webhook' as const,
    name: sanitizedName,
    description: functionSchema.description,
    apiSchema: {
      url: `${baseUrl}/api/tools/${toolId}/execute`,
      method: 'POST' as const,
      contentType: 'application/json' as const,
      requestBodySchema
    }
  }
}

