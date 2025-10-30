"use client"

import { useState } from "react"
import { toast } from "sonner"
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
  const [assignments, setAssignments] = useState<Record<string, boolean>>(
    knowledgeBases.reduce((acc, kb) => {
      acc[kb.id] = kb.is_assigned
      return acc
    }, {} as Record<string, boolean>)
  )

  const [loading, setLoading] = useState<Record<string, boolean>>({})

  const handleToggleAssignment = async (
    knowledgeBaseId: string,
    isAssigned: boolean,
    knowledgeBaseName: string
  ) => {
    const previousValue = assignments[knowledgeBaseId]

    // Optimistically update UI
    setAssignments((prev) => ({
      ...prev,
      [knowledgeBaseId]: !isAssigned,
    }))

    setLoading((prev) => ({
      ...prev,
      [knowledgeBaseId]: true,
    }))

    try {
      const method = isAssigned ? "DELETE" : "POST"
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
          `Failed to ${isAssigned ? "unassign" : "assign"} knowledge base`
        )
      }

      toast.success(
        isAssigned
          ? `${knowledgeBaseName} unassigned from agent`
          : `${knowledgeBaseName} assigned to agent`
      )
    } catch (error) {
      console.error("Error toggling knowledge base assignment:", error)
      // Revert on error
      setAssignments((prev) => ({
        ...prev,
        [knowledgeBaseId]: previousValue,
      }))
      toast.error(
        `Failed to ${isAssigned ? "unassign" : "assign"} knowledge base`
      )
    } finally {
      setLoading((prev) => ({
        ...prev,
        [knowledgeBaseId]: false,
      }))
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Knowledge Bases</h2>
        <p className="text-sm text-muted-foreground">
          Manage which knowledge bases are assigned to this agent
        </p>
      </div>
      
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {knowledgeBases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <div className="text-muted-foreground">
                    No knowledge bases found for this organization
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              knowledgeBases.map((kb) => {
                const isAssigned = assignments[kb.id]
                const isLoading = loading[kb.id]

                return (
                  <TableRow key={kb.id}>
                    <TableCell className="font-medium">{kb.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {kb.type.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isAssigned ? (
                        <Badge variant="default">Assigned</Badge>
                      ) : (
                        <Badge variant="secondary">Not Assigned</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isAssigned ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            handleToggleAssignment(kb.id, isAssigned, kb.name)
                          }
                          disabled={isLoading}
                        >
                          {isLoading ? "Unassigning..." : "De-assign"}
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() =>
                            handleToggleAssignment(kb.id, isAssigned, kb.name)
                          }
                          disabled={isLoading}
                        >
                          {isLoading ? "Assigning..." : "Assign"}
                        </Button>
                      )}
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