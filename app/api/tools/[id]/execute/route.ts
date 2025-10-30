import { createServiceClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { executeAction } from "@/lib/pipedream/actions"
import type { PipedreamActionToolConfig, SmsToolConfig } from "@/lib/tools/types"
import twilio from 'twilio'

/**
 * Tool Execution Endpoint
 * 
 * This endpoint receives tool calls from the LiveKit agent and:
 * 1. Fetches the tool configuration from the database
 * 2. Extracts AI-provided parameters from the request
 * 3. Merges them with static configuration
 * 4. Executes the appropriate tool action
 * 5. Returns the result
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: toolId } = await params
  
  // ===================================================================
  // PARSE REQUEST
  // ===================================================================
  
  let aiProvidedParams: Record<string, unknown>
  try {
    aiProvidedParams = await request.json()
  } catch {
    console.error('❌ Invalid JSON in request')
    return NextResponse.json(
      { 
        success: false,
        error: 'Invalid JSON in request body'
      }, 
      { status: 400 }
    )
  }

  console.log('🔧 Tool execution request for tool ID:', toolId)
  console.log('🤖 AI-provided parameters:', JSON.stringify(aiProvidedParams, null, 2))
  
  // Extract metadata BEFORE flattening parameters
  const callerPhoneNumber = (aiProvidedParams.metadata as Record<string, unknown> | undefined)?.['callerPhoneNumber'] as string | undefined
  const calledPhoneNumber = (aiProvidedParams.metadata as Record<string, unknown> | undefined)?.['calledPhoneNumber'] as string | undefined

  console.log(`📞 Context - Caller: ${callerPhoneNumber}, Called: ${calledPhoneNumber}`)
  
  // Flatten nested parameters if they exist
  if (aiProvidedParams.parameters && typeof aiProvidedParams.parameters === 'object') {
    const params = aiProvidedParams.parameters as Record<string, unknown>
    // Extract parameters and keep them flat at the top level
    aiProvidedParams = { ...params }
  }

  // ===================================================================
  // FETCH TOOL FROM DATABASE
  // ===================================================================
  
  const supabase = await createServiceClient()
  
  const { data: tool, error: toolError } = await supabase
    .from('tools')
    .select('*')
    .eq('id', toolId)
    .single()

  if (toolError) {
    console.error('❌ Database error fetching tool:', toolError)
    return NextResponse.json(
      { 
        success: false,
        error: 'Database error',
        details: toolError.message
      }, 
      { status: 500 }
    )
  }

  if (!tool) {
    console.error('❌ Tool not found:', toolId)
    return NextResponse.json(
      { 
        success: false,
        error: 'Tool not found'
      }, 
      { status: 404 }
    )
  }

  console.log(`✅ Found tool: ${tool.name} (type: ${tool.type})`)

  // ===================================================================
  // HANDLE PIPEDREAM ACTION TOOLS
  // ===================================================================
  
  if (tool.type === 'pipedream_action') {
    return handlePipedreamAction(tool, aiProvidedParams)
  }

  // ===================================================================
  // HANDLE SMS TOOLS
  // ===================================================================
  
  if (tool.type === 'sms') {
    return handleSmsAction(tool, aiProvidedParams, callerPhoneNumber, calledPhoneNumber)
  }

  // ===================================================================
  // HANDLE OTHER TOOL TYPES (TODO)
  // ===================================================================
  
  return NextResponse.json(
    { 
      success: false,
      error: `Tool type '${tool.type}' not yet implemented`
    }, 
    { status: 501 }
  )
}

/**
 * Handles execution of Pipedream action tools
 */
async function handlePipedreamAction(
  tool: Record<string, unknown>,
  aiProvidedParams: Record<string, unknown>
): Promise<NextResponse> {
  // ===================================================================
  // EXTRACT CONFIGURATION
  // ===================================================================
  
  const configMetadata = tool.config_metadata as PipedreamActionToolConfig | null
  
  if (!configMetadata || !configMetadata.pipedreamMetadata) {
    console.error('❌ Missing Pipedream metadata in tool configuration')
    return NextResponse.json(
      { 
        success: false,
        error: 'Tool configuration error - missing Pipedream metadata'
      }, 
      { status: 500 }
    )
  }

  const { pipedreamMetadata } = configMetadata
  const staticConfig = (tool.static_config || {}) as Record<string, unknown>
  
  // Extract actual parameter values from static_config
  // static_config may have structure: { params: {...}, preloadedParams: {...} }
  // We need to extract the values from the params object
  let staticParams: Record<string, unknown> = {}
  
  const params = staticConfig.params as Record<string, unknown> | undefined
  const preloadedParams = staticConfig.preloadedParams as Record<string, unknown> | undefined
  
  if (params && typeof params === 'object') {
    // If params is nested, extract it
    staticParams = { ...params }
  } else if (!params && !preloadedParams) {
    // If there's no params/preloadedParams structure, use staticConfig directly
    staticParams = { ...staticConfig }
  }

  const toolName = String(tool.name)
  const organizationId = String(tool.organization_id)
  
  console.log('📋 Tool configuration:')
  console.log(`   Tool: ${toolName}`)
  console.log(`   App: ${pipedreamMetadata.appName} (${pipedreamMetadata.app})`)
  console.log(`   Action: ${pipedreamMetadata.actionName} (${pipedreamMetadata.actionKey})`)
  console.log(`   Organization: ${organizationId}`)
  console.log(`   Account ID: ${pipedreamMetadata.accountId}`)
  console.log(`   Static Config:`, JSON.stringify(staticConfig, null, 2))
  console.log(`   Extracted Static Params:`, JSON.stringify(staticParams, null, 2))

  // ===================================================================
  // VALIDATE REQUIRED FIELDS
  // ===================================================================
  
  if (!tool.organization_id) {
    console.error('❌ Missing organization_id in tool')
    return NextResponse.json(
      { 
        success: false,
        error: 'Tool configuration error - missing organization_id'
      }, 
      { status: 500 }
    )
  }

  if (!pipedreamMetadata.actionKey) {
    console.error('❌ Missing actionKey in Pipedream metadata')
    return NextResponse.json(
      { 
        success: false,
        error: 'Tool configuration error - missing actionKey'
      }, 
      { status: 500 }
    )
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
    console.error('❌ Action execution failed:', executionResult.error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Action execution failed',
        details: executionResult.error
      }, 
      { status: 500 }
    )
  }

  console.log('✅ Action executed successfully')

  // ===================================================================
  // RETURN RESULT
  // ===================================================================
  
  return NextResponse.json({
    success: true,
    result: executionResult.returnValue,
    exports: executionResult.exports,
    logs: executionResult.logs
  })
}

