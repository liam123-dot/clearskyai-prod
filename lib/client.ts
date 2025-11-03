import { createServiceClient } from './supabase/server'
import { WorkOS } from '@workos-inc/node'

const workos = new WorkOS(process.env.WORKOS_API_KEY)

export async function getClientBySlug(slug: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('organisations')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) {
    return null
  }

  return data
}

export interface ClientStats {
  totalMinutes: number
  totalAgents: number
  totalCalls: number
}

export async function getClientStats(organizationId: string): Promise<ClientStats> {
  const supabase = await createServiceClient()

  // Count agents
  const { count: agentCount, error: agentError } = await supabase
    .from('agents')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)

  if (agentError) {
    console.error('Error counting agents:', agentError)
  }

  // Count calls
  const { count: callCount, error: callError } = await supabase
    .from('calls')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)

  if (callError) {
    console.error('Error counting calls:', callError)
  }

  // Get total minutes from calls - sum roundedDurationSeconds from data JSONB
  // Use a raw SQL query to efficiently sum the JSONB field
  const { data: callsData, error: callsDataError } = await supabase
    .from('calls')
    .select('data')
    .eq('organization_id', organizationId)

  let totalMinutes = 0
  if (!callsDataError && callsData) {
    // Extract roundedDurationSeconds from each call's data JSONB field
    for (const call of callsData) {
      const callData = call.data as any
      const roundedSeconds = callData?.roundedDurationSeconds
      if (roundedSeconds !== undefined) {
        totalMinutes += Math.ceil(roundedSeconds / 60)
      } else {
        // Fallback: calculate from durationSeconds if roundedDurationSeconds not available
        const durationSeconds = callData?.durationSeconds || callData?.call?.duration || 0
        if (durationSeconds > 0) {
          totalMinutes += Math.ceil(Math.ceil(durationSeconds) / 60)
        }
      }
    }
  } else if (callsDataError) {
    console.error('Error fetching calls data:', callsDataError)
  }

  return {
    totalMinutes: totalMinutes,
    totalAgents: agentCount || 0,
    totalCalls: callCount || 0,
  }
}

export interface WorkOSUser {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  createdAt: string
  updatedAt: string
}

export async function getWorkOSUsers(workosOrganizationId: string): Promise<WorkOSUser[]> {
  try {
    const result = await workos.userManagement.listUsers({
      organizationId: workosOrganizationId,
    })

    return result.data.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }))
  } catch (error) {
    console.error('Error fetching WorkOS users:', error)
    return []
  }
}