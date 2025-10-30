'use client'

import { useState, useEffect, useCallback, useMemo, useRef, startTransition } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import { DateRangePicker } from '@/components/ui/date-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Loader2, Info } from 'lucide-react'
import { IconPhone, IconRobot, IconUsers, IconRotateClockwise } from '@tabler/icons-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CardDescription } from '@/components/ui/card'

interface Organization {
  id: string
  slug: string
  name: string
}

interface CallsAnalyticsProps {
  slug?: string
  isAdmin?: boolean
  organizations?: Organization[]
}

interface Agent {
  id: string
  vapi_assistant_id: string
  vapiAssistant: {
    name: string
  }
}

interface AnalyticsData {
  groupedData: Array<{
    period: string
    total: number
    agent: number
    team: number
    teamAnswered: number
  }>
  totals: {
    total: number
    agent: number
    team: number
    teamAnswered: number
  }
}

const ROUTING_STATUSES = [
  { value: 'transferred_to_team', label: 'Transferred to Team' },
  { value: 'team_no_answer', label: 'Team No Answer' },
  { value: 'direct_to_agent', label: 'Direct to Agent' },
  { value: 'completed', label: 'Completed' },
]

const TIME_GROUPINGS = [
  { value: '15min', label: '15 Min' },
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

const CHART_SERIES = [
  { value: 'total', label: 'Total Calls' },
  { value: 'agentDirect', label: 'Direct to Agent' },
  { value: 'teamAnswered', label: 'Team Pickup' },
  { value: 'agentSaves', label: 'Agent Saves' },
]

export function CallsAnalytics({ slug, isAdmin = false, organizations = [] }: CallsAnalyticsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get initial organization from URL (admin mode only)
  const getInitialOrganization = useCallback(() => {
    if (!isAdmin) return undefined
    const orgParam = searchParams.get('org')
    return orgParam && orgParam !== 'all' ? orgParam : undefined
  }, [searchParams, isAdmin])

  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | undefined>(getInitialOrganization)

  // Parse query parameters
  const getInitialDateRange = useCallback(() => {
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    
    if (dateFrom && dateTo) {
      return {
        from: new Date(dateFrom),
        to: new Date(dateTo),
      }
    }
    
    // Default to last 30 days
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - 30)
    from.setHours(0, 0, 0, 0)
    to.setHours(23, 59, 59, 999)
    return { from, to }
  }, [searchParams])

  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(getInitialDateRange)
  
  const getInitialAgents = useCallback(() => {
    const agentsParam = searchParams.get('agents')
    return agentsParam ? agentsParam.split(',').filter(Boolean) : []
  }, [searchParams])
  
  const getInitialStatuses = useCallback(() => {
    const statusesParam = searchParams.get('statuses')
    return statusesParam ? statusesParam.split(',').filter(Boolean) : []
  }, [searchParams])

  const [selectedAgents, setSelectedAgents] = useState<string[]>(getInitialAgents)
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(getInitialStatuses)
  const [timeGrouping, setTimeGrouping] = useState<string>(
    searchParams.get('groupBy') || 'day'
  )
  const [agentsOpen, setAgentsOpen] = useState(false)
  const [statusesOpen, setStatusesOpen] = useState(false)
  
  // Get initial chart series from URL or default to total
  const getInitialChartSeries = useCallback(() => {
    const seriesParam = searchParams.get('chartSeries')
    return seriesParam ? seriesParam.split(',').filter(Boolean) : ['total']
  }, [searchParams])
  
  const [selectedChartSeries, setSelectedChartSeries] = useState<string[]>(getInitialChartSeries)
  const [chartSeriesOpen, setChartSeriesOpen] = useState(false)

  // Track if component has mounted to prevent updates during initial render
  const hasMounted = useRef(false)

  // Update URL when filters change
  const updateURL = useCallback((updates: {
    dateFrom?: Date
    dateTo?: Date
    agents?: string[]
    statuses?: string[]
    groupBy?: string
    chartSeries?: string[]
    organizationId?: string | undefined
  }) => {
    // Don't update URL during initial render
    if (!hasMounted.current) return
    
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      
      if (updates.dateFrom) {
        params.set('dateFrom', updates.dateFrom.toISOString())
      }
      if (updates.dateTo) {
        params.set('dateTo', updates.dateTo.toISOString())
      }
      if (updates.agents !== undefined) {
        if (updates.agents.length === 0) {
          params.delete('agents')
        } else {
          params.set('agents', updates.agents.join(','))
        }
      }
      if (updates.statuses !== undefined) {
        if (updates.statuses.length === 0) {
          params.delete('statuses')
        } else {
          params.set('statuses', updates.statuses.join(','))
        }
      }
      if (updates.groupBy !== undefined) {
        if (updates.groupBy === 'day') {
          params.delete('groupBy')
        } else {
          params.set('groupBy', updates.groupBy)
        }
      }
      if (updates.chartSeries !== undefined) {
        const defaultSeries = ['total']
        const isDefault = updates.chartSeries.length === defaultSeries.length &&
          updates.chartSeries.every(s => defaultSeries.includes(s)) &&
          defaultSeries.every(s => updates.chartSeries!.includes(s))
        if (isDefault) {
          params.delete('chartSeries')
        } else {
          params.set('chartSeries', updates.chartSeries.join(','))
        }
      }
      if (updates.organizationId !== undefined) {
        if (!updates.organizationId || updates.organizationId === 'all') {
          params.delete('org')
        } else {
          params.set('org', updates.organizationId)
        }
      }
      
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }, [router, searchParams])

  // Mark component as mounted after first render
  useEffect(() => {
    hasMounted.current = true
  }, [])

  // Fetch first call date
  const { data: firstCallData } = useQuery<{ firstCallDate: string | null }>({
    queryKey: ['first-call-date', isAdmin ? 'admin' : slug, selectedOrganizationId],
    queryFn: async () => {
      const baseUrl = isAdmin ? '/api/admin/calls/analytics' : `/api/${slug}/calls/analytics`
      const params = new URLSearchParams({ firstCallOnly: 'true' })
      if (isAdmin && selectedOrganizationId) {
        params.set('organizationId', selectedOrganizationId)
      }
      const response = await fetch(`${baseUrl}?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch first call date')
      return response.json()
    },
    enabled: isAdmin ? true : !!slug,
  })

  // Adjust date range if it goes before the first call
  useEffect(() => {
    if (!hasMounted.current) return
    if (firstCallData?.firstCallDate) {
      const firstCallDate = new Date(firstCallData.firstCallDate)
      if (dateRange.from < firstCallDate) {
        const adjustedRange = {
          from: new Date(firstCallDate),
          to: dateRange.to < firstCallDate ? new Date(firstCallDate) : dateRange.to,
        }
        setDateRange(adjustedRange)
        updateURL({
          dateFrom: adjustedRange.from,
          dateTo: adjustedRange.to,
        })
      }
    }
  }, [firstCallData, dateRange.from, dateRange.to, updateURL])

  // Calculate date range span in days
  const dateRangeDays = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))

  // Determine allowed groupings based on date range
  const allowedGroupings = useMemo(() => {
    const hours = (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60)
    
    if (hours <= 24) {
      // 24 hours or less: 15min and hour
      return ['15min', 'hour']
    } else if (dateRangeDays <= 7) {
      // Up to 1 week: 15min, hour, and day
      return ['15min', 'hour', 'day']
    } else if (dateRangeDays <= 28) {
      // Up to 4 weeks: hour, day, week
      return ['hour', 'day', 'week']
    } else {
      // More than 4 weeks: all options except 15min
      return ['hour', 'day', 'week', 'month']
    }
  }, [dateRangeDays, dateRange.from, dateRange.to])

  // Track if we're updating from URL to prevent loops
  const isUpdatingFromURL = useRef(false)
  const lastSearchParams = useRef<string>('')

  // Auto-select appropriate grouping if current is invalid
  useEffect(() => {
    if (!hasMounted.current) return
    // Skip if we're currently syncing from URL
    if (isUpdatingFromURL.current) return
    
    if (!allowedGroupings.includes(timeGrouping)) {
      // Select the most appropriate grouping (largest allowed)
      const newGrouping = allowedGroupings[allowedGroupings.length - 1]
      if (newGrouping && newGrouping !== timeGrouping) {
        setTimeGrouping(newGrouping)
        updateURL({ groupBy: newGrouping })
      }
    }
  }, [allowedGroupings, timeGrouping, updateURL])

  // Sync state with URL params when they change externally
  // Only depend on searchParams to avoid loops
  useEffect(() => {
    const searchParamsStr = searchParams.toString()
    
    // Skip if searchParams hasn't actually changed
    if (searchParamsStr === lastSearchParams.current) {
      return
    }
    
    lastSearchParams.current = searchParamsStr
    
    const urlDateFrom = searchParams.get('dateFrom')
    const urlDateTo = searchParams.get('dateTo')
    const urlAgents = searchParams.get('agents')
    const urlStatuses = searchParams.get('statuses')
    const urlGroupBy = searchParams.get('groupBy') || 'day'
    const urlOrg = isAdmin ? searchParams.get('org') : null

    isUpdatingFromURL.current = true

    // Sync organization (admin mode only)
    if (isAdmin && urlOrg !== null) {
      const expectedOrgId = urlOrg && urlOrg !== 'all' ? urlOrg : undefined
      if (selectedOrganizationId !== expectedOrgId) {
        setSelectedOrganizationId(expectedOrgId)
      }
    }

    if (urlDateFrom && urlDateTo) {
      const urlRange = {
        from: new Date(urlDateFrom),
        to: new Date(urlDateTo),
      }
      // Only update if actually different
      if (urlRange.from.getTime() !== dateRange.from.getTime() || 
          urlRange.to.getTime() !== dateRange.to.getTime()) {
        setDateRange(urlRange)
      }
    }

    if (urlAgents !== null) {
      const urlAgentsArray = urlAgents ? urlAgents.split(',').filter(Boolean) : []
      const currentAgentsStr = JSON.stringify(selectedAgents.sort())
      const urlAgentsStr = JSON.stringify(urlAgentsArray.sort())
      if (currentAgentsStr !== urlAgentsStr) {
        setSelectedAgents(urlAgentsArray)
      }
    }

    if (urlStatuses !== null) {
      const urlStatusesArray = urlStatuses ? urlStatuses.split(',').filter(Boolean) : []
      const currentStatusesStr = JSON.stringify(selectedStatuses.sort())
      const urlStatusesStr = JSON.stringify(urlStatusesArray.sort())
      if (currentStatusesStr !== urlStatusesStr) {
        setSelectedStatuses(urlStatusesArray)
      }
    }

    if (urlGroupBy !== timeGrouping) {
      setTimeGrouping(urlGroupBy)
    }

    const urlChartSeries = searchParams.get('chartSeries')
    if (urlChartSeries !== null) {
      const urlChartSeriesArray = urlChartSeries ? urlChartSeries.split(',').filter(Boolean) : []
      const currentSeriesStr = JSON.stringify(selectedChartSeries.sort())
      const urlSeriesStr = JSON.stringify(urlChartSeriesArray.sort())
      if (currentSeriesStr !== urlSeriesStr) {
        setSelectedChartSeries(urlChartSeriesArray.length > 0 ? urlChartSeriesArray : ['total'])
      }
    }

    // Reset flag after state updates complete
    requestAnimationFrame(() => {
      isUpdatingFromURL.current = false
    })
  }, [searchParams, isAdmin]) // Only depend on searchParams and isAdmin to avoid loops

  // Fetch agents
  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ['agents', isAdmin ? 'admin' : slug, selectedOrganizationId],
    queryFn: async () => {
      const baseUrl = isAdmin ? '/api/admin/agents' : `/api/${slug}/agents`
      const params = new URLSearchParams()
      if (isAdmin && selectedOrganizationId) {
        params.set('organizationId', selectedOrganizationId)
      }
      const url = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch agents')
      return response.json()
    },
    enabled: isAdmin ? true : !!slug,
  })

  // Set all agents as selected by default when agents load (if not in URL)
  useEffect(() => {
    if (!hasMounted.current) return
    if (agents.length > 0 && selectedAgents.length === 0 && !searchParams.get('agents')) {
      const allAgentIds = agents.map(a => a.id)
      setSelectedAgents(allAgentIds)
      updateURL({ agents: allAgentIds })
    }
  }, [agents, selectedAgents.length, searchParams, updateURL])

  // Set all statuses as selected by default (if not in URL)
  useEffect(() => {
    if (!hasMounted.current) return
    if (selectedStatuses.length === 0 && !searchParams.get('statuses')) {
      const allStatuses = ROUTING_STATUSES.map(s => s.value)
      setSelectedStatuses(allStatuses)
      updateURL({ statuses: allStatuses })
    }
  }, [selectedStatuses.length, searchParams, updateURL])

      // Fetch analytics data
      const { data: analyticsData, isLoading: analyticsLoading, error } = useQuery<AnalyticsData>({
        queryKey: ['calls-analytics', isAdmin ? 'admin' : slug, selectedOrganizationId, dateRange, selectedAgents, selectedStatuses, timeGrouping],
        queryFn: async () => {
          // Normalize date range: start from midnight of start day, end at end of day for end day
          const normalizedFrom = new Date(dateRange.from)
          normalizedFrom.setHours(0, 0, 0, 0)
          const normalizedTo = new Date(dateRange.to)
          normalizedTo.setHours(23, 59, 59, 999)
          
          const baseUrl = isAdmin ? '/api/admin/calls/analytics' : `/api/${slug}/calls/analytics`
          const params = new URLSearchParams({
            dateFrom: normalizedFrom.toISOString(),
            dateTo: normalizedTo.toISOString(),
            groupBy: timeGrouping,
          })

          if (isAdmin && selectedOrganizationId) {
            params.append('organizationId', selectedOrganizationId)
          }

      if (selectedAgents.length > 0 && selectedAgents.length < agents.length) {
        params.append('agentIds', selectedAgents.join(','))
      }

      if (selectedStatuses.length > 0 && selectedStatuses.length < ROUTING_STATUSES.length) {
        params.append('statuses', selectedStatuses.join(','))
      }

      const response = await fetch(`${baseUrl}?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch analytics')
      return response.json()
    },
    enabled: agents.length > 0 || selectedAgents.length > 0,
  })

  const toggleAgent = (agentId: string) => {
    setSelectedAgents(prev => {
      const updated = prev.includes(agentId)
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
      setTimeout(() => {
        if (hasMounted.current) {
          updateURL({ agents: updated })
        }
      }, 0)
      return updated
    })
  }

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev => {
      const updated = prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
      setTimeout(() => {
        if (hasMounted.current) {
          updateURL({ statuses: updated })
        }
      }, 0)
      return updated
    })
  }

  const selectAllAgents = () => {
    const allAgentIds = agents.map(a => a.id)
    setSelectedAgents(allAgentIds)
    setTimeout(() => {
      if (hasMounted.current) {
        updateURL({ agents: allAgentIds })
      }
    }, 0)
  }

  const deselectAllAgents = () => {
    setSelectedAgents([])
    setTimeout(() => {
      if (hasMounted.current) {
        updateURL({ agents: [] })
      }
    }, 0)
  }

  const selectAllStatuses = () => {
    const allStatuses = ROUTING_STATUSES.map(s => s.value)
    setSelectedStatuses(allStatuses)
    setTimeout(() => {
      if (hasMounted.current) {
        updateURL({ statuses: allStatuses })
      }
    }, 0)
  }

  const deselectAllStatuses = () => {
    setSelectedStatuses([])
    setTimeout(() => {
      if (hasMounted.current) {
        updateURL({ statuses: [] })
      }
    }, 0)
  }

  const toggleChartSeries = (series: string) => {
    setSelectedChartSeries(prev => {
      const updated = prev.includes(series)
        ? prev.filter(s => s !== series)
        : [...prev, series]
      // Ensure at least one series is selected
      if (updated.length === 0) {
        return prev
      }
      // Defer URL update to avoid render issues
      setTimeout(() => {
        if (hasMounted.current) {
          updateURL({ chartSeries: updated })
        }
      }, 0)
      return updated
    })
  }

  const selectAllChartSeries = () => {
    const allSeries = CHART_SERIES.map(s => s.value)
    setSelectedChartSeries(allSeries)
    setTimeout(() => {
      if (hasMounted.current) {
        updateURL({ chartSeries: allSeries })
      }
    }, 0)
  }

  const deselectAllChartSeries = () => {
    // Keep at least one selected - default to total
    setSelectedChartSeries(['total'])
    setTimeout(() => {
      if (hasMounted.current) {
        updateURL({ chartSeries: ['total'] })
      }
    }, 0)
  }

  const formatPeriodLabel = (period: string) => {
    switch (timeGrouping) {
      case '15min':
        return new Date(period).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      case 'hour':
        return new Date(period).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' })
      case 'day':
        return new Date(period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      case 'week':
        return `Week of ${new Date(period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      case 'month':
        return new Date(period + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      default:
        return period
    }
  }

  const totals = analyticsData?.totals || { total: 0, agent: 0, team: 0, teamAnswered: 0 }
  const agentPickups = totals.team - totals.teamAnswered
  const totalAgentHandled = totals.agent + agentPickups
  const agentHandledPercentage = totals.total > 0 ? ((totalAgentHandled / totals.total) * 100).toFixed(1) : '0'
  const savedCallsPercentage = totals.total > 0 ? ((agentPickups / totals.total) * 100).toFixed(1) : '0'

  // Build dynamic chart config based on selected series
  const chartConfig = useMemo(() => {
    const config: Record<string, { label: string; color: string }> = {}
    
    if (selectedChartSeries.includes('total')) {
      config.total = {
        label: 'Total Calls',
        color: 'hsl(217 91% 60%)', // blue-500
      }
    }
    if (selectedChartSeries.includes('agentDirect')) {
      config.agentDirect = {
        label: 'Direct to Agent',
        color: 'hsl(221 83% 53%)', // blue-600
      }
    }
    if (selectedChartSeries.includes('teamAnswered')) {
      config.teamAnswered = {
        label: 'Team Pickup',
        color: 'hsl(215 20% 65%)', // muted slate-blue
      }
    }
    if (selectedChartSeries.includes('agentSaves')) {
      config.agentSaves = {
        label: 'Agent Saves',
        color: 'hsl(160 84% 39%)', // teal-600
      }
    }
    
    return config satisfies ChartConfig
  }, [selectedChartSeries])

  // Handle organization change (admin mode only)
  const handleOrganizationChange = (value: string) => {
    const newOrgId = value === 'all' ? undefined : value
    setSelectedOrganizationId(newOrgId)
    // Reset selected agents when organization changes
    setSelectedAgents([])
    setTimeout(() => {
      if (hasMounted.current) {
        updateURL({ organizationId: newOrgId })
      }
    }, 0)
  }


  return (
    <div className="space-y-4">
      {/* Filters - Compact Layout */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {isAdmin && organizations.length > 0 && (
          <>
            <Select value={selectedOrganizationId || 'all'} onValueChange={handleOrganizationChange}>
              <SelectTrigger className="w-[200px] h-8">
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="h-4 w-px bg-border" />
          </>
        )}
        <DateRangePicker
          initialDateFrom={dateRange.from}
          initialDateTo={dateRange.to}
          minDate={firstCallData?.firstCallDate ? new Date(firstCallData.firstCallDate) : undefined}
          onUpdate={({ range }) => {
            const newRange = {
              from: range.from,
              to: range.to || range.from,
            }
            setDateRange(newRange)

            // Calculate new date range span
            const newRangeDays = Math.ceil((newRange.to.getTime() - newRange.from.getTime()) / (1000 * 60 * 60 * 24))

              // Determine appropriate grouping for new range
              const newRangeHours = (newRange.to.getTime() - newRange.from.getTime()) / (1000 * 60 * 60)
              let appropriateGrouping = timeGrouping
              
              if (newRangeHours <= 24) {
                // If current is not allowed for <= 24 hours, default to hour
                if (!['15min', 'hour'].includes(timeGrouping)) {
                  appropriateGrouping = 'hour'
                }
              } else if (newRangeDays <= 7) {
                // If current is month or week and not allowed, default to day
                if (!['15min', 'hour', 'day'].includes(timeGrouping)) {
                  appropriateGrouping = 'day'
                }
              } else if (newRangeDays <= 28) {
                // If current is month and not allowed, default to week
                if (timeGrouping === 'month') {
                  appropriateGrouping = 'week'
                }
              }

            // Only update grouping if it changed
            const updates: Parameters<typeof updateURL>[0] = {
              dateFrom: newRange.from,
              dateTo: newRange.to,
            }

            if (appropriateGrouping !== timeGrouping) {
              setTimeGrouping(appropriateGrouping)
              updates.groupBy = appropriateGrouping
            }

            // Defer URL update to avoid render issues
            setTimeout(() => {
              if (hasMounted.current) {
                updateURL(updates)
              }
            }, 0)
          }}
        />

        <div className="h-4 w-px bg-border" />

        <Select value={timeGrouping} onValueChange={(value) => {
          setTimeGrouping(value)
          setTimeout(() => {
            if (hasMounted.current) {
              updateURL({ groupBy: value })
            }
          }, 0)
        }}>
          <SelectTrigger className="w-[110px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_GROUPINGS.map((group) => {
              const isAllowed = allowedGroupings.includes(group.value)
              return (
                <SelectItem
                  key={group.value}
                  value={group.value}
                  disabled={!isAllowed}
                >
                  {group.label}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        <Popover open={chartSeriesOpen} onOpenChange={setChartSeriesOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 min-w-[140px]">
              Chart ({selectedChartSeries.length}/{CHART_SERIES.length})
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Chart Series</Label>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllChartSeries}
                    className="h-7 text-xs"
                  >
                    All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={deselectAllChartSeries}
                    className="h-7 text-xs"
                  >
                    Reset
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {CHART_SERIES.map((series) => (
                  <div key={series.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`chart-series-${series.value}`}
                      checked={selectedChartSeries.includes(series.value)}
                      onCheckedChange={() => toggleChartSeries(series.value)}
                    />
                    <Label
                      htmlFor={`chart-series-${series.value}`}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      {series.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={agentsOpen} onOpenChange={setAgentsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 min-w-[140px]">
              Agents ({selectedAgents.length}/{agents.length})
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Filter by Agents</Label>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllAgents}
                    className="h-7 text-xs"
                  >
                    All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={deselectAllAgents}
                    className="h-7 text-xs"
                  >
                    None
                  </Button>
                </div>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {agentsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  agents.map((agent) => (
                    <div key={agent.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`agent-${agent.id}`}
                        checked={selectedAgents.includes(agent.id)}
                        onCheckedChange={() => toggleAgent(agent.id)}
                      />
                      <Label
                        htmlFor={`agent-${agent.id}`}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {agent.vapiAssistant.name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={statusesOpen} onOpenChange={setStatusesOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 min-w-[140px]">
              Statuses ({selectedStatuses.length}/{ROUTING_STATUSES.length})
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Filter by Status</Label>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllStatuses}
                    className="h-7 text-xs"
                  >
                    All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={deselectAllStatuses}
                    className="h-7 text-xs"
                  >
                    None
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {ROUTING_STATUSES.map((status) => (
                  <div key={status.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${status.value}`}
                      checked={selectedStatuses.includes(status.value)}
                      onCheckedChange={() => toggleStatus(status.value)}
                    />
                    <Label
                      htmlFor={`status-${status.value}`}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      {status.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Metrics Cards - Compact Design */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {/* Total Calls */}
        <Card className="overflow-hidden border-l-4 border-l-slate-400">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <IconPhone className="h-4 w-4 text-slate-600 dark:text-slate-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-muted-foreground">Total Calls</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs">Total number of calls that came into your numbers</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-3xl font-bold tabular-nums tracking-tight">{totals.total}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Agent Handled Calls */}
        <Card className="overflow-hidden border-l-4 border-l-blue-600">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <IconRobot className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-muted-foreground">Agent Handled</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs">All calls handled by the agent (direct + pickups)</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-3xl font-bold tabular-nums tracking-tight">{totalAgentHandled}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {agentHandledPercentage}% of total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Saved Calls */}
        <Card className="overflow-hidden border-l-4 border-l-teal-600">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <IconRotateClockwise className="h-4 w-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-muted-foreground">Saved Calls</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs">Calls that would have been missed but were picked up by the agent</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-3xl font-bold tabular-nums tracking-tight">{agentPickups}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {savedCallsPercentage}% of total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart - Stacked Bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Calls Over Time</CardTitle>
        </CardHeader>
        <CardContent className="pb-4 px-2">
          {analyticsLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-[300px] text-destructive text-sm">
              Failed to load analytics data
            </div>
          ) : !analyticsData || analyticsData.groupedData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
              No data available for the selected filters
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart
                accessibilityLayer
                data={analyticsData.groupedData.map(d => {
                  const dataPoint: Record<string, string | number> = {
                    period: d.period,
                  }
                  
                  // Add only selected series
                  if (selectedChartSeries.includes('total')) {
                    dataPoint.total = d.total
                  }
                  if (selectedChartSeries.includes('agentDirect')) {
                    dataPoint.agentDirect = d.agent
                  }
                  if (selectedChartSeries.includes('teamAnswered')) {
                    dataPoint.teamAnswered = d.teamAnswered
                  }
                  if (selectedChartSeries.includes('agentSaves')) {
                    dataPoint.agentSaves = d.team - d.teamAnswered
                  }
                  
                  return dataPoint
                })}
                margin={{
                  left: 0,
                  right: 0,
                  top: 5,
                  bottom: 5,
                }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="period"
                  tickLine={false}
                  tickMargin={8}
                  axisLine={false}
                  tickFormatter={formatPeriodLabel}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <ChartTooltip 
                  content={
                    <ChartTooltipContent 
                      labelFormatter={(label) => {
                        // Format the period label with date/time
                        let date: Date
                        // Handle different period formats
                        if (timeGrouping === 'month') {
                          // Month format is YYYY-MM
                          date = new Date(label + '-01')
                        } else if (timeGrouping === 'day' || timeGrouping === 'week') {
                          // Day/week format is YYYY-MM-DD
                          date = new Date(label + 'T00:00:00Z')
                        } else {
                          // 15min/hour format is full ISO string
                          date = new Date(label)
                        }
                        
                        switch (timeGrouping) {
                          case '15min':
                            return date.toLocaleString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric',
                              hour: 'numeric', 
                              minute: '2-digit',
                              hour12: true
                            })
                          case 'hour':
                            return date.toLocaleString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric',
                              hour: 'numeric',
                              hour12: true
                            })
                          case 'day':
                            return date.toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })
                          case 'week':
                            return `Week of ${date.toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })}`
                          case 'month':
                            return date.toLocaleDateString('en-US', { 
                              month: 'short', 
                              year: 'numeric'
                            })
                          default:
                            return label
                        }
                      }}
                    />
                  } 
                />
                <ChartLegend content={<ChartLegendContent />} />
                {selectedChartSeries.includes('agentDirect') && (
                  <Bar
                    dataKey="agentDirect"
                    stackId={selectedChartSeries.length > 1 && !selectedChartSeries.includes('total') ? "a" : undefined}
                    fill="var(--color-agentDirect)"
                    radius={selectedChartSeries.length === 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                )}
                {selectedChartSeries.includes('teamAnswered') && (
                  <Bar
                    dataKey="teamAnswered"
                    stackId={selectedChartSeries.length > 1 && !selectedChartSeries.includes('total') ? "a" : undefined}
                    fill="var(--color-teamAnswered)"
                    radius={selectedChartSeries.length === 1 ? [4, 4, 0, 0] : selectedChartSeries.includes('agentSaves') ? [0, 0, 0, 0] : [0, 0, 4, 4]}
                  />
                )}
                {selectedChartSeries.includes('agentSaves') && (
                  <Bar
                    dataKey="agentSaves"
                    stackId={selectedChartSeries.length > 1 && !selectedChartSeries.includes('total') ? "a" : undefined}
                    fill="var(--color-agentSaves)"
                    radius={selectedChartSeries.length === 1 ? [4, 4, 0, 0] : [4, 4, 0, 0]}
                  />
                )}
                {selectedChartSeries.includes('total') && (
                  <Bar
                    dataKey="total"
                    stackId={undefined}
                    fill="var(--color-total)"
                    radius={selectedChartSeries.length === 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                )}
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

