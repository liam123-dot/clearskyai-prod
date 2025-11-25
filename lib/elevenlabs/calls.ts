// ElevenLabs-specific call data extraction functions

import { GetConversationResponseModel } from "@elevenlabs/elevenlabs-js/api"

// Voice cost per million characters (default: $118.8 per million for ElevenLabs Flash v2.5)
// Can be overridden via environment variable VOICE_COST_PER_MILLION_CHARACTERS
const VOICE_COST_PER_MILLION_CHARACTERS = parseFloat(
    process.env.VOICE_COST_PER_MILLION_CHARACTERS || "118.8"
);

/**
 * Extract call duration from ElevenLabs conversation data
 */
export function getCallDurationElevenLabs(callData: any): number {
  return callData?.metadata?.callDurationSecs || 0
}

/**
 * Extract caller number from ElevenLabs conversation data
 * ElevenLabs calls can be web-based or phone calls
 */
export function getCallerNumberElevenLabs(callData: any): string {
  // Check for phone call metadata first
  if (callData?.metadata?.phoneCall?.externalNumber) {
    return callData.metadata.phoneCall.externalNumber
  }
  
  // Check if there's a userId or other identifier
  if (callData?.userId) {
    return `User: ${callData.userId}`
  }
  
  return 'Web Call'
}

/**
 * Extract called number from ElevenLabs conversation data
 * This will be the agent number for phone calls, or agent name for web calls
 */
export function getCalledNumberElevenLabs(callData: any): string {
  // Check for phone call metadata
  if (callData?.metadata?.phoneCall?.agentNumber) {
    return callData.metadata.phoneCall.agentNumber
  }
  
  return 'ElevenLabs Agent'
}

/**
 * Extract assistant name from ElevenLabs conversation data
 * The agent name should be stored in callData.agentName by the webhook
 */
export function getAssistantNameElevenLabs(callData: any): string {
  // Use stored agentName (set by webhook), fallback to agentId if not available
  return callData?.agentName || callData?.agentId || 'ElevenLabs Agent'
}

/**
 * Extract recording URL from ElevenLabs conversation data
 */
export function getRecordingUrlElevenLabs(callData: any): string | null {
  // Check if there's an audio URL in the response
  // ElevenLabs may store audio differently, check metadata or other fields
  return callData?.recording_url || callData?.audio_url || null
}

/**
 * Extract summary from ElevenLabs conversation data
 */
export function getSummaryElevenLabs(callData: any): string {
  return callData?.analysis?.transcriptSummary || ''
}

/**
 * Extract ended reason from ElevenLabs conversation data
 */
export function getEndedReasonElevenLabs(callData: any): string {
  return callData?.status || 'Unknown'
}

/**
 * Extract transcript from ElevenLabs conversation data
 * Returns array of transcript items
 */
export function getTranscriptElevenLabs(callData: any): any[] {
  return callData?.transcript || []
}

/**
 * Get transcript as plain text from ElevenLabs conversation data
 */
export function getTranscriptTextElevenLabs(callData: any): string {
  const transcript = callData?.transcript || []
  
  if (Array.isArray(transcript)) {
    return transcript
      .map((item: any) => {
        const role = item.output_role || item.role || 'unknown'
        const message = item.message || item.text || ''
        return `${role}: ${message}`
      })
      .join('\n')
  }
  
  return ''
}

/**
 * Calculate cost in USD from ElevenLabs credits
 * Credits are stored in metadata.cost
 * Conversion: (credits / 1,000,000) * VOICE_COST_PER_MILLION_CHARACTERS
 */
export function calculateElevenLabsCost(callData: any): number {
  const credits = callData?.metadata?.cost
  
  if (!credits || credits === 0) {
    return 0
  }
  
  // Convert credits to USD using the cost per million characters
  const costUSD = (credits / 1_000_000) * VOICE_COST_PER_MILLION_CHARACTERS
  
  return costUSD
}

