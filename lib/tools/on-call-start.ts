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
    
    // Get the agent's VAPI assistant ID
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('vapi_assistant_id')
      .eq('id', agentId)
      .single()
    
    if (agentError || !agent) {
      console.error(`❌ Agent not found: ${agentId}`, agentError)
      return
    }
    
    if (!agent.vapi_assistant_id) {
      console.warn(`⚠️ Agent ${agentId} has no VAPI assistant ID`)
      return
    }
    
    // Get the assistant's tool IDs from VAPI (for attached tools)
    let toolIds: string[] = []
    try {
      const assistant = await vapiClient.assistants.get(agent.vapi_assistant_id)
      toolIds = assistant.model?.toolIds || []
    } catch (error) {
      console.error(`❌ Failed to fetch assistant ${agent.vapi_assistant_id}:`, error)
      return
    }
    
    // Query tools with execute_on_call_start = true that are attached to this agent
    // Two cases:
    // 1. Tools attached via VAPI (have external_tool_id in agent's toolIds)
    // 2. Tools attached via agent_tools table (attach_to_agent = false)
    
    // Get tools attached via agent_tools table
    const { data: agentToolsRecords, error: agentToolsError } = await supabase
      .from('agent_tools')
      .select('tool_id')
      .eq('agent_id', agentId)
    
    if (agentToolsError) {
      console.error(`❌ Error fetching agent_tools:`, agentToolsError)
    }
    
    const agentToolIds = (agentToolsRecords || []).map(record => record.tool_id)
    
    // Query tools: VAPI-attached OR agent_tools-attached, both with execute_on_call_start = true
    const conditions: string[] = []
    
    // Condition 1: Tools attached via VAPI
    if (toolIds.length > 0) {
      conditions.push(`external_tool_id.in.(${toolIds.join(',')})`)
    }
    
    // Condition 2: Tools attached via agent_tools table
    if (agentToolIds.length > 0) {
      conditions.push(`id.in.(${agentToolIds.join(',')})`)
    }
    
    if (conditions.length === 0) {
      console.log(`ℹ️ No on-call-start tools found for agent ${agentId}`)
      return
    }
    
    // Query tools with execute_on_call_start = true that match either condition
    const { data: tools, error: toolsError } = await supabase
      .from('tools')
      .select('*')
      .eq('execute_on_call_start', true)
      .or(conditions.join(','))
    
    if (toolsError) {
      console.error(`❌ Error querying on-call-start tools:`, toolsError)
      return
    }
    
    if (!tools || tools.length === 0) {
      console.log(`ℹ️ No on-call-start tools found for agent ${agentId}`)
      return
    }
    
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

