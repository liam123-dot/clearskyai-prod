import { createClient } from '@/lib/supabase/server'

// Knowledge base types
export type KnowledgeBaseType = 'general' | 'estate_agent'
export type ResyncSchedule = '6_hours' | '12_hours' | 'daily' | 'none'

// Type-specific data interfaces
export interface GeneralKnowledgeBaseData {
  [key: string]: unknown
}

export interface EstateAgentKnowledgeBaseData {
  for_sale_url?: string
  rental_url?: string
  resync_schedule?: ResyncSchedule
}

// Base knowledge base interface
export interface KnowledgeBase {
  id: string
  organization_id: string
  name: string
  type: KnowledgeBaseType
  data: GeneralKnowledgeBaseData | EstateAgentKnowledgeBaseData
  created_at: string
  updated_at: string
}

// Typed knowledge base by type
export interface GeneralKnowledgeBase extends Omit<KnowledgeBase, 'type' | 'data'> {
  type: 'general'
  data: GeneralKnowledgeBaseData
}

export interface EstateAgentKnowledgeBase extends Omit<KnowledgeBase, 'type' | 'data'> {
  type: 'estate_agent'
  data: EstateAgentKnowledgeBaseData
}

export type TypedKnowledgeBase = GeneralKnowledgeBase | EstateAgentKnowledgeBase

// Create knowledge base data
export interface CreateKnowledgeBaseData {
  name: string
  type: KnowledgeBaseType
  data: GeneralKnowledgeBaseData | EstateAgentKnowledgeBaseData
  organization_id: string
}

// Property interface (for estate agent knowledge bases)
export interface Property {
  id: string
  knowledge_base_id: string
  source: string
  rightmove_id: string
  url: string
  beds: number | null
  baths: number | null
  price: number
  property_type: string | null
  property_subtype: string | null
  title: string | null
  transaction_type: string
  street_address: string | null
  city: string | null
  district: string | null
  postcode: string | null
  postcode_district: string | null
  county: string | null
  full_address: string
  latitude: number | null
  longitude: number | null
  deposit: number | null
  let_available_date: string | null
  minimum_term_months: number | null
  let_type: string | null
  furnished_type: string | null
  tenure_type: string | null
  years_remaining_lease: number | null
  has_nearby_station: boolean | null
  has_online_viewing: boolean | null
  is_retirement: boolean
  is_shared_ownership: boolean | null
  pets_allowed: boolean | null
  bills_included: boolean | null
  image_count: number | null
  has_floorplan: boolean | null
  has_virtual_tour: boolean | null
  description: string | null
  features: string[] | null
  added_on: string | null
  scraped_at: string
  updated_at: string
  original_data: Record<string, unknown>
}

/**
 * Get all knowledge bases for an organization
 */
export async function getKnowledgeBases(
  organizationId: string
): Promise<KnowledgeBase[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('knowledge_bases')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching knowledge bases:', error)
    throw error
  }

  return data as KnowledgeBase[]
}

/**
 * Get a single knowledge base by ID
 */
export async function getKnowledgeBase(id: string): Promise<KnowledgeBase | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('knowledge_bases')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching knowledge base:', error)
    throw error
  }

  return data as KnowledgeBase
}

/**
 * Create a new knowledge base
 */
export async function createKnowledgeBase(
  data: CreateKnowledgeBaseData
): Promise<KnowledgeBase> {
  const supabase = await createClient()

  const { data: knowledgeBase, error } = await supabase
    .from('knowledge_bases')
    .insert({
      name: data.name,
      type: data.type,
      data: data.data,
      organization_id: data.organization_id,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating knowledge base:', error)
    throw error
  }

  return knowledgeBase as KnowledgeBase
}

/**
 * Update a knowledge base
 */
export async function updateKnowledgeBase(
  id: string,
  updates: Partial<Pick<KnowledgeBase, 'name' | 'data'>>
): Promise<KnowledgeBase> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('knowledge_bases')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating knowledge base:', error)
    throw error
  }

  return data as KnowledgeBase
}

/**
 * Delete a knowledge base
 */
export async function deleteKnowledgeBase(id: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('knowledge_bases')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting knowledge base:', error)
    throw error
  }
}

/**
 * Get properties for a knowledge base
 */
export async function getProperties(
  knowledgeBaseId: string
): Promise<Property[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('knowledge_base_id', knowledgeBaseId)
    .order('added_on', { ascending: false })

  if (error) {
    console.error('Error fetching properties:', error)
    throw error
  }

  return data as Property[]
}

/**
 * Get property count for a knowledge base
 */
export async function getPropertyCount(knowledgeBaseId: string): Promise<number> {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('properties')
    .select('*', { count: 'exact', head: true })
    .eq('knowledge_base_id', knowledgeBaseId)

  if (error) {
    console.error('Error fetching property count:', error)
    throw error
  }

  return count || 0
}

/**
 * Get all knowledge bases assigned to an agent
 */
