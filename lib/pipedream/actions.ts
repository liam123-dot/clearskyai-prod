import { pipedreamClient, isPipedreamConfigured } from './client'

/**
 * Result from executing a Pipedream action
 */
export interface ActionExecutionResult {
  success: boolean
  exports?: Record<string, unknown>
  logs?: Record<string, unknown>
  returnValue?: unknown
  error?: string
}

/**
 * Executes a Pipedream action with the provided configuration
 * 
 * @param clientId - External user ID (typically organization_id)
 * @param actionComponentId - The Pipedream action key/component ID
 * @param configuredProps - Merged parameters including authentication
 * @returns Result with success flag and data or error
 */
export async function executeAction(
  clientId: string,
  actionComponentId: string,
  configuredProps: Record<string, unknown>
): Promise<ActionExecutionResult> {
  try {
    // Check for required environment variables
    if (!isPipedreamConfigured()) {
      console.error('❌ Missing Pipedream credentials')
      return {
        success: false,
        error: 'Pipedream credentials not configured',
      }
    }

    console.log('🚀 Executing Pipedream action:', {
      clientId,
      actionComponentId,
      configuredProps: JSON.stringify(configuredProps, null, 2),
    })

    // Execute the action using the Pipedream SDK
    const response = await pipedreamClient.actions.run({
      id: actionComponentId,
      externalUserId: clientId,
      configuredProps: configuredProps,
    })

    console.log('✅ Action executed successfully:', JSON.stringify(response, null, 2))

    return {
      success: true,
      exports: response.exports as Record<string, unknown> | undefined,
      logs: response.os as Record<string, unknown> | undefined,
      returnValue: response.ret as unknown,
    }
  } catch (error) {
    console.error('❌ Error executing action:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute action',
    }
  }
}

