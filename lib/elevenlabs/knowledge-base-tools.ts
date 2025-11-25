import { createNoCookieClient } from "../supabase/serverNoCookies"
import { createTool, deleteToolByExternalId } from "../tools"
import { formatLabelForDisplay } from "../utils"
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { removeToolFromElevenLabsAgent, deleteElevenLabsTool } from './tools'

const client = new ElevenLabsClient({
    apiKey: process.env.ELEVEN_API_KEY,
})

/**
 * Creates an ElevenLabs webhook tool config for querying estate agent properties
 */
export function createEstateAgentToolData(
  knowledgeBaseId: string,
  knowledgeBaseName: string
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!
  
  // Sanitize name for function name (must match /^[a-zA-Z0-9_-]{1,40}$/)
  const sanitizedName = knowledgeBaseName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .substring(0, 30) // Leave room for prefixes/suffixes
  
  return {
    type: 'webhook' as const,
    name: `query_${sanitizedName}`,
    description: `Search and filter properties from ${knowledgeBaseName} by location (street, area, district, landmark), price, property type, furnished type, nearby train/tube stations, and other criteria. Returns up to 3 matching properties by default (or all properties if include_all is true) in plain text format with essential details (baths, price, property type, title, address, etc.) along with the total count of matching properties. Uses intelligent multi-strategy location matching combining fuzzy/phonetic address search AND Google Places API boundaries - if no match found, returns available options as refinements.`,
    apiSchema: {
      url: `${baseUrl}/api/query/estate-agent/${knowledgeBaseId}`,
      method: 'POST' as const,
      contentType: 'application/json' as const,
      requestBodySchema: {
        type: 'object' as const,
        properties: {
          beds: {
            type: 'number' as const,
            description: 'Number of bedrooms'
          },
          baths: {
            type: 'number' as const,
            description: 'Number of bathrooms'
          },
          price: {
            type: 'object' as const,
            description: 'Price filter',
            properties: {
              filter: {
                type: 'string' as const,
                enum: ['under', 'over', 'between'],
                description: 'Type of price filter'
              },
              value: {
                type: 'number' as const,
                description: 'Price value'
              },
              max_value: {
                type: 'number' as const,
                description: 'Maximum price value (only for between filter)'
              }
            },
            required: ['filter', 'value']
          },
          transaction_type: {
            type: 'string' as const,
            enum: ['rent', 'sale'],
            description: 'Type of transaction'
          },
          property_type: {
            type: 'string' as const,
            description: 'Type of property (e.g., Detached, Semi-Detached, Terraced, Flat)'
          },
          furnished_type: {
            type: 'string' as const,
            description: 'Furnishing status (e.g., Furnished, Unfurnished, Part Furnished)'
          },
          has_nearby_station: {
            type: 'boolean' as const,
            description: 'Filter properties with nearby train/tube stations'
          },
          location: {
            type: 'string' as const,
            description: 'General location search - street name, area, district, or landmark. Uses intelligent multi-strategy matching: (1) Searches full addresses for exact/fuzzy/phonetic matches, (2) Uses Google Places API to understand area boundaries (e.g., central Edinburgh, Spinningfields), (3) Returns properties within the specified area bounds. Examples: Baker Street, Spinningfields, central Edinburgh, Kensington, left bank. If no match found, returns top 10-15 most similar locations as refinements.'
          },
          include_all: {
            type: 'boolean' as const,
            description: 'If true, returns ALL matching properties instead of just the first 3. Use this when the user explicitly wants to see all results (e.g., show me all properties, I want to see everything). Default is false.'
          }
        }
      }
    }
  }
}

/**
 * Attaches a tool to an ElevenLabs agent and creates a DB record
 */
