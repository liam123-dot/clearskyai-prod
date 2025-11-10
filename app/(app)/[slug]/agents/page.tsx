import { getAgentsByOrganization, type AssignedAgent } from "@/lib/vapi/agents"
import { createServiceClient } from "@/lib/supabase/server"
import { getAuthSession } from "@/lib/auth"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Button } from "@/components/ui/button"
import { IconRobot, IconPlus } from "@tabler/icons-react"
import { AgentsTable } from "@/components/agents/agents-table"
import Link from "next/link"
import type { Metadata } from "next"

interface AgentsPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: AgentsPageProps): Promise<Metadata> {
  return {
    title: "Agents",
  }
}

export default async function AgentsPage({ params }: AgentsPageProps) {
  const { slug } = await params

  // Check if user is admin
  const { isAdmin } = await getAuthSession(slug)

  // Get organization ID from slug
  const supabase = await createServiceClient()
  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .select('id, slug')
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

  // Get agents for this organization
  let agents: AssignedAgent[] = []
  let error: string | null = null
  
  try {
    agents = await getAgentsByOrganization(org.id)
  } catch (e) {
    console.error('Error fetching agents:', e)
    error = e instanceof Error ? e.message : 'Failed to load agents'
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="space-y-6">
        {isAdmin && (
          <div className="flex justify-end">
            <Button asChild>
              <Link href={`/${slug}/agents/create`}>
                <IconPlus className="mr-2 size-4" />
                Create Agent
              </Link>
            </Button>
          </div>
        )}
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconRobot />
            </EmptyMedia>
            <EmptyTitle>No Agents</EmptyTitle>
            <EmptyDescription>
              No agents have been assigned to your organization yet.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {agents.length} {agents.length === 1 ? 'agent' : 'agents'} available
        </p>
        {isAdmin && (
          <Button asChild>
            <Link href={`/${slug}/agents/create`}>
              <IconPlus className="mr-2 size-4" />
              Create Agent
            </Link>
          </Button>
        )}
      </div>
      <div className="space-y-4">
        <AgentsTable agents={agents} slug={slug} />
      </div>
    </div>
  )
}