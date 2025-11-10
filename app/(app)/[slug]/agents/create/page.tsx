import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateAgentForm } from '@/components/agents/create-agent-form'
import { getAuthSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

interface CreateAgentPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: CreateAgentPageProps): Promise<Metadata> {
  return {
    title: 'Create Agent',
  }
}

export default async function CreateAgentPage({ params }: CreateAgentPageProps) {
  const { slug } = await params

  // Check if user is admin
  const { isAdmin } = await getAuthSession(slug)
  if (!isAdmin) {
    redirect(`/${slug}/agents`)
  }

  // Get organization ID from slug
  const supabase = await createServiceClient()
  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .select('id, name, slug')
    .eq('slug', slug)
    .single()

  if (orgError || !org) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Organization not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Agent</CardTitle>
          <CardDescription>
            Create a new VAPI agent for {org.name}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateAgentForm lockedOrganizationId={org.id} lockedOrganizationName={org.name} />
        </CardContent>
      </Card>
    </div>
  )
}

