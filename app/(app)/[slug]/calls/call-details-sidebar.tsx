'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { IconPlayerPlay, IconPlayerPause, IconPhone, IconClock, IconUser, IconRoute, IconTool, IconCheck } from "@tabler/icons-react"
import { 
  formatDuration, 
  getCallDuration, 
  getCallerNumber, 
  getCalledNumber, 
  getAssistantName,
  getRecordingUrl,
  getTranscript,
  getSummary,
  getEndedReason,
  getRoutingJourney,
  type Call,
  type VapiMessage
} from "@/lib/calls-helpers"
import { Vapi } from '@vapi-ai/server-sdk'
import { Pie, PieChart } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { RevenueData } from "@/app/api/admin/calls/[id]/revenue/route"
import { Skeleton } from "@/components/ui/skeleton"

interface CallDetailsSidebarProps {
  call: Call
  open: boolean
  onClose: () => void
  isAdmin?: boolean
}

export function CallDetailsSidebar({ call, open, onClose, isAdmin = false }: CallDetailsSidebarProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  const duration = getCallDuration(call.data)
  const callerNumber = getCallerNumber(call)
  const calledNumber = getCalledNumber(call)
  const assistantName = getAssistantName(call.data)
  const routingJourney = getRoutingJourney(call)
  const eventSequence = call.event_sequence || []
  const recordingUrl = getRecordingUrl(call.data)
  const summary = getSummary(call.data)
  const endedReason = getEndedReason(call.data)
  const callDate = new Date(call.created_at)
  const startedAt = call.data?.startedAt ? new Date(call.data.startedAt) : null
  const endedAt = call.data?.endedAt ? new Date(call.data.endedAt) : null

  // Process costs data for pie chart
  const costs = call.data?.costs || []
  const totalCost = costs.reduce((sum: number, item: any) => sum + (item.cost || 0), 0)
  const durationMinutes = duration / 60
  const costPerMinute = durationMinutes > 0 ? totalCost / durationMinutes : 0
  
  // Filter out zero-cost items and create chart data
  const costChartData = costs
    .filter((item: any) => item.cost > 0)
    .map((item: any, index: number) => ({
      type: item.type,
      cost: item.cost,
      fill: `var(--chart-${(index % 5) + 1})`,
    }))

  // Create chart config
  const costChartConfig = costs
    .filter((item: any) => item.cost > 0)
    .reduce((config: any, item: any, index: number) => {
      config[item.type] = {
        label: item.type.charAt(0).toUpperCase() + item.type.slice(1),
        color: `var(--chart-${(index % 5) + 1})`,
      }
      return config
    }, {
      cost: {
        label: "Cost",
      },
    } as ChartConfig)

  // Fetch revenue data for admin users
  const { data: revenueData, isLoading: revenueLoading } = useQuery<RevenueData>({
    queryKey: ['call-revenue', call.id],
    queryFn: async () => {
      const response = await fetch(`/api/admin/calls/${call.id}/revenue`)
      if (!response.ok) {
        throw new Error('Failed to fetch revenue data')
      }
      return response.json()
    },
    enabled: isAdmin && open,
  })

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  // Reset when sidebar closes
  useEffect(() => {
    if (!open && audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
      setCurrentTime(0)
    }
  }, [open])

  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-4">
        <SheetHeader className="space-y-1">
          <SheetTitle className="text-2xl">Call Details</SheetTitle>
          <SheetDescription className="text-base">
            {callDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {callDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-8 space-y-8">
          {/* Recording Player */}
          {recordingUrl && (
            <div className="space-y-3">
              <audio ref={audioRef} src={recordingUrl} preload="metadata" />
              <Button 
                onClick={togglePlayPause} 
                className="w-full"
                size="lg"
              >
                {isPlaying ? (
                  <>
                    <IconPlayerPause className="mr-2 size-5" />
                    Pause Recording
                  </>
                ) : (
                  <>
                    <IconPlayerPlay className="mr-2 size-5" />
                    Play Recording
                  </>
                )}
              </Button>
              {currentTime > 0 && (
                <div className="text-center text-sm text-muted-foreground font-mono">
                  {formatDuration(currentTime)} / {formatDuration(duration)}
                </div>
              )}
            </div>
          )}

          {/* Call Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Call Information</h3>
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <IconUser className="size-4" />
                  <span className="text-sm">Assistant</span>
                </div>
                <span className="font-medium">{assistantName}</span>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <IconPhone className="size-4" />
                  <span className="text-sm">Caller</span>
                </div>
                <span className="font-mono text-sm">{callerNumber}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <IconPhone className="size-4" />
                  <span className="text-sm">Called</span>
                </div>
                <span className="font-mono text-sm">{calledNumber}</span>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <IconClock className="size-4" />
                  <span className="text-sm">Duration</span>
                </div>
                <Badge variant="secondary" className="font-mono">{formatDuration(duration)}</Badge>
              </div>

              {startedAt && endedAt && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Started</span>
                    <span>{startedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Ended</span>
                    <span>{endedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                </>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Status</span>
                <Badge variant="outline" className="capitalize">
                  {endedReason.replace(/-/g, ' ')}
                </Badge>
              </div>
            </div>
          </div>

          {/* Call Routing Journey */}
          {eventSequence.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Call Journey</h3>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconRoute className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Routing</span>
                  </div>
                  <Badge variant={routingJourney.variant} className="font-normal">
                    {routingJourney.label}
                  </Badge>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground mb-2">Timeline</div>
                  {eventSequence.map((event, index) => {
                    const eventDate = new Date(event.timestamp)
                    const getEventLabel = (type: string) => {
                      switch (type) {
                        case 'incoming_call':
                          return 'Incoming Call'
                        case 'routing_to_team':
                          return 'Routing to Team'
                        case 'team_answered':
                          return 'Team Answered'
                        case 'team_call_completed':
                          return 'Team Call Completed'
                        case 'team_no_answer':
                          return 'Team No Answer'
                        case 'routing_to_agent':
                          return 'Routing to Agent'
                        case 'agent_call_completed':
                          return 'Agent Call Completed'
                        default:
                          return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                      }
                    }
                    
                    return (
                      <div key={index} className="flex items-start gap-3 text-sm">
                        <div className="flex flex-col items-center mt-0.5">
                          <div className={`size-2 rounded-full ${
                            event.type.includes('completed') || event.type === 'team_answered' 
                              ? 'bg-green-500' 
                              : event.type === 'team_no_answer'
                              ? 'bg-yellow-500'
                              : 'bg-blue-500'
                          }`} />
                          {index < eventSequence.length - 1 && (
                            <div className="w-px h-6 bg-border mt-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="font-medium">{getEventLabel(event.type)}</div>
                          <div className="text-muted-foreground text-xs">
                            {eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                          {event.details && Object.keys(event.details).length > 0 && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {event.type === 'routing_to_team' && (event.details.transfer_to_number as string | undefined) && (
                                <span>→ {event.details.transfer_to_number as string}</span>
                              )}
                              {event.type === 'team_no_answer' && (event.details.dial_status as string | undefined) && (
                                <span>Status: {event.details.dial_status as string}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Revenue - Admin Only */}
          {isAdmin && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Revenue</h3>
              {revenueLoading ? (
                <Card>
                  <CardContent className="pt-6">
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ) : revenueData && revenueData.hasActiveSubscription ? (
                <Card>
                  <CardContent className="pt-4 pb-4 space-y-3">
                    {revenueData.includedMinutesRate && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Included ({revenueData.includedMinutesRate.ratePerMinuteFormatted}/min)</span>
                          <Badge 
                            variant={revenueData.includedMinutesRate.marginCents >= 0 ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {revenueData.includedMinutesRate.marginPercentage >= 0 ? '+' : ''}
                            {revenueData.includedMinutesRate.marginPercentage.toFixed(1)}%
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Revenue:</span>
                          <span className="font-mono">{revenueData.includedMinutesRate.revenueFormatted}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Cost:</span>
                          <span className="font-mono">£{revenueData.totalCost.toFixed(4)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Margin:</span>
                          <span className={`font-mono font-semibold ${
                            revenueData.includedMinutesRate.marginCents >= 0 
                              ? 'text-green-600' 
                              : 'text-red-600'
                          }`}>
                            {revenueData.includedMinutesRate.marginFormatted}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {revenueData.includedMinutesRate && revenueData.overageRate && (
                      <Separator />
                    )}
                    
                    {revenueData.overageRate && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Overage ({revenueData.overageRate.pricePerMinuteFormatted}/min)</span>
                          <Badge 
                            variant={revenueData.overageRate.marginCents >= 0 ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {revenueData.overageRate.marginPercentage >= 0 ? '+' : ''}
                            {revenueData.overageRate.marginPercentage.toFixed(1)}%
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Revenue:</span>
                          <span className="font-mono">{revenueData.overageRate.revenueFormatted}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Cost:</span>
                          <span className="font-mono">£{revenueData.totalCost.toFixed(4)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Margin:</span>
                          <span className={`font-mono font-semibold ${
                            revenueData.overageRate.marginCents >= 0 
                              ? 'text-green-600' 
                              : 'text-red-600'
                          }`}>
                            {revenueData.overageRate.marginFormatted}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {!revenueData.includedMinutesRate && !revenueData.overageRate && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        No usage-based pricing found for this organization
                      </p>
                    )}
                  </CardContent>
                </Card>
              ) : revenueData && !revenueData.hasActiveSubscription ? (
                <Card>
                  <CardContent className="pt-6 pb-6">
                    <p className="text-sm text-muted-foreground text-center">
                      No active subscription found for this organization
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          )}

          {/* Cost Breakdown - Admin Only */}
          {isAdmin && costChartData.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Cost Breakdown</h3>
              <Card className="flex flex-col">
                <CardHeader className="items-center pb-0">
                  <CardTitle>Total Cost: ${totalCost.toFixed(4)}</CardTitle>
                  <CardDescription>Cost by component</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-0">
                  <ChartContainer
                    config={costChartConfig}
                    className="mx-auto aspect-square max-h-[250px]"
                  >
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <Pie 
                        data={costChartData} 
                        dataKey="cost" 
                        nameKey="type"
                        label={(entry) => `$${entry.cost.toFixed(4)}`}
                      />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
                <CardFooter className="flex-col gap-2 text-sm pt-4">
                  <div className="grid grid-cols-2 gap-2 w-full text-sm">
                    {costs
                      .filter((item: any) => item.cost > 0)
                      .map((item: any) => (
                        <div key={item.type} className="flex justify-between">
                          <span className="text-muted-foreground capitalize">{item.type}:</span>
                          <span className="font-mono">${item.cost.toFixed(4)}</span>
                        </div>
                      ))}
                  </div>
                  {durationMinutes > 0 && (
                    <>
                      <Separator className="my-2" />
                      <div className="space-y-2">
                        <div className="flex justify-between items-center font-semibold">
                          <span>Cost per Minute</span>
                          <span className="font-mono text-lg">${costPerMinute.toFixed(4)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {costs
                            .filter((item: any) => item.cost > 0)
                            .map((item: any) => {
                              const costPerMin = durationMinutes > 0 ? item.cost / durationMinutes : 0
                              return (
                                <div key={`${item.type}-per-min`} className="flex justify-between">
                                  <span className="text-muted-foreground capitalize">{item.type}:</span>
                                  <span className="font-mono">${costPerMin.toFixed(4)}/min</span>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    </>
                  )}
                </CardFooter>
              </Card>
            </div>
          )}

          {/* Summary */}
          {summary && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Summary</h3>
              <p className="text-sm leading-relaxed bg-muted/50 rounded-lg p-4">{summary}</p>
            </div>
          )}

          {/* Conversation */}
          {call.data?.artifact?.messages && call.data.artifact.messages.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Conversation</h3>
              <div className="space-y-3">
                {call.data.artifact.messages.map((msg: VapiMessage, index: number) => {
                  if (msg.role === 'system') return null
                  
                  const isBot = msg.role === 'bot'
                  const isToolCalls = msg.role === 'tool_calls'
                  const isToolResult = msg.role === 'tool_call_result'
                  
                  // Handle tool calls
                  if (isToolCalls && 'toolCalls' in msg && Array.isArray(msg.toolCalls)) {
                    return (
                      <div key={index} className="rounded-lg p-4 bg-muted/50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <IconTool className="size-4 text-muted-foreground" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                              Tool Call
                            </span>
                          </div>
                          {msg.secondsFromStart !== undefined && (
                            <span className="text-muted-foreground text-xs font-mono">
                              {formatDuration(msg.secondsFromStart)}
                            </span>
                          )}
                        </div>
                        <div className="space-y-2">
                          {msg.toolCalls.map((toolCall: any, toolIndex: number) => {
                            let args = {}
                            try {
                              args = typeof toolCall.function?.arguments === 'string' 
                                ? JSON.parse(toolCall.function.arguments)
                                : toolCall.function?.arguments || {}
                            } catch {
                              args = {}
                            }
                            
                            return (
                              <div key={toolIndex} className="bg-background rounded p-3 border border-border">
                                <div className="font-medium text-sm mb-2 text-foreground">
                                  {toolCall.function?.name || 'Unknown Tool'}
                                </div>
                                {Object.keys(args).length > 0 && (
                                  <div className="text-xs text-muted-foreground space-y-1">
                                    {Object.entries(args).map(([key, value]) => (
                                      <div key={key} className="flex gap-2">
                                        <span className="font-medium">{key}:</span>
                                        <span className="font-mono">
                                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  }
                  
                  // Handle tool call results
                  if (isToolResult && 'result' in msg) {
                    let resultData: any = null
                    let resultSummary = ''
                    
                    try {
                      resultData = typeof msg.result === 'string' ? JSON.parse(msg.result) : msg.result
                      
                      // Extract meaningful summary based on result structure
                      if (resultData?.properties && Array.isArray(resultData.properties)) {
                        const count = resultData.totalCount || resultData.properties.length
                        resultSummary = `Found ${count} ${count === 1 ? 'property' : 'properties'}`
                      } else if (resultData?.success !== undefined) {
                        resultSummary = resultData.success ? 'Success' : 'Failed'
                      } else if (typeof resultData === 'object' && Object.keys(resultData).length > 0) {
                        resultSummary = 'Result received'
                      } else {
                        resultSummary = 'Completed'
                      }
                    } catch {
                      resultSummary = typeof msg.result === 'string' && msg.result.length < 100 
                        ? msg.result 
                        : 'Result received'
                    }
                    
                    return (
                      <div key={index} className="rounded-lg p-4 bg-muted/50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <IconCheck className="size-4 text-muted-foreground" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                              {('name' in msg && msg.name) ? `Tool: ${msg.name}` : 'Tool Result'}
                            </span>
                          </div>
                          {msg.secondsFromStart !== undefined && (
                            <span className="text-muted-foreground text-xs font-mono">
                              {formatDuration(msg.secondsFromStart)}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-foreground mb-2 font-medium">
                          {resultSummary}
                        </div>
                        {resultData && resultData.properties && Array.isArray(resultData.properties) && resultData.properties.length > 0 && (
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            {resultData.properties.slice(0, 3).map((prop: any, propIndex: number) => {
                              const location = prop.full_address || prop.location || prop.city || ''
                              return (
                                <div key={propIndex} className="bg-background rounded p-2 border border-border">
                                  {prop.title && <div className="font-medium text-foreground mb-1">{prop.title}</div>}
                                  <div className="flex flex-wrap gap-3 text-xs">
                                    {prop.beds && <span>{prop.beds} bed{prop.beds !== 1 ? 's' : ''}</span>}
                                    {prop.price && <span>£{prop.price.toLocaleString()}{prop.transaction_type === 'rent' ? '/mo' : ''}</span>}
                                    {location && <span>{location}</span>}
                                  </div>
                                </div>
                              )
                            })}
                            {resultData.properties.length > 3 && (
                              <div className="text-xs text-muted-foreground italic">
                                +{resultData.properties.length - 3} more
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  }
                  
                  // Handle regular messages
                  const messageContent = 'message' in msg ? msg.message : 'Unknown message type'

                  return (
                    <div 
                      key={index} 
                      className={`rounded-lg p-4 ${
                        isBot 
                          ? 'bg-primary/5 border border-primary/10' 
                          : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-semibold uppercase tracking-wider ${
                          isBot ? 'text-primary' : 'text-foreground'
                        }`}>
                          {isBot ? 'Assistant' : 'User'}
                        </span>
                        {msg.secondsFromStart !== undefined && (
                          <span className="text-muted-foreground text-xs font-mono">
                            {formatDuration(msg.secondsFromStart)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed">{messageContent}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

