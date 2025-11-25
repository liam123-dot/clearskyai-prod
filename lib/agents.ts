import { createServiceClient } from "./supabase/server"
import { getVapiAgentById, updateVapiAgentName, updateAgentAssistant, AgentUpdateFields, AgentOrganization } from "./vapi/agents"
import { getElevenLabsAgentById, updateElevenLabsAgentName, updateElevenLabsAgent } from "./elevenlabs/agents"
import { Vapi } from "@vapi-ai/server-sdk"

// Generic agent model that works across providers
export interface UnifiedAgent {
    id: string                      // database ID
    externalAgentId: string         // provider's agent ID
    provider: 'vapi' | 'elevenlabs'
    name: string
    firstMessage?: string
    systemPrompt?: string
    voiceId?: string
    organization: AgentOrganization | null
    createdAt: string | null
    updatedAt: string | null
    isAssigned: boolean
    // Provider-specific raw data for advanced use cases
    rawVapiData?: Vapi.Assistant
    rawElevenLabsData?: any
    // Optional fields for idle messages (Vapi specific)
    idleMessages?: string[]
    idleTimeoutSeconds?: number
}

export async function getAgentById(agentId: string): Promise<UnifiedAgent | null> {
    console.log('agentId', agentId)
    const supabase = await createServiceClient()
    const { data: dbAgent, error } = await supabase
        .from('agents')
        .select(`
            id,
            external_agent_id,
            provider,
            created_at,
            updated_at,
            organization:organisations!organization_id (
                id,
                slug,
                external_id,
                permissions
            )
        `)
        .eq('id', agentId)
        .single<{
            id: string;
            external_agent_id: string;
            provider: string;
            created_at: string;
            updated_at: string;
            organization: AgentOrganization | null;
        }>();

    console.log('dbAgent', dbAgent)

    if (error || !dbAgent) {
        return null;
    }

    if (dbAgent.provider === 'vapi') {
        const vapiAgent = await getVapiAgentById(dbAgent.external_agent_id)
        if (!vapiAgent) return null
        return transformVapiToUnified(dbAgent, vapiAgent)
    } else if (dbAgent.provider === 'elevenlabs') {
        const elevenLabsAgent = await getElevenLabsAgentById(dbAgent.external_agent_id)
        if (!elevenLabsAgent) return null
        return transformElevenLabsToUnified(dbAgent, elevenLabsAgent)
    } else {
        return null
    }
}

export async function getAgentsByOrganization(organizationId: string): Promise<UnifiedAgent[]> {
    const supabase = await createServiceClient()
    
    // Load agents from database filtered by organization_id
    const { data: dbAgents, error } = await supabase
        .from('agents')
        .select(`
            id,
            external_agent_id,
            provider,
            created_at,
            updated_at,
            organization:organisations!organization_id (
                id,
                slug,
                external_id,
                permissions
            )
        `)
        .eq('organization_id', organizationId)
        .returns<Array<{
            id: string;
            external_agent_id: string;
            provider: string;
            created_at: string;
            updated_at: string;
            organization: AgentOrganization | null;
        }>>();

    if (error) {
        throw new Error(`Failed to load agents: ${error.message}`);
    }

    if (!dbAgents || dbAgents.length === 0) {
        return [];
    }

    // Load full agent details for each agent
    const agentPromises = dbAgents.map(async (dbAgent): Promise<UnifiedAgent | null> => {
        try {
            // Skip if organization is null (shouldn't happen with the filter, but type safety)
            if (!dbAgent.organization) {
                return null;
            }

            if (dbAgent.provider === 'vapi') {
                console.log('Loading Vapi agent:', dbAgent.external_agent_id)
                const vapiAgent = await getVapiAgentById(dbAgent.external_agent_id)
                if (!vapiAgent) return null
                return transformVapiToUnified(dbAgent, vapiAgent)
            } else if (dbAgent.provider === 'elevenlabs') {
                const elevenLabsAgent = await getElevenLabsAgentById(dbAgent.external_agent_id)
                if (!elevenLabsAgent) return null
                return transformElevenLabsToUnified(dbAgent, elevenLabsAgent)
            } else {
                return null
            }
        } catch (error) {
            console.error(`Failed to load agent ${dbAgent.id} (${dbAgent.provider}):`, error);
            // Skip agents that fail to fetch
            return null;
        }
    });

    const results = await Promise.all(agentPromises);
    const agents = results.filter((agent): agent is UnifiedAgent => agent !== null);

    console.log('Unified agents loaded:', agents);

    return agents;
}

