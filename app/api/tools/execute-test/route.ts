import { NextResponse } from "next/server"
import { executeAction } from "@/lib/pipedream/actions"
import { getAuthSession } from "@/lib/auth"

/**
 * Test Execution Endpoint for Pipedream Actions
 * 
 * This endpoint is used to test Pipedream action configurations before saving.
 * It executes the action with the provided parameters and returns the result.
 */
export async function POST(request: Request) {
  let requestBody: Record<string, unknown>
  
  try {
    requestBody = await request.json()
  } catch {
    console.error('❌ Invalid JSON in test request')
    return NextResponse.json(
      { 
        success: false,
        error: 'Invalid JSON in request body'
      }, 
      { status: 400 }
    )
  }

  const {
    slug,
    app,
    appName,
    appFieldName,
    accountId,
    actionKey,
    actionName,
    params,
  } = requestBody as {
    slug: string
    app: string
    appName: string
    appFieldName: string
    accountId: string
    actionKey: string
    actionName: string
    params: Record<string, unknown>
  }

  console.log('🧪 Test execution request:')
  console.log(`   App: ${appName} (${app})`)
  console.log(`   Action: ${actionName} (${actionKey})`)
  console.log(`   Account ID: ${accountId}`)
  console.log(`   Params:`, JSON.stringify(params, null, 2))

  // ===================================================================
  // GET AUTH CONTEXT
  // ===================================================================

  const { user, organizationId } = await getAuthSession(slug)

  if (!user || !organizationId) {
    console.error('❌ Not authenticated or unauthorized')
    return NextResponse.json(
      { 
        success: false,
        error: 'Not authenticated or unauthorized'
      }, 
      { status: 401 }
    )
  }

  console.log(`✅ Organization ID: ${organizationId}`)

  // ===================================================================
  // PREPARE PARAMETERS
  // ===================================================================

  const configuredProps: Record<string, unknown> = { ...params }

  // Add the app authentication field
  configuredProps[appFieldName] = {
    authProvisionId: accountId,
  }

  console.log('📤 Final configured props:', JSON.stringify(configuredProps, null, 2))

  // ===================================================================
  // EXECUTE THE PIPEDREAM ACTION
  // ===================================================================

  try {
    const executionResult = await executeAction(
      organizationId,
      actionKey,
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

    console.log('✅ Test action executed successfully')

    // ===================================================================
    // RETURN RESULT
    // ===================================================================

    return NextResponse.json({
      success: true,
      result: executionResult.returnValue,
      exports: executionResult.exports,
      logs: executionResult.logs
    })
  } catch (error) {
    console.error('❌ Test execution error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Test execution failed',
        details: errorMessage
      }, 
      { status: 500 }
    )
  }
}
