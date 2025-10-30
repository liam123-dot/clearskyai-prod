import { getAuthSession } from '@/lib/auth'
import { getOrganizations } from '@/lib/organizations'
import { CallsAnalytics } from '@/components/calls/calls-analytics'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Dashboard",
}

export default async function AdminPage() {
  const { user } = await getAuthSession()

  // Fetch organizations for admin analytics
  let organizations: Awaited<ReturnType<typeof getOrganizations>> = []
  let organizationsError: string | null = null

  try {
    organizations = await getOrganizations()
  } catch (e) {
    console.error('Error fetching organizations:', e)
    organizationsError = e instanceof Error ? e.message : 'Failed to load organizations'
  }

  // User is authenticated and is an admin (checked in layout)
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
          <div>
            <h2 className="text-2xl font-bold">Admin Dashboard</h2>
            <p className="text-muted-foreground">Welcome, {user?.email}</p>
            <p className="text-sm text-muted-foreground">You have admin access</p>
          </div>
          {organizationsError ? (
            <div className="text-sm text-destructive">{organizationsError}</div>
          ) : (
            <CallsAnalytics isAdmin={true} organizations={organizations} />
          )}
        </div>
      </div>
    </div>
  )
}