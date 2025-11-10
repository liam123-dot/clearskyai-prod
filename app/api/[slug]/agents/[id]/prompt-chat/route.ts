import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { getAgentById } from '@/lib/vapi/agents'
import { getAgentTools } from '@/lib/tools'
import { getAgentKnowledgeBases } from '@/lib/knowledge-bases'
import { generatePropertyQueryPrompt } from '@/lib/property-prompt'
import { generateToolLLMPrompt } from '@/lib/tools/llm-prompt'
import { convertToModelMessages, streamText } from 'ai'

interface RouteContext {
  params: Promise<{
    slug: string
    id: string
  }>
}


/**
 * POST /api/[slug]/agents/[id]/prompt-chat
 * Handle chat messages for prompt editing with AI assistance
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { slug, id: agentId } = await context.params
    
    // Verify user has access to this organization
    const { user, organizationId } = await getAuthSession(slug)

    if (!user || !organizationId) {
      return NextResponse.json(
        { error: 'Not authenticated or unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { messages }: { messages: any[] } = body

    // console.log('messages', JSON.stringify(messages, null, 2))

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'messages array is required' },
        { status: 400 }
      )
    }

    // Convert UIMessages to simple message format for streamText
    // Extract text content from message parts
    const modelMessages = messages
      .filter((msg) => {
        const hasText = msg.parts.some((part: { type: string; text?: string }) => part.type === 'text' && part.text?.trim())
        return hasText
      })
      .map((msg) => ({
        role: msg.role,
        content: msg.parts
          .filter((part: { type: string; text?: string }) => part.type === 'text')
          .map((part: { type: string; text?: string }) => part.type === 'text' ? part.text : '')
          .join(''),
      }))

    // Fetch agent details
    const agent = await getAgentById(agentId)
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Extract current system prompt
    const currentPrompt = agent.vapiAssistant.model?.messages?.find(
      (msg: any) => msg.role === 'system'
    )?.content || ''

    // Fetch tools (filter out preemptive-only tools like in prompt-editor-button.tsx)
    const allTools = await getAgentTools(agentId)
    const tools = allTools.filter(tool => {
      // Exclude query tools (handled as KBs) and preemptive-only tools
      if (tool.type === 'query') return false
      if (tool.attach_to_agent === false && tool.execute_on_call_start === true) {
        return false
      }
      return true
    })

    // Fetch knowledge bases
    const knowledgeBases = await getAgentKnowledgeBases(agentId)

    // Build context for AI - ALWAYS include tool and KB prompts
    const contextParts: string[] = []
    
    contextParts.push('=== CURRENT AGENT SYSTEM PROMPT ===')
    contextParts.push(currentPrompt || '(No system prompt set)')
    contextParts.push('')

    // Always include tool LLM prompts
    if (tools.length > 0) {
      contextParts.push('=== AVAILABLE TOOLS (LLM PROMPTS) ===')
      for (const tool of tools) {
        try {
          const toolPrompt = await generateToolLLMPrompt(tool)
          contextParts.push(toolPrompt)
          contextParts.push('')
        } catch (error) {
          console.error(`Error fetching tool prompt for ${tool.id}:`, error)
          // Fallback to basic format if fetch fails
          contextParts.push(`**${tool.name}**`)
          if (tool.description) {
            contextParts.push(tool.description)
          }
          contextParts.push('')
        }
      }
    }

    // Always include knowledge base prompts
    if (knowledgeBases.length > 0) {
      contextParts.push('=== KNOWLEDGE BASES (LLM PROMPTS) ===')
      for (const kb of knowledgeBases) {
        try {
          const { prompt } = await generatePropertyQueryPrompt(kb.id)
          contextParts.push(`# Knowledge Base: ${kb.name}`)
          contextParts.push('')
          contextParts.push('## Description')
          contextParts.push(prompt || 'No prompt available')
          contextParts.push('')
        } catch (error) {
          console.error(`Error fetching KB prompt for ${kb.id}:`, error)
          contextParts.push(`# Knowledge Base: ${kb.name}`)
          contextParts.push('No prompt available')
          contextParts.push('')
        }
      }
    }

    const contextBlock = contextParts.join('\n')

    // System prompt for the AI assistant
    const systemPrompt = `You are an expert AI assistant helping to design and edit voice agent system prompts.

CONTEXT:
${contextBlock}

IMPORTANT: The context above ALWAYS includes:
- The current agent's system prompt
- Full LLM prompts for all attached tools (including descriptions and parameters)
- Full LLM prompts for all attached knowledge bases

Your role is to help the user create or modify the agent's system prompt. When you suggest changes to the system prompt, you MUST wrap your suggestion in XML tags like this:

<prompt_update>
The complete new system prompt goes here...
</prompt_update>

=== VOICE AI PROMPTING GUIDE ===

This guide helps you write effective prompts for Voice AI assistants. Use these strategies to improve your agent's reliability, success rate, and user experience.

## Why prompt engineering matters

Prompt engineering is the art of crafting clear, actionable instructions for AI agents. Well-designed prompts:
- Guide the AI to produce accurate, relevant, and context-sensitive outputs
- Improve the agent's ability to handle requests without human intervention
- Increase your overall success rate

Poor prompts can lead to ambiguous or incorrect results, limiting the agent's utility.

## How to measure success

Your "success rate" is the percentage of requests your agent handles from start to finish without human intervention. The more complex your use case, the more you'll need to experiment and iterate on your prompt to improve this rate.

## The process

Follow a structured approach to prompt engineering:
1. Design: Craft your initial prompt, considering the specific task, context, and desired outcome
2. Test: Run the prompt through the AI and evaluate if the response aligns with expectations
3. Refine: Adjust the prompt based on test results, rewording or adding detail to avoid ambiguity
4. Repeat: Iterate on the process until the AI's output is accurate and relevant

## Principles of effective prompts

### Organize prompts into sections

Break down system prompts into clear sections, each focused on a specific aspect:
- **Identity:** Define the agent's persona and role
- **Style:** Set stylistic guidelines (conciseness, tone, humor)
- **Response guidelines:** Specify formatting, question limits, or structure
- **Task & goals:** Outline objectives and steps

### Break down complex tasks

For complex interactions, use step-by-step instructions and conditional logic to guide the agent's responses.

### Control response timing

Explicitly indicate when the agent should wait for the user's response before proceeding using <wait for user response>.

### Integrate tools and APIs

Specify when and how the agent should use external tools or APIs. Reference tools by their designated names and describe their functions.

### Silent transfers

If the AI determines that the user needs to be transferred, do not send any text response back to the user. Instead, silently call the appropriate tool for transferring the call. This ensures a seamless user experience and avoids confusion.

### Include fallback and error handling

Always include fallback options and error-handling mechanisms in your prompts. This ensures the agent can gracefully handle unexpected user inputs or system errors.

## Additional tips

- **Iterate as much as possible.** AI is driven by experimentation and iteration—refining prompts through trial and error will help you achieve more precise, relevant, and effective responses.
- **Use Markdown formatting:** Structure your content for clarity and easy scanning.
- **Emotional prompting:** Use expressive language to shape the AI's tone and create more engaging, relatable responses.
- **Add voice realism:** Incorporate natural speech elements like stuttering, hesitations, and pauses:
  - **Stuttering:** Use repeated letters or sounds (e.g., "I-I-I don't know")
  - **Hesitations:** Add fillers like "uh," "um," or "well" (e.g., "I was, uh, thinking about it")
  - **Pauses:** Use ellipses ("...") to indicate a pause (e.g., "I... I don't know how to say this")
  - **Emotional emphasis:** Use capital letters, exclamation marks, or ellipses to reflect tone

## Common issues

**Numbers sound robotic?**
- Spell out numbers in prompts for more natural-sounding speech.

**How to make assistants sound more human-like?**
- Add personality and tone to the assistant. For example:
  - Tone: conversational, spartan, use less corporate jargon
  - Act as a sales agent who is a human being and has real feelings.

## Example: Appointment setter prompt structure

A well-structured prompt includes:
- [Role]: Define who the agent is
- [Context]: Set the conversation context
- [Response Handling]: How to evaluate and proceed with responses
- [Warning]: Important constraints (e.g., don't modify user input)
- [Response Guidelines]: Formatting, tone, and behavior rules
- [Error Handling]: How to handle unclear responses or errors
- [Conversation Flow]: Step-by-step conversation logic with conditional branches
- [Call Closing]: How to end the call appropriately

Key practices from the example:
- Keep responses brief
- Ask one question at a time
- Present dates in clear format (e.g., "January Twenty Four")
- Present time in clear format (e.g., "Four Thirty PM")
- Speak dates gently using English words instead of numbers
- Never say the word 'function' nor 'tools' nor the name of available functions
- Never say "ending the call"
- If transferring, do not send any text response - simply trigger the tool silently

Guidelines:
- Ask clarifying questions to understand the user's needs
- Reference the available tools and knowledge bases when designing prompts - you have full access to their LLM prompts
- When suggesting a system prompt, always provide the COMPLETE prompt inside <prompt_update> tags
- Be concise and focused on the system prompt design
- Consider voice conversation context - these agents make phone calls
- Include relevant tool usage instructions in the prompt when appropriate
- Use the tool and knowledge base prompts to understand what capabilities are available
- Apply the principles from the prompting guide above when crafting prompts
- Structure prompts into clear sections (Identity, Style, Response Guidelines, Task, Error Handling)
- Include explicit wait points and conditional logic for complex flows
- Remember silent transfers - no text response when transferring calls

Remember: The user can apply your suggested prompt updates directly, so always provide complete, production-ready prompts.`

    console.log('systemPrompt', systemPrompt)
    // Generate AI response with streaming using Vercel AI Gateway
    const result = streamText({
      model: 'anthropic/claude-haiku-4.5',
      system: systemPrompt,
      messages: convertToModelMessages(messages),
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('Error in /api/[slug]/agents/[id]/prompt-chat POST:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

