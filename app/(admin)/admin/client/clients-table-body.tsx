"use client"

import { TableBody, TableCell, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { IconExternalLink, IconBuilding } from "@tabler/icons-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface ClientsTableBodyProps {
  organizations: Array<{
    id: string
    external_id: string
    name: string
    createdAt: string
    updatedAt: string
    slug: string
  }>
  baseUrl: string
}

export function ClientsTableBody({ organizations, baseUrl }: ClientsTableBodyProps) {
  const router = useRouter()
  return (
    <TableBody>
      {organizations.map((org) => (
        <TableRow key={org.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/admin/client/${org.slug}`)}>
          <TableCell>
            <div className="flex items-center justify-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <IconBuilding className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </TableCell>
          <TableCell className="font-medium">{org.name}</TableCell>
          <TableCell className="text-muted-foreground">
            {new Date(org.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })}
          </TableCell>
          <TableCell className="text-right">
            <Button
              variant="ghost"
              size="sm"
              asChild
            >
              <Link 
                href={`${baseUrl}/${org.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  )
}

