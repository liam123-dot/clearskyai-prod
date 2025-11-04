import { PipedreamClient } from "@pipedream/sdk"

// Validate environment variables
if (!process.env.PIPEDREAM_CLIENT_ID) {
  console.warn('Missing PIPEDREAM_CLIENT_ID environment variable')
}

if (!process.env.PIPEDREAM_CLIENT_SECRET) {
  console.warn('Missing PIPEDREAM_CLIENT_SECRET environment variable')
}

if (!process.env.PIPEDREAM_PROJECT_ID) {
  console.warn('Missing PIPEDREAM_PROJECT_ID environment variable')
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

export const pipedreamClient = new PipedreamClient({
  projectEnvironment,
  clientId: process.env.PIPEDREAM_CLIENT_ID,
  clientSecret: process.env.PIPEDREAM_CLIENT_SECRET,
  projectId: process.env.PIPEDREAM_PROJECT_ID,
})

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

