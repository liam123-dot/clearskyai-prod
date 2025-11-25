// Vapi-specific call data extraction functions

import { Vapi } from "@vapi-ai/server-sdk"

export type VapiMessage = Vapi.Artifact.Messages.Item;

/**
 * Extract call duration from Vapi call data
 */
export function getCallDurationVapi(callData: any): number {
  return callData?.durationSeconds || callData?.call?.duration || 0
}

/**
 * Extract caller number from Vapi call data
 */
export function getCallerNumberVapi(callData: any): string {
  return callData?.customer?.number || callData?.call?.customer?.number || 'Unknown'
}

/**
 * Extract called number from Vapi call data
 */
export function getCalledNumberVapi(callData: any): string {
  return callData?.phoneNumber?.number || callData?.call?.phoneNumber?.number || 'Unknown'
}

/**
 * Extract assistant name from Vapi call data
 */
export function getAssistantNameVapi(callData: any): string {
  return callData?.assistant?.name || 'Unknown Assistant'
}

/**
 * Extract recording URL from Vapi call data
 */
export function getRecordingUrlVapi(callData: any): string | null {
  return callData?.recordingUrl || callData?.stereoRecordingUrl || null
}

/**
 * Extract summary from Vapi call data
 */
export function getSummaryVapi(callData: any): string {
  return callData?.summary || callData?.analysis?.summary || ''
}

/**
 * Extract ended reason from Vapi call data
 */
export function getEndedReasonVapi(callData: any): string {
  return callData?.endedReason || callData?.call?.status || 'Unknown'
}

/**
 * Extract transcript from Vapi call data
 */
export function getTranscriptVapi(callData: any): VapiMessage[] {
  return callData?.artifact?.messages || []
}

/**
 * Get transcript as plain text from Vapi call data
 */
export function getTranscriptTextVapi(callData: any): string {
  return callData?.transcript || callData?.artifact?.transcript || ''
}

