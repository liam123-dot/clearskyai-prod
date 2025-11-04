/**
 * Tool Execution
 * 
 * Shared function for executing tools that can be called directly
 * without going through HTTP API routes.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { executeAction } from '@/lib/pipedream/actions'
import type { PipedreamActionToolConfig, SmsToolConfig } from '@/lib/tools/types'
import { substituteVariables, substituteVariablesInValue, type VariableContext } from '@/lib/tools/variables'
import twilio from 'twilio'

/**
 * Result from executing a tool
 */
export interface ToolExecutionResult {
  success: boolean
  result?: unknown
  error?: string
  exports?: Record<string, unknown>
  logs?: Record<string, unknown>
}

/**
 * Executes a tool by ID with the provided parameters
 * 
 * @param toolId - The tool ID to execute
 * @param aiProvidedParams - Parameters provided by AI (can be empty for on-call-start tools)
 * @param variableContext - Context for variable substitution (caller/called numbers)
 * @returns Result with success flag and data or error
 */
export async function executeToolById(
  toolId: string,
  aiProvidedParams: Record<string, unknown>,
  variableContext: VariableContext
): Promise<ToolExecutionResult> {
  console.log('🔧 Tool execution request for tool ID:', toolId)
  console.log('🤖 AI-provided parameters:', JSON.stringify(aiProvidedParams, null, 2))
  console.log(`📞 Context - Caller: ${variableContext.caller_phone_number}, Called: ${variableContext.called_phone_number}`)
  
  // ===================================================================
  // FETCH TOOL FROM DATABASE
  // ===================================================================
  
  console.log(`🔍 Fetching tool from database (ID: ${toolId})...`)
  const supabase = await createServiceClient()
  
  const { data: tool, error: toolError } = await supabase
    .from('tools')
    .select('*')
    .eq('id', toolId)
    .single()

  if (toolError) {
    console.error('❌ Database error fetching tool')
    console.error(`   Tool ID: ${toolId}`)
    console.error(`   Error code: ${toolError.code || 'N/A'}`)
    console.error(`   Error message: ${toolError.message || 'N/A'}`)
    console.error(`   Full error:`, JSON.stringify(toolError, null, 2))
    return {
      success: false,
      error: 'Database error',
    }
  }

  if (!tool) {
    console.error('❌ Tool not found')
    console.error(`   Tool ID: ${toolId}`)
    return {
      success: false,
      error: 'Tool not found',
    }
  }

  console.log(`✅ Found tool: ${tool.name} (type: ${tool.type})`)
  console.log(`   Tool ID: ${tool.id}`)
  console.log(`   Organization ID: ${tool.organization_id || 'N/A'}`)

  // ===================================================================
  // HANDLE PIPEDREAM ACTION TOOLS
  // ===================================================================
  
  if (tool.type === 'pipedream_action') {
    console.log(`🔀 Routing to Pipedream action handler`)
    return handlePipedreamAction(tool, aiProvidedParams, variableContext)
  }

  // ===================================================================
  // HANDLE SMS TOOLS
  // ===================================================================
  
  if (tool.type === 'sms') {
    console.log(`🔀 Routing to SMS handler`)
    return handleSmsAction(tool, aiProvidedParams, variableContext)
  }

  // ===================================================================
  // HANDLE OTHER TOOL TYPES (TODO)
  // ===================================================================
  
  console.error(`❌ Unsupported tool type: ${tool.type}`)
  return {
    success: false,
    error: `Tool type '${tool.type}' not yet implemented`,
  }
}

/**
 * Handles execution of Pipedream action tools
 */
