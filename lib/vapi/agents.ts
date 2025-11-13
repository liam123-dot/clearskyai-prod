import { vapiClient } from "./VapiClients";
import { createServiceClient } from "../supabase/server";
import { createNoCookieClient } from "../supabase/serverNoCookies";
import { Vapi } from "@vapi-ai/server-sdk";

export interface AgentOrganization {
    id: string;
    slug: string;
    external_id: string;
    permissions?: Record<string, unknown>;
}

export interface AgentWithDetails {
    id: string | null;
    vapi_assistant_id: string;
    created_at: string | null;
    updated_at: string | null;
    organization: AgentOrganization | null;
    isAssigned: boolean;
    vapiAssistant: Vapi.Assistant;
}

export interface AssignedAgent {
    id: string;
    vapi_assistant_id: string;
    created_at: string;
    updated_at: string;
    organization: AgentOrganization;
    isAssigned: true;
    vapiAssistant: Vapi.Assistant;
}

export interface AgentUpdateFields {
    firstMessage?: string;
    prompt?: string;
    voiceId?: string;
    transcriber?: any;
    serverMessages?: string[];
    startSpeakingPlan?: any;
    stopSpeakingPlan?: any;
    analysisPlan?: any;
    messagePlan?: any;
}

export async function getAgents(): Promise<AgentWithDetails[]> {
    const supabase = await createServiceClient();
    
    // Load all VAPI assistants
    const vapiAssistants = await vapiClient.assistants.list();
    
    // Load agents from database with organization details
    const { data: dbAgents, error } = await supabase
        .from('agents')
        .select(`
            id,
            vapi_assistant_id,
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
            vapi_assistant_id: string;
            created_at: string;
            updated_at: string;
            organization: AgentOrganization | null;
        }>>();

    if (error) {
        throw new Error(`Failed to load agents: ${error.message}`);
    }

    // Create a map of vapi_assistant_id to database agent record
    const dbAgentMap = new Map(
        (dbAgents || []).map(agent => [agent.vapi_assistant_id, agent])
    );

    // Map all VAPI assistants and include organization info if assigned
    const agentsWithDetails: AgentWithDetails[] = vapiAssistants.map((vapiAssistant) => {
        const dbAgent = dbAgentMap.get(vapiAssistant.id);
        
        return {
            id: dbAgent?.id || null,
            vapi_assistant_id: vapiAssistant.id,
            created_at: dbAgent?.created_at || null,
            updated_at: dbAgent?.updated_at || null,
            organization: dbAgent?.organization || null,
            isAssigned: !!dbAgent,
            vapiAssistant
        };
    });

    console.log(agentsWithDetails);

    return agentsWithDetails;
}

export async function getAgentsByOrganization(organizationId: string): Promise<AssignedAgent[]> {
    const supabase = await createServiceClient();
    
    // Load agents from database filtered by organization_id
    const { data: dbAgents, error } = await supabase
        .from('agents')
        .select(`
            id,
            vapi_assistant_id,
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
            vapi_assistant_id: string;
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

    // Load VAPI assistant details for each agent
    const agentPromises = dbAgents.map(async (dbAgent): Promise<AssignedAgent | null> => {
        try {
            // Skip if organization is null (shouldn't happen with the filter, but type safety)
            if (!dbAgent.organization) {
                return null;
            }

            const vapiAssistant: Vapi.Assistant = await vapiClient.assistants.get(dbAgent.vapi_assistant_id);
            
            return {
                id: dbAgent.id,
                vapi_assistant_id: dbAgent.vapi_assistant_id,
                created_at: dbAgent.created_at,
                updated_at: dbAgent.updated_at,
                organization: dbAgent.organization,
                isAssigned: true as const,
                vapiAssistant
            };
        } catch (error) {
            console.error(`Failed to load VAPI assistant ${dbAgent.vapi_assistant_id}:`, error);
            // If VAPI assistant is not found or error, skip this agent
            return null;
        }
    });

    const results = await Promise.all(agentPromises);
    const agentsWithDetails = results.filter((agent): agent is AssignedAgent => agent !== null);

    return agentsWithDetails;
}

export async function getAgentById(agentId: string): Promise<AgentWithDetails | null> {
    const supabase = await createServiceClient();
    
    const { data: dbAgent, error } = await supabase
        .from('agents')
        .select(`
            id,
            vapi_assistant_id,
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
            vapi_assistant_id: string;
            created_at: string;
            updated_at: string;
            organization: AgentOrganization | null;
        }>();

    if (error || !dbAgent) {
        return null;
    }

    try {
        // Fetch the full Vapi assistant details
        const vapiAssistant: Vapi.Assistant = await vapiClient.assistants.get(dbAgent.vapi_assistant_id);
        
        return {
            id: dbAgent.id,
            vapi_assistant_id: dbAgent.vapi_assistant_id,
            created_at: dbAgent.created_at,
            updated_at: dbAgent.updated_at,
            organization: dbAgent.organization,
            isAssigned: true,
            vapiAssistant
        };
    } catch (error) {
        console.error(`Failed to load VAPI assistant ${dbAgent.vapi_assistant_id}:`, error);
        return null;
    }
}

/**
 * Ensures server messages array includes both 'chat.created' and 'end-of-call-report'
 * Merges with existing server messages if provided
 */
export function ensureRequiredServerMessages(existingServerMessages?: string[]): string[] {
    const requiredMessages = ['chat.created', 'end-of-call-report'];
    const existing = existingServerMessages || [];
    
    // Create a Set to track which messages we have
    const messageSet = new Set(existing);
    
    // Add required messages if they're not already present
    requiredMessages.forEach(msg => messageSet.add(msg));
    
    return Array.from(messageSet);
}

export async function updateAgentWebhookWithVapiAssistantId(vapiAssistantId: string): Promise<void> {
    if (!vapiAssistantId) {
        throw new Error('VAPI assistant ID is required');
    }

    // Fetch current assistant to get existing server messages
    const assistant = await vapiClient.assistants.get(vapiAssistantId);
    const existingServerMessages = (assistant.serverMessages as string[]) || [];
    
    // Ensure required server messages are included
    const serverMessages = ensureRequiredServerMessages(existingServerMessages);

    await vapiClient.assistants.update(vapiAssistantId, {
        server: {
            url: process.env.NEXT_PUBLIC_APP_URL + '/api/vapi/webhook',
        },
        serverMessages: serverMessages as any
    });
}

/**
 * Updates a VAPI assistant with the provided fields
 * @param vapiAssistantId - The VAPI assistant ID to update
 * @param updates - Partial object containing fields to update
 */
export async function updateAgentAssistant(
    vapiAssistantId: string,
    updates: Partial<AgentUpdateFields>
): Promise<void> {
    // Fetch current assistant from VAPI
    const assistant = await vapiClient.assistants.get(vapiAssistantId);

    // Prepare update object
    const updateData: any = {};

    // Update firstMessage if provided
    if (updates.firstMessage !== undefined) {
        updateData.firstMessage = updates.firstMessage;
    }

    // Update prompt if provided
    if (updates.prompt !== undefined) {
        updateData.model = {
            ...assistant.model,
            messages: [
                {
                    role: 'system',
                    content: updates.prompt,
                },
                ...(assistant.model?.messages?.filter((m: any) => m.role !== 'system') || []),
            ],
        };
    }

    // Update voiceId if provided
    if (updates.voiceId !== undefined) {
        updateData.voice = {
            ...(assistant.voice as any),
            voiceId: updates.voiceId,
            provider: '11labs',
            model: 'eleven_flash_v2_5',
        };
    }

    // Update transcriber if provided
    if (updates.transcriber !== undefined) {
        updateData.transcriber = {
            ...(assistant.transcriber as any),
            ...updates.transcriber,
        };
    }

    // Update serverMessages if provided
    // Always ensure chat.created and end-of-call-report are included
    if (updates.serverMessages !== undefined) {
        updateData.serverMessages = ensureRequiredServerMessages(updates.serverMessages);
    } else {
        // If serverMessages not provided, check if required ones are missing
        const existingServerMessages = (assistant.serverMessages as string[]) || [];
        const requiredMessages = ['chat.created', 'end-of-call-report'];
        const hasAllRequired = requiredMessages.every(msg => existingServerMessages.includes(msg));
        
        // Only update if required messages are missing
        if (!hasAllRequired) {
            updateData.serverMessages = ensureRequiredServerMessages(existingServerMessages);
        }
    }

    // Update startSpeakingPlan if provided
    if (updates.startSpeakingPlan !== undefined) {
        updateData.startSpeakingPlan = {
            ...(assistant.startSpeakingPlan as any),
            ...updates.startSpeakingPlan,
        };
    }

    // Update stopSpeakingPlan if provided
    if (updates.stopSpeakingPlan !== undefined) {
        updateData.stopSpeakingPlan = {
            ...(assistant.stopSpeakingPlan as any),
            ...updates.stopSpeakingPlan,
        };
    }

    // Update analysisPlan if provided
    if (updates.analysisPlan !== undefined) {
        updateData.analysisPlan = {
            ...(assistant.analysisPlan as any),
            ...updates.analysisPlan,
        };
    }

    // Update messagePlan if provided
    if (updates.messagePlan !== undefined) {
        updateData.messagePlan = {
            ...((assistant as any).messagePlan as any),
            ...updates.messagePlan,
        };
    }

    // Update the assistant (Vapi SDK merges partial updates)
    await vapiClient.assistants.update(vapiAssistantId, updateData);
}

/**
 * Updates an agent by database ID
 * Fetches the VAPI assistant ID from the database and calls updateAgentAssistant
 * @param agentId - The database agent ID
 * @param updates - Partial object containing fields to update
 */
export async function updateAgent(
    agentId: string,
    updates: Partial<AgentUpdateFields>
): Promise<void> {
    const supabase = createNoCookieClient();

    console.log('Updating agent...', agentId, updates)
    
    // Fetch the agent from database to get vapi_assistant_id
    const { data: dbAgent, error } = await supabase
        .from('agents')
        .select('vapi_assistant_id')
        .eq('id', agentId)
        .single<{ vapi_assistant_id: string }>();

    if (error || !dbAgent) {
        throw new Error(`Failed to find agent with ID ${agentId}: ${error?.message || 'Agent not found'}`);
    }

    console.log('Fetched VAPI assistant ID:', dbAgent.vapi_assistant_id)

    // Call updateAgentAssistant with the fetched vapi_assistant_id
    await updateAgentAssistant(dbAgent.vapi_assistant_id, updates);
}

/**
 * Assigns or unassigns an agent to/from an organization
 * @param vapi_assistant_id - The VAPI assistant ID
 * @param organization_id - The organization ID to assign to, or null to unassign
 * @returns Object with success status, assigned boolean, and agent data if assigned
 */
export async function assignAgentToOrganization(
    vapi_assistant_id: string,
    organization_id: string | null
): Promise<{ success: boolean; assigned: boolean; agent?: { id: string; vapi_assistant_id: string; organization_id: string } }> {
    const supabase = await createServiceClient();

    // If organization_id is null, delete the agent assignment
    if (!organization_id) {
        const { error } = await supabase
            .from('agents')
            .delete()
            .eq('vapi_assistant_id', vapi_assistant_id);

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
        .eq('vapi_assistant_id', vapi_assistant_id)
        .single();

    let agent;

    if (existing) {
        // Update existing agent
        const { data: updatedAgent, error } = await supabase
            .from('agents')
            .update({ organization_id })
            .eq('vapi_assistant_id', vapi_assistant_id)
            .select()
            .single();

        if (error) {
            console.error('Error updating agent:', error);
            throw new Error('Failed to update agent');
        }

        agent = updatedAgent;
    } else {
        // Create new agent
        const { data: newAgent, error } = await supabase
            .from('agents')
            .insert({ vapi_assistant_id, organization_id })
            .select()
            .single();

        if (error) {
            console.error('Error creating agent:', error);
            throw new Error('Failed to create agent');
        }

        agent = newAgent;
    }

    // Update webhook configuration
    await updateAgentWebhookWithVapiAssistantId(vapi_assistant_id);

    return {
        success: true,
        assigned: true,
        agent: {
            id: agent.id,
            vapi_assistant_id: agent.vapi_assistant_id,
            organization_id: agent.organization_id,
        },
    };
}

/**
 * Creates a new agent with default settings and assigns it to an organization
 * @param name - The name of the agent
 * @param organization_id - The organization ID to assign the agent to
 * @returns Object containing the assigned agent data
 * @throws Error if agent creation or assignment fails
 */
export async function createAgent(
    name: string,
    organization_id: string
): Promise<{ agent: { id: string; vapi_assistant_id: string; organization_id: string } }> {
    // Create VAPI assistant with default settings
    const vapiAssistant = await vapiClient.assistants.create({
        name: name.trim(),
        model: {
            provider: 'openai',
            model: 'gpt-4.1-mini',
            temperature: 0.7,
        },
        voice: {
            voiceId: '2KeyfL6P3j1maB1yEare',
            provider: '11labs',
            model: 'eleven_flash_v2_5',
        },
        transcriber: {
            model: 'flux-general-en',
            provider: 'deepgram',
            language: 'en',
            endpointing: 150,
            eotThreshold: 0.73,
            eotTimeoutMs: 1900,
        } as any,
        startSpeakingPlan: {
            waitSeconds: 0.1,
            smartEndpointingEnabled: false,
            transcriptionEndpointingPlan: {
                onPunctuationSeconds: 0.8,
                onNoPunctuationSeconds: 0,
                onNumberSeconds: 2,
            },
        },
        stopSpeakingPlan: {
            voiceSeconds: 0.1,
            numWords: 0,
            backoffSeconds: 0,
        },
        server: {
            url: process.env.NEXT_PUBLIC_APP_URL + '/api/vapi/webhook',
        },
        serverMessages: ['chat.created', 'end-of-call-report'],
    });

    if (!vapiAssistant.id) {
        throw new Error('Failed to create VAPI assistant');
    }

    // Assign agent to organization using shared function
    let assignmentResult;
    try {
        assignmentResult = await assignAgentToOrganization(vapiAssistant.id, organization_id);
    } catch (assignmentError) {
        // If assignment fails, try to clean up the VAPI assistant
        try {
            await vapiClient.assistants.delete(vapiAssistant.id);
        } catch (cleanupError) {
            console.error('Failed to cleanup VAPI assistant:', cleanupError);
        }

        throw new Error(
            assignmentError instanceof Error ? assignmentError.message : 'Failed to assign agent'
        );
    }

    if (!assignmentResult.success || !assignmentResult.assigned || !assignmentResult.agent) {
        // If assignment failed, try to clean up the VAPI assistant
        try {
            await vapiClient.assistants.delete(vapiAssistant.id);
        } catch (cleanupError) {
            console.error('Failed to cleanup VAPI assistant:', cleanupError);
        }

        throw new Error('Failed to assign agent to organization');
    }

    return {
        agent: {
            id: assignmentResult.agent.id,
            vapi_assistant_id: assignmentResult.agent.vapi_assistant_id,
            organization_id: assignmentResult.agent.organization_id,
        },
    };
}