/**
 * Gets all agents from all providers (Vapi and ElevenLabs)
 * Returns agents with their organization assignments
 * Shows which agents are assigned and which are unassigned
 */
export async function getAgents(): Promise<UnifiedAgent[]> {
    const supabase = await createServiceClient()
    
    // Load all agents from database with organization details
    const { data: dbAgents, error } = await supabase
        .from('agents')
        .select(`
            id,
            external_agent_id,
            provider,
            created_at,
            updated_at,
            organization:organisations!organization_id (
                id,
                slug,
                external_id,
                permissions
            )
        `)
        .returns<Array<{
            id: string;
            external_agent_id: string;
            provider: string;
            created_at: string;
            updated_at: string;
            organization: AgentOrganization | null;
        }>>();

    if (error) {
        throw new Error(`Failed to load agents: ${error.message}`);
    }

    if (!dbAgents || dbAgents.length === 0) {
        return [];
    }

    // Load full agent details for each agent
    const agentPromises = dbAgents.map(async (dbAgent): Promise<UnifiedAgent | null> => {
        try {
            if (dbAgent.provider === 'vapi') {
                const vapiAgent = await getVapiAgentById(dbAgent.external_agent_id)
                if (!vapiAgent) return null
                return transformVapiToUnified(dbAgent, vapiAgent)
            } else if (dbAgent.provider === 'elevenlabs') {
                const elevenLabsAgent = await getElevenLabsAgentById(dbAgent.external_agent_id)
                if (!elevenLabsAgent) return null
                return transformElevenLabsToUnified(dbAgent, elevenLabsAgent)
            } else {
                return null
            }
        } catch (error) {
            console.error(`Failed to load agent ${dbAgent.id} (${dbAgent.provider}):`, error);
            // Skip agents that fail to fetch
            return null;
        }
    });

    const results = await Promise.all(agentPromises);
    const agents = results.filter((agent): agent is UnifiedAgent => agent !== null);

    console.log('All unified agents loaded:', agents);

    return agents;
}

// Transform Vapi agent to unified model
function transformVapiToUnified(
    dbAgent: { id: string; external_agent_id: string; created_at: string; updated_at: string; organization: AgentOrganization | null },
    vapiAssistant: Awaited<ReturnType<typeof getVapiAgentById>>
): UnifiedAgent {
    if (!vapiAssistant) throw new Error('Invalid Vapi agent data')
    
    const firstMessage = (vapiAssistant.firstMessage as string) || ''
    const prompt = vapiAssistant.model?.messages?.find(
        (msg: any) => msg.role === 'system'
    )?.content || ''
    const voiceId = (vapiAssistant.voice as any)?.voiceId || ''
    
    // Extract messagePlan for idle messages
    const messagePlan = (vapiAssistant as any).messagePlan as {
        idleMessages?: string[]
        idleTimeoutSeconds?: number
    } | undefined

    return {
        id: dbAgent.id,
        externalAgentId: dbAgent.external_agent_id,
        provider: 'vapi',
        name: vapiAssistant.name || 'Unnamed Agent',
        firstMessage,
        systemPrompt: prompt,
        voiceId,
        organization: dbAgent.organization,
        createdAt: dbAgent.created_at,
        updatedAt: dbAgent.updated_at,
        isAssigned: true, // If we found it in DB with organization, it's assigned
        rawVapiData: vapiAssistant,
        idleMessages: messagePlan?.idleMessages || [],
        idleTimeoutSeconds: messagePlan?.idleTimeoutSeconds ?? 7.5
    }
}

