/**
 * VAPI Call Control API Functions
 * 
 * These functions allow injecting messages and controlling live calls
 * using VAPI's Call Control API via the control URL.
 */

/**
 * Adds a message to the conversation history
 * @param controlUrl - The control URL from the call's monitor object
 * @param message - The message to add (role and content)
 * @param triggerResponse - Whether to trigger the assistant to respond (default: false)
 */
export async function addMessageToConversation(
  controlUrl: string,
  message: { role: 'system' | 'user' | 'assistant'; content: string },
  triggerResponse: boolean = false
): Promise<void> {
  try {
    const requestBody = {
      type: 'add-message',
      message,
      triggerResponseEnabled: triggerResponse,
    }
    
    console.log('📤 Call Control Request:')
    console.log(`   URL: ${controlUrl}`)
    console.log(`   Method: POST`)
    console.log(`   Body:`, JSON.stringify(requestBody, null, 2))
    
    const response = await fetch(controlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    console.log(`📥 Call Control Response:`)
    console.log(`   Status: ${response.status} ${response.statusText}`)
    console.log(`   Headers:`, JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2))

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Call Control API error response:`)
      console.error(`   Status: ${response.status} ${response.statusText}`)
      console.error(`   Response body: ${errorText}`)
      throw new Error(`Call Control API error: ${response.status} ${errorText}`)
    } else {
      const responseText = await response.text()
      console.log(`   Response body: ${responseText || '(empty)'}`)
    }
  } catch (error) {
    console.error('❌ Error adding message to conversation')
    console.error(`   Error type: ${error instanceof Error ? error.constructor.name : typeof error}`)
    console.error(`   Error message: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      console.error(`   Stack trace:`, error.stack)
    }
    console.error(`   Full error object:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    throw error
  }
}

/**
 * Makes the assistant say a specific message during the call
 * @param controlUrl - The control URL from the call's monitor object
 * @param content - The message content to say
 * @param endCallAfterSpoken - Whether to end the call after speaking (default: false)
 */
export async function sayMessage(
  controlUrl: string,
  content: string,
  endCallAfterSpoken: boolean = false
): Promise<void> {
  try {
    const requestBody = {
      type: 'say',
      content,
      endCallAfterSpoken,
    }
    
    console.log('📤 Call Control Request (say):')
    console.log(`   URL: ${controlUrl}`)
    console.log(`   Body:`, JSON.stringify(requestBody, null, 2))
    
    const response = await fetch(controlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    console.log(`📥 Call Control Response (say):`)
    console.log(`   Status: ${response.status} ${response.statusText}`)
    console.log(`   Headers:`, JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2))

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Call Control API error response:`)
      console.error(`   Status: ${response.status} ${response.statusText}`)
      console.error(`   Response body: ${errorText}`)
      throw new Error(`Call Control API error: ${response.status} ${errorText}`)
    } else {
      const responseText = await response.text()
      console.log(`   Response body: ${responseText || '(empty)'}`)
    }
  } catch (error) {
    console.error('❌ Error saying message')
    console.error(`   Error type: ${error instanceof Error ? error.constructor.name : typeof error}`)
    console.error(`   Error message: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      console.error(`   Stack trace:`, error.stack)
    }
    console.error(`   Full error object:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    throw error
  }
}

/**
 * Helper function to inject CRM data as system context
 * This adds context that the agent can reference during the conversation
 * @param controlUrl - The control URL from the call's monitor object
 * @param context - The context string to inject (e.g., CRM lookup results)
 */
export async function injectSystemContext(
  controlUrl: string,
  context: string
): Promise<void> {
  return addMessageToConversation(
    controlUrl,
    {
      role: 'system',
      content: context,
    },
    false // Don't trigger response, just add context
  )
}