export async function getAgentKnowledgeBases(
  agentId: string
): Promise<KnowledgeBase[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('agent_knowledge_bases')
    .select('knowledge_base_id, knowledge_bases(*)')
    .eq('agent_id', agentId)

  if (error) {
    console.error('Error fetching agent knowledge bases:', error)
    throw error
  }

  return (data?.map((row: any) => row.knowledge_bases).filter(Boolean) || []) as KnowledgeBase[]
}

/**
 * Get all knowledge bases for an organization with assignment status for a specific agent
 */
export async function getKnowledgeBasesWithAgentStatus(
  organizationId: string,
  agentId: string
): Promise<(KnowledgeBase & { is_assigned: boolean })[]> {
  const supabase = await createClient()

  // Get all knowledge bases for the organization
  const knowledgeBases = await getKnowledgeBases(organizationId)

  // Get assigned knowledge bases for the agent
  const { data: assignments, error } = await supabase
    .from('agent_knowledge_bases')
    .select('knowledge_base_id')
    .eq('agent_id', agentId)

  if (error) {
    console.error('Error fetching agent knowledge base assignments:', error)
    throw error
  }

  const assignedIds = new Set(
    assignments?.map((a) => a.knowledge_base_id) || []
  )

  return knowledgeBases.map((kb) => ({
    ...kb,
    is_assigned: assignedIds.has(kb.id),
  }))
}

/**
 * Assign a knowledge base to an agent
 * If the knowledge base is of type 'estate_agent', a VAPI tool will be created and attached
 */
export async function assignKnowledgeBaseToAgent(
  agentId: string,
  knowledgeBaseId: string
): Promise<void> {
  const supabase = await createClient()

  // Get the knowledge base to check its type
  const knowledgeBase = await getKnowledgeBase(knowledgeBaseId)
  
  if (!knowledgeBase) {
    throw new Error('Knowledge base not found')
  }

  let vapiToolId: string | null = null

  // If it's an estate agent knowledge base, create and attach a VAPI tool
  if (knowledgeBase.type === 'estate_agent') {
    const { createEstateAgentToolData, attachToolToAgent } = await import('./vapi/knowledge-base-tools')
    
    try {
      const toolData = createEstateAgentToolData(knowledgeBase.id, knowledgeBase.name)
      const result = await attachToolToAgent(agentId, toolData, 'query')
      vapiToolId = result.vapiToolId
    } catch (error) {
      console.error('Error creating VAPI tool:', error)
      throw new Error('Failed to create VAPI tool for estate agent knowledge base')
    }
  }

  // Insert the assignment record with the tool ID if created
  const { error } = await supabase
    .from('agent_knowledge_bases')
    .insert({
      agent_id: agentId,
      knowledge_base_id: knowledgeBaseId,
      vapi_tool_id: vapiToolId,
    })

  if (error) {
    // If insert fails and we created a tool, try to clean it up
    if (vapiToolId) {
      try {
        const { removeToolFromAgent } = await import('./vapi/knowledge-base-tools')
        await removeToolFromAgent(agentId, vapiToolId)
      } catch (cleanupError) {
        console.error('Error cleaning up VAPI tool after failed assignment:', cleanupError)
      }
    }
    
    console.error('Error assigning knowledge base to agent:', error)
    throw error
  }
}

/**
 * Unassign a knowledge base from an agent
 * If a VAPI tool was created for this assignment, it will be removed and deleted
 */
export async function unassignKnowledgeBaseFromAgent(
  agentId: string,
  knowledgeBaseId: string
): Promise<void> {
  const supabase = await createClient()

  // Get the assignment to check for a VAPI tool ID
  const { data: assignment, error: fetchError } = await supabase
    .from('agent_knowledge_bases')
    .select('vapi_tool_id')
    .eq('agent_id', agentId)
    .eq('knowledge_base_id', knowledgeBaseId)
    .single()

  if (fetchError) {
    console.error('Error fetching assignment:', fetchError)
    throw fetchError
  }

  // If there's a VAPI tool, remove it from the agent and delete it
  if (assignment?.vapi_tool_id) {
    try {
      const { removeToolFromAgent } = await import('./vapi/knowledge-base-tools')
      await removeToolFromAgent(agentId, assignment.vapi_tool_id)
    } catch (error) {
      console.error('Error removing VAPI tool:', error)
      // Continue with deletion even if tool removal fails
    }
  }

  // Delete the assignment record
  const { error } = await supabase
    .from('agent_knowledge_bases')
    .delete()
    .eq('agent_id', agentId)
    .eq('knowledge_base_id', knowledgeBaseId)

  if (error) {
    console.error('Error unassigning knowledge base from agent:', error)
    throw error
  }
}

/**
 * Check if a knowledge base is assigned to an agent
 */
export async function isKnowledgeBaseAssignedToAgent(
  agentId: string,
  knowledgeBaseId: string
): Promise<boolean> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('agent_knowledge_bases')
    .select('id')
    .eq('agent_id', agentId)
    .eq('knowledge_base_id', knowledgeBaseId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return false
    }
    console.error('Error checking knowledge base assignment:', error)
    throw error
  }

  return !!data
}

