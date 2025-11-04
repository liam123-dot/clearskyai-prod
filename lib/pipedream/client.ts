import { PipedreamClient } from "@pipedream/sdk"

// Cached client instance
let pipedreamClientInstance: PipedreamClient | null = null

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

/**
 * Get or create the Pipedream client instance (lazy initialization)
 * Only creates the client when accessed at runtime, not at build time
 * 
 * @throws Error if Pipedream is not properly configured
 */
function getPipedreamClient(): PipedreamClient {
  // Return cached instance if already initialized
  if (pipedreamClientInstance) {
    return pipedreamClientInstance
  }

  // Validate environment variables before creating client
  if (!isPipedreamConfigured()) {
    throw new Error(
      'Pipedream client cannot be initialized: Missing required environment variables (PIPEDREAM_CLIENT_ID, PIPEDREAM_CLIENT_SECRET, PIPEDREAM_PROJECT_ID)'
    )
  }

  // Initialize the Pipedream client
  const projectEnvironment = (process.env.PIPEDREAM_ENVIRONMENT || process.env.NEXT_PUBLIC_PIPEDREAM_ENVIRONMENT || "development") as "development" | "production"

  console.log('Initializing Pipedream client with:', {
    environment: projectEnvironment,
    hasClientId: !!process.env.PIPEDREAM_CLIENT_ID,
    hasClientSecret: !!process.env.PIPEDREAM_CLIENT_SECRET,
    hasProjectId: !!process.env.PIPEDREAM_PROJECT_ID,
    projectIdPreview: process.env.PIPEDREAM_PROJECT_ID?.substring(0, 10) + '...',
  })

  pipedreamClientInstance = new PipedreamClient({
    projectEnvironment,
    clientId: process.env.PIPEDREAM_CLIENT_ID,
    clientSecret: process.env.PIPEDREAM_CLIENT_SECRET,
    projectId: process.env.PIPEDREAM_PROJECT_ID,
  })

  return pipedreamClientInstance
}

/**
 * Export pipedreamClient as a getter for backward compatibility
 * This allows existing code to use pipedreamClient directly without changes
 */
export const pipedreamClient = new Proxy({} as PipedreamClient, {
  get(_target, prop) {
    const client = getPipedreamClient()
    const value = (client as any)[prop]
    // If it's a function, bind it to the client instance
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  }
}) as PipedreamClient

