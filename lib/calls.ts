import { createServiceClient } from './supabase/server'

// Re-export types and helpers for convenience
export type { Call } from './calls-helpers'
export {
  formatDuration,
  getCallDuration,
  getCallerNumber,
  getCalledNumber,
  getAssistantName,
  getRecordingUrl,
  getTranscript,
  getSummary,
  getEndedReason
} from './calls-helpers'

import type { Call } from './calls-helpers'

export async function getCallsByOrganization(organizationId: string): Promise<Call[]> {
  const supabase = await createServiceClient()

  const { data: calls, error } = await supabase
    .from('calls')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to load calls: ${error.message}`)
  }

  return calls || []
}

export async function getCallById(callId: string, organizationId: string): Promise<Call | null> {
  const supabase = await createServiceClient()

  const { data: call, error } = await supabase
    .from('calls')
    .select('*')
    .eq('id', callId)
    .eq('organization_id', organizationId)
    .single()

  if (error) {
    return null
  }

  return call
}

const PAGE_SIZE = 50

export async function getAllCallsPaginated(
  page: number = 1,
  organizationId?: string
): Promise<{
  calls: Call[]
  totalCount: number
  totalPages: number
}> {
  const supabase = await createServiceClient()

  // Calculate range for pagination
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  // Build query
  let query = supabase
    .from('calls')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  // Apply organization filter if provided
  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  }

  // Apply pagination
  query = query.range(from, to)

  const { data: calls, error, count } = await query

  if (error) {
    throw new Error(`Failed to load calls: ${error.message}`)
  }

  const totalCount = count || 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return {
    calls: calls || [],
    totalCount,
    totalPages
  }
}

