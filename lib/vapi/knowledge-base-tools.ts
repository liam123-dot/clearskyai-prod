import { vapiClient } from "./VapiClients"
import { createServiceClient } from "../supabase/server"
import { CreateApiRequestToolDto } from "./ToolTypes"
import { createTool, deleteToolByExternalId, ToolType } from "../tools"
import { formatLabelForDisplay } from "../utils"

/**
 * Creates an API Request tool for querying estate agent properties
 */
export function createEstateAgentToolData(
  knowledgeBaseId: string,
  knowledgeBaseName: string
): CreateApiRequestToolDto {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'
  
  // Sanitize name for both function name and tool name (must match /^[a-zA-Z0-9_-]{1,40}$/)
  const sanitizedName = knowledgeBaseName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .substring(0, 30) // Leave room for prefixes/suffixes
  
  return {
    type: "apiRequest",
    function: {
      name: `query_${sanitizedName}_props`,
      description: `Search and filter properties from ${knowledgeBaseName}. Returns up to 3 matching properties by default (or all properties if include_all is true) in plain text format with essential details (baths, price, property type, title, address, etc.) along with the total count of matching properties.`,
      parameters: {
        type: "object",
        properties: {
          beds: {
            type: "number",
            description: "Number of bedrooms"
          },
          baths: {
            type: "number",
            description: "Number of bathrooms"
          },
          price: {
            type: "object",
            description: "Price filter",
            properties: {
              filter: {
                type: "string",
                enum: ["under", "over", "between"],
                description: "Type of price filter"
              },
              value: {
                type: "number",
                description: "Price value"
              },
              max_value: {
                type: "number",
                description: "Maximum price value (only for 'between' filter)"
              }
            },
            required: ["filter", "value"]
          },
          transaction_type: {
            type: "string",
            enum: ["rent", "sale"],
            description: "Type of transaction"
          },
          property_type: {
            type: "string",
            description: "Type of property (e.g., 'Detached', 'Semi-Detached', 'Terraced', 'Flat')"
          },
          furnished_type: {
            type: "string",
            description: "Furnishing status (e.g., 'Furnished', 'Unfurnished', 'Part Furnished')"
          },
          has_nearby_station: {
            type: "boolean",
            description: "Filter properties with nearby train/tube stations"
          },
          location: {
            type: "string",
            description: "General location search (e.g., 'London', 'Manchester', 'SW1A 1AA', 'Kensington'). Uses Google Maps geocoding to find properties within a radius of this location. Results are sorted by distance from the location center (nearest first)."
          },
          location_radius_km: {
            type: "number",
            description: "Search radius in kilometers around the location. Defaults to 25km if not specified. Use smaller values (5-10km) for more precise searches, larger values (25-50km) for broader area searches."
          },
          include_all: {
            type: "boolean",
            description: "If true, returns ALL matching properties instead of just the first 3. Use this when the user explicitly wants to see all results (e.g., 'show me all properties', 'I want to see everything'). Default is false."
          }
        },
        required: []
      }
    },
    messages: [], // No messages for property queries
    name: `query_${sanitizedName}`,
    url: `${baseUrl}/api/query/estate-agent/${knowledgeBaseId}`,
    method: "POST",
    body: {
      type: "object",
      required: [],
      properties: {
        beds: {
          type: "number",
          description: "Number of bedrooms"
        },
        baths: {
          type: "number",
          description: "Number of bathrooms"
        },
        price: {
          type: "object",
          description: "Price filter object",
          properties: {
            filter: {
              type: "string",
              enum: ["under", "over", "between"],
              description: "Type of price filter"
            },
            value: {
              type: "number",
              description: "Price value"
            },
            max_value: {
              type: "number",
              description: "Maximum price value (only for 'between' filter)"
            }
          },
          required: ["filter", "value"]
        } as any, // Type assertion needed because TypeScript type doesn't support nested properties
        transaction_type: {
          type: "string",
          enum: ["rent", "sale"]
        },
        property_type: {
          type: "string"
        },
        furnished_type: {
          type: "string"
        },
        has_nearby_station: {
          type: "boolean"
        },
        location: {
          type: "string",
          description: "General location search (e.g., 'London', 'Manchester')"
        },
        location_radius_km: {
          type: "number",
          description: "Search radius in kilometers (default: 25km)"
        },
        include_all: {
          type: "boolean",
          description: "If true, returns all matching properties instead of just the first 3"
        }
      }
    }
  }
}

