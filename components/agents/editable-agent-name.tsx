"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface EditableAgentNameProps {
  agentId: string
  slug: string
  initialName: string
  className?: string
  variant?: "h1" | "text"
}

export function EditableAgentName({
  agentId,
  slug,
  initialName,
  className = "",
  variant = "h1",
}: EditableAgentNameProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(initialName)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // Update local state when initialName changes (e.g., after refresh)
  useEffect(() => {
    setName(initialName)
  }, [initialName])

  const handleSave = async () => {
    const trimmedName = name.trim()
    
    if (!trimmedName) {
      toast.error("Agent name cannot be empty")
      setName(initialName)
      setIsEditing(false)
      return
    }

    if (trimmedName === initialName) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/${slug}/agents/${agentId}/name`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmedName }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update agent name")
      }

      toast.success("Agent name updated")
      setIsEditing(false)
      router.refresh() // Refresh to get updated name from server
    } catch (error) {
      console.error("Error updating agent name:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update agent name")
      setName(initialName) // Revert to original name on error
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setName(initialName)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSave()
    } else if (e.key === "Escape") {
      e.preventDefault()
      handleCancel()
    }
  }

  if (isEditing) {
    return (
      <div 
        className="flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <Input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          disabled={isSaving}
          className={`${variant === "h1" ? "text-3xl font-bold h-auto py-1" : ""} ${className}`}
        />
        {isSaving && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
    )
  }

  const Component = variant === "h1" ? "h1" : "span"
  
  return (
    <Component
      className={`${variant === "h1" ? "text-3xl font-bold tracking-tight" : ""} ${className} cursor-pointer hover:opacity-80 transition-opacity`}
      onClick={(e) => {
        e.stopPropagation()
        setIsEditing(true)
      }}
      title="Click to edit name"
    >
      {name || "Unnamed Agent"}
    </Component>
  )
}