async function handlePipedreamAction(
  tool: Record<string, unknown>,
  aiProvidedParams: Record<string, unknown>,
  variableContext: VariableContext
): Promise<ToolExecutionResult> {
  // ===================================================================
  // EXTRACT CONFIGURATION
  // ===================================================================
  
  const configMetadata = tool.config_metadata as PipedreamActionToolConfig | null
  
  if (!configMetadata || !configMetadata.pipedreamMetadata) {
    console.error('❌ Missing Pipedream metadata in tool configuration')
    return {
      success: false,
      error: 'Tool configuration error - missing Pipedream metadata',
    }
  }

  const { pipedreamMetadata } = configMetadata
  const staticConfig = (tool.static_config || {}) as Record<string, unknown>
  
  // Apply variable substitution to static_config before extracting params
  const substitutedStaticConfig = substituteVariablesInValue(staticConfig, variableContext) as Record<string, unknown>
  
  // Extract actual parameter values from static_config
  // static_config may have structure: { params: {...}, preloadedParams: {...} }
  // We need to extract the values from the params object
  let staticParams: Record<string, unknown> = {}
  
  const params = substitutedStaticConfig.params as Record<string, unknown> | undefined
  const preloadedParams = substitutedStaticConfig.preloadedParams as Record<string, unknown> | undefined
  
  if (params && typeof params === 'object') {
    // If params is nested, extract it
    staticParams = { ...params }
  } else if (!params && !preloadedParams) {
    // If there's no params/preloadedParams structure, use staticConfig directly
    staticParams = { ...substitutedStaticConfig }
  }

  const toolName = String(tool.name)
  const organizationId = String(tool.organization_id)
  
  console.log('📋 Tool configuration:')
  console.log(`   Tool: ${toolName}`)
  console.log(`   App: ${pipedreamMetadata.appName} (${pipedreamMetadata.app})`)
  console.log(`   Action: ${pipedreamMetadata.actionName} (${pipedreamMetadata.actionKey})`)
  console.log(`   Organization: ${organizationId}`)
  console.log(`   Account ID: ${pipedreamMetadata.accountId}`)
  console.log(`   Static Config (original):`, JSON.stringify(staticConfig, null, 2))
  console.log(`   Static Config (substituted):`, JSON.stringify(substitutedStaticConfig, null, 2))
  console.log(`   Extracted Static Params:`, JSON.stringify(staticParams, null, 2))

  // ===================================================================
  // VALIDATE REQUIRED FIELDS
  // ===================================================================
  
  if (!tool.organization_id) {
    console.error('❌ Missing organization_id in tool')
    return {
      success: false,
      error: 'Tool configuration error - missing organization_id',
    }
  }

  if (!pipedreamMetadata.actionKey) {
    console.error('❌ Missing actionKey in Pipedream metadata')
    return {
      success: false,
      error: 'Tool configuration error - missing actionKey',
    }
  }

  // ===================================================================
  // MERGE PARAMETERS
  // Static params take precedence for security
  // ===================================================================
  
  const mergedParams = {
    ...aiProvidedParams,
    ...staticParams
  }

  console.log('🔀 Merged parameters:', JSON.stringify(mergedParams, null, 2))

  // ===================================================================
  // ADD AUTHENTICATION
  // Include the app authentication field if accountId is present
  // ===================================================================
  
  const configuredProps: Record<string, unknown> = { ...mergedParams }
  
  if (pipedreamMetadata.accountId) {
    // Use the app field name from configurableProps (e.g., "app", "microsoftOutlook")
    // Fall back to app slug for backward compatibility with older tools
    const appFieldName = pipedreamMetadata.appFieldName || pipedreamMetadata.app
    configuredProps[appFieldName] = {
      authProvisionId: pipedreamMetadata.accountId
    }
    console.log(`🔐 Added app auth field: ${appFieldName}`)
  }

  console.log('📤 Final configured props:', JSON.stringify(configuredProps, null, 2))

  // ===================================================================
  // EXECUTE THE PIPEDREAM ACTION
  // ===================================================================
  
  const executionResult = await executeAction(
    organizationId,
    pipedreamMetadata.actionKey,
    configuredProps
  )

  if (!executionResult.success) {
    console.error('❌ Action execution failed')
    console.error(`   Error: ${executionResult.error || 'Unknown error'}`)
    console.error(`   Full execution result:`, JSON.stringify(executionResult, null, 2))
    return {
      success: false,
      error: 'Action execution failed',
    }
  }

  console.log('✅ Action executed successfully')
  console.log(`   Return value type: ${typeof executionResult.returnValue}`)
  if (executionResult.returnValue) {
    console.log(`   Return value preview: ${JSON.stringify(executionResult.returnValue).substring(0, 200)}${JSON.stringify(executionResult.returnValue).length > 200 ? '...' : ''}`)
  }

  // ===================================================================
  // RETURN RESULT
  // ===================================================================
  
  return {
    success: true,
    result: executionResult.returnValue,
    exports: executionResult.exports,
    logs: executionResult.logs,
  }
}

