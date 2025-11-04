/**
 * On-Call-Start Tool Execution
 * 
 * Executes tools marked with execute_on_call_start = true when a call starts.
 * Results are injected into the conversation as system context using VAPI Call Control API.
 */

import { createNoCookieClient } from '@/lib/supabase/trigger'
import { injectSystemContext } from '@/lib/vapi/call-control'
import { executeToolById } from '@/lib/tools/execute'
import type { VariableContext } from '@/lib/tools/variables'

/**
 * Executes all tools marked for on-call-start execution for an agent
 * @param agentId - The agent ID
 * @param callRecordId - The call record ID (for logging)
 * @param callerNumber - The caller's phone number
 * @param calledNumber - The called phone number
 * @param controlUrl - The VAPI control URL for injecting messages
 */
export async function executeOnCallStartTools(
  agentId: string,
  callRecordId: string,
  callerNumber: string,
  calledNumber: string,
  controlUrl: string
): Promise<void> {
  'use step';
  console.log(`🚀 Executing on-call-start tools for agent ${agentId}, call ${callRecordId}`)
  console.log(`📞 Caller: ${callerNumber}, Called: ${calledNumber}`)
  console.log(`🔗 Control URL: ${controlUrl}`)
  
  try {
    const supabase = createNoCookieClient()
    
    // Query tools with execute_on_call_start = true that are attached to this agent
    // All agent-tool relationships are now tracked in agent_tools table
    console.log(`🔍 Querying database for on-call-start tools for agent ${agentId}...`)
    const { data: agentToolsRecords, error: agentToolsError } = await supabase
      .from('agent_tools')
      .select('tools!inner(*)')
      .eq('agent_id', agentId)
      .eq('tools.execute_on_call_start', true)
    
    if (agentToolsError) {
      console.error(`❌ Error fetching agent tools:`, agentToolsError)
      console.error(`   Error details:`, JSON.stringify(agentToolsError, null, 2))
      console.error(`   Error code: ${agentToolsError.code || 'N/A'}`)
      console.error(`   Error message: ${agentToolsError.message || 'N/A'}`)
      return
    }
    
    if (!agentToolsRecords || agentToolsRecords.length === 0) {
      console.log(`ℹ️ No on-call-start tools found for agent ${agentId}`)
      return
    }
    
    // Extract tools from the join result
    const tools = agentToolsRecords.map((record: any) => record.tools)
    
    console.log(`📋 Found ${tools.length} on-call-start tool(s) to execute`)
    console.log(`   Tool IDs: ${tools.map((t: any) => `${t.id} (${t.name || t.label || 'unnamed'})`).join(', ')}`)
    
    // Build variable context
    const variableContext: VariableContext = {
      caller_phone_number: callerNumber,
      called_phone_number: calledNumber,
    }
    
    console.log(`📋 Variable context:`, JSON.stringify(variableContext, null, 2))
    
    // Execute each tool and collect results
    const results: Array<{ toolName: string; success: boolean; result?: unknown; error?: string }> = []
    
    for (const tool of tools) {
      const toolName = tool.label || tool.name || tool.id
      const toolType = tool.type || 'unknown'
      console.log(`🔧 Starting execution of tool: ${toolName} (ID: ${tool.id}, Type: ${toolType})`)
      console.log(`   Variable context: caller=${variableContext.caller_phone_number}, called=${variableContext.called_phone_number}`)
      
      try {
        // Execute tool directly using shared function
        // Empty parameters - tools should use fixed values with variables
        // Pass supabase client to avoid cookie-based auth in Trigger.dev
        const executionResult = await executeToolById(tool.id, {}, variableContext, supabase)
        
        if (executionResult.success) {
          console.log(`✅ Tool ${toolName} executed successfully`)
          console.log(`   Result type: ${typeof executionResult.result}`)
          console.log(`   Result preview: ${JSON.stringify(executionResult.result).substring(0, 200)}${JSON.stringify(executionResult.result).length > 200 ? '...' : ''}`)
          if (executionResult.exports) {
            console.log(`   Exports: ${JSON.stringify(executionResult.exports).substring(0, 200)}`)
          }
          if (executionResult.logs) {
            console.log(`   Logs: ${JSON.stringify(executionResult.logs).substring(0, 200)}`)
          }
          results.push({
            toolName,
            success: true,
            result: executionResult.result,
          })
        } else {
          console.error(`❌ Tool ${toolName} execution failed`)
          console.error(`   Error: ${executionResult.error || 'Unknown error'}`)
          console.error(`   Full execution result:`, JSON.stringify(executionResult, null, 2))
          results.push({
            toolName,
            success: false,
            error: executionResult.error || 'Unknown error',
          })
        }
      } catch (error) {
        console.error(`❌ Exception while executing tool ${toolName}:`, error)
        console.error(`   Error type: ${error instanceof Error ? error.constructor.name : typeof error}`)
        console.error(`   Error message: ${error instanceof Error ? error.message : String(error)}`)
        if (error instanceof Error && error.stack) {
          console.error(`   Stack trace:`, error.stack)
        }
        console.error(`   Full error object:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
        results.push({
          toolName,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
    
    // If we have any successful results, format and inject them
    const successfulResults = results.filter(r => r.success && r.result)
    const failedResults = results.filter(r => !r.success)
    
    console.log(`📊 Execution summary:`)
    console.log(`   Total tools: ${results.length}`)
    console.log(`   Successful: ${successfulResults.length}`)
    console.log(`   Failed: ${failedResults.length}`)
    
    if (failedResults.length > 0) {
      console.log(`   Failed tools: ${failedResults.map(r => `${r.toolName} (${r.error})`).join(', ')}`)
    }
    
    if (successfulResults.length > 0) {
      // Format results as a system message
      const contextParts: string[] = []
      
      for (const result of successfulResults) {
        contextParts.push(`${result.toolName}: ${JSON.stringify(result.result)}`)
      }
      
      const systemContext = `Customer context from CRM lookup:\n${contextParts.join('\n')}`
      
      console.log(`💬 Preparing to inject system context`)
      console.log(`   Control URL: ${controlUrl}`)
      console.log(`   Context length: ${systemContext.length} characters`)
      console.log(`   Context preview: ${systemContext.substring(0, 300)}${systemContext.length > 300 ? '...' : ''}`)
      console.log(`   Full context:`, systemContext)
      
      try {
        console.log(`📤 Calling injectSystemContext...`)
        await injectSystemContext(controlUrl, systemContext)
        console.log(`✅ Successfully injected context into conversation`)
      } catch (error) {
        console.error(`❌ Failed to inject context`)
        console.error(`   Error type: ${error instanceof Error ? error.constructor.name : typeof error}`)
        console.error(`   Error message: ${error instanceof Error ? error.message : String(error)}`)
        if (error instanceof Error && error.stack) {
          console.error(`   Stack trace:`, error.stack)
        }
        console.error(`   Full error object:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
        // Don't throw - we don't want to fail the call if injection fails
      }
    } else {
      console.log(`ℹ️ No successful results to inject`)
      if (results.length > 0) {
        console.log(`   All ${results.length} tool(s) failed or returned no results`)
      }
    }
  } catch (error) {
    console.error(`❌ Fatal error in executeOnCallStartTools`)
    console.error(`   Error type: ${error instanceof Error ? error.constructor.name : typeof error}`)
    console.error(`   Error message: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      console.error(`   Stack trace:`, error.stack)
    }
    console.error(`   Full error object:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    console.error(`   Agent ID: ${agentId}`)
    console.error(`   Call Record ID: ${callRecordId}`)
    console.error(`   Caller: ${callerNumber}, Called: ${calledNumber}`)
    console.error(`   Control URL: ${controlUrl}`)
    // Don't throw - we don't want to fail the call if tool execution fails
  }
}

