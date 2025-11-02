import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { Call } from '@/lib/calls-helpers'
import { getWentToTeam, getTeamAnswered, getCallDuration } from '@/lib/calls-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const searchParams = request.nextUrl.searchParams

    // Get organization ID from slug
    const supabase = await createServiceClient()
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .select('id')
      .eq('slug', slug)
      .single()

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Parse query parameters
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const agentIds = searchParams.get('agentIds')?.split(',').filter(Boolean) || []
    const statuses = searchParams.get('statuses')?.split(',').filter(Boolean) || []
    const groupBy = searchParams.get('groupBy') || 'day' // 15min, hour, day, week, month
    const firstCallOnly = searchParams.get('firstCallOnly') === 'true'

    // If only requesting first call date, return early
    if (firstCallOnly) {
      const { data: firstCall, error: firstCallError } = await supabase
        .from('calls')
        .select('created_at')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (firstCallError) {
        return NextResponse.json(
          { error: 'Failed to fetch first call date' },
          { status: 500 }
        )
      }

      return NextResponse.json({ 
        firstCallDate: firstCall?.created_at || null 
      })
    }

    // Build query
    let query = supabase
      .from('calls')
      .select('*')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: true })

    // Apply date filters
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }
    if (dateTo) {
      // Include the end date/time
      query = query.lte('created_at', dateTo)
    }

    // Apply agent filter
    if (agentIds.length > 0) {
      query = query.in('agent_id', agentIds)
    }

    // Apply status filter
    if (statuses.length > 0) {
      query = query.in('routing_status', statuses)
    }

    const { data: calls, error } = await query

    if (error) {
      console.error('Error fetching calls:', error)
      return NextResponse.json(
        { error: 'Failed to fetch calls' },
        { status: 500 }
      )
    }

    const callsData = (calls || []) as Call[]

    // Group calls by time period and fill in missing periods
    const groupedData = groupCallsByTimePeriod(callsData, groupBy, dateFrom, dateTo)

    // Calculate totals (async now to handle updates)
    const totals = await calculateTotals(callsData, supabase)

    return NextResponse.json({
      groupedData,
      totals,
    })
  } catch (error) {
    console.error('Error in analytics endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function groupCallsByTimePeriod(
  calls: Call[],
  groupBy: string,
  dateFrom?: string | null,
  dateTo?: string | null
): Array<{
  period: string
  total: number
  agent: number
  team: number
  teamAnswered: number
  totalMinutes: number
  avgCallDuration: number
}> {
  const groups = new Map<string, {
    total: number
    agent: number
    team: number
    teamAnswered: number
    totalMinutes: number
    totalDurationSeconds: number // Track total duration for averaging
  }>()

  // Process calls and group them
  calls.forEach((call) => {
    const date = new Date(call.created_at)
    let periodKey: string

    switch (groupBy) {
      case '15min':
        // Truncate to 15-minute interval
        const min15Date = new Date(date)
        const minutes = min15Date.getMinutes()
        min15Date.setMinutes(Math.floor(minutes / 15) * 15, 0, 0)
        periodKey = min15Date.toISOString()
        break
      case 'hour':
        // Truncate to hour
        const hourDate = new Date(date)
        hourDate.setMinutes(0, 0, 0)
        periodKey = hourDate.toISOString().slice(0, 13) + ':00:00Z'
        break
      case 'day':
        // Truncate to day
        const dayDate = new Date(date)
        dayDate.setHours(0, 0, 0, 0)
        periodKey = dayDate.toISOString().slice(0, 10) // YYYY-MM-DD
        break
      case 'week':
        // Get Monday of the week (ISO week starts on Monday)
        const weekStart = new Date(date)
        const dayOfWeek = weekStart.getDay()
        const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
        weekStart.setDate(diff)
        weekStart.setHours(0, 0, 0, 0)
        periodKey = weekStart.toISOString().slice(0, 10)
        break
      case 'month':
        // Truncate to first day of month
        const monthDate = new Date(date)
        monthDate.setDate(1)
        monthDate.setHours(0, 0, 0, 0)
        periodKey = monthDate.toISOString().slice(0, 7) // YYYY-MM
        break
      default:
        periodKey = date.toISOString().slice(0, 10)
    }

    if (!groups.has(periodKey)) {
      groups.set(periodKey, {
        total: 0,
        agent: 0,
        team: 0,
        teamAnswered: 0,
        totalMinutes: 0,
        totalDurationSeconds: 0,
      })
    }

    const group = groups.get(periodKey)!
    group.total++

    // Track call duration for minutes and average calculation
    const callData = call.data as any
    const durationSeconds = callData?.roundedDurationSeconds !== undefined
      ? callData.roundedDurationSeconds
      : getCallDuration(call.data)
    const durationMinutes = durationSeconds > 0 ? durationSeconds / 60 : 0
    
    group.totalMinutes += durationMinutes
    group.totalDurationSeconds += durationSeconds

    // Check if call went to team
    const wentToTeam = getWentToTeam(call)
    const teamAnswered = getTeamAnswered(call)

    if (wentToTeam) {
      group.team++
      if (teamAnswered) {
        group.teamAnswered++
      }
    } else {
      // Direct to agent
      group.agent++
    }
  })

  // Fill in missing periods if date range is provided
  if (dateFrom && dateTo) {
    // Normalize to start of day for start date, end of day for end date
    const start = new Date(dateFrom)
    start.setHours(0, 0, 0, 0)
    const end = new Date(dateTo)
    end.setHours(23, 59, 59, 999)
    
    // Generate all periods in the range
    const allPeriods: string[] = []
    let current = new Date(start)

    // Helper to get period key for a given date
    const getPeriodKey = (date: Date): string => {
      switch (groupBy) {
        case '15min':
          const min15Date = new Date(date)
          min15Date.setSeconds(0, 0)
          const minutes = min15Date.getMinutes()
          min15Date.setMinutes(Math.floor(minutes / 15) * 15)
          return min15Date.toISOString()
        case 'hour':
          const hourDate = new Date(date)
          hourDate.setMinutes(0, 0, 0)
          return hourDate.toISOString().slice(0, 13) + ':00:00Z'
        case 'day':
          const dayDate = new Date(date)
          dayDate.setHours(0, 0, 0, 0)
          return dayDate.toISOString().slice(0, 10)
        case 'week':
          const weekStart = new Date(date)
          const dayOfWeek = weekStart.getDay()
          const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
          weekStart.setDate(diff)
          weekStart.setHours(0, 0, 0, 0)
          return weekStart.toISOString().slice(0, 10)
        case 'month':
          const monthDate = new Date(date)
          monthDate.setDate(1)
          monthDate.setHours(0, 0, 0, 0)
          return monthDate.toISOString().slice(0, 7)
        default:
          const defaultDate = new Date(date)
          defaultDate.setHours(0, 0, 0, 0)
          return defaultDate.toISOString().slice(0, 10)
      }
    }

    // Start from the period containing the start date (already normalized to start of day)
    let periodStart = new Date(start)
    switch (groupBy) {
      case '15min':
        // For 15min, start from midnight of the start day
        periodStart.setSeconds(0, 0)
        periodStart.setMinutes(0)
        break
      case 'hour':
        // For hour, start from midnight of the start day
        periodStart.setMinutes(0, 0, 0)
        break
      case 'day':
        // Already at start of day
        break
      case 'week':
        // Get Monday of the week containing the start date
        const dayOfWeek = periodStart.getDay()
        const diff = periodStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
        periodStart.setDate(diff)
        periodStart.setHours(0, 0, 0, 0)
        break
      case 'month':
        // First day of the month containing the start date
        periodStart.setDate(1)
        periodStart.setHours(0, 0, 0, 0)
        break
    }

    current = new Date(periodStart)
    const maxIterations = 10000 // Safety limit
    let iterations = 0

    while (current <= end && iterations < maxIterations) {
      iterations++
      const periodKey = getPeriodKey(current)

      if (!allPeriods.includes(periodKey)) {
        allPeriods.push(periodKey)
      }

      // Move to next period
      switch (groupBy) {
        case '15min':
          current.setMinutes(current.getMinutes() + 15)
          break
        case 'hour':
          current.setHours(current.getHours() + 1)
          break
        case 'day':
          current.setDate(current.getDate() + 1)
          break
        case 'week':
          current.setDate(current.getDate() + 7)
          break
        case 'month':
          current.setMonth(current.getMonth() + 1)
          break
        default:
          current.setDate(current.getDate() + 1)
      }
    }

    // Ensure we include the period containing the end date if we haven't already
    const endPeriodKey = getPeriodKey(end)
    if (!allPeriods.includes(endPeriodKey)) {
      allPeriods.push(endPeriodKey)
    }

    // Ensure all periods have entries
    allPeriods.forEach(period => {
      if (!groups.has(period)) {
        groups.set(period, {
          total: 0,
          agent: 0,
          team: 0,
          teamAnswered: 0,
          totalMinutes: 0,
          totalDurationSeconds: 0,
        })
      }
    })
  }

  // Convert to array, calculate averages, and sort by period
  return Array.from(groups.entries())
    .map(([period, data]) => {
      // Calculate average call duration in seconds
      const avgCallDuration = data.total > 0
        ? data.totalDurationSeconds / data.total
        : 0
      
      return {
        period,
        total: data.total,
        agent: data.agent,
        team: data.team,
        teamAnswered: data.teamAnswered,
        totalMinutes: data.totalMinutes,
        avgCallDuration,
      }
    })
    .sort((a, b) => a.period.localeCompare(b.period))
}

async function calculateTotals(calls: Call[], supabase: Awaited<ReturnType<typeof createServiceClient>>): Promise<{
  total: number
  agent: number
  team: number
  teamAnswered: number
  totalDurationSeconds: number
}> {
  const totals = {
    total: calls.length,
    agent: 0,
    team: 0,
    teamAnswered: 0,
    totalDurationSeconds: 0,
  }

  // Track calls that need to be updated with roundedDurationSeconds
  const callsToUpdate: Array<{ id: string; roundedDurationSeconds: number; data: any }> = []

  for (const call of calls) {
    const wentToTeam = getWentToTeam(call)
    const teamAnswered = getTeamAnswered(call)

    if (wentToTeam) {
      totals.team++
      if (teamAnswered) {
        totals.teamAnswered++
      }
    } else {
      totals.agent++
    }

    // Check for roundedDurationSeconds first, otherwise calculate and save it
    let roundedDurationSeconds: number
    const callData = call.data as any
    if (callData?.roundedDurationSeconds !== undefined) {
      roundedDurationSeconds = callData.roundedDurationSeconds
    } else {
      // Calculate by rounding UP durationSeconds
      const durationSeconds = getCallDuration(call.data)
      roundedDurationSeconds = durationSeconds > 0 ? Math.ceil(durationSeconds) : 0
      
      // Mark this call for update
      if (roundedDurationSeconds > 0) {
        callsToUpdate.push({
          id: call.id,
          roundedDurationSeconds,
          data: {
            ...callData,
            roundedDurationSeconds,
          },
        })
      }
    }

    totals.totalDurationSeconds += roundedDurationSeconds
  }

  // Batch update calls that need roundedDurationSeconds
  if (callsToUpdate.length > 0) {
    // Update calls in parallel (batched)
    await Promise.all(
      callsToUpdate.map(async ({ id, data }) => {
        const { error } = await supabase
          .from('calls')
          .update({ data })
          .eq('id', id)
        if (error) {
          console.error(`Error updating call ${id} with roundedDurationSeconds:`, error)
        }
      })
    )
  }

  return totals
}

