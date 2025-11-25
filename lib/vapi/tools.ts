import { vapiClient } from './VapiClients'

/**
 * Gets tool IDs from a Vapi assistant
 * @param assistantId - The Vapi assistant ID
 * @returns Array of tool IDs
 */
export async function getVapiAgentTools(assistantId: string): Promise<string[]> {
  const assistant = await vapiClient.assistants.get(assistantId)
  return assistant.model?.toolIds || []
}

/**
 * Updates a Vapi assistant's toolIds array
 * @param assistantId - The Vapi assistant ID
 * @param toolIds - The new array of tool IDs
 */
export async function updateVapiAssistantToolIds(
  assistantId: string,
  toolIds: string[]
): Promise<void> {
  const assistant = await vapiClient.assistants.get(assistantId)
  
  await vapiClient.assistants.update(assistantId, {
    model: {
      ...assistant.model,
      toolIds: toolIds
    } as any
  })
}

/**
 * Removes a tool from a Vapi assistant's toolIds
 * @param assistantId - The Vapi assistant ID
 * @param toolId - The tool ID to remove
 */
export async function removeToolFromVapiAgent(
  assistantId: string,
  toolId: string
): Promise<void> {
  try {
    const assistant = await vapiClient.assistants.get(assistantId)
    const currentToolIds = assistant.model?.toolIds || []
    
    // Remove tool from toolIds
    const updatedToolIds = currentToolIds.filter(id => id !== toolId)
    
    // Update assistant
    await updateVapiAssistantToolIds(assistantId, updatedToolIds)
    
    console.log(`Removed tool ${toolId} from Vapi assistant ${assistantId}`)
  } catch (vapiError: any) {
    // Check if it's a 404 error (tool or assistant not found)
    if (vapiError?.statusCode === 404 || vapiError?.status === 404) {
      console.log(`Tool or assistant not found in VAPI (404), continuing`)
      return
    }
    // Other errors should be thrown
    console.error(`Error removing tool from Vapi assistant ${assistantId}:`, vapiError)
    throw new Error(`Failed to remove tool from Vapi assistant: ${vapiError.message}`)
  }
}

/**
 * Deletes a tool from Vapi API
 * @param toolId - The Vapi tool ID to delete
 */
export async function deleteVapiTool(toolId: string): Promise<void> {
  try {
    console.log('Deleting VAPI tool:', toolId)
    await vapiClient.tools.delete(toolId)
    console.log('VAPI tool deleted successfully')
  } catch (vapiError: any) {
    // If 404, the tool was already deleted, which is fine
    if (vapiError?.statusCode === 404 || vapiError?.status === 404) {
      console.log('VAPI tool already deleted (404)')
      return
    }
    // Other errors should be thrown
    console.error('Error deleting VAPI tool:', vapiError)
    throw new Error(`Failed to delete Vapi tool: ${vapiError.message}`)
  }
}

