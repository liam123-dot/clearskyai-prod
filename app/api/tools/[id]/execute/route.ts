import { NextResponse } from "next/server"
import { executeToolById } from "@/lib/tools/execute"
import type { VariableContext } from "@/lib/tools/variables"

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
  
  // Remove dummy property if present (used to satisfy VAPI validation for tools with no AI parameters)
  if ('_dummy' in aiProvidedParams) {
    delete aiProvidedParams._dummy
  }

  // ===================================================================
  // BUILD VARIABLE CONTEXT
  // ===================================================================
  
  const variableContext: VariableContext = {
    caller_phone_number: callerPhoneNumber,
    called_phone_number: calledPhoneNumber,
  }

  // ===================================================================
  // EXECUTE TOOL USING SHARED FUNCTION
  // ===================================================================
  
  const executionResult = await executeToolById(toolId, aiProvidedParams, variableContext)

  // ===================================================================
  // RETURN RESULT AS HTTP RESPONSE
  // ===================================================================
  
  if (!executionResult.success) {
    const statusCode = executionResult.error === 'Tool not found' ? 404 : 
                      executionResult.error === 'Database error' ? 500 : 500
    return NextResponse.json(
      { 
        success: false,
        error: executionResult.error || 'Tool execution failed'
      }, 
      { status: statusCode }
    )
  }

  return NextResponse.json({
    success: true,
    result: executionResult.result,
    exports: executionResult.exports,
    logs: executionResult.logs
  })
}
