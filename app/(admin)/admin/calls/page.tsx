import { requireAdmin } from "@/app/(admin)/lib/admin-auth"
import { getAllCallsPaginated } from "@/lib/calls"
import { getOrganizations } from "@/lib/organizations"
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
import { AdminCallsTable } from "./admin-calls-table"
import { CallsFilters } from "./calls-filters"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Calls",
}

interface AdminCallsPageProps {
  searchParams: Promise<{ page?: string; org?: string }>
}

export default async function AdminCallsPage({ searchParams }: AdminCallsPageProps) {
  await requireAdmin()

  const params = await searchParams
  const page = parseInt(params.page || '1', 10)
  const organizationId = params.org

  // Fetch organizations for filter dropdown
  let organizations: Awaited<ReturnType<typeof getOrganizations>> = []
  let organizationsError: string | null = null

  try {
    organizations = await getOrganizations()
  } catch (e) {
    console.error('Error fetching organizations:', e)
    organizationsError = e instanceof Error ? e.message : 'Failed to load organizations'
  }

  // Fetch paginated calls
  let callsData: Awaited<ReturnType<typeof getAllCallsPaginated>> = {
    calls: [],
    totalCount: 0,
    totalPages: 0
  }
  let callsError: string | null = null

  try {
    callsData = await getAllCallsPaginated(page, organizationId)
  } catch (e) {
    console.error('Error fetching calls:', e)
    callsError = e instanceof Error ? e.message : 'Failed to load calls'
  }

  if (organizationsError || callsError) {
    return (
      <div className="px-4 lg:px-6">
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">
                {organizationsError || callsError}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (callsData.totalCount === 0) {
    return (
      <div className="px-4 lg:px-6">
        <div className="space-y-6">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconPhoneCall />
              </EmptyMedia>
              <EmptyTitle>No Calls Yet</EmptyTitle>
              <EmptyDescription>
                Call history will appear here once organizations start receiving calls.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 lg:px-6">
      <div className="space-y-6">
        <CallsFilters
          organizations={organizations}
          currentPage={page}
          totalPages={callsData.totalPages}
          totalCount={callsData.totalCount}
        />

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12"></TableHead>
                <TableHead className="font-semibold">Organization</TableHead>
                <TableHead className="font-semibold">Assistant & Time</TableHead>
                <TableHead className="font-semibold">Caller</TableHead>
                <TableHead className="font-semibold">Number Called</TableHead>
                <TableHead className="font-semibold">Duration</TableHead>
                <TableHead className="font-semibold">Routing</TableHead>
              </TableRow>
            </TableHeader>
            <AdminCallsTable calls={callsData.calls} organizations={organizations} />
          </Table>
        </div>
      </div>
    </div>
  )
}