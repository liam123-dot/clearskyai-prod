import { requireAdmin } from "../../lib/admin-auth"
import { getOrganizations } from "@/lib/organizations"
import { getAllTools } from "@/lib/tools"
import { vapiClient } from "@/lib/vapi/VapiClients"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { IconTool } from "@tabler/icons-react"
import { ToolsTableBody } from "./tools-table-body"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Tools",
}

export default async function AdminToolsPage() {
  await requireAdmin()

  let organizations: Awaited<ReturnType<typeof getOrganizations>> = []
  let dbTools: Awaited<ReturnType<typeof getAllTools>> = []
  let vapiTools: any[] = []
  let error: string | null = null

  // Fetch organizations, DB tools, and VAPI tools
  try {
    [organizations, dbTools, vapiTools] = await Promise.all([
      getOrganizations(),
      getAllTools(),
      vapiClient.tools.list()
    ])
  } catch (e) {
    console.error('Error fetching data:', e)
    error = e instanceof Error ? e.message : 'Failed to load data'
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

  // vapi.tools.list() returns an array directly
  const vapiToolsList = vapiTools || []

  // Create a set of external tool IDs from our DB
  const dbToolIds = new Set(dbTools.map((tool) => tool.external_tool_id))

  // Filter VAPI tools to only show ones NOT in our DB
  const unassignedVapiTools = vapiToolsList.filter((tool) => !dbToolIds.has(tool.id))

  // Create a map of external tool IDs to DB tool info for displaying assignments
  const toolAssignments = new Map(
    dbTools.map(tool => [tool.external_tool_id, tool])
  )

  if (dbTools.length === 0 && unassignedVapiTools.length === 0) {
    return (
      <div className="space-y-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconTool />
            </EmptyMedia>
            <EmptyTitle>No Tools Yet</EmptyTitle>
            <EmptyDescription>
              No tools found. Create a tool in VAPI to get started.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="space-y-6">
        {/* Platform Tools (assigned to organizations) */}
        {dbTools.length > 0 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Platform Tools</h2>
              <p className="text-sm text-muted-foreground">
                {dbTools.length} {dbTools.length === 1 ? 'tool' : 'tools'} assigned to organizations
              </p>
            </div>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="font-semibold">Tool Name</TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="font-semibold">Organization</TableHead>
                    <TableHead className="font-semibold">Slug</TableHead>
                  </TableRow>
                </TableHeader>
                <ToolsTableBody 
                  vapiTools={vapiToolsList}
                  dbTools={dbTools}
                  toolAssignments={toolAssignments}
                  organizations={organizations}
                  showOnlyAssigned={true}
                />
              </Table>
            </div>
          </div>
        )}

        {/* Unassigned VAPI Tools */}
        {unassignedVapiTools.length > 0 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Available VAPI Tools</h2>
              <p className="text-sm text-muted-foreground">
                {unassignedVapiTools.length} {unassignedVapiTools.length === 1 ? 'tool' : 'tools'} available to assign
              </p>
            </div>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="font-semibold">Tool Name</TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="font-semibold">Organization</TableHead>
                    <TableHead className="font-semibold">Slug</TableHead>
                  </TableRow>
                </TableHeader>
                <ToolsTableBody 
                  vapiTools={unassignedVapiTools}
                  dbTools={dbTools}
                  toolAssignments={toolAssignments}
                  organizations={organizations}
                  showOnlyAssigned={false}
                />
              </Table>
            </div>
          </div>
        )}
    </div>
  )
}

