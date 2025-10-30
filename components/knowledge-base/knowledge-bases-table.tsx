"use client"

import { KnowledgeBase } from "@/lib/knowledge-bases"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { IconBrain, IconHome } from "@tabler/icons-react"

interface KnowledgeBasesTableProps {
  knowledgeBases: KnowledgeBase[]
  slug: string
}

export function KnowledgeBasesTable({ knowledgeBases, slug }: KnowledgeBasesTableProps) {
  const router = useRouter()

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-semibold">Name</TableHead>
            <TableHead className="font-semibold">Type</TableHead>
            <TableHead className="font-semibold">Properties</TableHead>
            <TableHead className="font-semibold">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {knowledgeBases.map((kb) => (
            <TableRow
              key={kb.id}
              className="cursor-pointer"
              onClick={() => router.push(`/${slug}/knowledge-base/${kb.id}`)}
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {kb.type === 'estate_agent' ? (
                    <IconHome className="size-5 text-primary" />
                  ) : (
                    <IconBrain className="size-5 text-primary" />
                  )}
                  {kb.name}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={kb.type === 'estate_agent' ? 'default' : 'secondary'}>
                  {kb.type === 'estate_agent' ? 'Estate Agent' : 'General'}
                </Badge>
              </TableCell>
              <TableCell>
                {kb.type === 'estate_agent' && kb.data && typeof kb.data === 'object' && (() => {
                  const forSaleUrl = 'for_sale_url' in kb.data && typeof kb.data.for_sale_url === 'string' ? kb.data.for_sale_url : null
                  const rentalUrl = 'rental_url' in kb.data && typeof kb.data.rental_url === 'string' ? kb.data.rental_url : null
                  const resyncSchedule = 'resync_schedule' in kb.data && typeof kb.data.resync_schedule === 'string' ? kb.data.resync_schedule : null
                  
                  if (!forSaleUrl && !rentalUrl) {
                    return <span className="text-muted-foreground text-sm">—</span>
                  }
                  
                  return (
                    <div className="flex flex-wrap gap-1">
                      {forSaleUrl && (
                        <Badge variant="outline" className="text-xs">For Sale</Badge>
                      )}
                      {rentalUrl && (
                        <Badge variant="outline" className="text-xs">Rental</Badge>
                      )}
                      {resyncSchedule && resyncSchedule !== 'none' && (
                        <Badge variant="outline" className="text-xs">
                          {resyncSchedule.replace('_', ' ')}
                        </Badge>
                      )}
                    </div>
                  )
                })()}
                {kb.type !== 'estate_agent' && (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatDistanceToNow(new Date(kb.created_at), { addSuffix: true })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

