import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVEN_API_KEY,
})

/**
 * Gets tool IDs from an ElevenLabs agent
 * @param agentId - The ElevenLabs agent ID
 * @returns Array of tool IDs
 */
export async function getElevenLabsAgentTools(agentId: string): Promise<string[]> {
  const agent = await client.conversationalAi.agents.get(agentId)
  return (agent.conversationConfig?.agent as any)?.prompt?.toolIds || []
}

/**
 * Updates an ElevenLabs agent's prompt.toolIds array
 * @param agentId - The ElevenLabs agent ID
 * @param toolIds - The new array of tool IDs
 */
export async function updateElevenLabsAgentToolIds(
  agentId: string,
  toolIds: string[]
): Promise<void> {
  const agent = await client.conversationalAi.agents.get(agentId)
  const agentConfig = agent.conversationConfig?.agent as any
  const currentPrompt = agentConfig?.prompt || {}

  console.log('dooing toolids: ', toolIds)
  
  const updatedAgent = await client.conversationalAi.agents.update(agentId, {
    conversationConfig: {
      agent: {
        prompt: {
          toolIds: toolIds
        }
      }
    }
  })

  console.log(`Updated agent ${agentId} config:`, JSON.stringify(updatedAgent, null, 2))
  
  console.log(`Updated agent ${agentId} toolIds to:`, toolIds)
}

/**
 * Removes a tool from an ElevenLabs agent's prompt.toolIds
 * @param agentId - The ElevenLabs agent ID
 * @param toolId - The tool ID to remove
 */
export async function removeToolFromElevenLabsAgent(
  agentId: string,
  toolId: string
): Promise<void> {
  try {
    const agent = await client.conversationalAi.agents.get(agentId)
    const currentToolIds = (agent.conversationConfig?.agent as any)?.prompt?.toolIds || []
    
    console.log(`Current toolIds for agent ${agentId}:`, currentToolIds)
    
    // Check if tool exists
    if (!currentToolIds.includes(toolId)) {
      console.log(`Tool ${toolId} not found in agent ${agentId}, nothing to remove`)
      return
    }
    
    // Remove tool from toolIds
    const updatedToolIds = currentToolIds.filter((id: string) => id !== toolId)
    
    console.log(`Updating agent ${agentId} to remove tool ${toolId}, new toolIds:`, updatedToolIds)
    
    // Update agent
    await updateElevenLabsAgentToolIds(agentId, updatedToolIds)
    
    console.log(`Removed tool ${toolId} from ElevenLabs agent ${agentId}`)
  } catch (elevenLabsError: any) {
    // Check if it's a 404 error (tool or agent not found)
    if (elevenLabsError?.statusCode === 404 || elevenLabsError?.status === 404) {
      console.log(`Tool or agent not found in ElevenLabs (404), continuing`)
      return
    }
    // Other errors should be thrown
    console.error(`Error removing tool from ElevenLabs agent ${agentId}:`, elevenLabsError)
    throw new Error(`Failed to remove tool from ElevenLabs agent: ${elevenLabsError.message}`)
  }
}

/**
 * Deletes a tool from ElevenLabs API
 * @param toolId - The ElevenLabs tool ID to delete
 */
export async function deleteElevenLabsTool(toolId: string): Promise<void> {
  try {
    console.log('Deleting ElevenLabs tool:', toolId)
    await client.conversationalAi.tools.delete(toolId)
    console.log('ElevenLabs tool deleted successfully')
  } catch (elevenLabsError: any) {
    // If 404, the tool was already deleted, which is fine
    if (elevenLabsError?.statusCode === 404 || elevenLabsError?.status === 404) {
      console.log('ElevenLabs tool already deleted (404)')
      return
    }
    // Other errors should be thrown
    console.error('Error deleting ElevenLabs tool:', elevenLabsError)
    throw new Error(`Failed to delete ElevenLabs tool: ${elevenLabsError.message}`)
  }
}

