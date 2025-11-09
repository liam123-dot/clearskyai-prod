"use client"

import { useState } from "react"
import { KnowledgeBase } from "@/lib/knowledge-bases"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { IconBrain, IconHome, IconTrash, IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface KnowledgeBasesTableProps {
  knowledgeBases: KnowledgeBase[]
  slug: string
}

export function KnowledgeBasesTable({ knowledgeBases, slug }: KnowledgeBasesTableProps) {
  const router = useRouter()
  const [knowledgeBaseToDelete, setKnowledgeBaseToDelete] = useState<KnowledgeBase | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!knowledgeBaseToDelete) return

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/${slug}/knowledge-bases/${knowledgeBaseToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete knowledge base')
      }

      toast.success('Knowledge base deleted successfully')
      
      // Refresh the page to show updated data
      router.refresh()
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred while deleting the knowledge base.'

      toast.error('Failed to delete knowledge base', {
        description: errorMessage,
      })
      console.error(error)
    } finally {
      setIsDeleting(false)
      setKnowledgeBaseToDelete(null)
    }
  }

  return (
    <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold">Type</TableHead>
              <TableHead className="font-semibold">Properties</TableHead>
              <TableHead className="font-semibold">Created</TableHead>
              <TableHead className="font-semibold w-[100px]">Actions</TableHead>
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
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <AlertDialog open={knowledgeBaseToDelete?.id === kb.id} onOpenChange={(open) => !open && setKnowledgeBaseToDelete(null)}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          setKnowledgeBaseToDelete(kb)
                        }}
                        disabled={isDeleting}
                      >
                        {isDeleting && knowledgeBaseToDelete?.id === kb.id ? (
                          <IconLoader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <IconTrash className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the knowledge base &quot;{kb.name}&quot;. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground"
                          disabled={isDeleting}
                        >
                          {isDeleting ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
  )
}