// Transform ElevenLabs agent to unified model
function transformElevenLabsToUnified(
    dbAgent: { id: string; external_agent_id: string; created_at: string; updated_at: string; organization: AgentOrganization | null },
    elevenLabsAgent: any
): UnifiedAgent {
    // Extract data from ElevenLabs response structure
    const conversationConfig = elevenLabsAgent.conversation_config || elevenLabsAgent.conversationConfig
    const agentConfig = conversationConfig?.agent
    const ttsConfig = conversationConfig?.tts
    
    const systemPrompt = agentConfig?.prompt?.prompt || ''
    const firstMessage = agentConfig?.firstMessage || ''
    const voiceId = ttsConfig?.voiceId || ttsConfig?.voice_id || ''
    
    return {
        id: dbAgent.id,
        externalAgentId: dbAgent.external_agent_id,
        provider: 'elevenlabs',
        name: elevenLabsAgent.name || 'Unnamed Agent',
        firstMessage,
        systemPrompt,
        voiceId,
        organization: dbAgent.organization,
        createdAt: dbAgent.created_at,
        updatedAt: dbAgent.updated_at,
        isAssigned: true, // If we found it in DB, it's assigned
        rawElevenLabsData: elevenLabsAgent
    }
}

/**
 * Updates an agent's name by database ID
 * Works with both Vapi and ElevenLabs providers
 * @param agentId - The database agent ID
 * @param name - The new name for the agent
 */
export async function updateAgentName(agentId: string, name: string): Promise<void> {
    const supabase = await createServiceClient()
    
    // Fetch the agent from database to get external_agent_id and provider
    const { data: dbAgent, error } = await supabase
        .from('agents')
        .select('external_agent_id, provider')
        .eq('id', agentId)
        .single<{ external_agent_id: string; provider: string }>();

    if (error || !dbAgent) {
        throw new Error(`Failed to find agent with ID ${agentId}: ${error?.message || 'Agent not found'}`);
    }

    // Update name based on provider using provider-specific functions
    if (dbAgent.provider === 'vapi') {
        await updateVapiAgentName(dbAgent.external_agent_id, name)
    } else if (dbAgent.provider === 'elevenlabs') {
        await updateElevenLabsAgentName(dbAgent.external_agent_id, name)
    } else {
        throw new Error(`Unknown provider: ${dbAgent.provider}`)
    }
}

/**
 * Updates an agent by database ID
 * Works with both Vapi and ElevenLabs providers
 * Routes to appropriate provider-specific update function
 * @param agentId - The database agent ID
 * @param updates - Partial object containing fields to update
 */
export async function updateAgent(
    agentId: string,
    updates: Partial<AgentUpdateFields>
): Promise<void> {
    const supabase = await createServiceClient()
    
    // Fetch the agent from database to get external_agent_id and provider
    const { data: dbAgent, error } = await supabase
        .from('agents')
        .select('external_agent_id, provider')
        .eq('id', agentId)
        .single<{ external_agent_id: string; provider: string }>();

    if (error || !dbAgent) {
        throw new Error(`Failed to find agent with ID ${agentId}: ${error?.message || 'Agent not found'}`);
    }

    // Route to appropriate provider-specific update function
    if (dbAgent.provider === 'vapi') {
        // Vapi supports all fields
        await updateAgentAssistant(dbAgent.external_agent_id, updates)
    } else if (dbAgent.provider === 'elevenlabs') {
        // ElevenLabs only supports a subset of fields
        const elevenLabsUpdates: {
            firstMessage?: string
            prompt?: string
            voiceId?: string
        } = {}
        
        if (updates.firstMessage !== undefined) {
            elevenLabsUpdates.firstMessage = updates.firstMessage
        }
        if (updates.prompt !== undefined) {
            elevenLabsUpdates.prompt = updates.prompt
        }
        if (updates.voiceId !== undefined) {
            elevenLabsUpdates.voiceId = updates.voiceId
        }
        
        // Warn about unsupported fields
        const unsupportedFields = [
            updates.transcriber !== undefined && 'transcriber',
            updates.serverMessages !== undefined && 'serverMessages',
            updates.startSpeakingPlan !== undefined && 'startSpeakingPlan',
            updates.stopSpeakingPlan !== undefined && 'stopSpeakingPlan',
            updates.analysisPlan !== undefined && 'analysisPlan',
            updates.messagePlan !== undefined && 'messagePlan',
        ].filter(Boolean) as string[]
        
        if (unsupportedFields.length > 0) {
            console.warn(`ElevenLabs does not support the following fields: ${unsupportedFields.join(', ')}. These will be ignored.`)
        }
        
        await updateElevenLabsAgent(dbAgent.external_agent_id, elevenLabsUpdates)
    } else {
        throw new Error(`Unknown provider: ${dbAgent.provider}`)
    }
}

