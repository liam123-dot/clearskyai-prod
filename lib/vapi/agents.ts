import { vapiClient } from "./VapiClients";
import { createServiceClient } from "../supabase/server";
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