/**
 * Attaches a tool to an agent's VAPI assistant and creates a DB record
 */
export async function attachToolToAgent(
  agentId: string,
  toolData: CreateApiRequestToolDto,
  toolType: ToolType = 'apiRequest'
): Promise<{ vapiToolId: string; dbToolId: string }> {
  const supabase = await createServiceClient()

  // Get the agent to access the assistant and organization
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('vapi_assistant_id, organization_id')
    .eq('id', agentId)
    .single()

  if (agentError || !agent) {
    throw new Error('Failed to fetch agent data')
  }

  // Create the tool in VAPI
  const tool = await vapiClient.tools.create(toolData as any)

  try {
    // Get the current assistant to update its toolIds
    const assistant = await vapiClient.assistants.get(agent.vapi_assistant_id)
    const currentToolIds = assistant.model?.toolIds || []

    // Add the new tool ID to the assistant
    const updatedToolIds = [...currentToolIds, tool.id]

    // Update the assistant with the new tool
    await vapiClient.assistants.update(agent.vapi_assistant_id, {
      model: {
        ...assistant.model,
        toolIds: updatedToolIds
      } as any
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
      toolLabel
    )

    // Insert into agent_tools table to track the relationship
    const { error: insertError } = await supabase
      .from('agent_tools')
      .insert({
        agent_id: agentId,
        tool_id: dbTool.id,
        is_vapi_attached: true,
      })

    if (insertError) {
      console.error('Error inserting into agent_tools:', insertError)
      throw new Error('Failed to track tool attachment in database')
    }

    return {
      vapiToolId: tool.id,
      dbToolId: dbTool.id
    }
  } catch (error) {
    // If anything fails after VAPI tool creation, try to clean up the VAPI tool
    try {
      await vapiClient.tools.delete(tool.id)
    } catch (cleanupError) {
      console.error('Error cleaning up VAPI tool after failed attachment:', cleanupError)
    }
    throw error
  }
}

/**
 * Removes a tool from an agent's VAPI assistant and deletes it from both VAPI and DB
 */
export async function removeToolFromAgent(
  agentId: string,
  toolId: string
): Promise<void> {
  const supabase = await createServiceClient()

  // Get the agent to access the assistant
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('vapi_assistant_id')
    .eq('id', agentId)
    .single()

  if (agentError || !agent) {
    throw new Error('Failed to fetch agent data')
  }

  // Get the current assistant to update its toolIds
  const assistant = await vapiClient.assistants.get(agent.vapi_assistant_id)
  const currentToolIds = assistant.model?.toolIds || []

  // Remove the tool ID from the assistant
  const updatedToolIds = currentToolIds.filter(id => id !== toolId)

  // Update the assistant without the tool
  await vapiClient.assistants.update(agent.vapi_assistant_id, {
    model: {
      ...assistant.model,
      toolIds: updatedToolIds
    } as any
  })

  // Delete the tool from VAPI
  try {
    await vapiClient.tools.delete(toolId)
  } catch (error) {
    console.error('Error deleting tool from VAPI:', error)
    // Don't throw - tool might already be deleted
  }

  // Delete the tool from the database
  try {
    await deleteToolByExternalId(toolId)
  } catch (error) {
    console.error('Error deleting tool from database:', error)
    // Don't throw - tool might not exist in DB
  }
}

