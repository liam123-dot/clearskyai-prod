"use client"

import { type AssignedAgent } from "@/lib/vapi/agents"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { IconRobot } from "@tabler/icons-react"

interface AgentsTableProps {
  agents: AssignedAgent[]
  slug: string
}

export function AgentsTable({ agents, slug }: AgentsTableProps) {
  const router = useRouter()

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-semibold">Name</TableHead>
            <TableHead className="font-semibold">Model</TableHead>
            <TableHead className="font-semibold">Provider</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((agent) => (
            <TableRow
              key={agent.id}
              className="cursor-pointer"
              onClick={() => router.push(`/${slug}/agents/${agent.id}`)}
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <div className="bg-muted flex size-8 items-center justify-center rounded-md">
                    <IconRobot className="text-muted-foreground size-4" />
                  </div>
                  {agent.vapiAssistant.name}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {agent.vapiAssistant.model?.model || '—'}
              </TableCell>
              <TableCell>
                {agent.vapiAssistant.model?.provider ? (
                  <Badge variant="outline" className="text-muted-foreground">
                    {agent.vapiAssistant.model.provider}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="font-normal">
                  Active
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {agent.created_at ? formatDistanceToNow(new Date(agent.created_at), { addSuffix: true }) : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

