import { Card, CardContent } from "@/components/ui/card"
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
import { IconBuilding } from "@tabler/icons-react"
import { ClientsTableBody } from "./clients-table-body"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Clients",
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL

export default async function AdminClientPage() {
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

  if (organizations.length === 0) {
    return (
      <div className="px-4 lg:px-6">
        <div className="space-y-6">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconBuilding />
              </EmptyMedia>
              <EmptyTitle>No Clients Yet</EmptyTitle>
              <EmptyDescription>
                No organizations found.
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
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {organizations.length} {organizations.length === 1 ? 'client' : 'clients'}
          </p>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Created</TableHead>
                  <TableHead className="text-right font-semibold w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <ClientsTableBody organizations={organizations} baseUrl={baseUrl || ''} />
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}