import { getCallsByOrganization } from "@/lib/calls"
import { createServiceClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
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
import { IconPhoneCall } from "@tabler/icons-react"
import { CallsTable } from "./calls-table"
import { getAuthSession } from "@/lib/auth"
import type { Metadata } from "next"

interface CallsPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: CallsPageProps): Promise<Metadata> {
  return {
    title: "Calls",
  }
}

export default async function CallsPage({ params }: CallsPageProps) {
  const { slug } = await params

  const {organizationId, organisation} = await getAuthSession(slug);

  // Get calls for this organization
  let calls: Awaited<ReturnType<typeof getCallsByOrganization>> = []
  let error: string | null = null

  try {
    calls = await getCallsByOrganization(organizationId)
  } catch (e) {
    console.error('Error fetching calls:', e)
    error = e instanceof Error ? e.message : 'Failed to load calls'
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

  if (calls.length === 0) {
    return (
      <div className="space-y-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconPhoneCall />
            </EmptyMedia>
            <EmptyTitle>No Calls Yet</EmptyTitle>
            <EmptyDescription>
              Your call history will appear here once you start receiving calls.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="space-y-6">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {calls.length} {calls.length === 1 ? 'call' : 'calls'}
          </p>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="font-semibold">Assistant & Time</TableHead>
                  <TableHead className="font-semibold">Caller</TableHead>
                  <TableHead className="font-semibold">Number Called</TableHead>
                  <TableHead className="font-semibold">Duration</TableHead>
                  <TableHead className="font-semibold">Routing</TableHead>
                </TableRow>
              </TableHeader>
              <CallsTable calls={calls} />
            </Table>
          </div>
        </div>
    </div>
  )
}