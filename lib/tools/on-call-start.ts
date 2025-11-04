/**
 * On-Call-Start Tool Execution
 * 
 * Executes tools marked with execute_on_call_start = true when a call starts.
 * Results are injected into the conversation as system context using VAPI Call Control API.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { vapiClient } from '@/lib/vapi/VapiClients'
import { injectSystemContext } from '@/lib/vapi/call-control'
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
  console.log(`🚀 Executing on-call-start tools for agent ${agentId}, call ${callRecordId}`)
  
  try {
    const supabase = await createServiceClient()
    
    // Query tools with execute_on_call_start = true that are attached to this agent
    // All agent-tool relationships are now tracked in agent_tools table
    const { data: agentToolsRecords, error: agentToolsError } = await supabase
      .from('agent_tools')
      .select('tools!inner(*)')
      .eq('agent_id', agentId)
      .eq('tools.execute_on_call_start', true)
    
    if (agentToolsError) {
      console.error(`❌ Error fetching agent tools:`, agentToolsError)
      return
    }
    
    if (!agentToolsRecords || agentToolsRecords.length === 0) {
      console.log(`ℹ️ No on-call-start tools found for agent ${agentId}`)
      return
    }
    
    // Extract tools from the join result
    const tools = agentToolsRecords.map((record: any) => record.tools)
    
    console.log(`📋 Found ${tools.length} on-call-start tool(s) to execute`)
    
    // Build variable context
    const variableContext: VariableContext = {
      caller_phone_number: callerNumber,
      called_phone_number: calledNumber,
    }
    
    // Execute each tool and collect results
    const results: Array<{ toolName: string; success: boolean; result?: unknown; error?: string }> = []
    
    for (const tool of tools) {
      const toolName = tool.label || tool.name || tool.id
      console.log(`🔧 Executing tool: ${toolName} (${tool.id})`)
      
      try {
        // Build execution request with metadata
        const executionRequest = {
          metadata: {
            callerPhoneNumber: callerNumber,
            calledPhoneNumber: calledNumber,
          },
          // Empty parameters - tools should use fixed values with variables
          parameters: {},
        }
        
        // Make internal fetch to tool execution endpoint
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const executeUrl = `${baseUrl}/api/tools/${tool.id}/execute`
        
        const response = await fetch(executeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(executionRequest),
        })
        
        const data = await response.json()
        
        if (response.ok && data.success) {
          console.log(`✅ Tool ${toolName} executed successfully`)
          results.push({
            toolName,
            success: true,
            result: data.result,
          })
        } else {
          console.error(`❌ Tool ${toolName} execution failed:`, data.error || 'Unknown error')
          results.push({
            toolName,
            success: false,
            error: data.error || 'Unknown error',
          })
        }
      } catch (error) {
        console.error(`❌ Error executing tool ${toolName}:`, error)
        results.push({
          toolName,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
    
    // If we have any successful results, format and inject them
    const successfulResults = results.filter(r => r.success && r.result)
    
    if (successfulResults.length > 0) {
      // Format results as a system message
      const contextParts: string[] = []
      
      for (const result of successfulResults) {
        contextParts.push(`${result.toolName}: ${JSON.stringify(result.result)}`)
      }
      
      const systemContext = `Customer context from CRM lookup:\n${contextParts.join('\n')}`
      
      console.log(`💬 Injecting system context: ${systemContext.substring(0, 200)}...`)
      
      try {
        await injectSystemContext(controlUrl, systemContext)
        console.log(`✅ Successfully injected context into conversation`)
      } catch (error) {
        console.error(`❌ Failed to inject context:`, error)
        // Don't throw - we don't want to fail the call if injection fails
      }
    } else {
      console.log(`ℹ️ No successful results to inject`)
    }
  } catch (error) {
    console.error(`❌ Error in executeOnCallStartTools:`, error)
    // Don't throw - we don't want to fail the call if tool execution fails
  }
}