/**
 * Assigns or unassigns an agent to/from an organization
 * Works with both Vapi and ElevenLabs providers
 * @param externalAgentId - The external agent ID (from provider)
 * @param organizationId - The organization ID to assign to, or null to unassign
 * @returns Object with success status, assigned boolean, and agent data if assigned
 */
export async function assignAgentToOrganization(
    externalAgentId: string,
    organizationId: string | null
): Promise<{ success: boolean; assigned: boolean; agent?: { id: string; external_agent_id: string; organization_id: string } }> {
    const supabase = await createServiceClient();

    // First, check if agent exists in database to determine provider
    const { data: existingAgent } = await supabase
        .from('agents')
        .select('provider')
        .eq('external_agent_id', externalAgentId)
        .single();

    // Determine provider - if not in DB, try to infer from external ID or default to vapi
    // For now, we'll require the agent to exist in DB first (created via createAgent)
    // This ensures provider is always known
    if (!existingAgent) {
        throw new Error(`Agent with external ID ${externalAgentId} not found in database. Please create the agent first.`);
    }

    // If organization_id is null, delete the agent assignment
    if (!organizationId) {
        const { error } = await supabase
            .from('agents')
            .delete()
            .eq('external_agent_id', externalAgentId);

        if (error) {
            console.error('Error unassigning agent:', error);
            throw new Error('Failed to unassign agent');
        }

        return { success: true, assigned: false };
    }

    // Check if agent already exists
    const { data: existing } = await supabase
        .from('agents')
        .select('id, organization_id')
        .eq('external_agent_id', externalAgentId)
        .single();

    let agent;

    if (existing) {
        // Update existing agent
        const { data: updatedAgent, error } = await supabase
            .from('agents')
            .update({ organization_id: organizationId })
            .eq('external_agent_id', externalAgentId)
            .select()
            .single();

        if (error) {
            console.error('Error updating agent:', error);
            throw new Error('Failed to update agent');
        }

        agent = updatedAgent;
    } else {
        // Create new agent record
        const { data: newAgent, error } = await supabase
            .from('agents')
            .insert({ 
                external_agent_id: externalAgentId,
                provider: existingAgent.provider,
                organization_id: organizationId 
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating agent:', error);
            throw new Error('Failed to create agent');
        }

        agent = newAgent;
    }

    // Update webhook configuration for Vapi agents
    if (existingAgent.provider === 'vapi') {
        const { updateAgentWebhookWithVapiAssistantId } = await import('./vapi/agents')
        await updateAgentWebhookWithVapiAssistantId(externalAgentId);
    }
    // ElevenLabs doesn't require webhook configuration

    return {
        success: true,
        assigned: true,
        agent: {
            id: agent.id,
            external_agent_id: agent.external_agent_id,
            organization_id: agent.organization_id,
        },
    };
}
