import { streamText, generateText } from 'ai'

/**
 * UI Message format used by the chat interface
 */
export interface UIMessage {
  role: 'user' | 'assistant' | 'system'
  parts: Array<{ type: string; text?: string }>
}

/**
 * Options for AI text generation
 */
export interface AIGenerateOptions {
  /** Model identifier (e.g., 'anthropic/claude-haiku-4.5') */
  model: string
  /** System prompt */
  system?: string
  /** Messages in UI format with parts */
  messages: UIMessage[]
  /** Whether to stream the response (default: false) */
  stream?: boolean
}

/**
 * Converts UI messages to model messages format (CoreMessage[])
 * Filters out messages without text content and extracts text from parts
 */
function convertUIMessagesToModelMessages(messages: UIMessage[]) {
  // Filter messages that have text content
  const filteredMessages = messages.filter((msg) => {
    const hasText = msg.parts.some(
      (part: { type: string; text?: string }) =>
        part.type === 'text' && part.text?.trim()
    )
    return hasText
  })

  // Convert to CoreMessage format: { role: string, content: string }[]
  return filteredMessages.map((msg) => ({
    role: msg.role,
    content: msg.parts
      .filter((part: { type: string; text?: string }) => part.type === 'text')
      .map((part: { type: string; text?: string }) =>
        part.type === 'text' ? part.text : ''
      )
      .join(''),
  }))
}

/**
 * Generates AI text using Vercel AI SDK
 * Supports both streaming and non-streaming modes
 *
 * @param options - Generation options including model, system prompt, messages, and stream flag
 * @returns Response (streaming) if stream=true, otherwise { text: string }
 */
export async function generateAIText(
  options: AIGenerateOptions
): Promise<Response | { text: string }> {
  const { model, system, messages, stream = false } = options

  // Convert UI messages to model messages format
  const modelMessages = convertUIMessagesToModelMessages(messages)

  if (stream) {
    // Streaming mode: use streamText
    const result = streamText({
      model,
      system,
      messages: modelMessages,
    })

    return result.toUIMessageStreamResponse()
  } else {
    // Non-streaming mode: use generateText
    const result = await generateText({
      model,
      system,
      messages: modelMessages,
    })

    return { text: result.text }
  }
}

