"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { KnowledgeBase } from "@/lib/knowledge-bases"

interface AgentKnowledgeBasesProps {
  slug: string
  agentId: string
  knowledgeBases: (KnowledgeBase & { is_assigned: boolean })[]
}

export function AgentKnowledgeBases({
  slug,
  agentId,
  knowledgeBases,
}: AgentKnowledgeBasesProps) {
  const router = useRouter()
  const [assignments, setAssignments] = useState<Record<string, boolean>>(
    knowledgeBases.reduce((acc, kb) => {
      acc[kb.id] = kb.is_assigned
      return acc
    }, {} as Record<string, boolean>)
  )

  const [loadingStates, setLoadingStates] = useState<
    Record<string, "assigning" | "unassigning" | null>
  >({})

  const handleToggleAssignment = async (
    knowledgeBaseId: string,
    currentlyAssigned: boolean,
    knowledgeBaseName: string
  ) => {
    // Set loading state based on the action we're about to perform
    const action = currentlyAssigned ? "unassigning" : "assigning"
    setLoadingStates((prev) => ({
      ...prev,
      [knowledgeBaseId]: action,
    }))

    try {
      const method = currentlyAssigned ? "DELETE" : "POST"
      const response = await fetch(
        `/api/${slug}/agents/${agentId}/knowledge-bases`,
        {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            knowledge_base_id: knowledgeBaseId,
          }),
        }
      )

      if (!response.ok) {
        throw new Error(
          `Failed to ${currentlyAssigned ? "unassign" : "assign"} knowledge base`
        )
      }

      // Update state after successful API call
      setAssignments((prev) => ({
        ...prev,
        [knowledgeBaseId]: !currentlyAssigned,
      }))

      toast.success(
        currentlyAssigned
          ? `${knowledgeBaseName} removed from agent`
          : `${knowledgeBaseName} assigned to agent`
      )
    } catch (error) {
      console.error("Error toggling knowledge base assignment:", error)
      toast.error(
        `Failed to ${currentlyAssigned ? "remove" : "assign"} knowledge base`
      )
    } finally {
      setLoadingStates((prev) => ({
        ...prev,
        [knowledgeBaseId]: null,
      }))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Knowledge Bases</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Assign knowledge bases to make their information available to this agent
        </p>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Name</TableHead>
              <TableHead className="w-[20%]">Type</TableHead>
              <TableHead className="w-[20%]">Status</TableHead>
              <TableHead className="w-[20%] text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {knowledgeBases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <p className="text-sm">No knowledge bases found</p>
                    <p className="text-xs mt-1">Create a knowledge base to get started</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              knowledgeBases.map((kb) => {
                const isAssigned = assignments[kb.id]
                const loadingState = loadingStates[kb.id]
                const isLoading = loadingState !== null && loadingState !== undefined

                return (
                  <TableRow
                    key={kb.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/${slug}/knowledge-base/${kb.id}`)}
                  >
                    <TableCell className="font-medium">{kb.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {kb.type.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isAssigned ? (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                          Assigned
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Not Assigned</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant={isAssigned ? "outline" : "default"}
                        size="sm"
                        onClick={() =>
                          handleToggleAssignment(kb.id, isAssigned, kb.name)
                        }
                        disabled={isLoading}
                        className="min-w-[100px]"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {loadingState === "assigning" ? "Assigning..." : "Removing..."}
                          </>
                        ) : (
                          isAssigned ? "Remove" : "Assign"
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}