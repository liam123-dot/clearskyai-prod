import { Card, CardContent } from "@/components/ui/card"
import { getAgents } from "@/lib/vapi/agents"
import { getOrganizations } from "@/lib/organizations"
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { IconRobot } from "@tabler/icons-react"
import { AgentsTableBody } from "./agents-table-body"
import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Agents",
}

export default async function AdminAgentsPage() {
  let organizations: Awaited<ReturnType<typeof getOrganizations>> = []
  let agents: Awaited<ReturnType<typeof getAgents>> = []
  let error: string | null = null

  // Fetch organizations and agents
  try {
    [organizations, agents] = await Promise.all([
      getOrganizations(),
      getAgents()
    ])
  } catch (e) {
    console.error('Error fetching data:', e)
    error = e instanceof Error ? e.message : 'Failed to load data'
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

  if (agents.length === 0) {
    return (
      <div className="px-4 lg:px-6">
        <div className="space-y-6">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconRobot />
              </EmptyMedia>
              <EmptyTitle>No Agents Yet</EmptyTitle>
              <EmptyDescription>
                No VAPI agents found. Create an agent in VAPI to get started.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    )
  }

  const assignedCount = agents.filter(a => a.isAssigned).length
  const unassignedCount = agents.length - assignedCount

  return (
    <div className="px-4 lg:px-6">
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {agents.length} {agents.length === 1 ? 'agent' : 'agents'} 
              {' • '}
              {assignedCount} assigned
              {' • '}
              {unassignedCount} unassigned
            </p>
            <Button>
              <Link href="/admin/agents/create">
                Create Agent
              </Link>
            </Button>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="font-semibold">Agent Name</TableHead>
                  <TableHead className="font-semibold">Model</TableHead>
                  <TableHead className="font-semibold">Organization</TableHead>
                  <TableHead className="font-semibold">Slug</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <AgentsTableBody agents={agents} organizations={organizations} />
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}
