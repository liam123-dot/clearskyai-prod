import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getOrganizations } from '@/lib/organizations'
import { CreateAgentForm } from '@/components/agents/create-agent-form'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create Agent',
}

export default async function CreateAgentPage() {
  let organizations: Awaited<ReturnType<typeof getOrganizations>> = []
  let error: string | null = null

  try {
    organizations = await getOrganizations()
  } catch (e) {
    console.error('Error fetching organizations:', e)
    error = e instanceof Error ? e.message : 'Failed to load organizations'
  }

  if (error) {
    return (
      <div className="px-4 lg:px-6">
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 lg:px-6">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Create Agent</CardTitle>
            <CardDescription>
              Create a new VAPI agent for an organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateAgentForm organizations={organizations} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}