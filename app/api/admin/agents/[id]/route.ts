import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/(admin)/lib/admin-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { unassignKnowledgeBaseFromAgent } from '@/lib/knowledge-bases'
import { vapiClient } from '@/lib/vapi/VapiClients'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()
    
    // Step 1: Get agent details
    // Note: Agents can exist without an organization_id (unassigned agents)
    // This deletion process works for both assigned and unassigned agents
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, vapi_assistant_id')
      .eq('id', id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Step 2: Unassign all knowledge bases FIRST
    try {
      // Get all knowledge bases assigned to this agent
      const { data: kbAssignments, error: kbError } = await supabase
        .from('agent_knowledge_bases')
        .select('knowledge_base_id')
        .eq('agent_id', id)

      if (kbError) {
        console.error('Error fetching agent knowledge bases:', kbError)
      } else if (kbAssignments && kbAssignments.length > 0) {
        // Unassign each knowledge base (this handles VAPI tool cleanup)
        for (const assignment of kbAssignments) {
          try {
            await unassignKnowledgeBaseFromAgent(id, assignment.knowledge_base_id)
          } catch (error) {
            console.error(`Error unassigning knowledge base ${assignment.knowledge_base_id} from agent:`, error)
            // Continue with other knowledge bases even if one fails
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up agent knowledge bases:', error)
      // Continue with deletion even if knowledge base cleanup fails
    }

    // Step 3: Unassign all remaining tools
    try {
      const { data: agentToolsRecords, error: toolsError } = await supabase
        .from('agent_tools')
        .select('id, tool_id, is_vapi_attached, tools!inner(external_tool_id, attach_to_agent)')
        .eq('agent_id', id)

      if (toolsError) {
        console.error('Error fetching agent tools:', toolsError)
      } else if (agentToolsRecords && agentToolsRecords.length > 0) {
        // Get current VAPI assistant to update toolIds
        let assistant
        let currentToolIds: string[] = []
        
        if (agent.vapi_assistant_id) {
          try {
            assistant = await vapiClient.assistants.get(agent.vapi_assistant_id)
            currentToolIds = assistant.model?.toolIds || []
          } catch (error: any) {
            // If assistant not found (404), continue without VAPI updates
            if (error?.statusCode !== 404 && error?.status !== 404) {
              console.error('Error fetching VAPI assistant:', error)
            }
          }
        }

        const toolsToRemoveFromVapi: string[] = []

        for (const record of agentToolsRecords) {
          const toolRecord = record as any
          const tool = toolRecord.tools

          if (toolRecord.is_vapi_attached && tool?.external_tool_id) {
            // Track tools that need to be removed from VAPI
            if (currentToolIds.includes(tool.external_tool_id)) {
              toolsToRemoveFromVapi.push(tool.external_tool_id)
            }
          }

          // Delete from agent_tools table
          const { error: deleteError } = await supabase
            .from('agent_tools')
            .delete()
            .eq('id', toolRecord.id)

          if (deleteError) {
            console.error(`Error deleting agent_tool ${toolRecord.id}:`, deleteError)
          }
        }

        // Update VAPI assistant to remove all tools at once
        if (assistant && toolsToRemoveFromVapi.length > 0) {
          const updatedToolIds = currentToolIds.filter(id => !toolsToRemoveFromVapi.includes(id))
          
          try {
            await vapiClient.assistants.update(agent.vapi_assistant_id, {
              model: {
                ...assistant.model,
                toolIds: updatedToolIds
              } as any
            })
          } catch (error: any) {
            // Handle 404 gracefully (assistant may already be deleted)
            if (error?.statusCode !== 404 && error?.status !== 404) {
              console.error('Error updating VAPI assistant:', error)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up agent tools:', error)
      // Continue with deletion even if tool cleanup fails
    }

    // Step 4: Delete VAPI assistant
    if (agent.vapi_assistant_id) {
      try {
        await vapiClient.assistants.delete(agent.vapi_assistant_id)
      } catch (error: any) {
        // Handle 404 gracefully (assistant may already be deleted)
        if (error?.statusCode !== 404 && error?.status !== 404) {
          console.error('Error deleting VAPI assistant:', error)
          // Continue with database deletion even if VAPI deletion fails
        }
      }
    }

    // Step 5: Delete from database
    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting agent from database:', error)
      return NextResponse.json(
        { error: 'Failed to delete agent' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in agent deletion:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

