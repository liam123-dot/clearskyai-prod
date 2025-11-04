import { PipedreamClient } from "@pipedream/sdk"

// Lazy singleton pattern - client is only created when first needed
let pipedreamClientInstance: PipedreamClient | null = null
let isInitialized = false

/**
 * Get or create the Pipedream client instance (singleton pattern)
 * This ensures the client is only created when actually needed and reused across requests
 */
export function getPipedreamClient(): PipedreamClient {
  if (!pipedreamClientInstance) {
    const projectEnvironment = (
      process.env.PIPEDREAM_ENVIRONMENT || 
      process.env.NEXT_PUBLIC_PIPEDREAM_ENVIRONMENT || 
      "development"
    ) as "development" | "production"
    
    // Only log once when actually creating the client
    if (!isInitialized) {
      console.log('Initializing Pipedream client:', projectEnvironment)
      isInitialized = true
    }
    
    pipedreamClientInstance = new PipedreamClient({
      projectEnvironment,
      clientId: process.env.PIPEDREAM_CLIENT_ID,
      clientSecret: process.env.PIPEDREAM_CLIENT_SECRET,
      projectId: process.env.PIPEDREAM_PROJECT_ID,
    })
  }
  
  return pipedreamClientInstance
}


/**
 * Check if Pipedream is properly configured
 */
export function isPipedreamConfigured(): boolean {
  return !!(
    process.env.PIPEDREAM_CLIENT_ID &&
    process.env.PIPEDREAM_CLIENT_SECRET &&
    process.env.PIPEDREAM_PROJECT_ID
  )
}