export async function attachToolToAgent(
  agentId: string,
  toolData: ReturnType<typeof createEstateAgentToolData>,
  toolType: 'query' | 'apiRequest' = 'query'
): Promise<{ elevenLabsToolId: string; dbToolId: string }> {
  const supabase = createNoCookieClient()

  // Get the agent to access the external agent ID and organization
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('external_agent_id, organization_id, provider')
    .eq('id', agentId)
    .single()

  if (agentError || !agent) {
    throw new Error('Failed to fetch agent data')
  }

  if (agent.provider !== 'elevenlabs') {
    throw new Error('Agent is not an ElevenLabs agent')
  }

  // Create the tool in ElevenLabs
  const tool = await client.conversationalAi.tools.create({
    toolConfig: toolData
  })

  try {
    // Get the current agent to retrieve its tool_ids
    const elevenLabsAgent = await client.conversationalAi.agents.get(agent.external_agent_id)
    const currentToolIds = elevenLabsAgent.conversationConfig?.agent?.prompt?.toolIds || []

    // Add the new tool ID to the agent
    const updatedToolIds = [...currentToolIds, tool.id]

    // Update the agent with the new tool
    await client.conversationalAi.agents.update(agent.external_agent_id, {
      conversationConfig: {
        ...elevenLabsAgent.conversationConfig,
        agent: {
          ...elevenLabsAgent.conversationConfig?.agent,
          prompt: {
            ...(elevenLabsAgent.conversationConfig?.agent as any)?.prompt,
            toolIds: updatedToolIds
          }
        }
      }
    })

    // Create the tool record in the database with a formatted label
    // For query tools, extract the knowledge base name and format it nicely
    let toolLabel = toolData.name
    if (toolData.name.startsWith('query_')) {
      const kbName = toolData.name.replace('query_', '')
      toolLabel = `${formatLabelForDisplay(kbName)} Query`
    } else {
      toolLabel = formatLabelForDisplay(toolData.name)
    }
    
    const dbTool = await createTool(
      agent.organization_id,
      tool.id,
      toolType,
      toolData.name,
      tool,
      toolLabel,
      'elevenlabs'
    )

    // Insert into agent_tools table to track the relationship
    const { error: insertError } = await supabase
      .from('agent_tools')
      .insert({
        agent_id: agentId,
        tool_id: dbTool.id,
        is_vapi_attached: false, // ElevenLabs tools aren't "vapi attached"
      })

    if (insertError) {
      console.error('Error inserting into agent_tools:', insertError)
      throw new Error('Failed to track tool attachment in database')
    }

    return {
      elevenLabsToolId: tool.id,
      dbToolId: dbTool.id
    }
  } catch (error) {
    // If anything fails after ElevenLabs tool creation, try to clean up the tool
    try {
      await client.conversationalAi.tools.delete(tool.id)
    } catch (cleanupError) {
      console.error('Error cleaning up ElevenLabs tool after failed attachment:', cleanupError)
    }
    throw error
  }
}

/**
 * Removes a tool from an ElevenLabs agent and deletes it from both ElevenLabs and DB
 */
export async function removeToolFromAgent(
  agentId: string,
  toolId: string
): Promise<void> {
  const supabase = createNoCookieClient()

  // Get the agent to access the external agent ID
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('external_agent_id, provider')
    .eq('id', agentId)
    .single()

  if (agentError || !agent) {
    throw new Error('Failed to fetch agent data')
  }

  if (agent.provider !== 'elevenlabs') {
    throw new Error('Agent is not an ElevenLabs agent')
  }

  // Remove the tool from the agent
  try {
    await removeToolFromElevenLabsAgent(agent.external_agent_id, toolId)
    console.log(`Removed tool ${toolId} from agent ${agent.external_agent_id}`)
  } catch (error: any) {
    console.error(`Error removing tool from agent:`, error)
    throw new Error(`Failed to remove tool from agent: ${error.message}`)
  }

  // Wait for ElevenLabs to propagate the change (they have eventual consistency)
  console.log('Waiting for ElevenLabs to propagate tool removal...')
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Verify the tool was actually removed by checking the agent
  const verifyAgent = await client.conversationalAi.agents.get(agent.external_agent_id)
  const verifyToolIds = (verifyAgent.conversationConfig?.agent as any)?.prompt?.toolIds || []
  
  if (verifyToolIds.includes(toolId)) {
    console.error(`Tool ${toolId} still present in agent after removal attempt`)
    throw new Error(`Tool is still attached to agent after removal. Please try again.`)
  }

  console.log(`Verified: tool ${toolId} is no longer in agent's toolIds`)

  // Now try to delete the tool from ElevenLabs (with retries for eventual consistency)
  let deleted = false
  let attempts = 0
  const maxAttempts = 3

  while (!deleted && attempts < maxAttempts) {
    attempts++
    try {
      console.log(`Attempting to delete tool (attempt ${attempts}/${maxAttempts})...`)
      await client.conversationalAi.tools.delete(toolId)
      deleted = true
      console.log(`Successfully deleted tool ${toolId} from ElevenLabs`)
    } catch (error: any) {
      if (error?.statusCode === 404) {
        // Tool already deleted - that's fine
        console.log(`Tool ${toolId} already deleted from ElevenLabs (404)`)
        deleted = true
      } else if (error?.statusCode === 400 && error?.body?.detail?.status === 'tool_in_use') {
        if (attempts < maxAttempts) {
          console.log(`Tool still in use (attempt ${attempts}), waiting 3 seconds before retry...`)
          await new Promise(resolve => setTimeout(resolve, 3000))
        } else {
          console.error(`Failed to delete tool after ${maxAttempts} attempts - tool still in use`)
          throw new Error(`Tool could not be deleted from ElevenLabs after ${maxAttempts} attempts. The tool may still be cached in their system. Please try again in a few moments.`)
        }
      } else {
        console.error('Error deleting tool from ElevenLabs:', error)
        throw new Error(`Failed to delete tool from ElevenLabs: ${error.message}`)
      }
    }
  }

  // Only delete from database if provider deletion succeeded
  if (deleted) {
    try {
      await deleteToolByExternalId(toolId)
      console.log(`Successfully deleted tool ${toolId} from database`)
    } catch (error) {
      console.error('Error deleting tool from database:', error)
      // This is less critical - log but don't throw
    }
  } else {
    throw new Error('Tool deletion from ElevenLabs failed, database record preserved')
  }
}