/**
 * Handles execution of SMS tools
 */
async function handleSmsAction(
  tool: Record<string, unknown>,
  aiProvidedParams: Record<string, unknown>,
  variableContext: VariableContext
): Promise<ToolExecutionResult> {
  // ===================================================================
  // EXTRACT CONFIGURATION
  // ===================================================================
  
  const configMetadata = tool.config_metadata as SmsToolConfig | null
  
  if (!configMetadata) {
    console.error('❌ Missing SMS configuration in tool')
    return {
      success: false,
      error: 'Tool configuration error - missing SMS config',
    }
  }

  const staticConfig = (tool.static_config || {}) as Record<string, unknown>
  const toolName = String(tool.name)
  const organizationId = String(tool.organization_id)
  
  console.log('📱 SMS Tool configuration:')
  console.log(`   Tool: ${toolName}`)
  console.log(`   Organization: ${organizationId}`)
  console.log(`   Static Config:`, JSON.stringify(staticConfig, null, 2))
  console.log(`   AI Params:`, JSON.stringify(aiProvidedParams, null, 2))
  console.log(`📞 Context - Caller: ${variableContext.caller_phone_number || ''}, Called: ${variableContext.called_phone_number || ''}`)

  // ===================================================================
  // APPLY VARIABLE SUBSTITUTION TO STATIC CONFIG
  // ===================================================================
  
  const substitutedStaticConfig = substituteVariablesInValue(staticConfig, variableContext) as Record<string, unknown>

  // ===================================================================
  // MERGE PARAMETERS
  // Static params take precedence for security, variable substitution already applied
  // ===================================================================
  
  const rawText = (substitutedStaticConfig.text || aiProvidedParams.text || '') as string
  
  // Handle recipients - could be from static config or AI
  let recipients: string[] = []
  
  if (substitutedStaticConfig.recipients && Array.isArray(substitutedStaticConfig.recipients)) {
    recipients = [...(substitutedStaticConfig.recipients as string[])]
  } else if (substitutedStaticConfig.recipientsBase && Array.isArray(substitutedStaticConfig.recipientsBase)) {
    // Base recipients from array_extendable mode
    recipients = [...(substitutedStaticConfig.recipientsBase as string[])]
  }
  
  // Add AI-provided recipients if any (also apply substitution)
  if (aiProvidedParams.recipients) {
    if (Array.isArray(aiProvidedParams.recipients)) {
      const substitutedRecipients = substituteVariablesInValue(aiProvidedParams.recipients, variableContext) as string[]
      recipients = [...recipients, ...substitutedRecipients]
    } else if (typeof aiProvidedParams.recipients === 'string') {
      const substitutedRecipient = substituteVariables(aiProvidedParams.recipients, variableContext)
      recipients.push(substitutedRecipient)
    }
  }

  // Remove duplicates
  recipients = Array.from(new Set(recipients))

  // Text already has variables substituted
  const substitutedText = rawText

  console.log(`📝 Message text (raw): ${rawText}`)
  console.log(`📝 Message text (substituted): ${substitutedText}`)
  console.log(`📬 Recipients: ${recipients.join(', ')}`)

  // ===================================================================
  // DETERMINE SENDER PHONE NUMBER
  // ===================================================================
  
  const fromConfig = substitutedStaticConfig.from as { type: string; phone_number_id?: string } | undefined
  let fromPhoneNumber: string | null = null
  
  if (!fromConfig || !fromConfig.type) {
    console.error('❌ Missing "from" configuration in SMS tool')
    return {
      success: false,
      error: 'Tool configuration error - missing sender configuration',
    }
  }

  const supabase = await createServiceClient()
  let phoneNumberRecord: Record<string, unknown> | null = null
  
  const calledPhoneNumber = variableContext.called_phone_number
  
  if (fromConfig.type === 'called_number') {
    // Use the number that was called - fetch it from database
    const { data: phoneNumber, error: phoneError } = await supabase
      .from('phone_numbers')
      .select('phone_number, provider, credentials')
      .eq('phone_number', calledPhoneNumber)
      .single()
    
    if (phoneError || !phoneNumber) {
      console.error('❌ Failed to fetch called phone number:', phoneError)
      return {
        success: false,
        error: 'Failed to fetch called phone number from database',
      }
    }
    
    phoneNumberRecord = phoneNumber
    fromPhoneNumber = phoneNumber.phone_number
    console.log(`📱 Using called number: ${fromPhoneNumber} (${phoneNumber.provider})`)
  } else if (fromConfig.type === 'specific_number' && fromConfig.phone_number_id) {
    // Fetch the specific phone number from database
    const { data: phoneNumber, error: phoneError } = await supabase
      .from('phone_numbers')
      .select('phone_number, provider, credentials')
      .eq('id', fromConfig.phone_number_id)
      .single()
    
    if (phoneError || !phoneNumber) {
      console.error('❌ Failed to fetch phone number:', phoneError)
      return {
        success: false,
        error: 'Failed to fetch sender phone number',
      }
    }
    
    phoneNumberRecord = phoneNumber
    fromPhoneNumber = phoneNumber.phone_number
    console.log(`📱 Using specific number: ${fromPhoneNumber} (${phoneNumber.provider})`)
  }

  if (!fromPhoneNumber || !phoneNumberRecord) {
    console.error('❌ Could not determine sender phone number')
    return {
      success: false,
      error: 'Could not determine sender phone number',
    }
  }

  // ===================================================================
  // VALIDATE
  // ===================================================================
  
  if (!substitutedText || substitutedText.trim().length === 0) {
    console.error('❌ Message text is empty')
    return {
      success: false,
      error: 'Message text cannot be empty',
    }
  }

  if (recipients.length === 0) {
    console.error('❌ No recipients specified')
    return {
      success: false,
      error: 'At least one recipient is required',
    }
  }

  // ===================================================================
  // GET TWILIO CREDENTIALS FROM PHONE NUMBER
  // ===================================================================
  
  const credentials = phoneNumberRecord.credentials as { accountSid?: string; authToken?: string } | null
  
  if (!credentials || !credentials.accountSid || !credentials.authToken) {
    console.error('❌ Twilio credentials not found for phone number')
    return {
      success: false,
      error: 'Phone number credentials not configured',
    }
  }

  console.log(`🔐 Using credentials for phone number: Account SID ${credentials.accountSid.substring(0, 10)}...`)

  // ===================================================================
  // SEND SMS VIA TWILIO
  // ===================================================================
  
  try {
    const twilioClient = twilio(credentials.accountSid, credentials.authToken)
    
    // Send to all recipients
    const results = []
    const errors = []
    
    for (const recipient of recipients) {
      try {
        console.log(`📤 Sending SMS to ${recipient}...`)
        const message = await twilioClient.messages.create({
          body: substitutedText,
          from: fromPhoneNumber,
          to: recipient
        })
        
        console.log(`✅ SMS sent successfully to ${recipient} (SID: ${message.sid})`)
        results.push({
          recipient,
          sid: message.sid,
          status: message.status,
          success: true
        })
      } catch (error) {
        console.error(`❌ Failed to send SMS to ${recipient}:`, error)
        errors.push({
          recipient,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        })
      }
    }

    // ===================================================================
    // RETURN RESULT
    // ===================================================================
    
    const allSuccessful = errors.length === 0
    
    return {
      success: allSuccessful,
      result: {
        message: allSuccessful 
          ? `SMS sent successfully to ${results.length} recipient(s)` 
          : `Sent to ${results.length} recipient(s), ${errors.length} failed`,
        results,
        errors: errors.length > 0 ? errors : undefined,
        details: {
          from: fromPhoneNumber,
          text: substitutedText,
          recipientCount: recipients.length
        }
      },
      error: allSuccessful ? undefined : `Failed to send to ${errors.length} recipient(s)`,
    }
  } catch (error) {
    console.error('❌ SMS sending error')
    console.error(`   Error type: ${error instanceof Error ? error.constructor.name : typeof error}`)
    console.error(`   Error message: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      console.error(`   Stack trace:`, error.stack)
    }
    console.error(`   Full error object:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    return {
      success: false,
      error: 'Failed to send SMS',
    }
  }
}

