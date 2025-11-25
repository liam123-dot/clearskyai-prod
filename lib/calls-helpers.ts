// Helper functions to extract data from call objects
// These are client-safe and don't use any server-side code

import { Vapi } from "@vapi-ai/server-sdk"
import { 
  getCallDurationVapi, 
  getCallerNumberVapi, 
  getCalledNumberVapi,
  getAssistantNameVapi,
  getRecordingUrlVapi,
  getSummaryVapi,
  getEndedReasonVapi,
  getTranscriptVapi,
  getTranscriptTextVapi,
  type VapiMessage as VapiMessageType
} from "@/lib/vapi/calls"
import {
  getCallDurationElevenLabs,
  getCallerNumberElevenLabs,
  getCalledNumberElevenLabs,
  getAssistantNameElevenLabs,
  getRecordingUrlElevenLabs,
  getSummaryElevenLabs,
  getEndedReasonElevenLabs,
  getTranscriptElevenLabs,
  getTranscriptTextElevenLabs
} from "@/lib/elevenlabs/calls"

export interface Call {
  id: string
  organization_id: string
  agent_id: string
  phone_number_id?: string | null
  call_sid?: string | null
  caller_number?: string | null
  called_number?: string | null
  routing_status?: string | null
  provider?: string
  event_sequence?: Array<{
    type: string
    timestamp: string
    details: Record<string, unknown>
  }>
  created_at: string
  data: any // Can be Vapi or ElevenLabs data
}

export type VapiMessage = VapiMessageType;

export interface CallAnnotation {
  id: string
  call_id: string
  organization_id: string
  created_by_admin: boolean
  annotation_level: 'call' | 'transcript_item'
  transcript_item_index: number | null
  issue_category: string
  note: string
  created_at: string
  updated_at: string
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Check if a call is from ElevenLabs
 */
export function isElevenLabsCall(call: Call): boolean {
  return call.provider === 'elevenlabs'
}

/**
 * Get call duration - dispatches to provider-specific implementation
 */
export function getCallDuration(callData: any, provider?: string): number {
  if (provider === 'elevenlabs') {
    return getCallDurationElevenLabs(callData)
  }
  return getCallDurationVapi(callData)
}

/**
 * Get caller number - dispatches to provider-specific implementation
 */
export function getCallerNumber(call: Call): string {
  // Prefer stored caller_number, fallback to extracting from data
  if (call.caller_number) {
    return call.caller_number
  }
  
  if (isElevenLabsCall(call)) {
    return getCallerNumberElevenLabs(call.data)
  }
  return getCallerNumberVapi(call.data)
}

/**
 * Get called number - dispatches to provider-specific implementation
 */
export function getCalledNumber(call: Call): string {
  // Prefer stored called_number, fallback to extracting from data
  if (call.called_number) {
    return call.called_number
  }
  
  if (isElevenLabsCall(call)) {
    return getCalledNumberElevenLabs(call.data)
  }
  return getCalledNumberVapi(call.data)
}

/**
 * Get assistant name - dispatches to provider-specific implementation
 */
export function getAssistantName(callData: any, provider?: string): string {
  if (provider === 'elevenlabs') {
    return getAssistantNameElevenLabs(callData)
  }
  return getAssistantNameVapi(callData)
}

/**
 * Get recording URL - dispatches to provider-specific implementation
 */
export function getRecordingUrl(callData: any, provider?: string): string | null {
  if (provider === 'elevenlabs') {
    return getRecordingUrlElevenLabs(callData)
  }
  return getRecordingUrlVapi(callData)
}

/**
 * Get transcript as plain text - dispatches to provider-specific implementation
 */
export function getTranscript(callData: any, provider?: string): string {
  if (provider === 'elevenlabs') {
    return getTranscriptTextElevenLabs(callData)
  }
  return getTranscriptTextVapi(callData)
}

/**
 * Get summary - dispatches to provider-specific implementation
 */
export function getSummary(callData: any, provider?: string): string {
  if (provider === 'elevenlabs') {
    return getSummaryElevenLabs(callData)
  }
  return getSummaryVapi(callData)
}

/**
 * Get ended reason - dispatches to provider-specific implementation
 */
export function getEndedReason(callData: any, provider?: string): string {
  if (provider === 'elevenlabs') {
    return getEndedReasonElevenLabs(callData)
  }
  return getEndedReasonVapi(callData)
}

export function getRoutingJourney(call: Call): {
  label: string
  variant: 'default' | 'secondary' | 'outline' | 'destructive'
  description: string
} {
  const routingStatus = call.routing_status
  const eventSequence = call.event_sequence || []
  
  // Check if call went to team first
  const wentToTeam = eventSequence.some(e => e.type === 'routing_to_team')
  const teamAnswered = eventSequence.some(e => e.type === 'team_answered' || e.type === 'team_call_completed')
  const teamNoAnswer = eventSequence.some(e => e.type === 'team_no_answer')
  
  if (wentToTeam && teamAnswered) {
    return {
      label: 'Team Answered',
      variant: 'default',
      description: 'Call was answered by team'
    }
  }
  
  if (wentToTeam && teamNoAnswer) {
    return {
      label: 'Agent Save',
      variant: 'secondary',
      description: 'Team did not answer, routed to agent'
    }
  }
  
  if (wentToTeam) {
    return {
      label: 'Routed to Team',
      variant: 'secondary',
      description: 'Call routed to team number'
    }
  }
  
  // Direct to agent
  return {
    label: 'Direct to Agent',
    variant: 'outline',
    description: 'Call went directly to agent'
  }
}

export function getRoutingJourneyIcon(call: Call): string {
  const eventSequence = call.event_sequence || []
  const wentToTeam = eventSequence.some(e => e.type === 'routing_to_team')
  const teamAnswered = eventSequence.some(e => e.type === 'team_answered' || e.type === 'team_call_completed')
  const teamNoAnswer = eventSequence.some(e => e.type === 'team_no_answer')
  
  if (wentToTeam && teamAnswered) {
    return '✓'
  }
  
  if (wentToTeam && teamNoAnswer) {
    return '→'
  }
  
  return ''
}

export function getWentToTeam(call: Call): boolean {
  const eventSequence = call.event_sequence || []
  return eventSequence.some(e => e.type === 'routing_to_team') || 
         call.routing_status === 'transferred_to_team' || 
         call.routing_status === 'team_no_answer'
}

export function getTeamAnswered(call: Call): boolean {
  const eventSequence = call.event_sequence || []
  return eventSequence.some(e => e.type === 'team_answered' || e.type === 'team_call_completed')
}

export function getCallType(call: Call): string | null {
  const callData = call.data as any
  return callData?.call?.type || null
}

export function isWebCall(call: Call): boolean {
  return getCallType(call) === 'webCall'
}

// Annotation helpers
// Note: These require annotation data to be passed separately since it's not part of the Call object
export function hasAnnotations(annotationsCount: number): boolean {
  return annotationsCount > 0
}

export function getAnnotationCount(annotations: CallAnnotation[]): number {
  return annotations.length
}

export function getCallLevelAnnotation(annotations: CallAnnotation[]): CallAnnotation | null {
  return annotations.find(a => a.annotation_level === 'call') || null
}

export function getTranscriptAnnotations(annotations: CallAnnotation[]): CallAnnotation[] {
  return annotations.filter(a => a.annotation_level === 'transcript_item')
}

export function getAnnotationForTranscriptItem(annotations: CallAnnotation[], index: number): CallAnnotation | null {
  return annotations.find(a => a.annotation_level === 'transcript_item' && a.transcript_item_index === index) || null
}

