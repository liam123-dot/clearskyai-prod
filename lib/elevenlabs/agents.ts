import { createServiceClient } from "../supabase/server";
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
    
const client = new ElevenLabsClient({
    apiKey: process.env.ELEVEN_API_KEY,
})

export async function createAgent(name: string, organization_id: string): Promise<{ agent: { id: string; external_agent_id: string; organization_id: string } }> {

    const supabase = await createServiceClient()


    const elevenlabsAgent = await client.conversationalAi.agents.create({
        conversationConfig: {
            asr: {
                provider: 'scribe_realtime'
            },
            tts: {
                modelId: 'eleven_multilingual_v2',
                voiceId: '2KeyfL6P3j1maB1yEare',
            },
            agent: {
                prompt: {
                    llm: 'gpt-4.1-mini'
                }
            }
        },
        name,

    })

    const { data: agent, error } = await supabase
    .from('agents')
    .insert({
        organization_id,
        provider: 'elevenlabs',
        external_agent_id: elevenlabsAgent.agentId,
    })
    .select()
    .single()

    if (error) {
        throw new Error(`Failed to create agent: ${error.message}`)
    }

    return { agent }
}

/**
 * Gets an ElevenLabs agent by external agent ID (from ElevenLabs API)
 * @param externalAgentId - The ElevenLabs agent ID
 */
export async function getElevenLabsAgentById(externalAgentId: string) {
    const agent = await client.conversationalAi.agents.get(externalAgentId)
    return agent
}

/**
 * Updates an ElevenLabs agent's name by external agent ID
 * @param externalAgentId - The ElevenLabs agent ID
 * @param name - The new name for the agent
 */
export async function updateElevenLabsAgentName(externalAgentId: string, name: string): Promise<void> {
    await client.conversationalAi.agents.update(externalAgentId, {
        name: name.trim(),
    })
}

export interface ElevenLabsAgentUpdateFields {
    firstMessage?: string
    prompt?: string
    voiceId?: string
}

/**
 * Updates an ElevenLabs agent with the provided fields
 * @param externalAgentId - The ElevenLabs agent ID to update
 * @param updates - Partial object containing fields to update
 */
export async function updateElevenLabsAgent(
    externalAgentId: string,
    updates: Partial<ElevenLabsAgentUpdateFields>
): Promise<void> {
    // Build minimal update object with only the fields being updated
    const conversationConfigUpdates: any = {}
    let hasUpdates = false

    // Update firstMessage if provided
    if (updates.firstMessage !== undefined) {
        conversationConfigUpdates.agent = conversationConfigUpdates.agent || {}
        conversationConfigUpdates.agent.firstMessage = updates.firstMessage
        hasUpdates = true
    }

    // Update prompt if provided
    if (updates.prompt !== undefined) {
        conversationConfigUpdates.agent = conversationConfigUpdates.agent || {}
        conversationConfigUpdates.agent.prompt = conversationConfigUpdates.agent.prompt || {}
        conversationConfigUpdates.agent.prompt.prompt = updates.prompt
        hasUpdates = true
    }

    // Update voiceId if provided
    if (updates.voiceId !== undefined) {
        conversationConfigUpdates.tts = conversationConfigUpdates.tts || {}
        conversationConfigUpdates.tts.voiceId = updates.voiceId
        hasUpdates = true
    }

    // Only update if we have changes
    // Send only the fields we're updating, not the entire conversationConfig
    if (hasUpdates) {
        await client.conversationalAi.agents.update(externalAgentId, {
            conversationConfig: conversationConfigUpdates
        })
    }
}