/**
 * Handles execution of SMS tools
 */
async function handleSmsAction(
  tool: Record<string, unknown>,
  aiProvidedParams: Record<string, unknown>,
  callerPhoneNumber: string | undefined,
  calledPhoneNumber: string | undefined
): Promise<NextResponse> {
  // ===================================================================
  // EXTRACT CONFIGURATION
  // ===================================================================
  
  const configMetadata = tool.config_metadata as SmsToolConfig | null
  
  if (!configMetadata) {
    console.error('❌ Missing SMS configuration in tool')
    return NextResponse.json(
      { 
        success: false,
        error: 'Tool configuration error - missing SMS config'
      }, 
      { status: 500 }
    )
  }

  const staticConfig = (tool.static_config || {}) as Record<string, unknown>
  const toolName = String(tool.name)
  const organizationId = String(tool.organization_id)
  
  console.log('📱 SMS Tool configuration:')
  console.log(`   Tool: ${toolName}`)
  console.log(`   Organization: ${organizationId}`)
  console.log(`   Static Config:`, JSON.stringify(staticConfig, null, 2))
  console.log(`   AI Params:`, JSON.stringify(aiProvidedParams, null, 2))
  console.log(`📞 Context - Caller: ${callerPhoneNumber || ''}, Called: ${calledPhoneNumber || ''}`)

  // ===================================================================
  // HELPER: Variable Substitution
  // Replace {{variable_name}} with actual values
  // ===================================================================
  
  const substituteVariables = (text: string): string => {
    return text
      .replace(/\{\{caller_phone_number\}\}/g, callerPhoneNumber || '')
      .replace(/\{\{called_phone_number\}\}/g, calledPhoneNumber || '')
  }

  // ===================================================================
  // MERGE PARAMETERS
  // Static params take precedence for security, apply variable substitution
  // ===================================================================

  const rawText = (staticConfig.text || aiProvidedParams.text || '') as string
  
  // Handle recipients - could be from static config or AI
  let recipients: string[] = []
  
  if (staticConfig.recipients && Array.isArray(staticConfig.recipients)) {
    recipients = (staticConfig.recipients as string[]).map(substituteVariables)
  } else if (staticConfig.recipientsBase && Array.isArray(staticConfig.recipientsBase)) {
    // Base recipients from array_extendable mode
    recipients = [...(staticConfig.recipientsBase as string[]).map(substituteVariables)]
  }
  
  // Add AI-provided recipients if any
  if (aiProvidedParams.recipients) {
    if (Array.isArray(aiProvidedParams.recipients)) {
      recipients = [...recipients, ...(aiProvidedParams.recipients as string[]).map(substituteVariables)]
    } else if (typeof aiProvidedParams.recipients === 'string') {
      recipients.push(substituteVariables(aiProvidedParams.recipients))
    }
  }

  // Remove duplicates
  recipients = Array.from(new Set(recipients))

  // Apply variable substitution to text
  const substitutedText = substituteVariables(rawText)

  console.log(`📝 Message text (raw): ${rawText}`)
  console.log(`📝 Message text (substituted): ${substitutedText}`)
  console.log(`📬 Recipients: ${recipients.join(', ')}`)

  // ===================================================================
  // DETERMINE SENDER PHONE NUMBER
  // ===================================================================
  
  const fromConfig = staticConfig.from as { type: string; phone_number_id?: string } | undefined
  let fromPhoneNumber: string | null = null
  
  if (!fromConfig || !fromConfig.type) {
    console.error('❌ Missing "from" configuration in SMS tool')
    return NextResponse.json(
      { 
        success: false,
        error: 'Tool configuration error - missing sender configuration'
      }, 
      { status: 500 }
    )
  }

  const supabase = await createServiceClient()
  let phoneNumberRecord: Record<string, unknown> | null = null
  
  if (fromConfig.type === 'called_number') {
    // Use the number that was called - fetch it from database
    const { data: phoneNumber, error: phoneError } = await supabase
      .from('phone_numbers')
      .select('phone_number, provider, credentials')
      .eq('phone_number', calledPhoneNumber)
      .single()
    
    if (phoneError || !phoneNumber) {
      console.error('❌ Failed to fetch called phone number:', phoneError)
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to fetch called phone number from database'
        }, 
        { status: 500 }
      )
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
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to fetch sender phone number'
        }, 
        { status: 500 }
      )
    }
    
    phoneNumberRecord = phoneNumber
    fromPhoneNumber = phoneNumber.phone_number
    console.log(`📱 Using specific number: ${fromPhoneNumber} (${phoneNumber.provider})`)
  }

  if (!fromPhoneNumber || !phoneNumberRecord) {
    console.error('❌ Could not determine sender phone number')
    return NextResponse.json(
      { 
        success: false,
        error: 'Could not determine sender phone number'
      }, 
      { status: 400 }
    )
  }

  // ===================================================================
  // VALIDATE
  // ===================================================================
  
  if (!substitutedText || substitutedText.trim().length === 0) {
    console.error('❌ Message text is empty')
    return NextResponse.json(
      { 
        success: false,
        error: 'Message text cannot be empty'
      }, 
      { status: 400 }
    )
  }

  if (recipients.length === 0) {
    console.error('❌ No recipients specified')
    return NextResponse.json(
      { 
        success: false,
        error: 'At least one recipient is required'
      }, 
      { status: 400 }
    )
  }

  // ===================================================================
  // GET TWILIO CREDENTIALS FROM PHONE NUMBER
  // ===================================================================
  
  const credentials = phoneNumberRecord.credentials as { accountSid?: string; authToken?: string } | null
  
  if (!credentials || !credentials.accountSid || !credentials.authToken) {
    console.error('❌ Twilio credentials not found for phone number')
    return NextResponse.json(
      { 
        success: false,
        error: 'Phone number credentials not configured'
      }, 
      { status: 500 }
    )
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
    
    return NextResponse.json({
      success: allSuccessful,
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
    })
  } catch (error) {
    console.error('❌ SMS sending error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to send SMS',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
}